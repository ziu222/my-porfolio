import { useEffect, useRef } from "react";

export type SkillGroup = "front" | "back" | "data" | "cloud";

type Group = SkillGroup;
type Skill = { name: string; group: Group };

export const skillGroups: Record<Group, { label: string; color: string }> = {
  front: { label: "Frontend", color: "#FF7A93" },
  back: { label: "Backend", color: "#F4EFE6" },
  data: { label: "Dữ liệu", color: "#C8A2B0" },
  cloud: { label: "Cloud và công cụ", color: "#FFD9A8" },
};

export const skills: Skill[] = [
  { name: "React", group: "front" },
  { name: "TypeScript", group: "front" },
  { name: "JavaScript", group: "front" },
  { name: "Tailwind CSS", group: "front" },
  { name: "Java", group: "back" },
  { name: "Spring Boot", group: "back" },
  { name: "Spring AI", group: "back" },
  { name: "Node.js", group: "back" },
  { name: "FastAPI", group: "back" },
  { name: "PostgreSQL", group: "data" },
  { name: "pgvector", group: "data" },
  { name: "Supabase", group: "data" },
  { name: "MongoDB", group: "data" },
  { name: "Docker", group: "cloud" },
  { name: "AWS Lambda", group: "cloud" },
  { name: "AWS Cognito", group: "cloud" },
  { name: "Git", group: "cloud" },
  { name: "Jira", group: "cloud" },
];

type P = { x: number; y: number; z: number; r: number; g: number; b: number; s: number };

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

/**
 * A procedural 3D spiral galaxy drawn on canvas. Every labelled star is a real
 * skill. Drag to spin, it keeps its momentum; it idles with a slow rotation.
 */
