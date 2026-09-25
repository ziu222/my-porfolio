export type MotionMode = "full" | "reduce";

const KEY = "ng-motion";

// Runs inline in <head> before first paint so CSS never flashes the wrong mode.
// The timeout is a failsafe: the intro loader sets data-ready, but if the bundle
// never hydrates the held-back hero copy must still appear.
export const motionBootScript = `try{var d=document.documentElement,m=localStorage.getItem("${KEY}");if(m!=="full"&&m!=="reduce")m=matchMedia("(prefers-reduced-motion: reduce)").matches?"reduce":"full";d.dataset.motion=m;setTimeout(function(){d.dataset.ready=""},8000)}catch(e){}`;

/** Visitor's explicit choice wins; otherwise follow the OS setting. Client-only. */
export function readMotion(): MotionMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "full" || saved === "reduce") return saved;
  } catch {
    // storage blocked: fall through to the OS preference
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "full";
}

export const reducedMotion = () => readMotion() === "reduce";

export function writeMotion(mode: MotionMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // still applies for this page view
  }
  document.documentElement.dataset.motion = mode;
}
