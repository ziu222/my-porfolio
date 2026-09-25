import { useEffect, useRef } from "react";

import { reducedMotion } from "@/lib/motion";

/**
 * Star dust in the contact section that leans toward the pointer and drifts home when it
 * leaves. Mouse-only, paused offscreen, and off under reduced motion.
 */
export function ContactDust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const host = canvas.parentElement!;
    const ctx = canvas.getContext("2d");
    if (!ctx || reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let W = 0, H = 0;
    type Mote = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; r: number; a: number };
    let motes: Mote[] = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = host.clientWidth; H = host.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: Math.round((W * H) / 9000) }, () => {
        const x = Math.random() * W, y = Math.random() * H;
        return { hx: x, hy: y, x, y, vx: 0, vy: 0, r: 0.6 + Math.random() * 1.4, a: 0.25 + Math.random() * 0.5 };
      });
    };

    let px = -1e4, py = -1e4, raf = 0, visible = false;
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      for (const m of motes) {
        const dx = px - m.x, dy = py - m.y, d = Math.hypot(dx, dy);
        if (d < 240 && d > 1) {
          const pull = (1 - d / 240) * 0.09;
          m.vx += (dx / d) * pull; m.vy += (dy / d) * pull;
        }
        m.vx += (m.hx - m.x) * 0.0035; m.vy += (m.hy - m.y) * 0.0035;
        m.vx *= 0.93; m.vy *= 0.93;
        m.x += m.vx; m.y += m.vy;
        const glow = d < 240 ? 1 - d / 240 : 0;
        ctx.fillStyle = `rgba(255,${(214 - glow * 60) | 0},${(222 - glow * 60) | 0},${Math.min(1, m.a + glow * 0.6).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r + glow * 1.2, 0, Math.PI * 2); ctx.fill();
      }
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
    };
    const onLeave = () => { px = py = -1e4; };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    const ro = new ResizeObserver(resize);
    ro.observe(host); io.observe(host);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="ng-dust" aria-hidden="true" />;
}
