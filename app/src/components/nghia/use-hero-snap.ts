import { useEffect } from "react";

import { reducedMotion } from "@/lib/motion";

const DURATION = 1100;
const QUIET_MS = 220; // trackpad momentum keeps firing wheel events after a flick
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * One gesture per step through the hero: each wheel flick, swipe or arrow key glides to the next
 * story beat (the film scrubs along on the way), and one more from the last beat lands on the
 * projects. Below the hero the page scrolls normally.
 */
export function useHeroSnap(nextSelector: string) {
  useEffect(() => {
    const reduce = reducedMotion();
    let animating = false, raf = 0, lastWheel = 0, touchY: number | null = null;

    const stops = () => {
      const chapters = Array.from(document.querySelectorAll<HTMLElement>(".scroll-scrub__chapter"));
      const next = document.querySelector<HTMLElement>(nextSelector);
      const ys = chapters.map((c) => Math.round(c.getBoundingClientRect().top + window.scrollY));
      if (next) ys.push(Math.round(next.getBoundingClientRect().top + window.scrollY));
      return ys;
    };
    // the zone we own: anywhere above the last stop, or sitting on it and heading back up
    const owns = (dir: number) => {
      const s = stops();
      const end = s[s.length - 1];
      if (end === undefined) return false;
      const y = window.scrollY;
      return y < end - 2 || (dir < 0 && Math.abs(y - end) <= 2);
    };
    const locked = () => document.documentElement.style.overflow === "hidden";

    const glide = (to: number) => {
      if (reduce) { window.scrollTo(0, to); return; }
      const from = window.scrollY, t0 = performance.now();
      animating = true;
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(tick);
        else animating = false;
      };
      raf = requestAnimationFrame(tick);
    };
    const step = (dir: number) => {
      const s = stops(), y = window.scrollY;
      const target = dir > 0 ? s.find((v) => v > y + 4) : [...s].reverse().find((v) => v < y - 4);
      if (target !== undefined) glide(target);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || locked() || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const dir = Math.sign(e.deltaY);
      if (!dir || !owns(dir)) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - lastWheel > QUIET_MS;
      lastWheel = now;
      if (!animating && quiet) step(dir);
    };
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || locked()) return;
      const dir = Math.sign(touchY - (e.touches[0]?.clientY ?? touchY));
      if (dir && owns(dir)) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null || locked()) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      const dir = Math.sign(dy);
      if (Math.abs(dy) > 30 && owns(dir) && !animating) step(dir);
    };
    const onKey = (e: KeyboardEvent) => {
      if (locked() || (e.target as HTMLElement).closest("input, textarea, [contenteditable], [role='dialog']")) return;
      const dir = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey) ? 1
        : ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey) ? -1 : 0;
      if (!dir || !owns(dir)) return;
      e.preventDefault();
      if (!animating) step(dir);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [nextSelector]);
}
