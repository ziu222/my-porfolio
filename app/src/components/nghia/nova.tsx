import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ambient } from "@/lib/ambient";

export type NovaMood =
  | "idle" | "happy" | "error" | "wave"
  | "surprised" | "curious" | "starry" | "dizzy" | "sad"
  // poses the site companion strikes per section
  | "point" | "sign" | "juggle";

// 23 x 26 pixel astronaut: helmet with a glinting visor, chest panel, belt and oxygen pack; the
// legs and boots below the belt depend on the posture.
// Eyes, arms and headphones are drawn as overlays so they can move.
const BODY = [
  "...........A...........",
  "..........OOO..........",
  ".......OOOWWWOOO.......",
  "......OWWWWWWWWWO......",
  ".....OWWWWWWWWWWWO.....",
  "....OWWWWOOOOOWWWSO....",
  "....OWWOOVVVVVOOSSO....",
  "....OWOVGHVVVVVVOSO....",
  "...OWWOHVVVVVVVVOSSO...",
  "....OWOVVVVVVVVVOSO....",
  "....OWOVVVVVVVVVOSO....",
  "....OWWOVVVVVVVHSSO....",
  ".....OWWOOVVVOOSSO.....",
  "......OWWWOOOSSSO......",
  ".....ODWWWWWWSSSDO.....",
  ".....ODWDDDDDDDWDO.....",
  ".....ODWWWWWWWWSDO.....",
  ".....ODWWKKKKKWSDO.....",
  ".....ODWWKRBYKWSDO.....",
  ".....ODWWKKKKKWSDO.....",
  ".....ODWWWWWWWWSDO.....",
  ".....ODWDDDPDDDDDO.....",
];
const COLORS: Record<string, string> = {
  O: "#3a3550", W: "#f4efe6", S: "#b9b1c4", D: "#8e86a0", V: "#1a1830", H: "#4a4680", G: "#8f89d8", K: "#2a2640",
  R: "#ff7a93", B: "#9fd3ff", Y: "#ffd9a8", P: "#ff7a93", E: "#ffc2cf", L: "#ffd6de", A: "#ff7a93", T: "#9fd3ff",
};
type Px = [number, number, string];