export function GalaxySkills({ active }: { active: SkillGroup | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<SkillGroup | null>(active);
  activeRef.current = active;

  useEffect(() => {
    const el = wrap.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // seeded random so the galaxy is stable between visits
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const gauss = () => {
      let u = 0;
      for (let i = 0; i < 4; i++) u += rand();
      return u / 4 - 0.5;
    };

    const R = 1;
    const ARMS = 3;
    const rose = hexToRgb("#FF7A93");
    const star = hexToRgb("#F4EFE6");
    const mauve = hexToRgb("#C8A2B0");
    const stars: P[] = [];
    for (let i = 0; i < 2600; i++) {
      const arm = i % ARMS;
      const t = Math.pow(rand(), 0.7);
      const r = t * R;
      const a = (arm / ARMS) * Math.PI * 2 + r * 4.2 + gauss() * (0.6 - t * 0.35);
      const spread = gauss() * 0.18 * (1 - t * 0.5);
      const mix = Math.min(1, t * 1.4);
      const tone = rand() < 0.25 ? mauve : rose;
      stars.push({
        x: Math.cos(a) * r + spread,
        y: gauss() * 0.12 * (1 - t) + gauss() * 0.02,
        z: Math.sin(a) * r + spread,
        r: star[0] * (1 - mix) + tone[0] * mix,
        g: star[1] * (1 - mix) + tone[1] * mix,
        b: star[2] * (1 - mix) + tone[2] * mix,
        s: rand() * 1.3 + 0.4,
      });
    }
    const nodes = skills.map((sk, i) => {
      const arm = i % ARMS;
      const t = 0.28 + ((i * 0.618) % 1) * 0.66;
      const a = (arm / ARMS) * Math.PI * 2 + t * 4.2 + 0.25;
      return {
        ...sk,
        x: Math.cos(a) * t,
        y: (rand() - 0.5) * 0.12,
        z: Math.sin(a) * t,
        color: skillGroups[sk.group].color,
      };
    });

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw();
    };

    let angle = 0.6, vel = reduce ? 0 : 0.0016, tilt = 1.02, tiltTarget = 1.02;
    let dragging = false, lastX = 0, lastY = 0;
    let hoverX = -999, hoverY = -999;

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const scale = Math.min(W, H) * 0.62;
      const D = 2.6;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const project = (x: number, y: number, z: number) => {
        const x1 = x * ca - z * sa;
        const z1 = x * sa + z * ca;
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        const k = D / (D + z2);
        return { sx: cx + x1 * scale * k, sy: cy + y2 * scale * k, k, z: z2 };
      };

      ctx!.globalCompositeOperation = "lighter";
      // core glow
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.45);
      core.addColorStop(0, "rgba(255, 214, 222, 0.55)");
      core.addColorStop(0.35, "rgba(255, 122, 147, 0.18)");
      core.addColorStop(1, "rgba(255, 122, 147, 0)");
      ctx!.fillStyle = core;
      ctx!.fillRect(0, 0, W, H);

      for (const p of stars) {
        const q = project(p.x, p.y, p.z);
        const a = Math.max(0.08, Math.min(1, 0.95 - q.z * 0.45));
        const s = p.s * q.k;
        ctx!.fillStyle = `rgba(${p.r | 0},${p.g | 0},${p.b | 0},${a})`;
        ctx!.fillRect(q.sx, q.sy, s, s);
      }
      ctx!.globalCompositeOperation = "source-over";

      const projected = nodes
        .map((n) => ({ n, q: project(n.x, n.y, n.z) }))
        .sort((a, b) => b.q.z - a.q.z);
      let hovered: (typeof projected)[number] | null = null;
      for (const item of projected) {
        const dx = item.q.sx - hoverX, dy = item.q.sy - hoverY;
        if (dx * dx + dy * dy < 30 * 30) hovered = item;
      }
      for (const item of projected) {
        const { n, q } = item;
        const depth = Math.max(0.25, Math.min(1, 1 - q.z * 0.5));
        const isHover = hovered === item;
        const act = activeRef.current;
        const inGroup = act === null || act === n.group;
        const showLabel = isHover || (act !== null && act === n.group);
        const dim = inGroup ? 1 : 0.18;
        const rad = (isHover || (act !== null && inGroup) ? 6.5 : 4.5) * q.k;
        const [r, g, b] = hexToRgb(n.color);
        const glow = ctx!.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, rad * 5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${0.55 * depth * dim})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(q.sx, q.sy, rad * 5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(${r},${g},${b},${depth * dim})`;
        ctx!.beginPath();
        ctx!.arc(q.sx, q.sy, rad, 0, Math.PI * 2);
        ctx!.fill();
        if (showLabel) {
          ctx!.font = `600 ${Math.round(14 * (0.85 + q.k * 0.2))}px "Space Grotesk", system-ui, sans-serif`;
          ctx!.fillStyle = `rgba(244,239,230,${0.55 + depth * 0.45})`;
          ctx!.fillText(n.name, q.sx + rad + 8, q.sy + 4);
        }
      }
      el.style.cursor = hovered ? "pointer" : "";
    }

    let raf = 0, visible = true;
    const loop = () => {
      if (visible) {
        if (!dragging) {
          angle += vel;
          vel += ((reduce ? 0 : 0.0016) - vel) * 0.02;
        }
        tilt += (tiltTarget - tilt) * 0.08;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      hoverX = e.clientX - rect.left; hoverY = e.clientY - rect.top;
      if (!dragging) {
        if (reduce) draw();
        return;
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      angle += dx * 0.006;
      vel = dx * 0.0009;
      tiltTarget = Math.max(0.35, Math.min(1.35, tiltTarget + dy * 0.004));
      if (reduce) draw();
    };
    const onUp = () => { dragging = false; };
    const onLeave = () => { hoverX = hoverY = -999; };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(el);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);
    resize();
    if (reduce) draw();
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="ng-galaxy" ref={wrap}>
      <canvas ref={canvasRef} role="img" aria-label="Mô hình thiên hà 3D biểu diễn các công nghệ" />
      <p className="ng-galaxy-hint">Kéo để xoay mô hình</p>
    </div>
  );
}
