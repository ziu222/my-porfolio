import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { reducedMotion } from "@/lib/motion";

export type StackGroupId = "front" | "back" | "data" | "cloud";
export type StackItem = { name: string; logo?: string; mono?: string };
export type StackGroup = { id: StackGroupId; title: string; color: string; items: StackItem[] };

type Planet = {
  name: string;
  group: StackGroupId;
  ring: number;
  radius: number;
  angle: number;
  speed: number;
  size: number;
  rgb: [number, number, number];
  icon: HTMLCanvasElement | null;
  mono?: string;
};

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bottom-centre of each project star, in card coordinates (offsets ignore entrance transforms). */
function measureAnchors(box: HTMLUListElement | null): Anchor[] {
  if (!box) return [];
  return Array.from(box.children as HTMLCollectionOf<HTMLElement>).map((n) => ({
    x: box.offsetLeft + n.offsetLeft + n.offsetWidth / 2,
    y: box.offsetTop + n.offsetTop + n.offsetHeight,
  }));
}

/** Load an SVG logo and tint it white on an offscreen canvas (no ctx.filter needed). */
function whiteIcon(src: string, px: number): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = px;
      const g = c.getContext("2d");
      if (!g) return resolve(null);
      g.drawImage(img, 0, 0, px, px);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#F4EFE6";
      g.fillRect(0, 0, px, px);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * A small star system: a glowing central star, one tilted orbit per technology
 * group, and every technology is a lit planet carrying its logo. Drag to spin
 * and tilt; hovering a group card elsewhere on the page highlights its orbit.
 */
type Anchor = { x: number; y: number };
type OrbitProject = { id: string; short: string; stack: string[] };

// Stack entries name frameworks, not their languages; these carry the language over honestly.
const IMPLIED: Record<string, string[]> = { Java: ["Spring Boot"], Python: ["FastAPI"], JavaScript: ["React"] };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 4);

