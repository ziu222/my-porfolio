import { useEffect } from "react";

import { reducedMotion } from "@/lib/motion";

// ---- tiny matrix helpers (column-major, as WebGL expects) ----
function perspective(fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
// camera at `eye` looking at `target`, rolled by `roll` radians around the view axis
function lookAt(eye: number[], target: number[], roll: number) {
  const [ex, ey, ez] = eye;
  let zx = ex - target[0], zy = ey - target[1], zz = ez - target[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  // start from world up, then roll the right/up pair around z
  let xx = zz, xy = 0, xz = -zx; // (0,1,0) x z
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  let yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const c = Math.cos(roll), s = Math.sin(roll);
  [xx, xy, xz, yx, yy, yz] = [xx * c + yx * s, xy * c + yy * s, xz * c + yz * s, yx * c - xx * s, yy * c - xy * s, yz * c - xz * s];
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1,
  ]);
}
const smoothstep = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

// Camera shots along the hero's scroll (p = 0 top, ~0.48 second beat, ~0.96 third beat).
// Beat 1: the whole galaxy tilted, like Andromeda. Beat 2: dived down into the disk at the edge of
// an arm, a hair above the plane, looking in toward the core, so the galaxy becomes a band of light
// across the screen, the way the Milky Way looks from inside it. Beat 3: climbed out of the disk
// and high above it, looking down on the whole pinwheel face-on, like M101.
type Shot = { p: number; eye: number[]; target: number[]; roll: number; shift: number[] };
const SHOTS: Shot[] = [
  { p: 0, eye: [1.9, 0.915, -1.038], target: [0, 0, 0], roll: 0.42, shift: [0.2, 0] },
  { p: 0.478, eye: [0.92, 0.042, -0.5], target: [0, 0, 0], roll: -0.2, shift: [0.16, 0] },
  { p: 0.957, eye: [0.32, 2.35, 0.58], target: [0, 0, 0], roll: 0.3, shift: [0.22, 0] },
];
const SHOTS_MOBILE: Shot[] = [
  { p: 0, eye: [2.911, 1.402, -1.59], target: [0, 0, 0], roll: 0.42, shift: [0, 0.32] },
  { p: 0.478, eye: [1.05, 0.05, -0.57], target: [0, 0, 0], roll: -0.14, shift: [0, 0.64] },
  { p: 0.957, eye: [0.42, 3.3, 0.8], target: [0, 0, 0], roll: 0.3, shift: [0, 0.42] },
];

const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

