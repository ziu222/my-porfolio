import { useEffect, useRef, useState } from "react";

import { ambient } from "@/lib/ambient";
import { reducedMotion } from "@/lib/motion";

const easeIn = (v: number) => v * v * v;
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const TAU = Math.PI * 2;
// 33 1/3 rpm: one revolution every 1.8 s
const RPM33 = TAU / 1800;

type Planet = { a: number; r: number; size: number; rgb: string; ring: boolean };

// three tilted orbits around the record, drawn one after another as loading progresses
const ORBITS = [
  { tilt: -0.4, scale: 1.32, rgb: "255,122,147", start: 0, speed: 1 },
  { tilt: 0.65, scale: 1.46, rgb: "244,239,230", start: 0.18, speed: -0.7 },
  { tilt: 1.7, scale: 1.6, rgb: "255,217,168", start: 0.36, speed: 0.5 },
];

/**
 * Intro: a turntable whose record is a galaxy. The record spins up to 33 1/3 rpm while real
 * assets (fonts, first hero frame) load and three tilted orbits draw themselves around it as
 * progress. At 100% the tonearm drops onto the outer groove, then the view dives into the record.
 */
export function Loader({ poster }: { poster: string }) {
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pct = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = reducedMotion();
    el.classList.add("is-live"); // hydrated: the CSS no-JS failsafe is no longer needed
    document.documentElement.style.overflow = "hidden";

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const sky = Array.from({ length: 240 }, () => ({ a: Math.random() * TAU, r: Math.random() ** 0.6, s: 0.4 + Math.random(), o: 0.15 + Math.random() * 0.5 }));
    const discStars = Array.from({ length: 220 }, () => ({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.67, s: 0.3 + Math.random() * 0.9, o: 0.3 + Math.random() * 0.7 }));
    const nebulae = [
      { a: 0.6, r: 0.62, size: 0.42, rgb: "120,90,200" },
      { a: 2.7, r: 0.7, size: 0.38, rgb: "70,90,190" },
      { a: 4.4, r: 0.55, size: 0.34, rgb: "200,90,150" },
    ];
    const palette = ["201,122,98", "132,168,176", "176,150,196", "214,190,140", "150,110,120", "120,150,120", "230,200,120"];
    const planets: Planet[] = Array.from({ length: 11 }, (_, i) => ({
      a: Math.random() * TAU,
      r: 0.36 + (i / 11) * 0.58,
      size: 0.012 + Math.random() * 0.016,
      rgb: palette[i % palette.length],
      ring: i % 4 === 1,
    }));

    const tasks: Promise<unknown>[] = [
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((done) => {
        const img = new Image();
        img.onload = img.onerror = () => done();
        img.src = poster;
      }),
    ];
    let finished = 0;
    tasks.forEach((t) => void t.finally(() => { finished++; }));

    const start = performance.now();
    const minTime = reduce ? 500 : 2300;
    let shown = 0, spin = 0, last = start, raf = 0, leaveTimer = 0, isReady = false;
    let warpAt = 0, armAt = 0;
    let armPlay = 0; // tonearm angle that lands the stylus on the outer groove

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const elapsed = now - start;
      const loaded = finished / tasks.length;
      let target = Math.min(elapsed / minTime, 0.15 + 0.85 * loaded);
      if (elapsed > 6000) target = 1;
      shown += (target - shown) * (reduce ? 0.3 : 0.07);
      if (target === 1 && shown > 0.996) shown = 1;
      const k = warpAt ? easeIn(Math.min(1, (now - warpAt) / 800)) : 0;
      if (!reduce) spin += dt * RPM33 * (0.12 + 0.88 * easeOut(shown)) * (1 + k * 3);

      const cx = W / 2, cy = H * 0.44;
      const R = Math.min(W * 0.34, H * 0.3);
      ctx.clearRect(0, 0, W, H);

      // sky; at warp every star streaks outward
      const reach = Math.hypot(W, H) * 0.6;
      for (const s of sky) {
        const d = s.r * reach * (1 + k * 1.8);
        const x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d;
        const len = k * 110 * s.r + 0.01;
        ctx.strokeStyle = `rgba(244,239,230,${Math.min(1, s.o + k * 0.5).toFixed(3)})`;
        ctx.lineWidth = s.s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(s.a) * len, y - Math.sin(s.a) * len); ctx.stroke();
      }

      // orbits: a flattened circle rotated in the screen plane; the half with negative depth
      // is behind the record, so each ring is drawn in two passes around the disc
      const orbitDrift = reduce ? 0 : now * 0.00008;
      const drawOrbits = (front: boolean) => {
        for (const o of ORBITS) {
          const p = reduce ? 1 : Math.min(1, Math.max(0, (shown - o.start) / 0.62));
          const rot = o.tilt + orbitDrift * o.speed;
          const cos = Math.cos(rot), sin = Math.sin(rot);
          const Rr = R * o.scale * (1 + k * 4);
          const pt = (t: number) => {
            const ex = Math.cos(t) * Rr, ey = Math.sin(t) * Rr * 0.26;
            return { x: cx + ex * cos - ey * sin, y: cy + ex * sin + ey * cos, depth: Math.sin(t) };
          };
          const alpha = 1 - k;
          ctx.lineCap = "round";
          // faint full track, then the drawn progress on top
          for (const [upto, rgba, lw] of [
            [1, `rgba(244,239,230,${(0.07 * alpha).toFixed(3)})`, 1],
            [p, `rgba(${o.rgb},${(0.85 * alpha).toFixed(3)})`, 1.6],
          ] as const) {
            if (upto <= 0) continue;
            ctx.strokeStyle = rgba;
            ctx.lineWidth = lw;
            ctx.beginPath();
            let pen = false;
            const steps = Math.ceil(120 * upto);
            for (let i = 0; i <= steps; i++) {
              const q = pt((i / steps) * upto * TAU);
              if (q.depth > 0 === front) { if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; } }
              else pen = false;
            }
            ctx.stroke();
          }
          if (p > 0) {
            const t = p * TAU + (p === 1 ? orbitDrift * 12 * o.speed : 0);
            const head = pt(t);
            if (head.depth > 0 === front) {
              const hr = 4 + (head.depth + 1) * 1.5;
              const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, hr * 3);
              g.addColorStop(0, `rgba(${o.rgb},${(0.9 * alpha).toFixed(3)})`);
              g.addColorStop(1, `rgba(${o.rgb},0)`);
              ctx.fillStyle = g;
              ctx.beginPath(); ctx.arc(head.x, head.y, hr * 3, 0, TAU); ctx.fill();
              ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
              ctx.beginPath(); ctx.arc(head.x, head.y, hr * 0.6, 0, TAU); ctx.fill();
            }
          }
        }
      };
      drawOrbits(false);

      // the record; entering flies into it
      const r = R * (1 + k * 6);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = 1 - k * 0.85;

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.arc(0, r * 0.03, r * 1.03, 0, TAU); ctx.fill();
      const disc = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      disc.addColorStop(0, "#1f2352");
      disc.addColorStop(0.7, "#11143a");
      disc.addColorStop(1, "#090a22");
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

      ctx.save();
      ctx.rotate(spin);
      for (const n of nebulae) {
        const x = Math.cos(n.a) * n.r * r, y = Math.sin(n.a) * n.r * r;
        const g = ctx.createRadialGradient(x, y, 0, x, y, n.size * r);
        g.addColorStop(0, `rgba(${n.rgb},0.28)`);
        g.addColorStop(1, `rgba(${n.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, n.size * r, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${i % 6 === 0 ? 0.07 : 0.03})`;
        ctx.beginPath(); ctx.arc(0, 0, r * (0.3 + i * 0.0225), 0, TAU); ctx.stroke();
      }
      for (const s of discStars) {
        ctx.fillStyle = `rgba(255,255,255,${s.o.toFixed(2)})`;
        ctx.fillRect(Math.cos(s.a) * s.r * r, Math.sin(s.a) * s.r * r, s.s, s.s);
      }
      for (const p of planets) {
        const x = Math.cos(p.a) * p.r * r, y = Math.sin(p.a) * p.r * r, pr = p.size * r;
        const body = ctx.createRadialGradient(x - pr * 0.4, y - pr * 0.4, pr * 0.1, x, y, pr);
        body.addColorStop(0, `rgba(${p.rgb},1)`);
        body.addColorStop(1, "rgba(15,14,30,1)");
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
        if (p.ring) {
          ctx.strokeStyle = `rgba(${p.rgb},0.7)`;
          ctx.beginPath(); ctx.ellipse(x, y, pr * 2.1, pr * 0.7, p.a + 0.5, 0, TAU); ctx.stroke();
        }
      }
      // label: rotates with the record; the rose mark shows the spin
      ctx.fillStyle = "#ece5d3";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(70,60,50,0.35)";
      for (const rr of [0.17, 0.155]) { ctx.beginPath(); ctx.arc(0, 0, r * rr, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = "#ff7a93";
      ctx.beginPath(); ctx.arc(r * 0.12, 0, r * 0.018, 0, TAU); ctx.fill();
      ctx.restore();

      // static sheen: light catching the grooves does not turn with the disc
      const sheen = ctx.createLinearGradient(-r, -r, r, r);
      sheen.addColorStop(0.3, "rgba(255,255,255,0)");
      sheen.addColorStop(0.45, "rgba(255,255,255,0.07)");
      sheen.addColorStop(0.55, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(0, 0, r * 0.2, 0, TAU, true); ctx.fill();
      ctx.fillStyle = "#07060c";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.012, 0, TAU); ctx.fill();

      ctx.restore();
      drawOrbits(true);

      // tonearm: pivots off the top-right; swings onto the outer groove when sound is chosen
      const px = cx + R * 1.18, py = cy - R * 0.98, L = R * 1.2;
      if (!armPlay) {
        let best = 0, err = Infinity;
        for (let a = 0; a < 1.4; a += 0.005) {
          const tx = px - L * Math.sin(a), ty = py + L * Math.cos(a);
          const e = Math.abs(Math.hypot(tx - cx, ty - cy) - R * 0.9);
          if (e < err) { err = e; best = a; }
        }
        armPlay = best;
      }
      const armT = armAt ? (reduce ? 1 : easeOut(Math.min(1, (now - armAt) / 520))) : 0;
      const ang = armT * armPlay;
      const tx = px - L * Math.sin(ang), ty = py + L * Math.cos(ang);
      ctx.globalAlpha = 1 - k;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(10,9,16,0.7)";
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(px + 3, py + 4); ctx.lineTo(tx + 3, ty + 4); ctx.stroke();
      ctx.strokeStyle = "#cfc8bc";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      ctx.fillStyle = "#e9e3d6";
      ctx.fillRect(-9, -4, 18, 16);
      ctx.fillStyle = "#ff7a93";
      ctx.fillRect(-2, 10, 4, 4);
      ctx.restore();
      // counterweight behind the pivot, on the arm's axis
      const cwx = px + Math.sin(ang) * 30, cwy = py - Math.cos(ang) * 30;
      ctx.strokeStyle = "#8d877e";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cwx, cwy); ctx.stroke();
      ctx.fillStyle = "#2a2831";
      ctx.beginPath(); ctx.arc(cwx, cwy, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(207,200,188,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cwx, cwy, 11, 0, TAU); ctx.stroke();
      const base = ctx.createRadialGradient(px - 6, py - 6, 2, px, py, 22);
      base.addColorStop(0, "#56525e");
      base.addColorStop(1, "#1d1b24");
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(px, py, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = "#cfc8bc";
      ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;

      if (pct.current) pct.current.textContent = String(Math.round(shown * 100)).padStart(2, "0");
      if (shown === 1 && !isReady) {
        isReady = true;
        enter();
      }
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Loaded: the needle drops, the music is armed (it becomes audible on the visitor's first
    // click or key, as browsers require), then the dive into the record.
    const enter = () => {
      ambient.autoStart();
      document.documentElement.style.overflow = "";
      document.documentElement.dataset.ready = "";
      el.classList.add("is-entering");
      if (reduce) {
        el.classList.add("is-leaving");
        leaveTimer = window.setTimeout(() => setGone(true), 500);
        return;
      }
      armAt = performance.now();
      window.setTimeout(() => { warpAt = performance.now(); }, 620);
      window.setTimeout(() => el.classList.add("is-leaving"), 1240);
      leaveTimer = window.setTimeout(() => setGone(true), 1240 + 1150);
    };

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leaveTimer);
      window.removeEventListener("resize", resize);
      document.documentElement.style.overflow = "";
    };
  }, [poster]);

  if (gone) return null;
  return (
    <div className="ng-loader" ref={root} role="status">
      <canvas ref={canvasRef} className="ng-loader-canvas" aria-hidden="true" />
      <div className="ng-loader-ui">
        <span className="ng-loader-pct" aria-hidden="true">
          <span ref={pct}>00</span>
          <small>%</small>
        </span>
        <span className="ng-sr">Loading</span>
      </div>
    </div>
  );
}
