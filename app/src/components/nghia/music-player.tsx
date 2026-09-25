import { CaretUp, Pause, Play, Shuffle, SkipBack, SkipForward } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

import { TRACKS, ambient } from "@/lib/ambient";
import { reducedMotion } from "@/lib/motion";

/** Tonearm drawn as a soft S-curve with a rounded headshell, counterweight and pivot. */
function Tonearm() {
  return (
    <svg className="ng-tonearm" viewBox="0 0 30 58" aria-hidden="true">
      <defs>
        <linearGradient id="ng-arm" x1="0" x2="1">
          <stop offset="0" stopColor="#f6f1e7" />
          <stop offset="1" stopColor="#a9a29a" />
        </linearGradient>
        <radialGradient id="ng-pivot" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6d6878" />
          <stop offset="1" stopColor="#1d1b24" />
        </radialGradient>
      </defs>
      <g className="ng-tonearm-swing">
        {/* counterweight behind the pivot */}
        <rect x="18.5" y="0.5" width="7" height="6" rx="2.6" fill="#2b2932" stroke="#8d877e" strokeWidth="0.6" />
        <path d="M22 9 C 22 22, 26 30, 20 42 S 12 50, 12 52" fill="none" stroke="#0b0a12" strokeOpacity="0.55" strokeWidth="3.6" strokeLinecap="round" transform="translate(0.8 1)" />
        <path d="M22 9 C 22 22, 26 30, 20 42 S 12 50, 12 52" fill="none" stroke="url(#ng-arm)" strokeWidth="2.4" strokeLinecap="round" />
        {/* headshell and stylus */}
        <rect x="8.2" y="49.5" width="7.4" height="6.6" rx="1.8" fill="#e9e3d6" transform="rotate(-18 12 53)" />
        <circle cx="10.4" cy="56.4" r="0.9" fill="#ff7a93" />
        <circle cx="22" cy="9" r="4.6" fill="url(#ng-pivot)" />
        <circle cx="22" cy="9" r="1.6" fill="#cfc8bc" />
      </g>
    </svg>
  );
}

/**
 * The corner turntable: the intro's galaxy record, spinning while the generative soundtrack
 * plays, with a level meter driven by the real audio. The chevron opens the queue: pick a
 * track, skip, shuffle, and watch its progress.
 */
export function MusicPlayer() {
  const playing = useSyncExternalStore(ambient.subscribe, ambient.isPlaying, () => false);
  const current = useSyncExternalStore(ambient.subscribe, ambient.currentIndex, () => 0);
  const shuffle = useSyncExternalStore(ambient.subscribe, ambient.isShuffle, () => false);
  const [open, setOpen] = useState(false);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const track = TRACKS[current];

  useEffect(() => {
    const an = ambient.analyser();
    if (!playing || !an || reducedMotion()) return;
    const data = new Uint8Array(an.frequencyBinCount);
    const nodes = bars.current;
    let raf = 0;
    const tick = () => {
      an.getByteFrequencyData(data);
      nodes.forEach((b, i) => {
        // low bins only: the pads and plucks carry almost nothing above ~3 kHz
        const v = data[1 + i * 2] / 255;
        b?.style.setProperty("transform", `scaleY(${(0.18 + v * 0.95).toFixed(3)})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      nodes.forEach((b) => b?.style.removeProperty("transform"));
    };
  }, [playing]);

  // progress bar: polled only while the queue is open
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => bar.current?.style.setProperty("--p", String(ambient.progress())), 500);
    bar.current?.style.setProperty("--p", String(ambient.progress()));
    return () => clearInterval(t);
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!dock.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ng-player-dock" ref={dock} style={{ "--tint": track.tint } as CSSProperties}>
      {open ? (
        <div className="ng-queue" role="region" aria-label="Soundtrack">
          <div className="ng-queue-now">
            <p className="ng-queue-label">{playing ? "Now playing" : "Paused"}</p>
            <p className="ng-queue-title">{track.title}</p>
            <span className="ng-queue-bar" ref={bar} aria-hidden="true"><span /></span>
          </div>
          <div className="ng-queue-controls">
            <button type="button" className="ng-qbtn" aria-pressed={shuffle} onClick={() => ambient.setShuffle(!shuffle)} aria-label="Shuffle">
              <Shuffle size={16} weight="bold" />
            </button>
            <button type="button" className="ng-qbtn" onClick={() => ambient.prev()} aria-label="Previous track">
              <SkipBack size={16} weight="fill" />
            </button>
            <button type="button" className="ng-qbtn ng-qbtn--main" onClick={() => ambient.toggle()} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
            </button>
            <button type="button" className="ng-qbtn" onClick={() => ambient.next()} aria-label="Next track">
              <SkipForward size={16} weight="fill" />
            </button>
          </div>
          <ol className="ng-queue-list">
            {TRACKS.map((t, i) => (
              <li key={t.id}>
                <button type="button" aria-current={i === current ? "true" : undefined} onClick={() => ambient.select(i)} style={{ "--tint": t.tint } as CSSProperties}>
                  <span className="ng-queue-dot" aria-hidden="true" />
                  <span className="ng-queue-name">{t.title}</span>
                  <span className="ng-queue-mood">{t.mood}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="ng-player" data-playing={playing ? "" : undefined}>
        <button
          type="button"
          className="ng-player-main"
          aria-pressed={playing}
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          onClick={() => ambient.toggle()}
        >
          <span className="ng-deck" aria-hidden="true">
            <span className="ng-vinyl"><span className="ng-vinyl-label" /></span>
            <span className="ng-vinyl-sheen" />
            <Tonearm />
          </span>
          <span className="ng-player-meta">
            <span className="ng-player-title">{track.title}</span>
            <span className="ng-player-sub">{track.mood}</span>
          </span>
          <span className="ng-eq" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} ref={(n) => { bars.current[i] = n; }} />
            ))}
          </span>
          <span className="ng-player-icon" aria-hidden="true">
            {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
          </span>
        </button>
        <button type="button" className="ng-player-more" aria-expanded={open} aria-label="Tracks and controls" onClick={() => setOpen((o) => !o)}>
          <CaretUp size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
