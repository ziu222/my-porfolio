/**
 * Generative soundtrack built live with Web Audio: each track is a chord progression voiced as
 * detuned pads with a soft sub, plus high "star" plucks and, on some tracks, a steady arpeggio,
 * all through a synthetic reverb. No audio files, no licences. Tracks crossfade on change and
 * advance on their own (in order, or at random with shuffle on).
 * Browsers keep audio locked until a user gesture: start() arms it, the first click unlocks it.
 */

type Listener = () => void;

export type Track = {
  id: string;
  title: string;
  mood: string;
  /** Record label colour in the player. */
  tint: string;
  chords: number[][]; // MIDI notes, voiced low and open
  chordSeconds: number;
  pad: OscillatorType;
  cutoff: number;
  /** [min, max] ms between star plucks; 0 disables them. */
  sparkle: [number, number];
  sparkleOctave: number;
  /** Seconds between arpeggio notes; 0 disables it. */
  arp: number;
};

export const TRACKS: Track[] = [
  {
    id: "nebula", title: "Nebula Drift", mood: "Drifting pads", tint: "#ff7a93",
    chords: [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 59, 61], [45, 52, 59, 61, 64]],
    chordSeconds: 9, pad: "sawtooth", cutoff: 760, sparkle: [650, 1750], sparkleOctave: 24, arp: 0,
  },
  {
    id: "lullaby", title: "Orbit Lullaby", mood: "Warm and slow", tint: "#ffd9a8",
    chords: [[41, 48, 52, 55, 57], [45, 52, 55, 60, 64], [38, 45, 50, 53, 57], [46, 53, 57, 62, 65]],
    chordSeconds: 11, pad: "triangle", cutoff: 1100, sparkle: [1400, 3200], sparkleOctave: 24, arp: 0,
  },
  {
    id: "solar", title: "Solar Wind", mood: "Bright arpeggios", tint: "#8fd4ff",
    chords: [[52, 59, 63, 66, 68], [49, 56, 59, 63, 64], [45, 52, 56, 59, 63], [47, 54, 58, 61, 63]],
    chordSeconds: 7, pad: "sawtooth", cutoff: 1350, sparkle: [2200, 4200], sparkleOctave: 24, arp: 0.3,
  },
  {
    id: "deep", title: "Deep Field", mood: "Dark and spacious", tint: "#b39cff",
    chords: [[48, 55, 58, 62, 63], [44, 51, 55, 58, 60], [41, 48, 51, 55, 58], [43, 50, 53, 58, 62]],
    chordSeconds: 12, pad: "sine", cutoff: 520, sparkle: [2600, 5200], sparkleOctave: 12, arp: 0,
  },
];

const LOOPS_PER_TRACK = 3;
const VOLUME = 0.36;
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const trackLength = (t: Track) => t.chords.length * t.chordSeconds * LOOPS_PER_TRACK;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let voice: GainNode | null = null; // current track's submix, swapped on crossfade
let analyser: AnalyserNode | null = null;
// wanted by the visitor; audible only once the browser lets the context run
let playing = false;
let unlockArmed = false;
let current = 0;
let shuffle = false;
let trackStart = 0;
let chordIndex = 0;
let chordTimer = 0;
let sparkleTimer = 0;
let arpTimer = 0;
let stopTimer = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

try {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ng-track") : null;
  const i = TRACKS.findIndex((t) => t.id === saved);
  if (i >= 0) current = i;
  shuffle = typeof localStorage !== "undefined" && localStorage.getItem("ng-shuffle") === "on";
} catch { /* preferences only */ }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* preferences only */ } };

