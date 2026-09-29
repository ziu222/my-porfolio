import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ambient, TRACKS } from "@/lib/ambient";
import { reducedMotion } from "@/lib/motion";

import { Nova, type NovaMood, type NovaPosture } from "./nova";

type Cue = { mood: NovaMood; say?: string; ms?: number };

/** Anything on the page can make Nova react: `novaCue({ mood: "starry", say: "Nice pick." })`. */
export const novaCue = (cue: Cue) => window.dispatchEvent(new CustomEvent<Cue>("ng:nova", { detail: cue }));

type Spot = "dock" | "map" | "badge" | "contact";
// Nova is the tour guide: per section, where it stands, the pose it holds and the tips it gives,
// one on arrival and the rest spaced out while the visitor stays
const SECTIONS: { id: string; spot: Spot; pose: NovaMood; hello: NovaMood; lines: string[] }[] = [
  {
    id: "intro", spot: "dock", pose: "point", hello: "wave",
    lines: [
      "Hi, I'm Nova. I'll show you around Nghia's portfolio.",
      "Scroll down and we'll fly through the galaxy together.",
      "The record under me plays music. Click it to start or pause.",
    ],
  },
  {
    id: "projects", spot: "map", pose: "idle", hello: "happy",
    lines: [
      "Every planet on this map is one of Nghia's projects.",
      "Click a planet, or a name in the bar below, to fly to it.",
      "Start with Dishcover, the graduation project: eight microservices and an AI chatbot.",
      "The arrows beside the bar hop to the next project.",
    ],
  },
  {
    id: "skills", spot: "dock", pose: "juggle", hello: "juggle",
    lines: [
      "These are the technologies Nghia builds with.",
      "Pick one and the orbit shows which projects use it.",
      "Hover a group on the right to see where it sits in the orbit.",
    ],
  },
  {
    id: "about", spot: "badge", pose: "idle", hello: "wave",
    lines: [
      "This is Nghia's crew pass. Drag it and it swings.",
      "Press Flip the pass to read about SCTV, where Nghia interns.",
      "Below it is the journey so far, from university to SCTV.",
    ],
  },
  {
    id: "contact", spot: "contact", pose: "sign", hello: "sign",
    lines: [
      "Nghia is open to new opportunities.",
      "LinkedIn is the quickest way to get in touch.",
      "One more secret: press the tilde key to open my terminal.",
    ],
  },
];
const JUGGLE = ["react", "springboot", "postgresql"];
const TIP_EVERY = 9000;

/**
 * Nova, out of the terminal: a guide that rides in after the intro, sits on the record player
 * (dancing when the music plays; click to skip the track), flies to the project map, the crew pass
 * and the contact buttons, and explains each section. It reacts to the page, gets dizzy when the
 * mouse races around or it is spun in circles, and when tossed it drifts off spinning through
 * space, then flies back.
 */
