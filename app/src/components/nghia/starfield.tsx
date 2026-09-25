import { useEffect, useRef } from "react";

import { reducedMotion } from "@/lib/motion";

/**
 * Fixed full-screen starfield behind the content sections: three depth layers
 * drift slowly, twinkle, shift with scroll (parallax), and an occasional
 * shooting star crosses the sky.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = reducedMotion();
    let W = 0, H = 0, dpr = 1;
    type Star = { x: number; y: number; z: number; r: number; tw: number; ph: number; c: string };
    let stars: Star[] = [];
    const palette = ["244,239,230", "244,239,230", "244,239,230", "255,179,194", "200,162,176"];

    const build = () => {
      const count = Math.round((W * H) / 5200);
      stars = Array.from({ length: count }, () => {
        const z = Math.random();
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          z,
          r: 0.35 + z * 1.25,
          tw: 0.6 + Math.random() * 1.8,
          ph: Math.random() * Math.PI * 2,
          c: palette[(Math.random() * palette.length) | 0],
        };
      });
    };
    const resize = () => {
      // stars are sub-pixel dots; 1.5x keeps them crisp at ~44% less fill than 2x on retina
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduce) draw(0);
    };

    type Shoot = { x: number; y: number; vx: number; vy: number; life: number; speed: number; tail: number };
    let shoots: Shoot[] = [];
    let nextShoot = 1400;

    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);
      const scroll = window.scrollY;
      for (const s of stars) {
        const drift = reduce ? 0 : t * 0.004 * (0.3 + s.z);
        const py = ((s.y - scroll * (0.04 + s.z * 0.12) - drift) % H + H) % H;
        const px = (s.x + (reduce ? 0 : t * 0.0015 * s.z)) % W;
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.tw + s.ph));
        ctx!.fillStyle = `rgba(${s.c},${(a * (0.4 + s.z * 0.6)).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(px, py, s.r, 0, Math.PI * 2);
        ctx!.fill();
        if (s.z > 0.93) {
          const g = ctx!.createRadialGradient(px, py, 0, px, py, s.r * 6);
          g.addColorStop(0, `rgba(${s.c},${(a * 0.25).toFixed(3)})`);
          g.addColorStop(1, `rgba(${s.c},0)`);
          ctx!.fillStyle = g;
          ctx!.fillRect(px - s.r * 6, py - s.r * 6, s.r * 12, s.r * 12);
        }
      }
      for (const shoot of shoots) {
        const tail = shoot.tail;
        const grad = ctx!.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail);
        grad.addColorStop(0, `rgba(255,214,222,${shoot.life.toFixed(3)})`);
        grad.addColorStop(1, "rgba(255,122,147,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 2.2;
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(shoot.x, shoot.y);
        ctx!.lineTo(shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail);
        ctx!.stroke();
        const head = ctx!.createRadialGradient(shoot.x, shoot.y, 0, shoot.x, shoot.y, 10);
        head.addColorStop(0, `rgba(255,255,255,${shoot.life.toFixed(3)})`);
        head.addColorStop(1, "rgba(255,179,194,0)");
        ctx!.fillStyle = head;
        ctx!.beginPath();
        ctx!.arc(shoot.x, shoot.y, 10, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let raf = 0, last = 0;
    const loop = (t: number) => {
      const dt = last ? t - last : 16;
      last = t;
      if (!document.hidden) {
        nextShoot -= dt;
        if (nextShoot <= 0) {
          // one meteor, or now and then a pair on near-parallel paths
          const ang = 0.3 + Math.random() * 0.4;
          const x = Math.random() * W * 0.7 + W * 0.25, y = Math.random() * H * 0.4;
          const count = Math.random() < 0.22 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            const a = ang + i * 0.04;
            shoots.push({ x: x + i * 90, y: y + i * 40, vx: -Math.cos(a), vy: Math.sin(a), life: 1, speed: 1.1 + Math.random() * 0.6, tail: 120 + Math.random() * 90 });
          }
          nextShoot = 2400 + Math.random() * 4200;
        }
        for (const s of shoots) {
          s.x += s.vx * dt * s.speed;
          s.y += s.vy * dt * s.speed;
          s.life -= dt / 1100;
        }
        shoots = shoots.filter((s) => s.life > 0);
        // the opaque scroll-scrub journey sits above this canvas; skip painting while it fills the screen
        const cover = document.querySelector(".scroll-scrub");
        if (!cover || cover.getBoundingClientRect().bottom < H) draw(t);
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) {
      const onScroll = () => draw(0);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
      };
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="ng-starfield" aria-hidden="true" />;
}