const ARM_L: Px[] = [
  [5, 16, "W"], [4, 16, "S"], [4, 17, "W"], [3, 17, "S"], [4, 18, "W"], [3, 18, "S"], [4, 19, "D"], [3, 19, "D"],
  [3, 16, "O"], [4, 15, "O"], [2, 17, "O"], [2, 18, "O"], [4, 20, "O"], [2, 19, "O"], [3, 20, "O"],
];
const ARM_R: Px[] = [
  [17, 16, "W"], [18, 16, "S"], [18, 17, "W"], [19, 17, "S"], [18, 18, "W"], [19, 18, "S"], [18, 19, "D"], [19, 19, "D"],
  [19, 16, "O"], [18, 15, "O"], [20, 17, "O"], [20, 18, "O"], [18, 20, "O"], [20, 19, "O"], [19, 20, "O"],
];
const ARM_R_UP: Px[] = [
  [17, 16, "W"], [18, 16, "S"], [18, 15, "W"], [19, 15, "S"], [19, 14, "W"], [20, 14, "S"], [19, 13, "W"], [20, 13, "S"],
  [19, 12, "D"], [20, 12, "D"], [19, 16, "O"], [18, 17, "O"], [18, 14, "O"], [20, 15, "O"], [21, 14, "O"], [18, 13, "O"],
  [21, 13, "O"], [18, 12, "O"], [19, 11, "O"], [21, 12, "O"], [20, 11, "O"],
];
const ARM_L_UP: Px[] = [
  [5, 16, "W"], [4, 16, "S"], [4, 15, "W"], [3, 15, "S"], [3, 14, "W"], [2, 14, "S"], [3, 13, "W"], [2, 13, "S"],
  [3, 12, "D"], [2, 12, "D"], [3, 16, "O"], [4, 17, "O"], [4, 14, "O"], [2, 15, "O"], [1, 14, "O"], [4, 13, "O"],
  [1, 13, "O"], [4, 12, "O"], [3, 11, "O"], [1, 12, "O"], [2, 11, "O"],
];
const ARM_R_POINT: Px[] = [
  [17, 16, "W"], [18, 16, "S"], [18, 17, "W"], [19, 17, "S"], [19, 18, "W"], [20, 18, "S"], [20, 19, "D"], [21, 19, "D"],
  [19, 16, "O"], [18, 15, "O"], [18, 18, "O"], [20, 17, "O"], [19, 19, "O"], [21, 18, "O"], [20, 20, "O"], [22, 19, "O"],
  [21, 20, "O"],
];
// legs per posture, rows 22-25, split so each leg can swing on its own
export type NovaPosture = "stand" | "sit" | "hang" | "float";
const LEGS: Record<NovaPosture, { l: Px[]; r: Px[] }> = {
  stand: {
    l: [
      [6, 22, "O"], [7, 22, "O"], [8, 22, "W"], [9, 22, "W"], [10, 22, "S"], [11, 22, "O"], [7, 23, "O"], [8, 23, "W"],
      [9, 23, "W"], [10, 23, "S"], [11, 23, "O"], [7, 24, "O"], [8, 24, "D"], [9, 24, "D"], [10, 24, "D"], [11, 24, "O"],
      [8, 25, "O"], [9, 25, "O"], [10, 25, "O"],
    ],
    r: [
      [12, 22, "W"], [13, 22, "W"], [14, 22, "S"], [15, 22, "O"], [16, 22, "O"], [12, 23, "W"], [13, 23, "W"], [14, 23, "S"],
      [15, 23, "O"], [12, 24, "D"], [13, 24, "D"], [14, 24, "D"], [15, 24, "O"], [12, 25, "O"], [13, 25, "O"], [14, 25, "O"],
    ],
  },
  sit: {
    l: [
      [6, 22, "O"], [7, 22, "W"], [8, 22, "W"], [9, 22, "W"], [10, 22, "W"], [11, 22, "O"], [7, 23, "O"], [8, 23, "W"],
      [9, 23, "S"], [10, 23, "O"], [6, 24, "O"], [7, 24, "D"], [8, 24, "D"], [9, 24, "D"], [10, 24, "O"], [7, 25, "O"],
      [8, 25, "O"], [9, 25, "O"],
    ],
    r: [
      [12, 22, "W"], [13, 22, "W"], [14, 22, "W"], [15, 22, "W"], [16, 22, "O"], [12, 23, "O"], [13, 23, "S"], [14, 23, "W"],
      [15, 23, "O"], [12, 24, "O"], [13, 24, "D"], [14, 24, "D"], [15, 24, "D"], [16, 24, "O"], [13, 25, "O"], [14, 25, "O"],
      [15, 25, "O"],
    ],
  },
  hang: {
    l: [
      [6, 22, "O"], [7, 22, "O"], [8, 22, "W"], [9, 22, "W"], [10, 22, "S"], [11, 22, "O"], [7, 23, "O"], [8, 23, "W"],
      [9, 23, "W"], [10, 23, "S"], [11, 23, "O"], [8, 24, "O"], [9, 24, "D"], [10, 24, "D"], [11, 24, "O"], [9, 25, "O"],
      [10, 25, "O"],
    ],
    r: [
      [12, 22, "W"], [13, 22, "W"], [14, 22, "S"], [15, 22, "O"], [16, 22, "O"], [12, 23, "W"], [13, 23, "W"], [14, 23, "S"],
      [15, 23, "O"], [12, 24, "D"], [13, 24, "D"], [14, 24, "O"], [12, 25, "O"], [13, 25, "O"],
    ],
  },
  float: {
    l: [
      [6, 22, "O"], [7, 22, "O"], [8, 22, "W"], [9, 22, "W"], [10, 22, "S"], [11, 22, "O"], [5, 23, "O"], [6, 23, "W"],
      [7, 23, "W"], [8, 23, "S"], [9, 23, "O"], [4, 24, "O"], [5, 24, "D"], [6, 24, "D"], [7, 24, "D"], [8, 24, "O"],
      [5, 25, "O"], [6, 25, "O"], [7, 25, "O"],
    ],
    r: [
      [12, 22, "W"], [13, 22, "W"], [14, 22, "S"], [15, 22, "O"], [16, 22, "O"], [13, 23, "O"], [14, 23, "W"], [15, 23, "W"],
      [16, 23, "S"], [17, 23, "O"], [14, 24, "O"], [15, 24, "D"], [16, 24, "D"], [17, 24, "D"], [18, 24, "O"], [15, 25, "O"],
      [16, 25, "O"], [17, 25, "O"],
    ],
  },
};
// sitting: hands planted on the ledge beside the hips; floating: arms out to the sides
const ARM_L_SIT: Px[] = [
  [5, 16, "W"], [4, 16, "S"], [4, 17, "W"], [3, 17, "S"], [4, 18, "W"], [3, 18, "S"], [4, 19, "W"], [3, 19, "S"],
  [4, 20, "W"], [3, 20, "S"], [4, 21, "D"], [3, 21, "D"], [3, 16, "O"], [4, 15, "O"], [2, 17, "O"], [2, 18, "O"],
  [2, 19, "O"], [2, 20, "O"], [4, 22, "O"], [2, 21, "O"], [3, 22, "O"],
];
const ARM_R_SIT: Px[] = [
  [17, 16, "W"], [18, 16, "S"], [18, 17, "W"], [19, 17, "S"], [18, 18, "W"], [19, 18, "S"], [18, 19, "W"], [19, 19, "S"],
  [18, 20, "W"], [19, 20, "S"], [18, 21, "D"], [19, 21, "D"], [19, 16, "O"], [18, 15, "O"], [20, 17, "O"], [20, 18, "O"],
  [20, 19, "O"], [20, 20, "O"], [18, 22, "O"], [20, 21, "O"], [19, 22, "O"],
];
const ARM_L_SPREAD: Px[] = [
  [5, 16, "W"], [4, 16, "W"], [3, 16, "S"], [3, 15, "W"], [2, 15, "D"], [1, 15, "D"], [4, 17, "O"], [4, 15, "O"],
  [2, 16, "O"], [3, 17, "O"], [3, 14, "O"], [2, 14, "O"], [0, 15, "O"], [1, 16, "O"], [1, 14, "O"],
];
const ARM_R_SPREAD: Px[] = [
  [17, 16, "W"], [18, 16, "W"], [19, 16, "S"], [19, 15, "W"], [20, 15, "D"], [21, 15, "D"], [18, 17, "O"], [18, 15, "O"],
  [20, 16, "O"], [19, 17, "O"], [19, 14, "O"], [20, 14, "O"], [22, 15, "O"], [21, 16, "O"], [21, 14, "O"],
];