export function NovaCompanion() {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [section, setSection] = useState(0);
  const [cue, setCue] = useState<Cue | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [posture, setPostureState] = useState<NovaPosture>("float");
  const reduceNow = useSyncExternalStore(noSubscribe, reducedMotion, () => false);

  useEffect(() => {
    const el = box.current!;
    const reduce = reducedMotion();
    const root = document.documentElement;
    let sec = 0, raf = 0, last = performance.now(), shown = false;
    let cueTimer = 0, bubbleTimer = 0, sad = false, busyUntil = 0;
    const told = new Map<string, number>(); // tips already given per section
    const visible = new Set<string>();

    const say = (c: Cue) => {
      const ms = c.ms ?? (c.say ? Math.max(2600, c.say.length * 55) : 2600);
      busyUntil = performance.now() + ms;
      window.clearTimeout(cueTimer);
      window.clearTimeout(bubbleTimer);
      setCue(c);
      cueTimer = window.setTimeout(() => setCue(null), ms);
      if (c.say) {
        setBubble(c.say);
        bubbleTimer = window.setTimeout(() => setBubble(null), Math.max(ms, 3000));
      }
    };

    // where Nova is headed and how it rests there: sitting on the record player's edge, standing
    // with its feet on a surface, or hanging from the crew pass strap by one hand. Sprite units:
    // the box is 23 x 27 cells; the hips are at row 23, the feet at the bottom, the raised right
    // glove at (20, 13.5)
    type Rest = { x: number; y: number; posture: NovaPosture };

    // motion: "home" springs to the section's spot, "drift" is the post-toss float through space
    let x = window.innerWidth + 80, y = window.innerHeight * 0.45, vx = 0, vy = 0, tilt = 0, spin = 0;
    let mode: "home" | "drift" = "home", driftUntil = 0, returning = false;
    const drag = { id: -1, active: false, sx: 0, sy: 0, ox: 0, oy: 0, t: 0, lx: 0, ly: 0, turn: 0, heading: NaN, dizzy: false };
    let swallowClick = false;
    let posture: NovaPosture = "float";
    const body = el.querySelector<HTMLElement>(".ng-cmp-body");
    // touchdown: a squash and stretch, and the record player gives a little when sat on
    const land = (p: NovaPosture) => {
      if (reduce) return;
      body?.animate(
        [{ scale: "1 1" }, { scale: "1.16 0.82" }, { scale: "0.94 1.07" }, { scale: "1 1" }],
        { duration: 460, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
      );
      if (p === "sit") {
        document.querySelector(".ng-player")?.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" }],
          { duration: 420, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        );
      }
    };
    const setPose = (p: NovaPosture) => {
      if (p === posture) return;
      if (posture === "float") land(p);
      posture = p;
      el.dataset.posture = p;
      setPostureState(p);
    };

    const target = (nw: number, nh: number): Rest => {
      const ux = nw / 23, uy = nh / 27;
      const spot = SECTIONS[sec].spot;
      const inView = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight;
      if (spot === "badge") {
        const r = document.querySelector(".ng-badge-clip")?.getBoundingClientRect();
        if (r && inView(r)) return { x: r.left + r.width / 2 - 20 * ux, y: r.top - 16 - 13.5 * uy, posture: "hang" };
      }
      if (spot === "contact") {
        const r = document.querySelector(".ng-contact .ng-hero-actions > :last-child")?.getBoundingClientRect();
        if (r && inView(r)) {
          if (r.right + nw + 20 < window.innerWidth) return { x: r.right + 14, y: r.bottom - nh, posture: "stand" };
          // narrow screens: stand below the buttons, where there is room for the sign
          return { x: r.right - nw - 4, y: r.bottom + 64, posture: "stand" };
        }
      }
      const d = document.querySelector(".ng-player-dock")?.getBoundingClientRect();
      if (spot === "map") {
        // keep off the project panel: beside the project index on wide screens, next to the
        // folded-up record player on phones
        const r = document.querySelector(".ng-map-nav")?.getBoundingClientRect();
        if (r && inView(r) && window.innerWidth > 860) return { x: r.right + 18, y: r.bottom - nh, posture: "stand" };
        if (d) return { x: d.right + 10, y: d.bottom - nh, posture: "stand" };
      }
      // sitting on the record player's top edge, legs over the front; clear of the record itself
      // unless the player is folded down to just the record
      if (d) return { x: d.left + (d.width < 120 ? 8 : 62), y: d.top - 23 * uy + 1, posture: "sit" };
      return { x: 16, y: window.innerHeight - nh - 80, posture: "stand" };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!shown) return;
      const nw = window.innerWidth < 640 ? 44 : 54, nh = Math.round((nw * 88) / 78);
      const W = window.innerWidth;
      let rest: NovaPosture = "float";
      if (drag.active) {
        // held: the pointer handler moves it
      } else if (mode === "drift") {
        // ejected into space: coasts on, slowly, turning over and over
        x += vx * dt; y += vy * dt;
        const coast = Math.pow(0.72, dt);
        vx *= coast; vy *= coast;
        tilt += spin * dt;
        spin *= Math.pow(0.9, dt);
        if (now > driftUntil) {
          mode = "home";
          returning = true;
          tilt = ((tilt % 360) + 540) % 360 - 180; // unwind by the short way round
        }
      } else {
        const t = target(nw, nh);
        const k = reduce ? 1 : 1 - Math.exp(-dt * (returning ? 2.6 : 5));
        const px = x;
        x += (t.x - x) * k; y += (t.y - y) * k;
        // lean into the flight, level out on arrival
        const lean = Math.max(-16, Math.min(16, ((x - px) / Math.max(dt, 0.001)) * 0.02));
        tilt += (lean - tilt) * Math.min(1, dt * (returning ? 3 : 8));
        const gap = Math.hypot(t.x - x, t.y - y);
        if (gap < 10) rest = t.posture;
        if (returning && gap < 8) {
          returning = false;
          say({ mood: "happy", say: "Phew, I'm back. Now, where were we?" });
        }
      }
      setPose(rest);
      // bobbing is for flight; resting on something means staying put
      const bob = reduce || rest !== "float" || drag.active || mode === "drift" ? 0 : Math.sin(now / 700) * 2.5;
      el.style.width = `${nw}px`;
      el.style.height = `${nh}px`;
      // only Nova turns; the speech bubble stays level so it can be read mid-spin
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px)`;
      el.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
      el.dataset.side = x < 150 ? "l" : x > W - 190 ? "r" : "c";
      el.toggleAttribute("data-below", y < 110);
    };
    raf = requestAnimationFrame(frame);

    // the guide: next tip for the current section, when Nova is free to talk
    const settled = () => shown && !sad && !drag.active && mode === "home" && !returning && performance.now() > busyUntil;
    const tip = (hello = false) => {
      const s = SECTIONS[sec];
      const n = told.get(s.id) ?? 0;
      if (n >= s.lines.length) return;
      told.set(s.id, n + 1);
      say({ mood: hello ? s.hello : s.pose === "point" ? "point" : "happy", say: s.lines[n] });
    };
    const guide = window.setInterval(() => { if (settled()) tip(); }, TIP_EVERY);

    // arrive once the intro has handed over
    const wait = window.setInterval(() => {
      if (!root.hasAttribute("data-ready")) return;
      window.clearInterval(wait);
      window.setTimeout(() => {
        shown = true;
        setOn(true);
        tip(true);
      }, reduce ? 0 : 2700);
    }, 200);

    // section tracking: the band across the middle of the viewport decides
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      }
      let next = 0;
      SECTIONS.forEach((s, i) => { if (visible.has(s.id)) next = i; });
      if (next === sec) return;
      sec = next;
      setSection(next);
      if (shown && !told.has(SECTIONS[next].id) && !drag.active && mode === "home") tip(true);
    }, { rootMargin: "-45% 0px -45% 0px" });
    SECTIONS.forEach((s) => { const n = document.getElementById(s.id); if (n) io.observe(n); });

    // reactions
    const onCue = (e: Event) => { if (shown && !drag.active && mode === "home") say((e as CustomEvent<Cue>).detail); };
    let lastTrack = ambient.currentIndex();
    const unTrack = ambient.subscribe(() => {
      const i = ambient.currentIndex();
      if (i === lastTrack) return;
      lastTrack = i;
      if (shown) say({ mood: "happy", say: `Now playing: ${TRACKS[i].title}.` });
    });

    let coolUntil = 0;
    const react = (c: Cue) => {
      const now = performance.now();
      if (now < coolUntil || !settled()) return;
      coolUntil = now + 6000;
      say(c);
    };
    let lastY = window.scrollY, lastT = performance.now(), speed = 0;
    const onScroll = () => {
      const now = performance.now();
      const v = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT) * 1000;
      lastY = window.scrollY; lastT = now;
      speed = speed * 0.6 + v * 0.4;
      if (speed > 4200) react({ mood: "surprised", say: "Easy, you'll miss the good parts." });
    };
    // too much mouse: lots of distance, or a shake (quick left-right reversals), in a short spell
    let dir = 0;
    const flips: number[] = [];
    const travel: [number, number][] = [];
    const onMove = (e: PointerEvent) => {
      if (drag.active) return;
      const now = performance.now();
      travel.push([now, Math.hypot(e.movementX, e.movementY)]);
      while (travel.length && now - travel[0][0] > 1500) travel.shift();
      const dist = travel.reduce((a, [, d]) => a + d, 0);
      if (dist > 7000) { travel.length = 0; react({ mood: "dizzy", say: "So much zooming around. I'm getting dizzy." }); }
      if (Math.abs(e.movementX) < 14) return;
      const d = Math.sign(e.movementX);
      if (d === dir) return;
      dir = d;
      flips.push(now);
      while (flips.length && now - flips[0] > 700) flips.shift();
      if (flips.length >= 6) react({ mood: "dizzy", say: "All that shaking made my head spin." });
    };
    // lingering on something interesting makes Nova curious
    let hoverEl: Element | null = null, hoverTimer = 0;
    const onOver = (e: PointerEvent) => {
      const hit = (e.target as Element).closest?.(".ng-map-nav button, .ng-group, .ng-journey li, .ng-badge, .ng-cta") ?? null;
      if (hit === hoverEl) return;
      hoverEl = hit;
      window.clearTimeout(hoverTimer);
      if (hit) hoverTimer = window.setTimeout(() => { if (settled()) say({ mood: "curious", ms: 1800 }); }, 1300);
    };
    const onLeave = () => { if (!shown || drag.active) return; sad = true; say({ mood: "sad", say: "I'll wait right here.", ms: 1e9 }); };
    const onEnter = () => { if (!sad) return; sad = false; say({ mood: "happy", say: "There you are. Let's keep exploring." }); };
    let title = document.title;
    const onVisibility = () => {
      if (document.hidden) { title = document.title; document.title = "Nova misses you"; }
      else { document.title = title; if (shown) say({ mood: "wave", say: "Welcome back. Pick up where you left off." }); }
    };

    // grab, spin around, toss
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.id = e.pointerId; drag.active = false;
      drag.sx = e.clientX; drag.sy = e.clientY; drag.ox = e.clientX - x; drag.oy = e.clientY - y;
      drag.t = performance.now(); drag.lx = e.clientX; drag.ly = e.clientY;
      drag.turn = 0; drag.heading = NaN; drag.dizzy = false;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      if (!drag.active && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.active = true; mode = "home"; returning = false; vx = vy = 0; spin = 0;
        say({ mood: "surprised", say: "Hey, put me down!", ms: 1e9 });
      }
      if (!drag.active) return;
      const now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
      const mx = e.clientX - drag.lx, my = e.clientY - drag.ly;
      vx = vx * 0.5 + (mx / dt) * 0.5;
      vy = vy * 0.5 + (my / dt) * 0.5;
      // swung in circles: add up how far the direction of travel has turned
      if (Math.hypot(mx, my) > 3) {
        const h = Math.atan2(my, mx);
        if (!Number.isNaN(drag.heading)) {
          let d = h - drag.heading;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          drag.turn += d;
        }
        drag.heading = h;
      }
      if (!drag.dizzy && Math.abs(drag.turn) > Math.PI * 4) {
        drag.dizzy = true;
        say({ mood: "dizzy", say: "Stop spinning me, everything is going round.", ms: 1e9 });
      }
      drag.t = now; drag.lx = e.clientX; drag.ly = e.clientY;
      x = e.clientX - drag.ox; y = e.clientY - drag.oy;
      tilt = Math.max(-25, Math.min(25, vx * 0.02));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      drag.id = -1;
      if (!drag.active) return;
      drag.active = false;
      swallowClick = true;
      if (performance.now() - drag.t > 80) { vx = 0; vy = 0; } // held still before letting go
      const fling = Math.hypot(vx, vy);
      if (fling > 350 && !reduce) {
        // tossed: float away spinning like a crewmate out of the airlock, then come back
        // slow and floaty, so it drifts across the screen rather than out of it
        const cap = Math.min(1, 320 / fling);
        vx *= cap; vy *= cap;
        spin = (vx >= 0 ? 1 : -1) * Math.min(600, Math.max(160, fling * 0.3));
        mode = "drift";
        driftUntil = performance.now() + 3400;
        say({ mood: "dizzy", say: "Nova was not the impostor.", ms: 3400 });
      } else {
        returning = true;
        say(drag.dizzy ? { mood: "dizzy", say: "The room is still spinning.", ms: 2200 } : { mood: "happy", ms: 900 });
      }
    };
    // a drag is not a click; a plain click on the docked Nova skips the track
    const click = (e: MouseEvent) => {
      if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); return; }
      if (SECTIONS[sec].spot === "dock" && ambient.isPlaying()) ambient.next();
    };

    window.addEventListener("ng:nova", onCue);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("mouseenter", onEnter);
    document.addEventListener("visibilitychange", onVisibility);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(wait);
      window.clearInterval(guide);
      [cueTimer, bubbleTimer, hoverTimer].forEach((t) => window.clearTimeout(t));
      io.disconnect();
      unTrack();
      window.removeEventListener("ng:nova", onCue);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
  }, []);

  const mood = cue?.mood ?? SECTIONS[section].pose;
  return (
    <div className="ng-cmp" ref={box} data-on={on ? "" : undefined}>
      {bubble ? <span className="ng-cmp-bubble" role="status">{bubble}</span> : null}
      {mood === "sign" ? <span className="ng-cmp-sign" aria-hidden="true">say hi</span> : null}
      {mood === "juggle" ? (
        <span className="ng-cmp-juggle" aria-hidden="true">
          {JUGGLE.map((l, i) => <img key={l} src={`/assets/logos/${l}.svg`} alt="" width={14} height={14} style={{ animationDelay: `${i * -0.4}s` }} />)}
        </span>
      ) : null}
      <span className="ng-cmp-shadow" aria-hidden="true" />
      <div className="ng-cmp-body">
        <Nova mood={mood} typing={false} reduce={reduceNow} posture={posture} />
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};
