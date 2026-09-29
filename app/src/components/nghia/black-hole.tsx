import { useEffect, useRef } from "react";

import { reducedMotion } from "@/lib/motion";

import { novaCue } from "./nova-companion";

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// pieces of the page that get pulled in: section names, projects, the stack, the crew
const WORDS = [
  "Projects", "Skills", "About", "Contact", "Dishcover", "MedBook", "OptiLink", "Music Web", "CodeGym",
  "DeepChessRL", "React", "TypeScript", "Spring Boot", "Kafka", "PostgreSQL", "Docker", "AWS", "Nova",
  "SCTV", "33⅓ rpm", "Side A", "crew pass", "star map", "LinkedIn",
];

/**
 * The end of the page is a black hole. Scrolling past the footer walks into it: it opens up with
 * a tilted accretion disk and a photon ring, bends the stars behind it, and pulls the page in, its
 * words spiralling down and stretching as they fall. At the bottom it collapses into a white flash
 * and the visitor comes out at the top of the page again. Everything is driven by scroll, so it
 * runs backwards just as well. Absent with motion off.
 */
export function BlackHole() {
  const wrap = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const section = wrap.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0, raf = 0, visible = false, last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // stars keep their own angle (they orbit over time); how far they have fallen comes from scroll
    const stars = Array.from({ length: 520 }, () => ({
      r0: 0.08 + Math.random() ** 0.7 * 1.1, th: Math.random() * TAU, s: 0.4 + Math.random() * 1.3,
      o: 0.25 + Math.random() * 0.6, fall: 0.55 + Math.random() * 0.45,
    }));
    const words = WORDS.map((w, i) => ({
      w, r0: 0.45 + Math.random() * 0.6, th: (i / WORDS.length) * TAU + Math.random() * 0.4,
      size: 12 + Math.random() * 10, fall: 0.8 + Math.random() * 0.2, delay: Math.random() * 0.25,
    }));
    const sparks = Array.from({ length: 90 }, () => ({ a: Math.random() * TAU, r: 1.5 + Math.random() * 1.7, v: 0.6 + Math.random() }));

    let said = 0, teleported = false;
    const progress = () => {
      const r = section.getBoundingClientRect();
      return clamp01(-r.top / Math.max(1, r.height - window.innerHeight));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = progress();
      const cx = W / 2, cy = H / 2, half = Math.hypot(W, H) / 2, m = Math.min(W, H);
      const grow = smooth(0.02, 0.7, p);
      const collapse = smooth(0.86, 0.97, p);
      const Rs = m * (0.025 + 0.13 * grow) * (1 - collapse);
      const pull = smooth(0.12, 0.84, p);

      ctx.fillStyle = "#07060c";
      ctx.fillRect(0, 0, W, H);

      // stars: spiral in, faster near the hole, and are lensed outward around its edge
      for (const s of stars) {
        const r = s.r0 * half * (1 - pull * s.fall * 0.97);
        const spin = 0.03 + 2.2 * Math.pow(Rs / Math.max(r, Rs), 1.5) * (0.3 + pull);
        s.th += spin * dt;
        if (r < Rs * 1.02) continue; // gone over the horizon
        const rl = r + (Rs * Rs * 1.5) / Math.max(r, Rs);
        const x = cx + Math.cos(s.th) * rl, y = cy + Math.sin(s.th) * rl;
        const streak = Math.min(40, spin * rl * 0.09);
        ctx.strokeStyle = `rgba(244,239,230,${(s.o * (0.4 + 0.6 * Math.min(1, streak / 6 + 0.4))).toFixed(3)})`;
        ctx.lineWidth = s.s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(s.th) * streak, y - Math.cos(s.th) * streak);
        ctx.stroke();
      }

      // the page itself: its words fall in, stretching along the fall (spaghettification)
      const wordsIn = smooth(0.08, 0.22, p);
      if (wordsIn > 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const w of words) {
          const f = clamp01((pull - w.delay) / (1 - w.delay));
          const r = w.r0 * half * (1 - f * w.fall);
          w.th += (0.05 + 1.6 * Math.pow(Rs / Math.max(r, Rs), 1.4)) * dt;
          if (r < Rs * 1.1) continue;
          const x = cx + Math.cos(w.th) * r, y = cy + Math.sin(w.th) * r;
          const near = clamp01(1 - (r - Rs) / (Rs * 5));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(w.th);
          ctx.scale(1 + near * 2.2, Math.max(0.15, 1 - near * 0.8));
          ctx.rotate(Math.PI / 2);
          ctx.globalAlpha = wordsIn * (0.75 - near * 0.4);
          ctx.fillStyle = near > 0.4 ? "#ffd6de" : "#f4efe6";
          ctx.font = `600 ${w.size * (1 - near * 0.4)}px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx.fillText(w.w, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      if (Rs > 0.5) {
        const tilt = -0.18;
        // the shadow is drawn in two halves split along the disk's axis: the near half first, so
        // the disk passes in front of it, the far half last, so it hides the disk behind the hole
        const shadowHalf = (far: boolean) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(tilt);
          ctx.beginPath();
          ctx.rect(-Rs * 1.1, far ? -Rs * 1.1 : 0, Rs * 2.2, Rs * 1.1);
          ctx.clip();
          ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.arc(0, 0, Rs, 0, TAU); ctx.fill();
          ctx.restore();
        };
        shadowHalf(false);

        const glow = ctx.createRadialGradient(cx, cy, Rs, cx, cy, Rs * 3.6);
        glow.addColorStop(0, "rgba(255,214,222,0.95)");
        glow.addColorStop(0.35, "rgba(255,122,147,0.7)");
        glow.addColorStop(0.7, "rgba(150,90,210,0.35)");
        glow.addColorStop(1, "rgba(120,90,200,0)");
        // the disk's image lensed up and over the hole, fading out toward its ends
        const archFade = ctx.createLinearGradient(cx - Rs * 1.7, 0, cx + Rs * 1.7, 0);
        archFade.addColorStop(0, "rgba(255,122,147,0)");
        archFade.addColorStop(0.25, "rgba(255,170,190,0.75)");
        archFade.addColorStop(0.5, "rgba(255,214,222,0.85)");
        archFade.addColorStop(0.75, "rgba(255,170,190,0.75)");
        archFade.addColorStop(1, "rgba(255,122,147,0)");
        ctx.strokeStyle = archFade;
        ctx.lineWidth = Rs * 0.26;
        ctx.beginPath();
        ctx.ellipse(cx, cy - Rs * 0.05, Rs * 1.55, Rs * 1.35, 0, Math.PI, TAU);
        ctx.stroke();
        ctx.strokeStyle = glow;
        // accretion disk: soft bands, then thin streams of gas turning around the hole
        for (const [k, a] of [[3.4, 0.35], [2.6, 0.55], [1.9, 0.9]] as const) {
          ctx.globalAlpha = a;
          ctx.lineWidth = Rs * 0.55;
          ctx.beginPath(); ctx.ellipse(cx, cy, Rs * k, Rs * k * 0.26, tilt, 0, TAU); ctx.stroke();
        }
        ctx.lineWidth = Math.max(0.6, Rs * 0.02);
        for (let i = 0; i < 12; i++) {
          const k = 1.45 + i * 0.19;
          ctx.globalAlpha = 0.25 + 0.35 * ((i * 37) % 10) / 10;
          ctx.strokeStyle = i % 3 ? "rgba(255,230,236,0.9)" : "rgba(255,160,180,0.9)";
          ctx.setLineDash([Rs * (0.3 + (i % 4) * 0.25), Rs * (0.2 + (i % 3) * 0.3)]);
          ctx.lineDashOffset = -now * 0.02 * (Rs / 60) / k;
          ctx.beginPath(); ctx.ellipse(cx, cy, Rs * k, Rs * k * 0.26, tilt, 0, TAU); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        shadowHalf(true);
        ctx.strokeStyle = "rgba(255,230,236,0.9)";
        ctx.lineWidth = Math.max(1, Rs * 0.04);
        ctx.beginPath(); ctx.arc(cx, cy, Rs * 1.04, 0, TAU); ctx.stroke();
        // hot clumps orbiting in the disk
        for (const s of sparks) {
          s.a += s.v * dt * (1.4 / s.r) * (0.6 + pull);
          const ex = Math.cos(s.a) * Rs * s.r, ey = Math.sin(s.a) * Rs * s.r * 0.26;
          const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
          if (Math.sin(s.a) < 0 && Math.hypot(x - cx, y - cy) < Rs) continue; // hidden behind the shadow
          const doppler = 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(s.a));
          ctx.fillStyle = `rgba(255,236,240,${doppler.toFixed(3)})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }

      // collapse: the hole pinches shut and turns inside out into a white hole, a point of light
      // that swells until it fills the screen
      if (collapse > 0) {
        const wr = m * (0.03 + Math.pow(collapse, 2.4) * 1.3);
        ctx.globalCompositeOperation = "lighter";
        const white = ctx.createRadialGradient(cx, cy, 0, cx, cy, wr);
        white.addColorStop(0, "rgba(255,255,255,1)");
        white.addColorStop(0.25, `rgba(255,236,240,${(0.6 + collapse * 0.4).toFixed(3)})`);
        white.addColorStop(0.6, `rgba(255,150,175,${(collapse * 0.5).toFixed(3)})`);
        white.addColorStop(1, "rgba(255,122,147,0)");
        ctx.fillStyle = white;
        ctx.beginPath(); ctx.arc(cx, cy, wr, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      // Nova narrates the fall
      if (p > 0.2 && said < 1) { said = 1; novaCue({ mood: "surprised", say: "That's a black hole. Keep scrolling if you're brave." }); }
      if (p > 0.62 && said < 2) { said = 2; novaCue({ mood: "dizzy", say: "It's pulling the whole page in!" }); }

      // out the other side: back at the top of the page
      if (p > 0.985 && !teleported) {
        teleported = true;
        flash.current?.classList.remove("is-on");
        void flash.current?.offsetWidth;
        flash.current?.classList.add("is-on");
        window.scrollTo({ top: 0, behavior: "instant" });
        window.setTimeout(() => novaCue({ mood: "happy", say: "Through the black hole and back to the start. Another lap?" }), 900);
      }
      if (p < 0.5) { teleported = false; if (p < 0.1) said = 0; }

      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    io.observe(section);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <section className="ng-bh" ref={wrap} aria-label="The end of the page: a black hole that leads back to the top">
      <div className="ng-bh-stage">
        <canvas ref={canvasRef} className="ng-bh-canvas" aria-hidden="true" />
      </div>
      <div className="ng-bh-flash" ref={flash} aria-hidden="true" />
    </section>
  );
}
