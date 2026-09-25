const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Gas-giant surface: turbulent latitude bands in the planet's own palette (night blue up to its
 * accent), plus an optional storm. Generated once per planet; wraps horizontally so it can turn.
 */
export function surface(rgb: string, seed: number, storm: boolean, w = 320, h = 160): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  const d = g.createImageData(w, h);
  const accent = rgb.split(",").map(Number);
  const stops: [number, number[]][] = [[0, [10, 9, 28]], [0.38, [38, 42, 104]], [0.72, accent], [1, accent.map((v) => Math.min(255, v + 55))]];
  const rnd = (n: number) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  const f = [2 + rnd(1) * 3, 7 + rnd(2) * 6, 17 + rnd(3) * 9];
  const ph = [rnd(4) * 6.28, rnd(5) * 6.28, rnd(6) * 6.28];
  const sx = w * (0.3 + rnd(7) * 0.4), sy = h * (0.55 + rnd(8) * 0.2), sr = h * 0.13;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      // turbulence: bands wobble sideways, seamless because it is periodic in u
      const warp = 0.035 * Math.sin(u * TAU * 3 + v * 9 + ph[0]) + 0.018 * Math.sin(u * TAU * 7 + ph[1]);
      let vv = v + warp;
      if (storm) {
        const dx = x - sx, dy = (y - sy) * 1.8, dd = Math.hypot(dx, dy);
        if (dd < sr * 2) vv += (Math.atan2(dy, dx) / TAU) * 0.08 * (1 - dd / (sr * 2));
      }
      let l = 0.5 + 0.28 * Math.sin(vv * f[0] * Math.PI + ph[0]) + 0.14 * Math.sin(vv * f[1] * Math.PI + ph[1]) + 0.07 * Math.sin(vv * f[2] * Math.PI + ph[2] + u * TAU);
      if (storm) {
        // the storm's eye blends into the bands instead of sitting on them as a flat disc
        const e = clamp01(Math.hypot(x - sx, (y - sy) * 1.8) / sr);
        const wgt = (1 - e * e * (3 - 2 * e)) * 0.75;
        l = l * (1 - wgt) + (0.88 + 0.08 * Math.sin(e * 14)) * wgt;
      }
      l = clamp01(l + (rnd(x * 0.37 + y * 3.1) - 0.5) * 0.05);
      let j = 0;
      while (j < stops.length - 2 && l > stops[j + 1][0]) j++;
      const [a, ca] = stops[j], [b, cb] = stops[j + 1];
      const t = clamp01((l - a) / (b - a));
      const o = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) d.data[o + k] = ca[k] + (cb[k] - ca[k]) * t;
      d.data[o + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}
