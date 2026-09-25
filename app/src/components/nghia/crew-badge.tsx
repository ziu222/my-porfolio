import { ArrowsClockwise, ArrowUpRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { reducedMotion } from "@/lib/motion";

const FACTS: [string, string][] = [
  ["University", "HCMC Open University"],
  ["Major", "Computer Science"],
  ["Training", "MindX, Full-stack Web"],
  ["English", "IELTS 6.5"],
];

/**
 * A crew pass hanging on a lanyard. The strap and card swing as one pendulum from the anchor:
 * drag to swing it, let go and it settles; a tap (not a drag) flips it to the back, which is
 * about SCTV. Physics only runs while something is moving.
 */
export function CrewBadge() {
  const rig = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const el = rig.current!;
    const face = card.current!;
    if (reducedMotion()) return;

    let angle = 0, vel = 0, tiltX = 0, tiltY = 0, raf = 0, last = 0;
    let dragging = false, moved = false, downX = 0, downY = 0;
    const anchor = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top };
    };
    const apply = () => {
      el.style.transform = `rotate(${angle}rad)`;
      face.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
      face.style.setProperty("--tilt-y", `${(tiltY + vel * 900).toFixed(2)}deg`);
    };
    const step = (now: number) => {
      const dt = Math.min(now - (last || now), 32) / 16.67;
      last = now;
      if (!dragging) {
        vel += -angle * 0.012 * dt; // spring back to hanging straight
        vel *= Math.pow(0.965, dt); // air drag
        angle += vel * dt;
      }
      tiltX *= 0.9; tiltY *= 0.9;
      apply();
      if (dragging || Math.abs(angle) > 0.0008 || Math.abs(vel) > 0.0002 || Math.abs(tiltY) > 0.05) {
        raf = requestAnimationFrame(step);
      } else {
        angle = vel = 0; apply(); raf = 0; last = 0;
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("a, button")) return;
      dragging = true; moved = false; downX = e.clientX; downY = e.clientY;
      face.setPointerCapture(e.pointerId);
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        // idle hover: the card leans toward the pointer a little
        const r = face.getBoundingClientRect();
        tiltX = ((e.clientY - r.top) / r.height - 0.5) * -10;
        tiltY = ((e.clientX - r.left) / r.width - 0.5) * 14;
        kick();
        return;
      }
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
      const a = anchor();
      const target = Math.atan2(-(e.clientX - a.x), e.clientY - a.y);
      const next = Math.max(-1.1, Math.min(1.1, target));
      vel = next - angle;
      angle = next;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) setFlipped((f) => !f);
      kick();
    };

    // arrives with a swing the first time it scrolls into view
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      angle = 0.32; vel = 0; kick();
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);

    face.addEventListener("pointerdown", onDown);
    face.addEventListener("pointermove", onMove);
    face.addEventListener("pointerup", onUp);
    face.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      face.removeEventListener("pointerdown", onDown);
      face.removeEventListener("pointermove", onMove);
      face.removeEventListener("pointerup", onUp);
      face.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="ng-badge-wrap">
      {/* narrow layouts: the pass sits below the copy, so it gets its own beam to hang from */}
      <span className="ng-beam ng-beam--local" aria-hidden="true" />
      <span className="ng-badge-anchor" aria-hidden="true" />
      <div className="ng-badge-rig" ref={rig}>
        <span className="ng-badge-strap" aria-hidden="true" />
        <span className="ng-badge-clip" aria-hidden="true" />
        <div className="ng-badge" ref={card} data-flipped={flipped ? "" : undefined}>
          <div className="ng-badge-inner">
            <section className="ng-badge-face ng-badge-front" aria-hidden={flipped} inert={flipped}>
              <span className="ng-badge-slot" aria-hidden="true" />
              <div className="ng-badge-head">
                <span>Crew pass</span>
                <span>2026</span>
              </div>
              <img className="ng-badge-photo" src="/assets/img/badge-photo.webp" alt="Portrait of Bùi Trọng Nghĩa" width={480} height={640} loading="lazy" decoding="async" />
              <p className="ng-badge-name">Bùi Trọng Nghĩa</p>
              <p className="ng-badge-role">Software Engineer Intern <span>at SCTV</span></p>
              <dl className="ng-badge-facts">
                {FACTS.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="ng-badge-face ng-badge-back" aria-hidden={!flipped} inert={!flipped}>
              <span className="ng-badge-slot" aria-hidden="true" />
              <div className="ng-badge-head">
                <span>Current mission</span>
                <span>SCTV</span>
              </div>
              <p className="ng-badge-org">Saigontourist Cable Television</p>
              <p className="ng-badge-copy">
                Vietnam&apos;s leading cable television network since 1992, a joint venture of VTV and Saigontourist.
                It runs cable and digital TV, high-speed internet and the SCTV Online super app across 53 provinces.
              </p>
              <ul className="ng-badge-services" aria-label="SCTV services">
                {["Cable TV", "Digital TV", "Broadband", "SCTV Online", "VOD / OTT"].map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p className="ng-badge-copy">I work there as a Software Engineer Intern while finishing my degree.</p>
              <div className="ng-badge-links">
                <a href="https://linkedin.com/in/btn2812" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} weight="bold" aria-hidden="true" /></a>
                <a href="https://github.com/ziu222" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={14} weight="bold" aria-hidden="true" /></a>
              </div>
            </section>
          </div>
        </div>
      </div>
      <button type="button" className="ng-badge-flip" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
        <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
        {flipped ? "Show front" : "Flip the pass"}
      </button>
    </div>
  );
}
