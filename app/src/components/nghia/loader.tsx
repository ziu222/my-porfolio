import { useEffect, useRef, useState } from "react";

import { ambient } from "@/lib/ambient";
import { reducedMotion } from "@/lib/motion";

import { Nova, type NovaMood } from "./nova";

const easeIn = (v: number) => v * v * v;
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const TAU = Math.PI * 2;
// Nova glides to the headshell before the needle drops
const NOVA_REACH = 380;
// 33 1/3 rpm: one revolution every 1.8 s
const RPM33 = TAU / 1800;

type Planet = { a: number; r: number; size: number; rgb: string; ring: boolean };

// two tilted rose orbits around the record, drawn as loading progresses; the record is the
// subject, so they stay secondary and differ only in opacity
const ORBIT_RGB = "255,122,147";
const ORBITS = [
  { tilt: -0.4, scale: 1.3, op: 0.75, start: 0, speed: 1 },
  { tilt: 0.65, scale: 1.44, op: 0.35, start: 0.22, speed: -0.7 },
];

// the owner's signature: a slanted cursive "n" with a looping underline flourish, as knots of a
// Catmull-Rom curve in a unit box (y down), sampled once into a polyline the label signs live
const SIG_KNOTS = [
  [-0.98, 0.26], [-0.7, 0.06], [-0.5, -0.26], [-0.47, -0.08], [-0.54, 0.36], [-0.46, 0.06], [-0.26, -0.26],
  [-0.04, -0.33], [0.1, -0.14], [0.06, 0.18], [0.16, 0.36], [0.42, 0.26], [0.74, -0.12], [0.96, -0.44],
  [1.04, -0.3], [0.82, 0.22], [0.36, 0.5], [-0.3, 0.56], [-0.86, 0.46],
].map(([x, y]) => [x - y * 0.22 - 0.04, y]);
const SIG: number[][] = [];
for (let i = 0; i < SIG_KNOTS.length - 1; i++) {
  const K = (j: number) => SIG_KNOTS[Math.max(0, Math.min(SIG_KNOTS.length - 1, j))];
  const [p0, p1, p2, p3] = [K(i - 1), K(i), K(i + 1), K(i + 2)];
  for (let s = 0; s < 14; s++) {
    const t = s / 14, t2 = t * t, t3 = t2 * t;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
    SIG.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
}
SIG.push(SIG_KNOTS[SIG_KNOTS.length - 1]);

// the site as an album: the label's rim and the dead wax around it
const LABEL_TOP = "SIDE A · PORTFOLIO · 2026";
const LABEL_BOTTOM = "33⅓ RPM · STEREO";
const TRACKLIST = "01 LAUNCH · 02 STAR MAP · 03 CREW · 04 SIGNAL · ";

// the boot log under the record, in step with progress
const BOOT = [
  "pressing side A",
  "mounting kafka topics",
  "warming pgvector",
  "spinning up 8 services",
  "tuning to 33⅓ rpm",
  "cleared for launch",
];

// letters set along a circle; the bottom arc runs the other way so it still reads left to right
function arcText(g: CanvasRenderingContext2D, text: string, rad: number, mid: number, bottom: boolean, spacing = 0) {
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let acc = 0;
  chars.forEach((c, i) => {
    const a = bottom ? mid + (total / 2 - acc - widths[i] / 2) / rad : mid - (total / 2 - acc - widths[i] / 2) / rad;
    g.save();
    g.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    g.fillText(c, 0, bottom ? rad : -rad);
    g.restore();
    acc += widths[i];
  });
}

/**
 * Intro: the site as a record. A galaxy pressed into vinyl spins up to 33 1/3 rpm while real
 * assets (fonts, first hero frame) load; the label signs itself, two orbits draw around it and a
 * boot log ticks by. At 100% Nova drops the needle onto the outer groove, then the view dives in.
 */
export function Loader({ poster }: { poster: string }) {
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const log = useRef<HTMLSpanElement>(null);
  const novaBox = useRef<HTMLDivElement>(null);
  const [novaMood, setNovaMood] = useState<NovaMood>("idle");

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
    const discStars = Array.from({ length: 220 }, () => ({ a: Math.random() * TAU, r: 0.38 + Math.random() * 0.59, s: 0.3 + Math.random() * 0.9, o: 0.3 + Math.random() * 0.7 }));
    const nebulae = [
      { a: 0.6, r: 0.62, size: 0.42, rgb: "120,90,200" },
      { a: 2.7, r: 0.7, size: 0.38, rgb: "70,90,190" },
      { a: 4.4, r: 0.55, size: 0.34, rgb: "200,90,150" },
    ];
    const palette = ["201,122,98", "132,168,176", "176,150,196", "214,190,140", "150,110,120", "120,150,120", "230,200,120"];
    const planets: Planet[] = Array.from({ length: 11 }, (_, i) => ({
      a: Math.random() * TAU,
      r: 0.42 + (i / 11) * 0.52,
      size: 0.012 + Math.random() * 0.016,
      rgb: palette[i % palette.length],
      ring: i % 4 === 1,
    }));

    // the printed label and the dead-wax tracklist never change, so they are drawn once per size
    // into a sprite that simply turns with the record; the signature is inked live on top
    const label = document.createElement("canvas");
    let labelFor = 0;
    const paintLabel = (R: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const half = R * 0.37;
      label.width = label.height = Math.ceil(half * 2 * dpr);
      const g = label.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
      g.fillStyle = "#ece5d3";
      g.beginPath(); g.arc(0, 0, R * 0.3, 0, TAU); g.fill();
      g.strokeStyle = "rgba(58,26,63,0.22)";
      g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, R * 0.285, 0, TAU); g.stroke();
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(58,26,63,0.62)";
      g.font = `600 ${Math.max(5, R * 0.03)}px "Be Vietnam Pro", system-ui, sans-serif`;
      arcText(g, LABEL_TOP, R * 0.25, -Math.PI / 2, false, R * 0.008);
      arcText(g, LABEL_BOTTOM, R * 0.25, Math.PI / 2, true, R * 0.008);
      // tracklist pressed into the dead wax, letter-spaced to close the circle
      g.fillStyle = "rgba(236,229,211,0.42)";
      g.font = `500 ${Math.max(4, R * 0.028)}px "Be Vietnam Pro", system-ui, sans-serif`;
      const rad = R * 0.335, chars = [...TRACKLIST];
      const bare = chars.reduce((a, c) => a + g.measureText(c).width, 0);
      arcText(g, TRACKLIST, rad, -Math.PI / 2, false, Math.max(0, (TAU * rad - bare) / chars.length));
      labelFor = R;
    };

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
    void tasks[0].then(() => { labelFor = 0; }); // repaint the label once the webfont is in

    const start = performance.now();
    const minTime = reduce ? 500 : 2300;
    let shown = 0, spin = 0, last = start, raf = 0, leaveTimer = 0, isReady = false;
    let warpAt = 0, armAt = 0, bootLine = -1;
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
      const R = Math.min(W * 0.31, H * 0.29);
      if (labelFor !== R) paintLabel(R);
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
          const alpha = (1 - k) * o.op;
          ctx.lineCap = "round";
          // faint full track, then the drawn progress on top
          for (const [upto, rgba, lw] of [
            [1, `rgba(${ORBIT_RGB},${(0.1 * alpha).toFixed(3)})`, 1],
            [p, `rgba(${ORBIT_RGB},${alpha.toFixed(3)})`, 1.4],
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
              const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, hr * 2.4);
              g.addColorStop(0, `rgba(${ORBIT_RGB},${alpha.toFixed(3)})`);
              g.addColorStop(1, `rgba(${ORBIT_RGB},0)`);
              ctx.fillStyle = g;
              ctx.beginPath(); ctx.arc(head.x, head.y, hr * 2.4, 0, TAU); ctx.fill();
              ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
              ctx.beginPath(); ctx.arc(head.x, head.y, hr * 0.6, 0, TAU); ctx.fill();
            }
          }
        }
      };
      // very soft violet halo separates the record from the sky
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.9);
      halo.addColorStop(0, `rgba(124,92,214,${(0.16 * (1 - k)).toFixed(3)})`);
      halo.addColorStop(1, "rgba(124,92,214,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 1.9, cy - R * 1.9, R * 3.8, R * 3.8);

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
        ctx.beginPath(); ctx.arc(0, 0, r * (0.37 + i * 0.02), 0, TAU); ctx.stroke();
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
      // label: the printed sprite, then the signature inking itself as loading runs
      ctx.drawImage(label, -r * 0.37, -r * 0.37, r * 0.74, r * 0.74);
      const signed = reduce ? 1 : Math.min(1, shown / 0.85);
      const ss = r * 0.19, n = Math.floor((SIG.length - 1) * signed);
      ctx.strokeStyle = "#3a1a3f";
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const [x0, y0] = SIG[i], [x1, y1] = SIG[i + 1];
        const seg = Math.hypot(x1 - x0, y1 - y0) || 1;
        const f = i / (SIG.length - 1);
        const taper = Math.min(1, f * 12, (1 - f) * 5);
        // a pen: heavy on the down strokes, hairline on the way up, tapering at both ends
        ctx.lineWidth = r * 0.011 * (0.3 + 0.7 * taper) * (0.72 + 0.55 * ((y1 - y0) / seg));
        ctx.beginPath(); ctx.moveTo(x0 * ss, y0 * ss); ctx.lineTo(x1 * ss, y1 * ss); ctx.stroke();
      }
      if (signed === 1) {
        ctx.fillStyle = "#ff7a93";
        ctx.beginPath(); ctx.arc(ss * 1.1, ss * 0.3, r * 0.011, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // static sheen: light catching the grooves does not turn with the disc
      const sheen = ctx.createLinearGradient(-r, -r, r, r);
      sheen.addColorStop(0.3, "rgba(255,255,255,0)");
      sheen.addColorStop(0.45, "rgba(255,255,255,0.07)");
      sheen.addColorStop(0.55, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(0, 0, r * 0.3, 0, TAU, true); ctx.fill();
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
      const armT = armAt ? (reduce ? 1 : easeOut(Math.min(1, Math.max(0, now - armAt - NOVA_REACH) / 520))) : 0;
      const ang = armT * armPlay;
      // dim while waiting; it only lights up as the needle drops
      ctx.globalAlpha = (0.35 + 0.65 * armT) * (1 - k);
      // drawn in the arm's own frame: pivot at the origin, stylus at (0, L); the same S-curved
      // arm, angled headshell and counterweight as the corner player's tonearm
      const u = R / 100;
      const arm = () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(0, L * 0.34, L * 0.13, L * 0.52, L * 0.08, L * 0.76);
        ctx.quadraticCurveTo(L * 0.05, L * 0.88, L * 0.012, L * 0.93);
      };
      // base plate, fixed under the pivot
      ctx.fillStyle = "rgba(22,20,30,0.85)";
      ctx.strokeStyle = "rgba(207,200,188,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px - 11 * u, py - 11 * u, 22 * u, 22 * u, 5 * u); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // counterweight behind the pivot
      ctx.strokeStyle = "#8d877e";
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12 * u); ctx.stroke();
      ctx.fillStyle = "#2b2932";
      ctx.strokeStyle = "rgba(207,200,188,0.45)";
      ctx.lineWidth = 0.6 * u;
      ctx.beginPath(); ctx.roundRect(-4 * u, -17 * u, 8 * u, 7 * u, 2.4 * u); ctx.fill(); ctx.stroke();
      // arm: soft shadow, then a brushed-metal stroke
      ctx.save();
      ctx.translate(1.2 * u, 1.6 * u);
      ctx.strokeStyle = "rgba(10,9,16,0.55)";
      ctx.lineWidth = 2.6 * u;
      arm(); ctx.stroke();
      ctx.restore();
      const metal = ctx.createLinearGradient(-2 * u, 0, L * 0.14, 0);
      metal.addColorStop(0, "#f6f1e7");
      metal.addColorStop(1, "#a9a29a");
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.7 * u;
      arm(); ctx.stroke();
      // headshell, angled in toward the label, with the stylus at its tip
      ctx.save();
      ctx.translate(L * 0.01, L - 3.2 * u);
      ctx.rotate(-0.32);
      ctx.fillStyle = "#e9e3d6";
      ctx.beginPath(); ctx.roundRect(-3.2 * u, -3.4 * u, 6.4 * u, 6.8 * u, 1.4 * u); ctx.fill();
      ctx.fillStyle = "rgba(10,9,16,0.35)";
      ctx.fillRect(-3.2 * u, 1.6 * u, 6.4 * u, 0.6 * u);
      ctx.restore();
      ctx.fillStyle = "#ff7a93";
      ctx.beginPath(); ctx.arc(0, L, 0.9 * u, 0, TAU); ctx.fill();
      // pivot bearing
      const base = ctx.createRadialGradient(-2 * u, -2 * u, u, 0, 0, 6 * u);
      base.addColorStop(0, "#6d6878");
      base.addColorStop(1, "#1d1b24");
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(0, 0, 5.6 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = "#cfc8bc";
      ctx.beginPath(); ctx.arc(0, 0, 1.8 * u, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;

      // Nova floats by the headshell while the record loads, glides in to grab it and rides the
      // arm down onto the groove
      const box = novaBox.current;
      if (box) {
        const nw = Math.round(R * 0.2), nh = Math.round(nw * 88 / 78);
        if (box.style.width !== `${nw}px`) { box.style.width = `${nw}px`; box.style.height = `${nh}px`; }
        const hx = px - L * Math.sin(ang), hy = py + L * Math.cos(ang);
        const grab = armAt && !reduce ? easeOut(Math.min(1, (now - armAt) / NOVA_REACH)) : armAt ? 1 : 0;
        const bob = reduce ? 0 : Math.sin(now / 520) * u * 2.2 * (1 - grab);
        const x = hx + u * (16 - 11 * grab), y = hy - nh * (0.95 - 0.35 * grab) + bob;
        box.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(-8 * grab).toFixed(1)}deg)`;
        box.style.opacity = String(Math.min(1, shown * 3) * (1 - k));
      }

      const line = Math.min(BOOT.length - 1, Math.floor(shown * (BOOT.length - 1)));
      if (line !== bootLine && log.current) { bootLine = line; log.current.textContent = BOOT[line]; }
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
      window.setTimeout(() => setNovaMood("wave"), NOVA_REACH + 480);
      window.setTimeout(() => { warpAt = performance.now(); }, NOVA_REACH + 760);
      window.setTimeout(() => el.classList.add("is-leaving"), NOVA_REACH + 1380);
      leaveTimer = window.setTimeout(() => setGone(true), NOVA_REACH + 1380 + 1150);
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
      <div className="ng-loader-nova" ref={novaBox}>
        <Nova mood={novaMood} typing={false} reduce={false} />
      </div>
      <div className="ng-loader-ui">
        <span className="ng-loader-pct" aria-hidden="true">
          <span ref={pct}>00</span>
          <small>%</small>
        </span>
        <span className="ng-loader-log" ref={log} aria-hidden="true">{BOOT[0]}</span>
        <span className="ng-sr">Loading</span>
      </div>
    </div>
  );
}