function impulse(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

function build() {
  const c = new AudioContext();
  const out = c.createGain();
  out.gain.value = 0;
  const an = c.createAnalyser();
  an.fftSize = 64;
  an.smoothingTimeConstant = 0.8;
  out.connect(an);
  an.connect(c.destination);

  const input = c.createGain();
  const dry = c.createGain();
  dry.gain.value = 0.55;
  const wet = c.createGain();
  wet.gain.value = 0.6;
  const verb = c.createConvolver();
  verb.buffer = impulse(c, 3.6);
  input.connect(dry).connect(out);
  input.connect(verb).connect(wet).connect(out);

  ctx = c;
  master = out;
  bus = input;
  analyser = an;
  c.onstatechange = emit;
}

// Autoplay policy: a context made without a user gesture stays suspended. Resume it on the
// first real interaction anywhere, except the player, whose own buttons handle it.
function onGesture(e: Event) {
  if ((e.target as Element | null)?.closest?.(".ng-player-dock")) return;
  disarmUnlock();
  if (playing) void ctx?.resume();
}
function armUnlock() {
  if (unlockArmed) return;
  unlockArmed = true;
  for (const t of ["pointerdown", "keydown", "touchend"]) window.addEventListener(t, onGesture, true);
}
function disarmUnlock() {
  if (!unlockArmed) return;
  unlockArmed = false;
  for (const t of ["pointerdown", "keydown", "touchend"]) window.removeEventListener(t, onGesture, true);
}

const chordNow = () => TRACKS[current].chords[(chordIndex + TRACKS[current].chords.length - 1) % TRACKS[current].chords.length];

function playChord(at: number) {
  if (!ctx || !voice) return;
  const c = ctx, t = TRACKS[current];
  const notes = t.chords[chordIndex % t.chords.length];
  chordIndex++;
  const end = at + t.chordSeconds + 5;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = t.cutoff;
  filter.Q.value = 0.6;
  const lfo = c.createOscillator();
  const lfoDepth = c.createGain();
  lfo.frequency.value = 0.07;
  lfoDepth.gain.value = t.cutoff * 0.42;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start(at);
  lfo.stop(end);

  const env = c.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(1, at + 3.5);
  env.gain.setValueAtTime(1, at + t.chordSeconds);
  env.gain.linearRampToValueAtTime(0, end);
  filter.connect(env).connect(voice);

  // sine and triangle are quieter than saw at the same gain
  const level = t.pad === "sawtooth" ? 0.035 : t.pad === "triangle" ? 0.06 : 0.075;
  for (const n of notes) {
    for (const detune of [-7, 7]) {
      const osc = c.createOscillator();
      osc.type = t.pad;
      osc.frequency.value = midiHz(n);
      osc.detune.value = detune;
      const g = c.createGain();
      g.gain.value = level;
      osc.connect(g).connect(filter);
      osc.start(at);
      osc.stop(end);
    }
  }

  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = midiHz(notes[0] - 12);
  const subGain = c.createGain();
  subGain.gain.value = 0.09;
  sub.connect(subGain).connect(env);
  sub.start(at);
  sub.stop(end);
}

function pluck(note: number, peak: number, decay: number, wave: OscillatorType) {
  if (!ctx || !voice) return;
  const c = ctx;
  const t = c.currentTime + 0.02;
  const osc = c.createOscillator();
  osc.type = wave;
  osc.frequency.value = midiHz(note);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  const pan = c.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  osc.connect(g).connect(pan).connect(voice);
  osc.start(t);
  osc.stop(t + decay + 0.1);
}

function clearTimers() {
  window.clearTimeout(chordTimer);
  window.clearTimeout(sparkleTimer);
  window.clearTimeout(arpTimer);
}

function schedule() {
  if (!ctx || !playing) return;
  const t = TRACKS[current];
  // a track has run its course: move on (the new one crossfades in)
  if (ctx.currentTime - trackStart >= trackLength(t) && ctx.state === "running") {
    ambient.next(true);
    return;
  }
  playChord(ctx.currentTime + 0.05);
  chordTimer = window.setTimeout(schedule, t.chordSeconds * 1000);
}

function twinkle() {
  const t = TRACKS[current];
  if (!playing || !t.sparkle[0]) return;
  const notes = chordNow();
  if (Math.random() < 0.8) pluck(notes[1 + Math.floor(Math.random() * (notes.length - 1))] + t.sparkleOctave, 0.045, 2.2, "triangle");
  sparkleTimer = window.setTimeout(twinkle, t.sparkle[0] + Math.random() * (t.sparkle[1] - t.sparkle[0]));
}

let arpStep = 0;
function arpeggio() {
  const t = TRACKS[current];
  if (!playing || !t.arp) return;
  const notes = chordNow();
  const pattern = [1, 2, 3, 4, 3, 2];
  pluck(notes[pattern[arpStep++ % pattern.length]] + 12, 0.03, 0.9, "sine");
  arpTimer = window.setTimeout(arpeggio, t.arp * 1000);
}

/** Start the current track on a fresh submix, fading out whatever was playing. */
function beginTrack() {
  if (!ctx || !bus) return;
  const c = ctx, now = c.currentTime;
  const old = voice;
  if (old) {
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 2.2);
    window.setTimeout(() => old.disconnect(), 8000);
  }
  voice = c.createGain();
  voice.gain.setValueAtTime(0, now);
  voice.gain.linearRampToValueAtTime(1, now + (old ? 2.2 : 0.1));
  voice.connect(bus);
  clearTimers();
  chordIndex = 0;
  arpStep = 0;
  trackStart = now;
  schedule();
  twinkle();
  arpeggio();
}