const VERT = `
attribute vec4 aPos;   // radius, angle, height, seed
attribute vec3 aColor;
attribute float aSize;
uniform mat4 uProj, uView;
uniform float uTime, uPixel, uSpin, uStarMax, uGain;
uniform vec2 uShift;
varying vec3 vColor;
void main() {
  // things outside the disk (background stars, satellite galaxies) are flagged with radius + 100
  // and hold still; the disk turns as one, so its arms keep their shape
  bool sky = aPos.x > 50.0;
  float r = sky ? aPos.x - 100.0 : aPos.x;
  float th = aPos.y + (sky ? 0.0 : uTime * uSpin);
  vec4 mv = uView * vec4(cos(th) * r, aPos.z, sin(th) * r, 1.0);
  gl_Position = uProj * mv;
  gl_Position.xy += uShift * gl_Position.w;
  // only the foreground stars twinkle; the galaxy's own are too far away to
  float tw = sky ? 0.75 + 0.25 * sin(uTime * (1.3 + fract(aPos.w * 7.0) * 2.0) + aPos.w * 60.0) : 1.0;
  // a star is a point of light: coming closer makes it brighter, not bigger, so it stays crisp.
  // Diffuse puffs (gas, glow, dust; flagged with a negative size) do grow, up to a point
  bool puff = aSize < 0.0;
  float want = abs(aSize) * uPixel / -mv.z;
  float size = puff ? min(want, 64.0) : min(want, uStarMax);
  float boost = puff ? 1.0 : sqrt(clamp(want / max(size, 0.001), 1.0, 6.0));
  // right at the lens things fade out, and puffs fade before they would swell past their cap
  float near = smoothstep(0.03, 0.3, -mv.z) * (puff ? 1.0 - smoothstep(40.0, 64.0, want) : 1.0);
  // below a pixel, shrink the brightness instead of the point, so tiny stars don't shimmer
  vColor = aColor * tw * clamp(size, 0.0, 1.0) * near * boost * (sky ? 1.0 : uGain);
  gl_PointSize = max(size, 1.0);
}`;
const FRAG = `
precision mediump float;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 16.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

type Build = { pos: Float32Array; color: Float32Array; size: Float32Array; count: number; dust: number };

// A grand-design spiral built like the real thing: an exponential disk of stars filled edge to
// edge, with the arms as density waves carved into it (two main arms wound about two turns, plus
// ragged secondary ones), a warm bulge with a smooth glow, pink star-forming knots along the arms,
// fine brown dust lanes on the arms' inner edges, two small satellite galaxies and a dense field
// of foreground stars.
function buildGalaxy(mobile: boolean): Build {
  const k = mobile ? 0.45 : 1;
  // on a phone the galaxy is small on screen, so the core packs into fewer pixels: dim it to match
  const coreK = mobile ? 0.45 : 1;
  const N = { disk: 150000 * k, haze: 7000 * k, bulge: 22000 * k, glow: 900 * k, knots: 380 * k, sats: 5000 * k, sky: 16000 * k, dust: 42000 * k };
  for (const key of Object.keys(N) as (keyof typeof N)[]) N[key] = Math.round(N[key]);
  const count = N.disk + N.haze + N.bulge + N.glow + N.knots + N.sats + N.sky + N.dust;
  const pos = new Float32Array(count * 4), color = new Float32Array(count * 3), size = new Float32Array(count);
  let i = 0;
  const put = (r: number, th: number, y: number, c: number[], s: number, gain: number) => {
    pos.set([r, th, y, Math.random()], i * 4);
    color.set([c[0] * gain, c[1] * gain, c[2] * gain], i * 3);
    size[i] = s;
    i++;
  };

  const CORE = [1.0, 0.86, 0.68], DISK = [0.86, 0.84, 1.0], OUTER = [0.62, 0.72, 1.0], YOUNG = [0.72, 0.84, 1.0], PINK = [1.0, 0.48, 0.64];
  const PITCH = 0.36; // tan of the pitch angle: about one and a half turns across the disk
  const phaseAt = (r: number, th: number) => th - Math.log(Math.max(r, 0.02)) / PITCH;
  // 0..~1.3: how much "arm" there is at this point
  const arms = (r: number, th: number) => {
    const ph = phaseAt(r, th);
    const main = Math.pow(0.5 + 0.5 * Math.cos(2 * ph), 5);
    const ragged = Math.pow(0.5 + 0.5 * Math.cos(5 * ph + 1.3 + Math.sin(r * 9) * 0.8), 7) * 0.4;
    return (main + ragged) * Math.min(1, r / 0.15);
  };
  const diskColor = (r: number) => (r < 0.3 ? mix(CORE, DISK, r / 0.3) : mix(DISK, OUTER, Math.min(1, (r - 0.3) / 0.8)));
  const expR = (h: number, max: number) => { for (;;) { const r = -Math.log(1 - Math.random()) * h; if (r < max) return r; } };

  // the disk: exponential falloff, arms kept by rejection, so the gaps between them still glow
  for (let n = 0; n < N.disk;) {
    const r = expR(0.3, 1.2), th = Math.random() * Math.PI * 2;
    const a = arms(r, th);
    if (Math.random() > 0.22 + 0.78 * Math.min(1, a)) continue;
    const young = a > 0.7 && Math.random() < 0.12;
    const c = young ? YOUNG : diskColor(r);
    const bright = Math.random() < 0.003;
    put(r, th, randn() * 0.018 * (1.1 - r * 0.6), c, bright ? 4.5 : young ? 2 : 1.1 + Math.random(), bright ? 0.9 : (young ? 0.45 : 0.24) * (0.6 + 0.4 * Math.min(1, a + 0.3)));
    n++;
  }
  // haze: the light of stars too faint to resolve, soft puffs laid out like the disk and its arms,
  // so the galaxy reads as one glowing body rather than loose dots
  for (let n = 0; n < N.haze;) {
    const r = expR(0.32, 1.15), th = Math.random() * Math.PI * 2;
    const a = arms(r, th);
    if (Math.random() > 0.3 + 0.7 * Math.min(1, a)) continue;
    put(r, th, randn() * 0.02, mix(diskColor(r), [0.8, 0.72, 1], 0.25), -(18 + Math.random() * 26), 0.02 * (0.5 + Math.min(1, a)) * Math.exp(-r * 0.6) * Math.min(1, r / 0.3));
    n++;
  }
  // bulge: a dense warm ball of old stars, then a handful of big soft sprites for the glow
  for (let n = 0; n < N.bulge; n++) {
    const r = Math.abs(randn()) * 0.1;
    put(r, Math.random() * Math.PI * 2, randn() * 0.035 * Math.max(0, 1 - r * 5), mix(CORE, [1, 0.95, 0.88], Math.random() * 0.4), 1.2 + Math.random(), 0.1 * coreK);
  }
  // the glow is many mid-sized puffs, not a few huge ones: GPUs cap how big a point can be
  for (let n = 0; n < N.glow; n++) { const r = Math.abs(randn()) * 0.09; put(r, Math.random() * Math.PI * 2, randn() * 0.015, CORE, -(26 + Math.random() * 34), 0.022 * coreK * Math.exp(-r * 12)); }
  // pink star-forming knots strung along the arm crests
  for (let n = 0; n < N.knots;) {
    const r = 0.25 + Math.random() * 0.85, th = Math.random() * Math.PI * 2;
    if (arms(r, th) < 0.75) continue;
    put(r, th, randn() * 0.01, Math.random() < 0.7 ? PINK : YOUNG, 2 + Math.random() * 3, 0.26);
    n++;
  }
  // two satellites, like M32 and M110 beside Andromeda (flagged +100: they don't turn with the disk)
  for (let n = 0; n < N.sats; n++) {
    const big = n % 3 !== 0;
    const [cx, cy, cz, sx, sy, sz] = big ? [0.55, 0.06, -0.62, 0.09, 0.04, 0.05] : [-0.3, -0.05, 0.38, 0.03, 0.03, 0.03];
    const x = cx + randn() * sx, y = cy + randn() * sy, z = cz + randn() * sz;
    put(Math.hypot(x, z) + 100, Math.atan2(z, x), y, mix(CORE, [1, 1, 1], 0.4), 1.2 + Math.random(), 0.16);
  }
  // foreground stars all over the sky: mostly white, some blue, some orange, a few bright ones
  for (let n = 0; n < N.sky; n++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, R = 7 + Math.random() * 6;
    const h = Math.random();
    const c = h < 0.55 ? [1, 1, 1] : h < 0.8 ? [0.62, 0.76, 1] : [1, 0.74, 0.52];
    const bright = Math.random() < 0.02;
    put(Math.sqrt(1 - u * u) * R + 100, a, u * R, c, bright ? 14 + Math.random() * 10 : 3 + Math.random() * 5, bright ? 0.9 : 0.55);
  }
  // dust: fine puffs hugging the arms' inner edges, drawn last with a darkening blend. The colour
  // is how much light each absorbs, more blue than red, so the lanes come out brown
  for (let n = 0; n < N.dust;) {
    const r = expR(0.35, 1.05), th = Math.random() * Math.PI * 2;
    if (r < 0.16) continue;
    const ph = phaseAt(r, th);
    const lane = Math.pow(0.5 + 0.5 * Math.cos(2 * ph + 0.55), 14) + Math.pow(0.5 + 0.5 * Math.cos(5 * ph + 1.9), 12) * 0.5;
    // break the lanes into filaments and knots rather than smooth bands
    const strands = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(r * 46 + ph * 3.1), 3);
    if (Math.random() > (0.06 + 0.94 * Math.min(1, lane)) * strands) continue;
    put(r, th, randn() * 0.004, [0.3, 0.46, 0.62], -(1.6 + Math.random() * 2.6), 0.2 * Math.min(1, (r - 0.16) * 4));
    n++;
  }
  return { pos, color, size, count, dust: N.dust };
}

// ---- the star-forming nebula of beat 2, and diffraction-spiked bright stars ----
// Each item is a camera-facing quad. Modes: 0 glowing gas, 1 dark dust pillars (absorbing),
// 2 a star with four diffraction spikes (sized in pixels), 3 the pillars' sunlit rims.
const QUAD_VERT = `
attribute vec3 aCenter;
attribute vec2 aCorner;
attribute vec4 aParams; // size, mode, seed, intensity
attribute vec3 aTint, aTint2;
uniform mat4 uProj, uView;
uniform vec2 uShift, uViewport;
varying vec2 vUv;
varying vec4 vParams;
varying vec3 vTint, vTint2;
void main() {
  vec4 mv = uView * vec4(aCenter, 1.0);
  bool px = aParams.y > 1.5 && aParams.y < 2.5;
  if (!px) mv.xy += aCorner * aParams.x;
  vec4 clip = uProj * mv;
  clip.xy += uShift * clip.w;
  if (px) clip.xy += aCorner * aParams.x / uViewport * 2.0 * clip.w;
  gl_Position = clip;
  vUv = aCorner;
  vParams = vec4(aParams.xyz, aParams.w * smoothstep(0.03, 0.14, -mv.z));
  vTint = aTint; vTint2 = aTint2;
}`;
const QUAD_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTime, uVis;
varying vec2 vUv;
varying vec4 vParams;
varying vec3 vTint, vTint2;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
// dust pillars rising from the bottom of the quad, eroded into ragged edges
float pillars(vec2 uv, float seed) {
  // few, tall columns: the noise barely changes going up, a lot going across
  float cols = fbm(vec2(uv.x * 1.5 + seed, uv.y * 0.28 + seed * 0.3));
  float rise = smoothstep(0.9, -1.0, uv.y);
  float m = smoothstep(0.55, 0.6, cols + rise * 0.62 - 0.36 + (fbm(uv * vec2(5.0, 9.0) + seed + vec2(uTime * 0.006, -uTime * 0.012)) - 0.5) * 0.12);
  return m * smoothstep(1.0, 0.7, abs(uv.x)) * smoothstep(-1.0, -0.8, uv.y);
}
void main() {
  vec2 uv = vUv;
  float mode = vParams.y, seed = vParams.z, k = vParams.w * uVis;
  vec3 c = vec3(0.0);
  if (mode < 0.5) {
    // glowing gas: domain-warped noise, so it comes out wispy and folded rather than blobby
    vec2 q = uv * 1.3 + seed;
    // the warp field churns, and the gas it shapes wells upward, like heated gas rising
    float w = fbm(q + vec2(uTime * 0.03, -uTime * 0.022));
    float n = fbm(q * 1.7 + w * 1.9 + vec2(sin(uTime * 0.05) * 0.2, -uTime * 0.045));
    float fall = exp(-dot(uv, uv) * 2.3);
    float d = smoothstep(0.3, 0.95, n * fall * 1.7);
    c = mix(vTint, vTint2, smoothstep(0.35, 0.75, w)) * d;
  } else if (mode < 1.5) {
    // pillars absorb light, a little more blue than red
    c = vec3(0.82, 0.9, 1.0) * pillars(uv, seed) * 0.92;
  } else if (mode < 2.5) {
    // a star: tight core, soft halo, four thin spikes
    float r2 = dot(uv, uv);
    float core = exp(-r2 * 90.0) * 2.2 + exp(-r2 * 14.0) * 0.35;
    float spikes = exp(-abs(uv.y) * 70.0) * (1.0 - abs(uv.x)) + exp(-abs(uv.x) * 70.0) * (1.0 - abs(uv.y));
    // each star breathes on its own beat
    float tw = 0.82 + 0.18 * sin(uTime * (1.6 + seed * 0.7) + seed * 11.0);
    c = vTint * (core + spikes * 0.55 * tw) * tw;
  } else if (mode < 3.5) {
    // rims: the edge of the pillars that faces the cluster above them catches the light
    float m = pillars(uv, seed);
    float edge = clamp(m - pillars(uv + vec2(0.0, 0.016), seed), 0.0, 1.0);
    // plus light spilling up over the ridge from behind
    float spill = clamp(pillars(uv - vec2(0.0, 0.09), seed) - m, 0.0, 1.0);
    // gas boiling off the lit ridge, carried upward away from the cliffs in thin streamers
    float above = clamp(pillars(uv - vec2(0.0, 0.22), seed) - m, 0.0, 1.0);
    float flow = fbm(vec2(uv.x * 7.0 + seed, uv.y * 2.2 - uTime * 0.18));
    float strands = smoothstep(0.52, 0.8, flow) * above;
    c = vTint * edge * 1.5 + vTint2 * (m * 0.05 + spill * 0.22) + vTint * strands * 0.55;
  } else {
    // light rays from the cluster, turning slowly and shifting in strength as gas drifts across
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float rays = pow(noise(vec2(a * 7.0 + uTime * 0.04, uTime * 0.12)), 3.0) + pow(noise(vec2(a * 13.0 - uTime * 0.03, 5.0 + uTime * 0.09)), 4.0) * 0.6;
    c = vTint * rays * exp(-r * 2.6) * smoothstep(0.02, 0.12, r) * smoothstep(1.0, 0.6, r);
  }
  gl_FragColor = vec4(c * k, 1.0);
}`;

