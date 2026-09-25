import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { sparkBurst } from "./sparks";

// Every line restates something already on the page; the meteor is a playful second path to it.
const FACTS = [
  "MedBook: appointment booking with VNPAY payments for Military Hospital 175.",
  "Dishcover runs 8 Spring Boot microservices with Kafka, a RAG chatbot and Vision AI.",
  "React Music Web: 19 tables secured with Row Level Security.",
  "Took the Full-stack Web course at MindX.",
  "IELTS 6.5.",
  "A Vietnamese Sign Language dataset built to support the Deaf community.",
];

type Flight = { id: number; top: number; angle: number };

/**
 * Now and then a golden meteor crosses the sky. Hovering slows it to a stop so it can be
 * caught; catching one reveals a fact. Pointer-only garnish: every fact is also in the page.
 */
export function FactMeteors({ enabled }: { enabled: boolean }) {
  const [flight, setFlight] = useState<Flight | null>(null);
  const [caught, setCaught] = useState<{ text: string; n: number } | null>(null);
  const count = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0, id = 0;
    const launch = () => {
      const hero = document.querySelector(".scroll-scrub");
      const heroOnScreen = hero ? hero.getBoundingClientRect().bottom > window.innerHeight * 0.5 : false;
      const busy = document.hidden || heroOnScreen || document.querySelector('[role="dialog"]');
      if (!busy) {
        const W = window.innerWidth, H = window.innerHeight;
        setFlight({ id: ++id, top: 10 + Math.random() * 28, angle: (Math.atan2(0.42 * H, 1.18 * W) * 180) / Math.PI });
      }
      timer = window.setTimeout(launch, 16000 + Math.random() * 14000);
    };
    timer = window.setTimeout(launch, 8000);
    return () => clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!caught) return;
    const t = window.setTimeout(() => setCaught(null), 6500);
    return () => clearTimeout(t);
  }, [caught]);

  return (
    <>
      {flight && enabled ? (
        <div className="ng-meteor-lane" style={{ top: `${flight.top}vh`, "--ang": `${flight.angle}deg` } as CSSProperties} key={flight.id}>
          <button
            type="button"
            className="ng-meteor"
            aria-hidden="true"
            tabIndex={-1}
            onAnimationEnd={() => setFlight(null)}
            onClick={(e) => {
              sparkBurst(e.clientX, e.clientY, { count: 16 });
              setFlight(null);
              setCaught({ text: FACTS[count.current % FACTS.length], n: count.current + 1 });
              count.current += 1;
            }}
          >
            <span className="ng-meteor-tail" />
            <span className="ng-meteor-head" />
          </button>
        </div>
      ) : null}
      <div className="ng-caught" role="status" data-show={caught ? "" : undefined}>
        {caught ? (
          <>
            <p className="ng-caught-title">You caught meteor #{caught.n}</p>
            <p>{caught.text}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
