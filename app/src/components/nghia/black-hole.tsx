import { useEffect, useRef } from "react";

import { reducedMotion } from "@/lib/motion";

import { novaCue } from "./nova-companion";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// A Gargantua-style black hole, per pixel. Coordinates: screen centre at 0, half-height 1.
// - Background: a procedural starfield and faint nebula, seen through a thin gravitational lens,
//   so it bends around the hole and piles up into an Einstein ring; frame dragging swirls it.
// - Accretion disk: thin, seen nearly edge-on; its near half crosses in front of the shadow, and
//   the far half's image is lensed up and over the top (and a thinner one under the bottom).
//   Sheared noise gives streaks of gas orbiting faster inside; the side coming at us is brighter
//   and bluer (Doppler beaming).
// - Shadow, a thin photon ring, and at the end a white hole that swells to fill the screen.
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime, uRs, uPull, uCollapse, uFade, uPx;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return v;
}
// point stars on a jittered grid, two scales
vec3 stars(vec2 p) {
  vec3 c = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 26.0 : 60.0;
    vec2 g = p * sc, id = floor(g), f = fract(g) - 0.5;
    float h = hash(id + float(l) * 17.0);
    if (h > 0.78) {
      vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
      float d = length(f - o * 0.7);
      float b = (h - 0.78) / 0.22;
      vec3 tint = mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.86, 0.8), hash(id + 1.3));
      float w0 = l == 0 ? 0.033 : 0.02;           // star radius in cell units
      float w = max(w0, uPx * sc * 0.7);          // at least ~a pixel wide
      c += tint * b * exp(-d * d / (w * w)) * (w0 * w0) / (w * w) * (l == 0 ? 1.6 : 0.9);
    }
  }
  return c;
}
vec3 sky(vec2 p) {
  float n = fbm(p * 1.4 + 4.0);
  vec3 neb = mix(vec3(0.16, 0.05, 0.14), vec3(0.08, 0.05, 0.2), fbm(p * 2.3)) * smoothstep(0.45, 0.85, n) * 0.55;
  return neb + stars(p);
}
// disk emission at disk radius dr and angle a (a = 0 toward the viewer's right)
vec3 disk(float dr, float a, float rin, float rout) {
  if (dr < rin || dr > rout) return vec3(0.0);
  float x = (dr - rin) / (rout - rin);
  // Keplerian-ish shear: inner gas laps the outer gas
  float w = 0.9 / pow(dr / rin, 1.5);
  float th = a - uTime * w;
  vec2 q = vec2(cos(th), sin(th)) * dr / rin;
  float gas = fbm(q * 3.2 + vec2(0.0, dr * 4.0)) * 0.7 + fbm(vec2(dr * 26.0 / rin, th * 2.0)) * 0.5;
  float edge = smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.55, 1.0, x));
  // clamp first: at the rim x can round a hair past 1, and pow of a negative is NaN
  float heat = pow(clamp(1.0 - x, 0.0, 1.0), 1.6);
  vec3 col = mix(vec3(0.62, 0.12, 0.36), vec3(1.0, 0.48, 0.6), smoothstep(0.1, 0.6, heat));
  col = mix(col, vec3(1.0, 0.93, 0.9), smoothstep(0.6, 1.0, heat));
  // Doppler: the left side (sin a < 0 after our mapping) comes toward us
  float beam = 1.0 + 0.75 * -cos(a);
  col *= mix(vec3(1.0, 0.85, 0.8), vec3(0.85, 0.92, 1.1), clamp(-cos(a) * 0.5 + 0.5, 0.0, 1.0));
  return col * (0.25 + gas * 1.1) * edge * (0.55 + heat * 1.8) * beam;
}
void main() {
  vec2 uv = vUv * vec2(uRes.x / uRes.y, 1.0);
  float r = length(uv);
  float Rs = uRs;
  vec3 c;
  if (Rs > 0.001) {
    // thin lens: the source position behind the hole, then frame dragging twists it
    float thE = Rs * 1.35;
    vec2 beta = uv * (1.0 - thE * thE / max(r * r, 1e-4));
    float twist = uPull * 0.9 * Rs / max(length(beta), 0.05) + uTime * 0.01;
    beta = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * beta;
    // magnification brightens the ring, capped
    float mag = min(4.0, 1.0 / max(abs(1.0 - pow(thE / max(r, 1e-4), 4.0)), 0.05));
    c = sky(beta * (1.0 + uPull * 0.6) + uTime * 0.004) * (0.6 + 0.4 * mag);
    c *= smoothstep(Rs * 0.985, Rs * 1.015, r);

    // the disk, tilted so we look at it from ~10 degrees above its plane
    float incl = 0.17, rin = Rs * 1.55, rout = Rs * 4.4;
    float dr = length(vec2(uv.x, uv.y / incl));
    float a = atan(uv.y / incl, uv.x);
    vec3 d = disk(dr, a, rin, rout);
    // far half: behind the shadow, so hidden where it overlaps it, with soft edges
    float nearW = (1.0 - smoothstep(-0.03 * Rs, 0.03 * Rs, uv.y));
    float outside = smoothstep(Rs * 0.97, Rs * 1.03, r);
    c += d * max(nearW, outside * 0.85);
    // lensed image of the far side, arching over the top of the shadow
    float arc = r;
    float up = smoothstep(-0.25 * Rs, 0.35 * Rs, uv.y);
    c += disk(mix(rin, rout, clamp((arc - Rs * 1.08) / (Rs * 1.1), 0.0, 1.0)), atan(uv.x, uv.y) * 1.6, rin, rout)
         * up * smoothstep(Rs * 1.02, Rs * 1.12, r) * (1.0 - smoothstep(Rs * 1.7, Rs * 2.4, r)) * 0.75;
    // and a thinner one hugging the bottom
    float down = (1.0 - smoothstep(-0.5 * Rs, 0.2 * Rs, uv.y));
    c += disk(mix(rin, rout, clamp((r - Rs * 1.04) / (Rs * 0.45), 0.0, 1.0)), atan(-uv.x, -uv.y) * 1.6, rin, rout)
         * down * smoothstep(Rs * 1.01, Rs * 1.06, r) * (1.0 - smoothstep(Rs * 1.18, Rs * 1.5, r)) * 0.45;
    // photon ring
    c += vec3(1.0, 0.86, 0.9) * exp(-abs(r - Rs * 1.035) / (Rs * 0.012)) * 0.9;
    c += vec3(1.0, 0.5, 0.65) * exp(-abs(r - Rs * 1.06) / (Rs * 0.06)) * 0.12;
  } else {
    c = sky(uv);
  }
  // white hole: a point of light swelling until it fills the screen
  float wr = 0.03 + pow(uCollapse, 2.2) * 2.4;
  c += (vec3(1.0, 0.97, 0.98) * exp(-r / (wr * 0.25)) * 1.4 + vec3(1.0, 0.7, 0.8) * exp(-r / wr) * 0.7) * smoothstep(0.0, 0.2, uCollapse);
  // filmic shoulder so the hottest gas rolls off instead of clipping
  c = c / (1.0 + c * 0.35);
  gl_FragColor = vec4(c * uFade, 1.0);
}`;

/**
 * The end of the page is a black hole, rendered per pixel like Gargantua: stars lensed into an
 * Einstein ring, a thin accretion disk wrapped over and under the shadow, Doppler-bright on one
 * side, a photon ring. It sits below the footer, turning. Nova points it out; one more scroll
 * from the bottom of the page sets it off: the page, the navigation, the record player and Nova
 * spiral into it, it collapses into a white hole, and the visitor comes out at the top of the
 * page. A timed sequence, not scroll-scrubbed. Absent with motion off.
 */
export function BlackHole() {
  const wrap = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const section = wrap.current!;
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) { section.hidden = true; return; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("black hole shader:", gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u("uRes"), time: u("uTime"), rs: u("uRs"), pull: u("uPull"), collapse: u("uCollapse"), fade: u("uFade"), px: u("uPx") };

    // per-pixel lensing is the costly part: render below device resolution and let CSS scale it up
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.7;
      canvas.width = Math.round(canvas.clientWidth * scale);
      canvas.height = Math.round(canvas.clientHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const root = document.documentElement;
    const atBottom = () => {
      const r = section.getBoundingClientRect();
      return r.top < window.innerHeight * 0.55 && window.scrollY + window.innerHeight >= root.scrollHeight - 4;
    };

    // ---- the swallow: each piece on screen falls in on its own orbit ----
    // Per piece, per frame: it spirals in on a Kepler-like orbit (angular speed grows as r^-1.5),
    // turns to keep facing the hole, is stretched along the radius and squeezed across it by the
    // tide (which grows as 1/r^3), and near the horizon it slows, reddens, dims and fades, the way
    // a distant observer sees infalling matter freeze at the horizon. Nearer pieces go first.
    const SUCK = 1900, RESET = 1950, DONE = 2600;
    const PIECES = [
      ".ng-contact .ng-wrap > *", ".ng-contact .ng-orbits", ".ng-contact > canvas",
      ".ng-footer > p", ".ng-nav", ".ng-player-dock", ".ng-cmp",
    ];
    const SAVED = ["transform", "transformOrigin", "filter", "opacity", "animation", "transition"] as const;
    type Piece = {
      el: HTMLElement; vx: number; vy: number; r0: number; th: number; th0: number; lead: number;
      ox: number; oy: number; saved: Record<(typeof SAVED)[number], string>;
    };
    let pieces: Piece[] = [];
    let phase: "idle" | "suck" = "idle", suckAt = 0, reset = false, lastT = 0;
    const holeAt = () => {
      const c = canvas.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2, h: c.height };
    };
    const swallow = () => {
      const hole = holeAt(), W = window.innerWidth, H = window.innerHeight;
      pieces = [];
      for (const el of document.querySelectorAll<HTMLElement>(PIECES.join(","))) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > H || b.right < 0 || b.left > W) continue;
        const vx = b.left + b.width / 2, vy = b.top + b.height / 2;
        const dx = vx - hole.x, dy = vy - hole.y;
        // only a pure translation is expected as an existing transform (the nav, Nova)
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
        const saved = Object.fromEntries(SAVED.map((k) => [k, el.style[k]])) as Piece["saved"];
        pieces.push({ el, vx, vy, r0: Math.max(1, Math.hypot(dx, dy)), th: Math.atan2(dy, dx), th0: Math.atan2(dy, dx), lead: 0, ox: m.e, oy: m.f, saved });
      }
      const far = Math.max(...pieces.map((p) => p.r0), 1);
      for (const p of pieces) {
        p.lead = 0.28 * (p.r0 / far); // tidal order: the nearest start falling first
        p.el.style.animation = "none";
        p.el.style.transition = "none";
        p.el.style.transformOrigin = "50% 50%";
      }
      // anything else on the page (backgrounds, off-screen sections) just fades out
      for (const el of document.querySelectorAll<HTMLElement>(".ng-page > main, .ng-footer")) {
        el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: SUCK, fill: "forwards" });
      }
      lastT = performance.now();
    };
    const fall = (now: number, rsNow: number) => {
      const hole = holeAt();
      const Rh = Math.max(24, rsNow * hole.h / 2); // horizon radius in CSS px
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const T = (now - suckAt) / SUCK;
      for (const p of pieces) {
        const tau = clamp01((T - p.lead) / (1 - p.lead));
        // falls slowly at first, fastest mid-way, then crawls as it nears the horizon
        const s = tau * tau * (3 - 2 * tau);
        const r = Rh + (p.r0 - Rh) * (1 - s);
        // Kepler-ish: the closer in, the faster it goes round (anticlockwise, with the disk)
        const w = Math.min(14, 0.9 * Math.pow((Rh * 4) / Math.max(r, Rh), 1.5));
        if (tau > 0) p.th -= w * dt;
        const c = Math.cos(p.th), sn = Math.sin(p.th);
        const x = hole.x + c * r, y = hole.y + sn * r;
        // the tide: stretched along the radius, squeezed across it, and shrunk as it recedes
        const tide = Math.min(1, Math.pow((Rh * 2.2) / r, 3));
        const stretch = 1 + 2.1 * tide, squeeze = 1 / Math.pow(stretch, 0.8);
        const size = 0.3 + 0.7 * Math.pow(r / p.r0, 0.6);
        const a = stretch * size, bb = squeeze * size;
        // M = R(th) diag(a, b) R(-th) R(spin): stretch along the radial axis, turned with the orbit
        const spin = p.th - p.th0;
        const m11 = a * c * c + bb * sn * sn, m12 = (a - bb) * c * sn, m22 = a * sn * sn + bb * c * c;
        const cs = Math.cos(spin), ss = Math.sin(spin);
        const A = m11 * cs + m12 * ss, B = m12 * cs + m22 * ss, C = -m11 * ss + m12 * cs, D = -m12 * ss + m22 * cs;
        p.el.style.transform = `translate(${(x - p.vx + p.ox).toFixed(1)}px, ${(y - p.vy + p.oy).toFixed(1)}px) matrix(${A.toFixed(4)}, ${B.toFixed(4)}, ${C.toFixed(4)}, ${D.toFixed(4)}, 0, 0)`;
        // near the horizon: redshifted, dimmer, smeared, then gone
        const near = clamp01(1 - (r - Rh) / (Rh * 2.5));
        p.el.style.filter = near > 0.02 ? `sepia(${near.toFixed(2)}) saturate(${(1 + near * 2).toFixed(2)}) hue-rotate(${(-25 * near).toFixed(0)}deg) brightness(${(1 - near * 0.55).toFixed(2)}) blur(${(near * 2.5).toFixed(2)}px)` : "";
        p.el.style.opacity = (1 - smooth(0.72, 1, tau)).toFixed(3);
      }
    };
    const restore = () => {
      for (const p of pieces) for (const k of SAVED) p.el.style[k] = p.saved[k];
      pieces = [];
      for (const el of document.querySelectorAll<HTMLElement>(".ng-page > main, .ng-footer")) for (const a of el.getAnimations()) a.cancel();
    };
    const trigger = () => {
      if (phase !== "idle") return;
      phase = "suck";
      suckAt = performance.now();
      reset = false;
      root.style.overflow = "hidden";
      root.setAttribute("data-bh", "");
      novaCue({ mood: "dizzy", say: "Here we go! It's pulling us in!", ms: 2000 });
      swallow();
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // ---- one scroll from the bottom sets it off ----
    // a new gesture only: momentum from the scroll that reached the bottom must not count
    let bottomSince = 0, lastWheel = 0, touchY: number | null = null, hinted = -Infinity;
    const ready = () => phase === "idle" && atBottom() && bottomSince > 0 && performance.now() - bottomSince > 350;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      const fresh = now - lastWheel > 220;
      lastWheel = now;
      if (e.deltaY > 0 && fresh && ready()) trigger();
    };
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      if (dy > 40 && ready()) trigger();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable], [role='dialog']")) return;
      if (["ArrowDown", "PageDown", "End"].includes(e.key) || (e.key === " " && !e.shiftKey)) if (ready()) trigger();
    };

    let raf = 0, visible = false, cw = 0, ch = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) { cw = canvas.clientWidth; ch = canvas.clientHeight; resize(); }
      const r = section.getBoundingClientRect(), H = window.innerHeight;

      // waiting at the bottom: Nova points the way, now and then
      if (phase === "idle") {
        if (atBottom()) {
          if (!bottomSince) bottomSince = now;
          if (now - bottomSince > 700 && now - hinted > 14000) {
            hinted = now;
            novaCue({ mood: "point", say: "Scroll once more to jump into the black hole.", ms: 4200 });
          }
        } else bottomSince = 0;
      }

      let rs = 0.22 + 0.012 * Math.sin((now - t0) / 1400), pull = 0.12, collapse = 0;
      if (phase === "suck") {
        const e = now - suckAt;
        const k = clamp01(e / 1500);
        rs += 0.1 * k * k;
        pull = 0.12 + 0.88 * k * k;
        collapse = smooth(1350, 1950, e);
        if (!reset) fall(now, rs);
        if (e > RESET - 180 && !flash.current?.classList.contains("is-on")) {
          flash.current?.classList.add("is-on");
        }
        // hidden behind the flash: put the page back, at the top
        if (e > RESET && !reset) {
          reset = true;
          restore();
          root.style.overflow = "";
          root.removeAttribute("data-bh");
          window.scrollTo({ top: 0, behavior: "instant" });
          window.setTimeout(() => novaCue({ mood: "happy", say: "Through the black hole and back to the start. Another lap?" }), 700);
        }
        if (e > DONE) {
          phase = "idle";
          flash.current?.classList.remove("is-on");
          bottomSince = 0;
        }
      }
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.px, 2 / Math.max(1, canvas.height));
      gl.uniform1f(U.time, (now - t0) / 1000);
      gl.uniform1f(U.rs, rs * (1 - collapse));
      gl.uniform1f(U.pull, pull);
      gl.uniform1f(U.collapse, collapse);
      gl.uniform1f(U.fade, 0.35 + 0.65 * clamp01((H - r.top) / H));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (visible || phase === "suck") raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(section);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      restore();
      if (phase === "suck") root.style.overflow = "";
      root.removeAttribute("data-bh");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <section className="ng-bh" ref={wrap} aria-label="The end of the page: a black hole. Scroll once more to jump in and return to the top">
      <canvas ref={canvasRef} className="ng-bh-canvas" aria-hidden="true" />
      <div className="ng-bh-flash" ref={flash} aria-hidden="true" />
    </section>
  );
}
