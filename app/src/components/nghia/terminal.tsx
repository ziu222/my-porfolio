import { useEffect, useRef, useState } from "react";

import { TRACKS, ambient } from "@/lib/ambient";
import { reducedMotion } from "@/lib/motion";

import { Nova, type NovaMood } from "./nova";
import type { Project } from "./project-map";

type Line = { kind: "in" | "out" | "err"; text: string };

const SECTIONS = ["projects", "skills", "about", "contact"];

const HELP = [
  "help              list commands",
  "whoami            short introduction",
  "projects          list projects",
  "open <project>    show details, e.g. open medbook",
  "skills            technology groups",
  "goto <section>    projects | skills | about | contact",
  "contact           how to reach me",
  "music [next|list] play, skip or pick a track",
  "clear | exit",
];

/** Hidden terminal: press ~ (or `) anywhere, or use the footer button. */
export function Terminal({ projects, skills }: { projects: Project[]; skills: { title: string; items: { name: string }[] }[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [mood, setMood] = useState<NovaMood>("idle");
  const [typing, setTyping] = useState(false);
  const moodTimer = useRef(0);
  const typingTimer = useRef(0);
  const react = (m: NovaMood, ms: number) => {
    window.clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = window.setTimeout(() => setMood("idle"), ms);
  };
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "~" || e.key === "`") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ng:terminal", onToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ng:terminal", onToggle);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  const run = (raw: string) => {
    const [cmd = "", ...rest] = raw.trim().toLowerCase().split(/\s+/);
    const arg = rest.join(" ");
    const out = (...text: string[]): Line[] => text.map((t) => ({ kind: "out", text: t }));
    const echo: Line = { kind: "in", text: raw };
    let reply: Line[] = [];

    if (!cmd) reply = [];
    else if (cmd === "help") reply = out(...HELP);
    else if (cmd === "whoami") reply = out("Bùi Trọng Nghĩa, final-year Computer Science student at Ho Chi Minh City Open University.", "Software Engineer Intern at SCTV. Full-stack with React and Spring Boot.");
    else if (cmd === "projects") reply = out(...projects.map((p) => `${p.id.padEnd(10)} ${p.title}`));
    else if (cmd === "skills") reply = out(...skills.map((g) => `${g.title}: ${g.items.map((i) => i.name).join(", ")}`));
    else if (cmd === "music") {
      const hit = TRACKS.findIndex((t) => arg && t.title.toLowerCase().includes(arg));
      if (arg === "next" || arg === "prev") {
        if (arg === "next") ambient.next(); else ambient.prev();
        reply = out(`Now playing ${TRACKS[ambient.currentIndex()].title}.`);
      } else if (arg === "shuffle") {
        ambient.setShuffle(!ambient.isShuffle());
        reply = out(`Shuffle ${ambient.isShuffle() ? "on" : "off"}.`);
      } else if (arg === "list") {
        reply = out(...TRACKS.map((t, i) => `${i === ambient.currentIndex() ? ">" : " "} ${t.title.padEnd(15)} ${t.mood}`));
      } else if (hit >= 0) {
        ambient.select(hit);
        reply = out(`Now playing ${TRACKS[hit].title}.`);
      } else if (arg) {
        reply = [{ kind: "err", text: `No track matches "${arg}". Try music list.` }];
      } else {
        reply = out(ambient.isPlaying() ? "Lifting the needle." : `Dropping the needle on ${TRACKS[ambient.currentIndex()].title}.`);
        ambient.toggle();
      }
    } else if (cmd === "contact") reply = out("LinkedIn  linkedin.com/in/btn2812", "GitHub    github.com/ziu222");
    else if (cmd === "clear" || cmd === "exit") {
      setValue("");
      if (cmd === "clear") { setLines([]); react("happy", 900); }
      else {
        // Nova waves goodbye before the window closes
        react("wave", 700);
        window.setTimeout(() => setOpen(false), reducedMotion() ? 0 : 650);
      }
      return;
    } else if (cmd === "open") {
      const p = projects.find((x) => x.id === arg || x.short.toLowerCase().includes(arg) || x.title.toLowerCase().includes(arg));
      if (!arg || !p) reply = [{ kind: "err", text: `No project matches "${arg}". Type projects to see the list.` }];
      else {
        window.dispatchEvent(new CustomEvent("ng:open-project", { detail: p.id }));
        setOpen(false);
        reply = out(`Opening ${p.title}...`);
      }
    } else if (cmd === "goto") {
      const id = SECTIONS.includes(arg) ? arg : null;
      if (!id) reply = [{ kind: "err", text: "Sections: projects, skills, about, contact." }];
      else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        setOpen(false);
        reply = out(`Flying to ${arg}...`);
      }
    } else reply = [{ kind: "err", text: `Unknown command "${cmd}". Type help for the list.` }];

    if (cmd) react(reply.some((r) => r.kind === "err") ? "error" : "happy", reply.some((r) => r.kind === "err") ? 1400 : 1200);
    setLines((l) => [...l, echo, ...reply]);
    setValue("");
  };

  if (!open) return null;
  return (
    <div className="ng-term" role="dialog" aria-label="Terminal">
      <div className="ng-term-bar">
        <span>nghia@portfolio</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close terminal">esc</button>
      </div>
      <div className="ng-term-welcome">
        <Nova mood={mood} typing={typing} reduce={reducedMotion()} />
        <div>
          <p className="ng-term-hello">Welcome aboard, crew.</p>
          <p>This is Nghia's mission control. I'm Nova, your guide.</p>
          <p className="ng-term-dim">Try <b>help</b>, <b>projects</b> or <b>open dishcover</b>. Click me to say hi.</p>
        </div>
      </div>
      <div className="ng-term-log" ref={log} aria-live="polite">
        {lines.map((l, i) => (
          <p key={i} data-kind={l.kind}>{l.kind === "in" ? `> ${l.text}` : l.text}</p>
        ))}
      </div>
      <form
        className="ng-term-input"
        onSubmit={(e) => {
          e.preventDefault();
          run(value);
        }}
      >
        <span aria-hidden="true">&gt;</span>
        <input
          ref={input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setTyping(true);
            window.clearTimeout(typingTimer.current);
            typingTimer.current = window.setTimeout(() => setTyping(false), 900);
          }}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          aria-label="Command"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