type Quad = { at: number[]; size: number; mode: number; seed: number; k: number; tint: number[]; tint2?: number[] };
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
function packQuads(list: Quad[]) {
  const out = new Float32Array(list.length * 6 * 15);
  let o = 0;
  for (const q of list) {
    for (const [cx, cy] of CORNERS) {
      out.set([...q.at, cx, cy, q.size, q.mode, q.seed, q.k, ...q.tint, ...(q.tint2 ?? q.tint)], o);
      o += 15;
    }
  }
  return out;
}
// the beat-2 camera's own axes, so the nebula can be laid out in front of it
function viewBasis(eye: number[], target: number[]) {
  let z = eye.map((v, i) => v - target[i]);
  const l = Math.hypot(...z); z = z.map((v) => v / l);
  let x = [z[2], 0, -z[0]];
  const lx = Math.hypot(...x); x = x.map((v) => v / lx);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return (d: number, ox: number, oy: number) => eye.map((v, i) => v - z[i] * d + x[i] * ox + y[i] * oy);
}
// The nursery: layered pink and violet gas with a teal heart, dark pillars with lit rims, a cluster
// of young blue stars with spikes; plus a few spiked bright stars in the far sky for every beat
// (on phones everything is scaled down around the view axis: the screen is narrow and the copy tall)
function buildNebula(shot: Shot, scale: number) {
  const base = viewBasis(shot.eye, shot.target);
  const at = (d: number, ox: number, oy: number) => base(d, ox * scale, oy * scale);
  const PINK = [1.0, 0.36, 0.58], VIOLET = [0.5, 0.3, 1.0], MAGENTA = [0.85, 0.2, 0.55], TEAL = [0.35, 0.85, 0.95];
  let neb: Quad[] = [
    { at: at(0.66, 0.02, 0.02), size: 0.36, mode: 0, seed: 1.3, k: 0.5, tint: MAGENTA, tint2: VIOLET },
    { at: at(0.52, 0.03, 0.015), size: 0.25, mode: 0, seed: 4.1, k: 0.85, tint: PINK, tint2: VIOLET },
    { at: at(0.5, 0.02, 0.03), size: 0.11, mode: 0, seed: 7.7, k: 0.5, tint: TEAL, tint2: [0.95, 0.92, 1] },
    { at: at(0.43, 0.05, -0.06), size: 0.15, mode: 1, seed: 2.2, k: 1, tint: [1, 1, 1] },
    { at: at(0.43, 0.05, -0.06), size: 0.15, mode: 3, seed: 2.2, k: 1, tint: [1.0, 0.62, 0.78], tint2: PINK },
    { at: at(0.32, -0.05, 0.05), size: 0.15, mode: 0, seed: 9.9, k: 0.22, tint: MAGENTA, tint2: VIOLET },
  ];
  // god rays fanning out from the cluster
  neb.push({ at: at(0.5, 0.03, 0.03), size: 0.2, mode: 4, seed: 0, k: 0.3, tint: [1.0, 0.8, 0.9] });
  // the young cluster, bright ones spiked, the rest small points around them
  for (let i = 0; i < 46; i++) {
    const big = i < 5;
    const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 1.6) * (big ? 0.022 : 0.05);
    const hot = Math.random() < 0.7 ? [0.72, 0.86, 1] : [1, 0.95, 0.9];
    neb.push({ at: at(0.5 + randn() * 0.02, 0.03 + Math.cos(a) * r, 0.03 + Math.sin(a) * r * 0.8), size: big ? 44 + Math.random() * 40 : 6 + Math.random() * 10, mode: 2, seed: Math.random() * 6, k: big ? 1 : 0.55, tint: hot });
  }
  neb = neb.map((n) => (n.mode === 2 ? n : { ...n, size: n.size * scale }));
  const sky: Quad[] = [];
  for (let i = 0; i < 9; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, R = 9;
    const h = Math.sqrt(1 - u * u);
    const tint = Math.random() < 0.5 ? [0.7, 0.82, 1] : Math.random() < 0.5 ? [1, 0.86, 0.72] : [1, 1, 1];
    sky.push({ at: [Math.cos(a) * h * R, u * R, Math.sin(a) * h * R], size: 16 + Math.random() * 22, mode: 2, seed: 0, k: 0.7, tint });
  }
  return { neb, sky };
}

