import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ambient } from "@/lib/ambient";

export type NovaMood = "idle" | "happy" | "error" | "wave";

// 15 x 16 pixel astronaut. Eyes and arms are drawn as overlays so they can move.
const BODY = [
  ".......A.......",
  ".......O.......",
  "....OOOOOOO....",
  "...OWWWWWWWO...",
  "..OWVVVVVVVWO..",
  "..OWVHVVVVVWO..",
  "..OWVVVVVVVWO..",
  "..OWVVVVVVVWO..",
  "...OWWWWWWWO...",
  "....OOOOOOO....",
  "...OWWWPWWWO...",
  "..OWWWWWWWWWO..",
  "..OSWWWWWWWSO..",
  "...OWWOOOWWO...",
  "...OSSO.OSSO...",
  "....OO...OO....",
];
const COLORS: Record<string, string> = {
  O: "#3a3550", W: "#f4efe6", S: "#b9b1c4", V: "#1a1830", H: "#4a4680",
  P: "#ff7a93", E: "#ffc2cf", L: "#ffd6de", A: "#ff7a93",
};
type Px = [number, number, string];

const ARM_L: Px[] = [[1, 10, "O"], [1, 11, "W"], [1, 12, "O"]];
const ARM_R: Px[] = [[13, 10, "O"], [13, 11, "W"], [13, 12, "O"]];
const ARM_R_UP: Px[] = [[13, 10, "O"], [13, 9, "W"], [14, 8, "W"], [14, 7, "O"]];
const PHONES: Px[] = [
  [3, 2, "P"], [4, 2, "P"], [5, 2, "P"], [6, 2, "P"], [7, 2, "P"], [8, 2, "P"], [9, 2, "P"], [10, 2, "P"], [11, 2, "P"],
  [2, 3, "P"], [12, 3, "P"], [1, 4, "P"], [1, 5, "P"], [1, 6, "P"], [13, 4, "P"], [13, 5, "P"], [13, 6, "P"],
];

type Face = "open" | "blink" | "happy" | "error" | "love" | "sleep";
function eyes(face: Face, dx: number, dy: number): Px[] {
  switch (face) {
    case "blink":
    case "sleep":
      return [[5 + dx, 6, "E"], [6 + dx, 6, "E"], [8 + dx, 6, "E"], [9 + dx, 6, "E"]];
    case "happy":
      return [[4, 6, "E"], [5, 5, "E"], [6, 6, "E"], [8, 6, "E"], [9, 5, "E"], [10, 6, "E"]];
    case "error":
      return [[4, 5, "E"], [5, 6, "E"], [4, 7, "E"], [10, 5, "E"], [9, 6, "E"], [10, 7, "E"]];
    case "love":
      return [[4, 5, "P"], [6, 5, "P"], [5, 6, "P"], [8, 5, "P"], [10, 5, "P"], [9, 6, "P"]];
    default:
      return [[5 + dx, 5 + dy, "E"], [5 + dx, 6 + dy, "E"], [9 + dx, 5 + dy, "E"], [9 + dx, 6 + dy, "E"]];
  }
}

const SLEEP_AFTER = 20000;

/**
 * Nova, the terminal's pixel astronaut. Eyes follow the pointer anywhere on the page, look down
 * at the prompt while you type, blink and breathe when idle, doze off when left alone, react to
 * command results, wear headphones while the music plays, and love being clicked.
 */
export function Nova({ mood, typing, reduce }: { mood: NovaMood; typing: boolean; reduce: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState<[number, number]>([0, 0]);
  const [blink, setBlink] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [loved, setLoved] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const heartId = useRef(0);
  const lastActive = useRef(0);
  const music = useSyncExternalStore(ambient.subscribe, ambient.isPlaying, () => false);

  // eyes follow the pointer: only re-render when the 3x3 look direction actually changes
  useEffect(() => {
    lastActive.current = performance.now();
    let raf = 0, px = 0, py = 0;
    const update = () => {
      raf = 0;
      const r = svg.current?.getBoundingClientRect();
      if (!r) return;
      const dxp = px - (r.left + r.width / 2), dyp = py - (r.top + r.height * 0.36);
      const dx = Math.abs(dxp) < r.width * 0.6 ? 0 : Math.sign(dxp);
      const dy = Math.abs(dyp) < r.height * 0.6 ? 0 : dyp < 0 ? -1 : 1;
      setLook((l) => (l[0] === dx && l[1] === dy ? l : [dx, dy]));
    };
    const wake = () => {
      lastActive.current = performance.now();
      setAsleep(false);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      wake();
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", wake);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // blink at random intervals; doze off after a quiet spell
  useEffect(() => {
    let t = 0;
    const loop = () => {
      setAsleep(performance.now() - lastActive.current > SLEEP_AFTER);
      setBlink(true);
      window.setTimeout(() => setBlink(false), 130);
      t = window.setTimeout(loop, 2200 + Math.random() * 3200);
    };
    t = window.setTimeout(loop, 1800);
    return () => clearTimeout(t);
  }, []);

  // activity keeps Nova awake; the next blink tick re-checks the quiet timer
  useEffect(() => {
    if (typing || mood !== "idle") lastActive.current = performance.now();
  }, [typing, mood]);

  useEffect(() => {
    if (!loved) return;
    const t = window.setTimeout(() => setLoved(0), 1400);
    return () => clearTimeout(t);
  }, [loved]);

  const pet = () => {
    lastActive.current = performance.now();
    setAsleep(false);
    setLoved((n) => n + 1);
    const burst = [0, 1, 2].map((i) => ({ id: ++heartId.current, x: 20 + i * 30 + Math.random() * 12 }));
    setHearts((h) => [...h, ...burst]);
    window.setTimeout(() => setHearts((h) => h.filter((x) => !burst.includes(x))), 1300);
  };

  const dozing = asleep && !typing && mood === "idle";
  const face: Face = loved ? "love" : mood === "happy" || mood === "wave" ? "happy" : mood === "error" ? "error"
    : dozing ? "sleep" : blink ? "blink" : "open";
  const [dx, dy] = typing ? [0, 1] : look;
  const px: Px[] = [
    ...eyes(face, dx, dy),
    ...ARM_L,
    ...(mood === "wave" ? ARM_R_UP : ARM_R),
    ...(music ? PHONES : []),
  ];
  const state = loved ? "love" : mood !== "idle" ? mood : music ? "music" : dozing ? "sleep" : typing ? "typing" : "idle";

  return (
    <button type="button" className="ng-nova" data-state={state} data-reduce={reduce ? "" : undefined} onClick={pet} aria-label="Nova, the mission control mascot. Click to say hi.">
      <svg ref={svg} viewBox="0 -1 15 17" shapeRendering="crispEdges" aria-hidden="true">
        <g className="ng-nova-body">
          {BODY.flatMap((row, y) =>
            [...row].map((c, x) => (c === "." ? null : (
              <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} className={c === "A" ? "ng-nova-antenna" : undefined} />
            ))),
          )}
          {px.map(([x, y, c], i) => <rect key={`o${i}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} />)}
        </g>
      </svg>
      {state === "sleep" ? (
        <span className="ng-nova-z" aria-hidden="true"><i>z</i><i>z</i></span>
      ) : null}
      {hearts.map((h) => (
        <span key={h.id} className="ng-nova-heart" style={{ left: `${h.x}%` }} aria-hidden="true" />
      ))}
    </button>
  );
}