function pickNext(dir: 1 | -1, auto: boolean) {
  if (shuffle && (auto || dir === 1)) {
    let i = current;
    while (i === current && TRACKS.length > 1) i = Math.floor(Math.random() * TRACKS.length);
    return i;
  }
  return (current + dir + TRACKS.length) % TRACKS.length;
}

export const ambient = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Audible right now (wanted and the browser has let the context run). */
  isPlaying: () => playing && ctx?.state === "running",
  analyser: () => analyser,
  currentIndex: () => current,
  isShuffle: () => shuffle,
  /** 0..1 through the current track (for the progress bar). */
  progress: () => (ctx && playing ? Math.min(1, (ctx.currentTime - trackStart) / trackLength(TRACKS[current])) : 0),

  /** Default-on: start unless the visitor switched the music off on an earlier visit. */
  autoStart() {
    let pref: string | null = null;
    try { pref = localStorage.getItem("ng-sound"); } catch { /* no preference */ }
    if (pref !== "off") ambient.start(false);
  },

  start(remember = true) {
    if (!ctx) build();
    window.clearTimeout(stopTimer);
    if (!playing) {
      playing = true;
      // the clock is frozen while suspended, so this fade plays out once audio is unlocked
      const now = ctx!.currentTime;
      master!.gain.cancelScheduledValues(now);
      master!.gain.setValueAtTime(master!.gain.value, now);
      master!.gain.linearRampToValueAtTime(VOLUME, now + 2.5);
      beginTrack();
    }
    void ctx!.resume().catch(() => {});
    if (ctx!.state !== "running") armUnlock();
    if (remember) save("ng-sound", "on");
    emit();
  },

  stop() {
    if (!playing || !ctx || !master) return;
    playing = false;
    disarmUnlock();
    clearTimers();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
    // suspend once faded so the pad voices stop costing CPU
    stopTimer = window.setTimeout(() => void ctx?.suspend(), 1300);
    save("ng-sound", "off");
    emit();
  },

  // wanted-but-still-locked counts as off: a click here is the gesture that unlocks it
  toggle() {
    if (ambient.isPlaying()) ambient.stop();
    else ambient.start();
  },

  /** Jump to a track; starts playback if it was stopped. */
  select(i: number) {
    current = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    save("ng-track", TRACKS[current].id);
    if (playing && ctx) {
      beginTrack();
      void ctx.resume().catch(() => {});
      emit();
    } else ambient.start();
  },
  next(auto = false) { ambient.select(pickNext(1, auto)); },
  prev() { ambient.select(pickNext(-1, false)); },
  setShuffle(on: boolean) {
    shuffle = on;
    save("ng-shuffle", on ? "on" : "off");
    emit();
  },
};