export function OrbitStack({
  groups,
  active,
  tech,
  onTech,
  projects,
}: {
  groups: StackGroup[];
  active: StackGroupId | null;
  tech: string | null;
  onTech: (name: string | null) => void;
  projects: OrbitProject[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef(active);
  const techRef = useRef(tech);
  const onTechRef = useRef(onTech);
  // where each project star sits, when the threads started drawing, and the set fading out
  const anchorsRef = useRef<Anchor[]>([]);
  const selAtRef = useRef(0);
  const fadeRef = useRef<{ name: string; anchors: Anchor[]; at: number } | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  useEffect(() => { activeRef.current = active; redrawRef.current?.(); }, [active]);
  useEffect(() => { onTechRef.current = onTech; }, [onTech]);

  const matches = tech
    ? projects.filter((p) => p.stack.includes(tech) || IMPLIED[tech]?.some((s) => p.stack.includes(s)))
    : [];

  useEffect(() => {
    const prev = techRef.current;
    if (prev && prev !== tech && anchorsRef.current.length) {
      fadeRef.current = { name: prev, anchors: anchorsRef.current, at: performance.now() };
    }
    techRef.current = tech;
    anchorsRef.current = measureAnchors(nodesRef.current);
    selAtRef.current = performance.now();
    redrawRef.current?.();
  }, [tech]);

  useEffect(() => {
    if (!tech) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTechRef.current(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tech]);

  useEffect(() => {
    const el = wrap.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = reducedMotion();

    // radii in units of the outer orbit; wide gaps so neighbouring rings never touch
    const ringRadii = [0.4, 0.6, 0.8, 1];
    const planets: Planet[] = [];
    groups.forEach((g, gi) => {
      const rgb = hexRgb(g.color);
      g.items.forEach((it, i) => {
        const r = ringRadii[gi];
        planets.push({
          name: it.name,
          group: g.id,
          ring: gi,
          radius: r,
          // golden-angle offset per ring keeps planets on adjacent orbits from lining up
          angle: (i / g.items.length) * Math.PI * 2 + gi * 2.4,
          speed: 0.00007 / Math.pow(r, 1.5),
          size: 21 - gi,
          rgb,
          icon: null,
          mono: it.mono,
        });
      });
    });
    const logoFor = new Map<string, string>();
    groups.forEach((g) => g.items.forEach((it) => it.logo && logoFor.set(it.name, it.logo)));
    planets.forEach((p) => {
      const logo = logoFor.get(p.name);
      if (logo) void whiteIcon(`/assets/logos/${logo}.svg`, 64).then((c) => { p.icon = c; });
    });

    // faint background dust inside the card
    const dust = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.2, a: Math.random() * 0.5 + 0.15, tw: 0.5 + Math.random() * 1.5, ph: Math.random() * 6.28 }));

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      // narrow (phone) cards: open the orbit up so it uses the height instead of a flat sliver
      if (!sized) { tilt = tiltTarget = W < 520 ? 0.62 : 0.9; sized = true; }
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      anchorsRef.current = measureAnchors(nodesRef.current);
      if (reduce) draw(0);
    };

    let spin = 0, spinVel = 0, tilt = 0.9, tiltTarget = 0.9, sized = false;
    let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
    let hx = -999, hy = -999;
    // orbital clock: slows to a stop while a technology is selected, then picks back up
    let clock = 0, speedMul = 1, lastT = 0;
    let hits: { name: string; x: number; y: number; r: number }[] = [];

    function draw(t: number) {
      const act = activeRef.current;
      const tech = techRef.current;
      const now = performance.now();
      const selGroup = tech ? planets.find((p) => p.name === tech)?.group : undefined;
      ctx!.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const D = 3.6;
      const st = Math.sin(tilt), ct = Math.cos(tilt);
      // fit the outer orbit to the card: sideways the perspective swell is only ~3%,
      // vertically the near side swells by D / (D - sin(tilt))
      const swell = D / (D - st);
      const scale = Math.min((W / 2 - 30) / 1.04, (H / 2 - 50) / (ct * swell));
      // planets shrink with small orbits so rings stay readable on phones
      const sizeK = Math.min(1, Math.max(0.62, scale / 250));
      const proj = (x: number, z: number) => {
        const y = z * ct;
        const depth = z * st;
        const k = D / (D + depth);
        return { sx: cx + x * scale * k, sy: cy + y * scale * k, k, depth };
      };

      for (const d of dust) {
        const a = reduce ? d.a : d.a * (0.55 + 0.45 * Math.sin(t * 0.0016 * d.tw + d.ph));
        ctx!.fillStyle = `rgba(244,239,230,${a.toFixed(3)})`;
        ctx!.fillRect(d.x * W, d.y * H, d.r, d.r);
      }

      // orbits
      groups.forEach((g, gi) => {
        const r = ringRadii[gi];
        const on = tech ? selGroup === g.id : act === g.id;
        const [cr, cg, cb] = hexRgb(g.color);
        ctx!.beginPath();
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * Math.PI * 2;
          const q = proj(Math.cos(a) * r, Math.sin(a) * r);
          if (i === 0) ctx!.moveTo(q.sx, q.sy); else ctx!.lineTo(q.sx, q.sy);
        }
        ctx!.strokeStyle = on ? `rgba(${cr},${cg},${cb},0.75)` : `rgba(244,239,230,${act || tech ? 0.05 : 0.11})`;
        ctx!.lineWidth = on ? 1.6 : 1;
        ctx!.stroke();
      });

      const items = planets.map((p) => {
        const a = p.angle + spin + clock * p.speed;
        const q = proj(Math.cos(a) * p.radius, Math.sin(a) * p.radius);
        return { p, q };
      });
      const back = items.filter((i) => i.q.depth < 0).sort((a, b) => a.q.depth - b.q.depth);
      const front = items.filter((i) => i.q.depth >= 0).sort((a, b) => a.q.depth - b.q.depth);

      let hovered: (typeof items)[number] | null = null;
      for (const it of items) {
        const dx = it.q.sx - hx, dy = it.q.sy - hy;
        if (dx * dx + dy * dy < (it.p.size * it.q.k + 6) ** 2) hovered = it;
      }

      hits = items.map(({ p, q }) => ({ name: p.name, x: q.sx, y: q.sy, r: p.size * sizeK * q.k + 6 }));

      const drawPlanet = ({ p, q }: (typeof items)[number]) => {
        const isFocus = tech === p.name;
        const dim = tech ? (isFocus ? 1 : 0.2) : act && act !== p.group ? 0.28 : 1;
        const isHover = hovered?.p === p;
        const R = p.size * sizeK * q.k * (isHover ? 1.18 : 1) * (isFocus ? 1.3 : 1);
        const [r, g, b] = p.rgb;
        if (act === p.group || isHover || isFocus) {
          const halo = ctx!.createRadialGradient(q.sx, q.sy, R * 0.6, q.sx, q.sy, R * 2.6);
          halo.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
          halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.fillStyle = halo;
          ctx!.beginPath(); ctx!.arc(q.sx, q.sy, R * 2.6, 0, Math.PI * 2); ctx!.fill();
        }
        // lit sphere: highlight faces the central star
        const vx = cx - q.sx, vy = cy - q.sy;
        const vl = Math.hypot(vx, vy) || 1;
        const hlx = q.sx + (vx / vl) * R * 0.45, hly = q.sy + (vy / vl) * R * 0.45;
        const body = ctx!.createRadialGradient(hlx, hly, R * 0.1, q.sx, q.sy, R);
        body.addColorStop(0, `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},${dim})`);
        body.addColorStop(0.55, `rgba(${(r * 0.55) | 0},${(g * 0.45) | 0},${(b * 0.55) | 0},${dim})`);
        body.addColorStop(1, `rgba(20,16,30,${dim})`);
        ctx!.fillStyle = body;
        ctx!.beginPath(); ctx!.arc(q.sx, q.sy, R, 0, Math.PI * 2); ctx!.fill();
        ctx!.strokeStyle = `rgba(${r},${g},${b},${0.55 * dim})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
        const s = R * 1.05;
        ctx!.globalAlpha = 0.95 * dim;
        if (p.icon) ctx!.drawImage(p.icon, q.sx - s / 2, q.sy - s / 2, s, s);
        else if (p.mono) {
          ctx!.fillStyle = "#F4EFE6";
          ctx!.font = `700 ${Math.round(R * 0.8)}px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
          ctx!.fillText(p.mono, q.sx, q.sy + 1);
          ctx!.textAlign = "start"; ctx!.textBaseline = "alphabetic";
        }
        ctx!.globalAlpha = 1;
        if ((act === p.group && !tech) || isHover || isFocus) {
          ctx!.font = `600 13px "Bricolage Grotesque", system-ui, sans-serif`;
          const tw = ctx!.measureText(p.name).width;
          const lx = q.sx + R + 8, ly = q.sy - 11;
          ctx!.fillStyle = "rgba(7,6,12,0.72)";
          ctx!.beginPath();
          ctx!.roundRect(lx, ly, tw + 16, 22, 11);
          ctx!.fill();
          ctx!.fillStyle = "#F4EFE6";
          ctx!.fillText(p.name, lx + 8, ly + 15);
        }
      };

      back.forEach(drawPlanet);

      // central star
      const pulse = reduce ? 1 : 1 + Math.sin(t * 0.0012) * 0.05;
      const sunR = scale * 0.13 * pulse;
      const corona = ctx!.createRadialGradient(cx, cy, 0, cx, cy, sunR * 4.2);
      corona.addColorStop(0, "rgba(255,230,236,0.55)");
      corona.addColorStop(0.3, "rgba(255,122,147,0.18)");
      corona.addColorStop(1, "rgba(255,122,147,0)");
      ctx!.fillStyle = corona;
      ctx!.beginPath(); ctx!.arc(cx, cy, sunR * 4.2, 0, Math.PI * 2); ctx!.fill();
      const core = ctx!.createRadialGradient(cx - sunR * 0.25, cy - sunR * 0.25, 0, cx, cy, sunR);
      core.addColorStop(0, "#FFFFFF");
      core.addColorStop(0.45, "#FFE3E9");
      core.addColorStop(1, "#FF7A93");
      ctx!.fillStyle = core;
      ctx!.beginPath(); ctx!.arc(cx, cy, sunR, 0, Math.PI * 2); ctx!.fill();

      front.forEach(drawPlanet);

      // threads: from the chosen planet up to each project star
      const threads = (name: string, anchors: Anchor[], since: number, alpha: number, grow: boolean) => {
        const src = items.find((i) => i.p.name === name);
        if (!src || alpha <= 0) return;
        const [r, g, b] = src.p.rgb;
        const x0 = src.q.sx, y0 = src.q.sy;
        anchors.forEach((a, i) => {
          const local = now - since - i * 90;
          const prog = grow && !reduce ? easeOut(clamp01(local / 650)) : 1;
          if (prog <= 0) return;
          // leave the planet sideways, arrive at the star vertically
          const pt = (s: number) => {
            const u = 1 - s;
            return { x: u * u * x0 + 2 * u * s * a.x + s * s * a.x, y: u * u * y0 + 2 * u * s * y0 + s * s * a.y };
          };
          ctx!.beginPath();
          for (let k = 0; k <= 28; k++) {
            const q = pt((k / 28) * prog);
            if (k === 0) ctx!.moveTo(q.x, q.y); else ctx!.lineTo(q.x, q.y);
          }
          ctx!.lineCap = "round";
          ctx!.strokeStyle = `rgba(${r},${g},${b},${(0.16 * alpha).toFixed(3)})`;
          ctx!.lineWidth = 6;
          ctx!.stroke();
          ctx!.strokeStyle = `rgba(255,222,229,${(0.85 * alpha).toFixed(3)})`;
          ctx!.lineWidth = 1.3;
          ctx!.stroke();
          const tip = pt(prog);
          ctx!.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx!.beginPath(); ctx!.arc(tip.x, tip.y, prog < 1 ? 3 : 2.2, 0, Math.PI * 2); ctx!.fill();
          // a spark keeps travelling the finished thread
          if (!reduce && prog === 1 && grow) {
            const s = (((local - 650) / 1700) % 1 + 1) % 1;
            const sp = pt(s);
            ctx!.fillStyle = `rgba(255,179,194,${(0.35 * alpha).toFixed(3)})`;
            ctx!.beginPath(); ctx!.arc(sp.x, sp.y, 5, 0, Math.PI * 2); ctx!.fill();
            ctx!.fillStyle = `rgba(255,255,255,${(0.9 * alpha).toFixed(3)})`;
            ctx!.beginPath(); ctx!.arc(sp.x, sp.y, 1.8, 0, Math.PI * 2); ctx!.fill();
          }
        });
      };
      const fade = fadeRef.current;
      if (fade) {
        const alpha = reduce ? 0 : 1 - (now - fade.at) / 260;
        if (alpha <= 0) fadeRef.current = null;
        else threads(fade.name, fade.anchors, fade.at, alpha, false);
      }
      if (tech) threads(tech, anchorsRef.current, selAtRef.current, 1, true);

      el.style.cursor = hovered ? "pointer" : "";
    }
    redrawRef.current = () => { if (reduce) draw(0); };

    let raf = 0, visible = true;
    const loop = (t: number) => {
      const dt = lastT ? Math.min(t - lastT, 50) : 16;
      lastT = t;
      if (visible) {
        speedMul += ((techRef.current ? 0 : 1) - speedMul) * 0.06;
        clock += dt * speedMul;
        if (!dragging) { spin += spinVel; spinVel *= 0.95; }
        tilt += (tiltTarget - tilt) * 0.08;
        draw(t);
      }
      raf = requestAnimationFrame(loop);
    };

    const onDown = (e: PointerEvent) => {
      // project stars and the caption are real buttons; let their clicks through
      if ((e.target as Element).closest(".ng-const, .ng-galaxy-caption")) return;
      dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      hx = e.clientX - rect.left; hy = e.clientY - rect.top;
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        spin += dx * 0.006; spinVel = dx * 0.0012;
        tiltTarget = Math.max(0.55, Math.min(1.4, tiltTarget - dy * 0.004));
      }
      if (reduce) draw(0);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      // a tap, not a drag: select the planet under it, or clear on empty space
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let hit: (typeof hits)[number] | undefined, best = Infinity;
      for (const h of hits) {
        const d = (h.x - x) ** 2 + (h.y - y) ** 2;
        if (d < h.r ** 2 && d < best) { best = d; hit = h; }
      }
      onTechRef.current(hit && hit.name !== techRef.current ? hit.name : null);
    };
    const onLeave = () => { hx = hy = -999; };
    const onCancel = () => { dragging = false; };

    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }); io.observe(el);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerleave", onLeave);
    resize();
    if (reduce) draw(0); else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [groups]);

  return (
    <div className="ng-galaxy" ref={wrap}>
      <canvas ref={canvasRef} role="img" aria-label="A planetary system where each planet is a technology" />
      <ul className="ng-const" ref={nodesRef} key={tech ?? "none"} aria-label={tech ? `Projects using ${tech}` : undefined}>
        {matches.map((p, i) => (
          <li key={p.id} style={{ "--i": i } as CSSProperties}>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ng:open-project", { detail: p.id }))}>
              <span className="ng-const-star" aria-hidden="true" />
              {p.short}
            </button>
          </li>
        ))}
      </ul>
      <div className="ng-galaxy-caption" aria-live="polite">
        {tech ? (
          <>
            <p>
              {matches.length
                ? `${tech} appears in ${matches.length} ${matches.length === 1 ? "project" : "projects"}. Choose one to see the details.`
                : `${tech} is used in coursework and team collaboration, not in the featured projects above.`}
            </p>
            <button type="button" onClick={() => onTech(null)}>Clear</button>
          </>
        ) : (
          <p>Drag to rotate. Select a planet to see which projects use that technology.</p>
        )}
      </div>
    </div>
  );
}