const PHONES: Px[] = [
  [10, 1, "P"], [12, 1, "P"], [7, 2, "P"], [8, 2, "P"], [9, 2, "P"], [13, 2, "P"], [14, 2, "P"], [15, 2, "P"],
  [6, 3, "P"], [16, 3, "P"], [5, 4, "P"], [17, 4, "P"], [4, 5, "P"], [18, 5, "P"], [3, 7, "P"], [19, 7, "P"],
  [3, 8, "P"], [19, 8, "P"], [3, 9, "P"], [19, 9, "P"], [3, 10, "P"], [19, 10, "P"], [2, 8, "P"], [20, 8, "P"], [2, 9, "P"], [20, 9, "P"],
];

type Face = "open" | "blink" | "happy" | "error" | "love" | "sleep" | "surprised" | "starry" | "dizzy" | "sad" | "blush" | "yawn";
const FACES: Record<Exclude<Face, "open" | "sleep">, Px[]> = {
  blink: [[8, 9, "E"], [9, 9, "E"], [14, 9, "E"], [13, 9, "E"]],
  happy: [[8, 9, "E"], [9, 8, "E"], [10, 9, "E"], [14, 9, "E"], [13, 8, "E"], [12, 9, "E"]],
  error: [
    [8, 8, "E"], [10, 8, "E"], [9, 9, "E"], [8, 10, "E"], [10, 10, "E"], [14, 8, "E"], [12, 8, "E"], [13, 9, "E"],
    [14, 10, "E"], [12, 10, "E"],
  ],
  love: [
    [8, 8, "P"], [10, 8, "P"], [8, 9, "P"], [9, 9, "P"], [10, 9, "P"], [9, 10, "P"], [14, 8, "P"], [12, 8, "P"],
    [14, 9, "P"], [13, 9, "P"], [12, 9, "P"], [13, 10, "P"],
  ],
  surprised: [
    [8, 8, "E"], [9, 8, "E"], [8, 9, "E"], [9, 9, "E"], [14, 8, "E"], [13, 8, "E"], [14, 9, "E"], [13, 9, "E"],
    [11, 11, "E"],
  ], // wide eyes, little "o" mouth
  starry: [
    [9, 8, "Y"], [8, 9, "Y"], [9, 9, "Y"], [10, 9, "Y"], [9, 10, "Y"], [13, 8, "Y"], [14, 9, "Y"], [13, 9, "Y"],
    [12, 9, "Y"], [13, 10, "Y"],
  ],
  dizzy: [
    [8, 8, "E"], [9, 8, "E"], [10, 8, "E"], [10, 9, "E"], [10, 10, "E"], [9, 10, "E"], [8, 10, "E"], [9, 9, "E"],
    [14, 8, "E"], [13, 8, "E"], [12, 8, "E"], [12, 9, "E"], [12, 10, "E"], [13, 10, "E"], [14, 10, "E"], [13, 9, "E"],
  ], // little spirals
  sad: [[9, 9, "E"], [9, 10, "E"], [10, 8, "E"], [13, 9, "E"], [13, 10, "E"], [12, 8, "E"], [8, 11, "T"]], // droopy, one tear
  blush: [
    [8, 9, "E"], [9, 8, "E"], [10, 9, "E"], [7, 10, "P"], [8, 10, "P"], [14, 9, "E"], [13, 8, "E"], [12, 9, "E"],
    [15, 10, "P"], [14, 10, "P"],
  ],
  yawn: [[8, 8, "E"], [9, 8, "E"], [14, 8, "E"], [13, 8, "E"], [11, 10, "E"], [11, 11, "E"], [10, 10, "E"], [12, 10, "E"]],
};
function eyes(face: Face, dx: number, dy: number): Px[] {
  if (face === "open") return [[9 + dx, 8 + dy, "E"], [9 + dx, 9 + dy, "E"], [13 + dx, 8 + dy, "E"], [13 + dx, 9 + dy, "E"]];
  return FACES[face === "sleep" ? "blink" : face];
}