/**
 * The hero's backdrop as a live WebGL galaxy instead of the filmed journey: a three-armed spiral
 * turning with differential rotation, sharp at any resolution. It sits in the scroll-scrub stage
 * above the (hidden) film layers, so the story beats, snapping and chapter nav work as before.
 * The camera leans toward the pointer and eases in as the journey scrolls. `?hero=film` brings the
 * film back for comparison.
 */
export function GalaxyHero() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("hero") === "film") return;
    const hero = document.querySelector<HTMLElement>(".ng-page .scroll-scrub");
    const media = hero?.querySelector<HTMLElement>(".scroll-scrub__media");
    if (!hero || !media) return;

    const canvas = document.createElement("canvas");
    canvas.className = "ng-galaxy-hero";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) return; // no WebGL: keep the film
    media.after(canvas);
    hero.dataset.galaxy = "";

    const reduce = reducedMotion();
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const g = buildGalaxy(mobile);
    const gbufs: WebGLBuffer[] = [];
    const attr = (name: string, data: Float32Array, n: number) => {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gbufs.push(buf);
      void n;
    };
    attr("aPos", g.pos, 4);
    attr("aColor", g.color, 3);
    attr("aSize", g.size, 1);
    const gDims = [4, 3, 1];
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uProj = u("uProj"), uView = u("uView"), uStarMax = u("uStarMax"), uGain = u("uGain"), uTime = u("uTime"), uPixel = u("uPixel"), uShift = u("uShift"), uSpin = u("uSpin");
    // nebula and spiked stars: their own program and buffer
    const qprog = gl.createProgram()!;
    gl.attachShader(qprog, compile(gl.VERTEX_SHADER, QUAD_VERT));
    gl.attachShader(qprog, compile(gl.FRAGMENT_SHADER, QUAD_FRAG));
    gl.linkProgram(qprog);
    const scene = buildNebula((mobile ? SHOTS_MOBILE : SHOTS)[1], mobile ? 0.55 : 1);
    const quads = packQuads([...scene.neb, ...scene.sky]);
    const qbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    gl.bufferData(gl.ARRAY_BUFFER, quads, gl.STATIC_DRAW);
    const qa = (n: string) => gl.getAttribLocation(qprog, n);
    const qAttrs: [number, number, number][] = [[qa("aCenter"), 3, 0], [qa("aCorner"), 2, 3], [qa("aParams"), 4, 5], [qa("aTint"), 3, 9], [qa("aTint2"), 3, 12]];
    const qu = (n: string) => gl.getUniformLocation(qprog, n);
    const q = { proj: qu("uProj"), view: qu("uView"), shift: qu("uShift"), viewport: qu("uViewport"), time: qu("uTime"), vis: qu("uVis") };
    // where each group's six-vertex quads start and how many, in draw order
    const nNeb = scene.neb.length;
    const ranges = { gasBack: [0, 3], pillars: [3, 1], rims: [4, 1], gasFront: [5, 1], cluster: [6, nNeb - 6], sky: [nNeb, scene.sky.length] };
    const gAttrs = ["aPos", "aColor", "aSize"].map((n) => gl.getAttribLocation(prog, n));
    const bindGalaxy = () => {
      gl.useProgram(prog);
      for (const loc of qAttrs) gl.disableVertexAttribArray(loc[0]);
      gAttrs.forEach((loc, i) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, gbufs[i]);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, gDims[i], gl.FLOAT, false, 0, 0);
      });
    };
    const bindQuads = () => {
      gl.useProgram(qprog);
      for (const loc of gAttrs) gl.disableVertexAttribArray(loc);
      gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
      for (const [loc, n, off] of qAttrs) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 60, off * 4);
      }
    };
    const drawRange = ([from, n]: number[]) => gl.drawArrays(gl.TRIANGLES, from * 6, n * 6);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clearColor(0.027, 0.024, 0.047, 1);

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // pointer lean, eased
    let mx = 0, my = 0, lx = 0, ly = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener("pointermove", onMove);

    const t0 = performance.now();
    let raf = 0, visible = true;
    const frame = (now: number) => {
      raf = 0;
      const t = reduce ? 40 : (now - t0) / 1000;
      lx += (mx - lx) * 0.05; ly += (my - ly) * 0.05;
      const r = hero.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      // the flight: interpolate between the shots, eased so each beat's snap glides in and settles
      const keys = mobile ? SHOTS_MOBILE : SHOTS;
      let k = 0;
      while (k < keys.length - 2 && p > keys[k + 1].p) k++;
      const a = keys[k], b = keys[k + 1];
      const e = smoothstep(a.p, b.p, p);
      const eye = lerp3(a.eye, b.eye, e), target = lerp3(a.target, b.target, e);
      const roll = a.roll + (b.roll - a.roll) * e;
      const shift = [a.shift[0] + (b.shift[0] - a.shift[0]) * e, a.shift[1] + (b.shift[1] - a.shift[1]) * e];
      // pointer lean: swing the camera a little around what it looks at, and lift it
      // plus a slow sway that stays bounded, so nearby things (the nebula) never drift off screen
      const lean = lx * 0.22 + (reduce ? 0 : Math.sin(t * 0.05) * 0.05);
      const ox = eye[0] - target[0], oz = eye[2] - target[2];
      const reach = Math.hypot(ox, eye[1] - target[1], oz);
      eye[0] = target[0] + ox * Math.cos(lean) - oz * Math.sin(lean);
      eye[2] = target[2] + ox * Math.sin(lean) + oz * Math.cos(lean);
      eye[1] += -ly * 0.05 * reach;
      const proj = perspective(0.9, W / Math.max(1, H), 0.01, 60), view = lookAt(eye, target, roll);
      const nursery = smoothstep(0.22, 0.44, p) * (1 - smoothstep(0.54, 0.74, p));
      bindGalaxy();
      gl.uniform1f(uGain, 1 - 0.4 * nursery);
      gl.uniformMatrix4fv(uProj, false, proj);
      gl.uniformMatrix4fv(uView, false, view);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uSpin, 0.02);
      // point size in device pixels per unit of aSize at distance 1: a star (aSize ~1.5) comes out
      // a couple of pixels wide at the opening distance, a gas cloud a soft ~40-100px puff
      gl.uniform1f(uPixel, (H * dpr) / 240);
      gl.uniform1f(uStarMax, 2.6 * dpr);
      // screen offset: clear of the copy (to its right on desktop, above it on phones)
      gl.uniform2f(uShift, shift[0], shift[1]);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFunc(gl.ONE, gl.ONE); // light adds up, like a long exposure
      gl.drawArrays(gl.POINTS, 0, g.count - g.dust);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); // dust only takes light away
      gl.drawArrays(gl.POINTS, g.count - g.dust, g.dust);

      // the nursery only exists around beat 2; the spiked sky stars are always there
      bindQuads();
      gl.uniformMatrix4fv(q.proj, false, proj);
      gl.uniformMatrix4fv(q.view, false, view);
      gl.uniform2f(q.shift, shift[0], shift[1]);
      gl.uniform2f(q.viewport, W * dpr, H * dpr);
      gl.uniform1f(q.time, t);
      gl.blendFunc(gl.ONE, gl.ONE);
      if (nursery > 0.01) {
        // staged: the gas swells in first, the cliffs rise, then the cluster ignites
        const stage = (from: number) => smoothstep(from, 1, nursery);
        gl.uniform1f(q.vis, stage(0));
        drawRange(ranges.gasBack);
        gl.uniform1f(q.vis, stage(0.2));
        gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
        drawRange(ranges.pillars);
        gl.blendFunc(gl.ONE, gl.ONE);
        drawRange(ranges.rims);
        gl.uniform1f(q.vis, stage(0));
        drawRange(ranges.gasFront);
        gl.uniform1f(q.vis, stage(0.45));
        drawRange(ranges.cluster);
      }
      gl.uniform1f(q.vis, 1);
      drawRange(ranges.sky);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(hero);
    const onScroll = () => { if (reduce && !raf) raf = requestAnimationFrame(frame); };
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      canvas.remove();
      delete hero.dataset.galaxy;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);
  return null;
}
