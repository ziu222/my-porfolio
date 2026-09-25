export type MotionMode = "full" | "reduce";

const KEY = "ng-motion";

// Runs inline in <head> before first paint so CSS never flashes the wrong mode.
// The timeout is a failsafe: the intro loader sets data-ready, but if the bundle
// never hydrates the held-back hero copy must still appear.
export const motionBootScript = `var d=document.documentElement;d.dataset.motion="full";try{if(localStorage.getItem("${KEY}")==="reduce")d.dataset.motion="reduce"}catch(e){}setTimeout(function(){d.dataset.ready=""},8000);`;

/**
 * Motion is on by default (the site owner's choice), regardless of the OS setting; the
 * nav's Motion toggle switches it off and is remembered. Client-only.
 */
export function readMotion(): MotionMode {
  try {
    if (localStorage.getItem(KEY) === "reduce") return "reduce";
  } catch {
    // storage blocked: default on
  }
  return "full";
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