const SLEEP_AFTER = 20000;

/**
 * Nova, the terminal's pixel astronaut. Eyes follow the pointer anywhere on the page, look down
 * at the prompt while you type, blink and breathe when idle, doze off when left alone, react to
 * command results, wear headphones and dance while the music plays, and love being clicked (a
 * lot of clicks and Nova blushes).
 */
export function Nova({ mood, typing, reduce, posture = "stand" }: { mood: NovaMood; typing: boolean; reduce: boolean; posture?: NovaPosture }) {
  const svg = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState<[number, number]>([0, 0]);
  const [blink, setBlink] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [yawning, setYawning] = useState(false);
  const body = useRef<SVGGElement>(null);
  const dozed = useRef(false);
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
      dozed.current = false;
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
      const tired = performance.now() - lastActive.current > SLEEP_AFTER;
      // a big yawn on the way to sleep
      if (tired && !dozed.current) {
        setYawning(true);
        window.setTimeout(() => setYawning(false), 1500);
      }
      dozed.current = tired;
      setAsleep(tired);
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
    dozed.current = false;
    setAsleep(false);
    setLoved((n) => n + 1);
    const burst = [0, 1, 2].map((i) => ({ id: ++heartId.current, x: 20 + i * 30 + Math.random() * 12 }));
    setHearts((h) => [...h, ...burst]);
    window.setTimeout(() => setHearts((h) => h.filter((x) => !burst.includes(x))), 1300);
  };

  const dozing = asleep && !typing && mood === "idle";
  const face: Face = loved >= 3 ? "blush" : loved ? "love"
    : mood === "happy" || mood === "wave" || mood === "sign" ? "happy"
    : mood === "error" ? "error"
    : mood === "surprised" || mood === "starry" || mood === "dizzy" || mood === "sad" ? mood
    : dozing && yawning ? "yawn" : dozing ? "sleep" : blink ? "blink" : "open";
  const [dx, dy] = typing ? [0, 1] : mood === "curious" ? [1, -1] : mood === "juggle" ? [0, -1] : look;
  const armsUp = mood === "sign" || mood === "juggle";
  // arms follow the mood first (waving, holding a sign), then the posture: hanging keeps a hand
  // on the strap, sitting plants both on the ledge, floating spreads them out
  const px: Px[] = [
    ...eyes(face, dx, dy),
    ...(armsUp ? ARM_L_UP : posture === "sit" ? ARM_L_SIT : posture === "float" ? ARM_L_SPREAD : ARM_L),
    ...(mood === "wave" || armsUp || posture === "hang" ? ARM_R_UP
      : mood === "point" ? ARM_R_POINT : posture === "sit" ? ARM_R_SIT : posture === "float" ? ARM_R_SPREAD : ARM_R),
    ...(music ? PHONES : []),
  ];
  const legs = LEGS[posture];
  const state = loved ? "love" : mood !== "idle" ? mood : music ? "music" : dozing ? "sleep" : typing ? "typing" : "idle";

  // dancing: while the music plays the body bounces on the soundtrack's real low end
  useEffect(() => {
    const g = body.current, an = ambient.analyser();
    if (state !== "music" || reduce || !g || !an) return;
    const data = new Uint8Array(an.frequencyBinCount);
    let raf = 0, beat = 0;
    const tick = (now: number) => {
      an.getByteFrequencyData(data);
      const v = (data[1] + data[2] + data[3]) / 765;
      beat += (v - beat) * 0.35;
      // whole pixels only, like the rest of the sprite
      g.style.transform = `translateY(${-Math.round(beat * 2.2)}px) rotate(${(Math.sin(now / 260) * beat * 7).toFixed(1)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); g.style.transform = ""; };
  }, [state, reduce]);

  return (
    <button type="button" className="ng-nova" data-state={state} data-posture={posture} data-reduce={reduce ? "" : undefined} onClick={pet} aria-label="Nova, the mission control mascot. Click to say hi.">
      <svg ref={svg} viewBox="0 -1 23 27" shapeRendering="crispEdges" aria-hidden="true">
        <g className="ng-nova-body" ref={body}>
          {BODY.flatMap((row, y) =>
            [...row].map((c, x) => (c === "." ? null : (
              <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} className={c === "A" ? "ng-nova-antenna" : undefined} />
            ))),
          )}
          {/* knees stay put; each shin and boot is its own group so the legs can swing */}
          {[legs.l, legs.r].map((leg, side) => (
            <g key={side}>
              {leg.filter((p) => p[1] === 22).map(([x, y, c]) => <rect key={`k${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} />)}
              <g className="ng-nova-leg" data-side={side ? "r" : "l"}>
                {leg.filter((p) => p[1] > 22).map(([x, y, c]) => <rect key={`s${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} />)}
              </g>
            </g>
          ))}
          {px.map(([x, y, c], i) => <rect key={`o${i}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} />)}
        </g>
      </svg>
      {mood === "curious" ? <span className="ng-nova-q" aria-hidden="true">?</span> : null}
      {state === "sleep" ? (
        <span className="ng-nova-z" aria-hidden="true"><i>z</i><i>z</i></span>
      ) : null}
      {hearts.map((h) => (
        <span key={h.id} className="ng-nova-heart" style={{ left: `${h.x}%` }} aria-hidden="true" />
      ))}
    </button>
  );
}
