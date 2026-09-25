import { ArrowUpRight, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { surface } from "./planet-surface";

import { reducedMotion } from "@/lib/motion";

export type Project = {
  id: string;
  title: string;
  /** Name on the planet labels, the map nav and the skill-constellation stars. */
  short: string;
  category: string;
  summary: string;
  meta: { label: string; value: string }[];
  stack: string[];
  /** Product screenshot for the panel; projects without a UI to show leave it out. */
  img?: string;
  alt?: string;
  links?: { label: string; href: string }[];
};

type Feature = "rings" | "moon" | "satellites";
/** A rendered planet image: where its disc sits inside the square frame (fractions of the side). */
type Photo = { src: string; cx: number; cy: number; r: number };
type Body = { x: number; y: number; r: number; rgb: string; feature?: Feature; photo?: Photo };

const photo = (name: string, cx: number, cy: number, r: number): Photo => ({ src: `/assets/planets/${name}.webp`, cx, cy, r });

// World layout (arbitrary units), in project order: the flagship three sweep left to right,
// the supporting six cluster beyond them in two rows. Photo discs were measured per render;
// Dishcover's rings are part of its render, so it needs no procedural ring.
const BODIES: Body[] = [
  { x: 0, y: 0, r: 1, rgb: "255,122,147", photo: photo("dishcover", 0.495, 0.445, 0.2) },
  { x: 3.3, y: -1.6, r: 0.82, rgb: "120,160,240", feature: "moon", photo: photo("medbook", 0.497, 0.497, 0.404) },
  { x: 6.2, y: 0.7, r: 0.76, rgb: "240,205,150", feature: "satellites", photo: photo("optilink", 0.508, 0.494, 0.439) },
  { x: 8.6, y: -1.7, r: 0.4, rgb: "200,162,176" },
  { x: 9.0, y: 1.2, r: 0.36, rgb: "150,205,200", photo: photo("codegym", 0.482, 0.495, 0.43) },
  { x: 10.4, y: -0.2, r: 0.34, rgb: "225,170,110", photo: photo("vsl", 0.504, 0.493, 0.431) },
  { x: 11.7, y: -1.8, r: 0.4, rgb: "220,215,210", photo: photo("deepchess", 0.497, 0.497, 0.391) },
  { x: 12.0, y: 1.3, r: 0.38, rgb: "255,130,70", photo: photo("restaurant", 0.493, 0.491, 0.425) },
  { x: 13.3, y: -0.1, r: 0.32, rgb: "170,195,225", photo: photo("puzzle", 0.498, 0.499, 0.402) },
];
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Cam = { x: number; y: number; z: number };


/**
 * Projects as a star map: click a planet (or its name below the map) and the camera flies to it,
 * with that project's details beside it. Each planet's surface is generated in its own colours;
 * the real product screenshot sits in the panel, tinted to match.
 */
export function ProjectMap({ projects }: { projects: Project[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef<(i: number) => void>(() => {});
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const el = stage.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = reducedMotion();
    const names = projects.map((p) => p.short);
    const bodies = BODIES.slice(0, projects.length);
    // generated after first paint so the page never waits on it
    // rendered planets load as images; any body without one (or whose image fails) gets a
    // procedural banded surface instead, generated after first paint
    const photos: (HTMLImageElement | null)[] = bodies.map(() => null);
    const textures: (HTMLCanvasElement | null)[] = bodies.map(() => null);
    bodies.forEach((b, i) => {
      if (!b.photo) return;
      const img = new Image();
      img.decoding = "async";
      img.src = b.photo.src;
      // decode off the main thread before first use; drawing an undecoded image stalls a frame
      img.decode().then(
        () => { photos[i] = img; },
        () => { textures[i] = surface(b.rgb, i + 1, false); },
      );
    });
    const texTimer = window.setTimeout(() => {
      bodies.forEach((b, i) => { if (!b.photo) textures[i] = surface(b.rgb, i + 1, false); });
    }, 0);
    const stars = Array.from({ length: 360 }, () => ({ x: Math.random(), y: Math.random(), d: 0.2 + Math.random() * 0.8, s: 0.4 + Math.random() * 1.1, ph: Math.random() * TAU }));

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const overview = (): Cam => {
      const xs = bodies.map((b) => b.x), ys = bodies.map((b) => b.y);
      const minX = Math.min(...xs) - 1.6, maxX = Math.max(...xs) + 1.2, minY = Math.min(...ys) - 1.4, maxY = Math.max(...ys) + 1.4;
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: Math.min((W * 0.92) / (maxX - minX), (H * 0.7) / (maxY - minY)) };
    };
    const stop = (i: number): Cam => {
      const b = bodies[i];
      if (W >= 860) {
        const z = (H * 0.25) / b.r;
        return { x: b.x - (W * 0.66 - W / 2) / z, y: b.y, z };
      }
      const z = Math.min(W * 0.26, H * 0.15) / b.r;
      return { x: b.x, y: b.y + (H / 2 - H * 0.3) / z, z };
    };

    // camera tween: from wherever it is now to the target; planet-to-planet flights pull back mid-way
    let cam: Cam | null = null, from: Cam | null = null, target = -1, t0 = 0, dur = 1;
    const camFor = (i: number) => (i < 0 ? overview() : stop(i));
    const current = (now: number): Cam => {
      const to = camFor(target);
      if (!from || reduce) return to;
      const u = clamp01((now - t0) / dur);
      const s = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const pull = 1 - 0.35 * Math.sin(Math.PI * s);
      return { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s, z: Math.exp(Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * s) * pull };
    };
    flyRef.current = (i: number) => {
      const now = performance.now();
      from = cam ?? camFor(target);
      target = i;
      t0 = now;
      const d = Math.hypot(camFor(i).x - from.x, camFor(i).y - from.y);
      dur = 900 + Math.min(d, 8) * 110;
      setActive(i);
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const drawPlanet = (i: number, sx: number, sy: number, R: number, now: number, hot: boolean) => {
      const b = bodies[i];
      const tex = textures[i];
      const spinT = reduce ? 0 : now;
      const atmo = ctx.createRadialGradient(sx, sy, R * 0.9, sx, sy, R * (hot ? 1.6 : 1.45));
      atmo.addColorStop(0, `rgba(${b.rgb},${hot ? 0.4 : b.photo ? 0.14 : 0.28})`);
      atmo.addColorStop(1, `rgba(${b.rgb},0)`);
      ctx.fillStyle = atmo;
      ctx.beginPath(); ctx.arc(sx, sy, R * 1.6, 0, TAU); ctx.fill();

      const ring = (front: boolean) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-0.32);
        for (const [k, a] of [[1.65, 0.35], [1.9, 0.6], [2.2, 0.28]] as const) {
          ctx.strokeStyle = `rgba(${b.rgb},${a})`;
          ctx.lineWidth = Math.max(1, R * 0.05);
          ctx.beginPath();
          ctx.ellipse(0, 0, R * k, R * k * 0.26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.stroke();
        }
        ctx.restore();
      };
      const orbiters = (front: boolean) => {
        if (b.feature === "moon") {
          const a = spinT * 0.00035;
          if ((Math.sin(a) > 0) !== front) return;
          const mx = sx + Math.cos(a) * R * 1.9, my = sy + Math.sin(a) * R * 0.5, mr = R * 0.2;
          const g = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
          g.addColorStop(0, "#e9e3d6"); g.addColorStop(1, "#2a2833");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        }
        if (b.feature === "satellites") {
          for (const [k, off, sp] of [[1.55, 0, 0.0007], [1.85, 2.4, -0.0005]] as const) {
            const a = spinT * sp + off;
            if (!front) {
              ctx.strokeStyle = `rgba(${b.rgb},0.22)`;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.ellipse(sx, sy, R * k, R * k * 0.34, 0.2, 0, TAU); ctx.stroke();
            }
            if ((Math.sin(a) > 0) !== front) continue;
            const x = sx + Math.cos(a) * R * k * Math.cos(0.2) - Math.sin(a) * R * k * 0.34 * Math.sin(0.2);
            const y = sy + Math.cos(a) * R * k * Math.sin(0.2) + Math.sin(a) * R * k * 0.34 * Math.cos(0.2);
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, R * 0.06), 0, TAU); ctx.fill();
          }
        }
      };

      const pic = photos[i];
      if (pic && b.photo) {
        orbiters(false);
        // the render's black background is keyed to alpha at export, which also thins the night
        // side; a dark disc underneath keeps stars from showing through it
        ctx.fillStyle = "#06050d";
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.985, 0, TAU); ctx.fill();
        const S = R / b.photo.r;
        ctx.drawImage(pic, sx - b.photo.cx * S, sy - b.photo.cy * S, S, S);
        if (hot) {
          ctx.strokeStyle = `rgba(${b.rgb},0.7)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sx, sy, R + 3, 0, TAU); ctx.stroke();
        }
        orbiters(true);
        return;
      }

      if (b.feature === "rings") ring(false);
      orbiters(false);
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.clip();
      if (tex && R > 6) {
        const tw = R * 4, th = R * 2;
        const off = ((spinT * 0.012 * (R / 100)) % tw + tw) % tw;
        ctx.drawImage(tex, sx - R - off, sy - R, tw, th);
        ctx.drawImage(tex, sx - R - off + tw, sy - R, tw, th);
      } else {
        ctx.fillStyle = `rgb(${b.rgb})`;
        ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
      }
      const shade = ctx.createRadialGradient(sx - R * 0.42, sy - R * 0.45, R * 0.08, sx, sy, R * 1.25);
      shade.addColorStop(0, "rgba(255,255,255,0.22)");
      shade.addColorStop(0.45, "rgba(8,7,20,0.05)");
      shade.addColorStop(1, "rgba(5,4,14,0.95)");
      ctx.fillStyle = shade;
      ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
      ctx.restore();
      ctx.strokeStyle = `rgba(${b.rgb},${hot ? 0.9 : 0.55})`;
      ctx.lineWidth = hot ? 1.5 : 1;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.stroke();
      orbiters(true);
      if (b.feature === "rings") ring(true);
    };

    let raf = 0, visible = false, hx = -1e4, hy = -1e4;
    let hits: { i: number; x: number; y: number; r: number }[] = [];
    const frame = (now: number) => {
      cam = current(now);
      const toScreen = (x: number, y: number) => ({ x: W / 2 + (x - cam!.x) * cam!.z, y: H / 2 + (y - cam!.y) * cam!.z });
      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        const px = (((s.x * W - cam.x * cam.z * 0.06 * s.d) % W) + W) % W;
        const py = (((s.y * H - cam.y * cam.z * 0.06 * s.d) % H) + H) % H;
        const a = 0.25 + 0.5 * s.d * (reduce ? 1 : 0.7 + 0.3 * Math.sin(now * 0.0015 + s.ph));
        ctx.fillStyle = `rgba(244,239,230,${a.toFixed(3)})`;
        ctx.fillRect(px, py, s.s, s.s);
      }

      ctx.setLineDash([2, 7]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(244,239,230,0.16)";
      ctx.beginPath();
      bodies.forEach((b, i) => { const p = toScreen(b.x, b.y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);

      const zo = overview().z;
      // narrow screens: names would collide in the overview, and the index row below lists them
      const labelAlpha = W < 700 ? 0 : clamp01(1 - (cam.z - zo * 1.2) / (zo * 1.2));
      hits = [];
      let hover = -1;
      bodies.forEach((b, i) => {
        const p = toScreen(b.x, b.y);
        const R = b.r * cam!.z;
        hits.push({ i, x: p.x, y: p.y, r: Math.max(R * 1.3, 22) });
        if ((hx - p.x) ** 2 + (hy - p.y) ** 2 < Math.max(R * 1.3, 22) ** 2) hover = i;
      });
      bodies.forEach((b, i) => {
        const p = toScreen(b.x, b.y);
        const R = b.r * cam!.z;
        if (p.x < -R * 3 || p.x > W + R * 3 || p.y < -R * 3 || p.y > H + R * 3) return;
        drawPlanet(i, p.x, p.y, R, now, i === hover);
        if (labelAlpha > 0.01) {
          ctx.fillStyle = `rgba(244,239,230,${((i === hover ? 1 : 0.8) * labelAlpha).toFixed(3)})`;
          ctx.font = `${i === hover ? 700 : 600} 13px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(names[i], p.x, p.y + R + 24);
          ctx.textAlign = "start";
        }
      });
      canvas.style.cursor = hover >= 0 ? "pointer" : "";
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      hx = e.clientX - r.left; hy = e.clientY - r.top;
    };
    const onLeave = () => { hx = hy = -1e4; };
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let best = -1, bd = Infinity;
      for (const h of hits) {
        const d = (h.x - x) ** 2 + (h.y - y) ** 2;
        if (d < h.r ** 2 && d < bd) { bd = d; best = h.i; }
      }
      flyRef.current(best >= 0 && best !== target ? best : -1);
    };

    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    const ro = new ResizeObserver(() => { resize(); if (!raf && visible) raf = requestAnimationFrame(frame); });
    resize();
    io.observe(el);
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);

    // the orbit's project stars and the terminal ask for a project: bring the map into view, fly there
    const onRequest = (e: Event) => {
      const i = projects.findIndex((p) => p.id === (e as CustomEvent<string>).detail);
      if (i < 0) return;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      flyRef.current(i);
    };
    window.addEventListener("ng:open-project", onRequest);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(texTimer);
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("ng:open-project", onRequest);
    };
  }, [projects]);

  const go = (i: number) => flyRef.current(i);
  const step = (d: number) => go(active < 0 ? (d > 0 ? 0 : projects.length - 1) : (active + d + projects.length) % projects.length);

  return (
    <div
      className="ng-map"
      ref={stage}
      data-open={active >= 0 ? "" : undefined}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        else if (e.key === "Escape" && active >= 0) go(-1);
      }}
    >
      <canvas ref={canvasRef} className="ng-map-canvas" role="img" aria-label="Star map of projects; select a project below to fly to it" />
      <p className="ng-map-hint" aria-hidden="true">Select a planet to explore</p>

      {projects.map((p, i) => (
        <article
          key={p.id}
          className="ng-map-panel"
          data-active={active === i ? "" : undefined}
          aria-labelledby={`map-${p.id}`}
          inert={active !== i}
          style={{ "--acc": BODIES[i]?.rgb ?? "255,122,147" } as CSSProperties}
        >
          <button type="button" className="ng-map-close" onClick={() => go(-1)} aria-label="Back to the map">
            <X size={16} weight="bold" />
          </button>
          {p.img ? (
            <div className="ng-map-shot">
              <img src={p.img} alt={p.alt ?? ""} loading="lazy" decoding="async" />
            </div>
          ) : null}
          <h3 id={`map-${p.id}`}>{p.title}</h3>
          <p className="ng-map-cat">{p.category}</p>
          <p className="ng-case-summary">{p.summary}</p>
          <dl className="ng-case-meta">
            {p.meta.map((m) => (
              <div key={m.label}>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="ng-tags">
            {p.stack.slice(0, 6).map((t) => <li key={t}>{t}</li>)}
            {p.stack.length > 6 ? <li aria-label={`and ${p.stack.length - 6} more: ${p.stack.slice(6).join(", ")}`}>+{p.stack.length - 6}</li> : null}
          </ul>
          {p.links ? (
            <div className="ng-case-links">
              {p.links.map((l, li) => (
                <a key={l.href} className={li === 0 ? "ng-cta ng-cta--rose" : "ng-cta ng-cta--ghost"} href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                  <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : null}
        </article>
      ))}

      <nav className="ng-map-nav" aria-label="Projects">
        <button type="button" className="ng-map-step" onClick={() => step(-1)} aria-label="Previous project">
          <CaretLeft size={16} weight="bold" />
        </button>
        <ul>
          {projects.map((p, i) => (
            <li key={p.id} style={{ "--acc": BODIES[i]?.rgb ?? "255,122,147" } as CSSProperties}>
              <button type="button" aria-pressed={active === i} onClick={() => go(active === i ? -1 : i)}>
                <span aria-hidden="true" />
                {p.short}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="ng-map-step" onClick={() => step(1)} aria-label="Next project">
          <CaretRight size={16} weight="bold" />
        </button>
      </nav>
    </div>
  );
}
