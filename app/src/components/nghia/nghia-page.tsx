import { Sparkle } from "@phosphor-icons/react";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MouseEvent } from "react";

import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { readMotion, writeMotion, type MotionMode } from "@/lib/motion";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";

import { ContactDust } from "./contact-dust";
import { CrewBadge } from "./crew-badge";
import { FactMeteors } from "./fact-meteors";
import { Loader } from "./loader";
import { MusicPlayer } from "./music-player";
import { sparkBurst } from "./sparks";
import { Terminal } from "./terminal";
import { useHeroSnap } from "./use-hero-snap";
import { OrbitStack, type StackGroup, type StackGroupId } from "./orbit-stack";
import { ProjectMap, type Project } from "./project-map";
import { Starfield } from "./starfield";
import "./nghia.css";

const noSubscribe = () => () => {};

/** Headline whose words rise in one by one when its reveal container enters. */
function Words({ text }: { text: string }) {
  // the space sits outside the inline-block span, where it doesn't collapse
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 ? " " : null}
      <span className="ng-w" style={{ "--i": i } as CSSProperties}>{w}</span>
    </Fragment>
  ));
}

// Order matters: it is the planet order on the star map (BODIES in project-map.tsx follows it).
const projects: Project[] = [
  {
    id: "dishcover",
    title: "Dishcover",
    short: "Dishcover",
    category: "Graduation project",
    summary:
      "An AI-powered smart fridge and recipe recommender that works backwards from the ingredients you already have. Eight Spring Boot microservices behind an API gateway rank recipes by ingredient coverage, expiry urgency and dietary goals, with a Vietnamese RAG chatbot, Vision AI ingredient recognition and Kafka-driven expiry alerts.",
    meta: [
      { label: "Type", value: "Capstone project" },
      { label: "Architecture", value: "8 microservices" },
      { label: "Status", value: "Live demo" },
    ],
    stack: ["Java", "Spring Boot", "Spring AI", "React", "TypeScript", "PostgreSQL", "pgvector", "MongoDB", "Kafka", "Terraform", "AWS ECS"],
    img: "/assets/img/shot-dishcover.webp",
    alt: "Home page of the Dishcover live demo",
    links: [
      { label: "Live demo", href: "https://www.dishcover.online" },
      { label: "Source code", href: "https://github.com/ziu222/Dishcover" },
    ],
  },
  {
    id: "medbook",
    title: "MedBook",
    short: "MedBook",
    category: "Team product",
    summary:
      "A medical appointment booking platform for Military Hospital 175: find doctors by specialty, check open slots, book and pay through VNPAY, with automatic appointment reminders. I built the frontend in a team of three.",
    meta: [
      { label: "Role", value: "Frontend Developer" },
      { label: "Team", value: "3 people" },
      { label: "Backend", value: "FastAPI on AWS Lambda" },
    ],
    stack: ["React", "TypeScript", "Vite", "FastAPI", "AWS Lambda", "AWS Cognito", "PostgreSQL", "VNPAY", "Terraform"],
    img: "/assets/img/shot-medbook.webp",
    alt: "MedBook home page",
    links: [{ label: "Source code", href: "https://github.com/ziu222/medbook" }],
  },
  {
    id: "optilink",
    title: "OptiLink",
    short: "OptiLink",
    category: "Full-stack product",
    summary:
      "An all-in-one link management platform on the MERN stack: smart URL shortening, bio pages and QR codes in a single workspace.",
    meta: [
      { label: "Type", value: "Web product" },
      { label: "Stack", value: "MERN" },
      { label: "Status", value: "Live demo" },
    ],
    stack: ["MongoDB", "Express", "React", "Node.js"],
    img: "/assets/img/shot-optilink.webp",
    alt: "OptiLink home page with a URL being shortened",
    links: [
      { label: "Live demo", href: "https://opti-link-mu.vercel.app" },
      { label: "Source code", href: "https://github.com/ziu222/OptiLink" },
    ],
  },
  {
    id: "music",
    title: "React Music Web",
    short: "Music Web",
    category: "Personal project",
    summary:
      "A music streaming app that runs entirely on React and Supabase with no dedicated server. The database has 19 tables, fine-grained RBAC through Row Level Security, and offline-first sync.",
    meta: [
      { label: "Type", value: "Personal project" },
      { label: "Role", value: "Sole developer" },
      { label: "Database", value: "19 tables" },
    ],
    stack: ["React", "Supabase", "PostgreSQL", "RBAC"],
    img: "/assets/img/photo-music.webp",
    alt: "A hand placing a turntable needle on a vinyl record",
    links: [{ label: "Source code", href: "https://github.com/ziu222/react-music-web" }],
  },
  {
    id: "codegym",
    title: "CodeGym Course Management System",
    short: "CodeGym",
    category: "System design",
    summary:
      "Analysis and design of a course management system for a programming school, including a functional decomposition diagram, level 0 and level 1 data flow diagrams, a 19-entity ERD and the relational schema.",
    meta: [
      { label: "Type", value: "System analysis and design" },
      { label: "Team", value: "4 people" },
      { label: "Deliverables", value: "DFD, 19-entity ERD" },
    ],
    stack: ["DFD", "ERD", "Database design"],
    img: "/assets/img/photo-codegym.webp",
    alt: "Illustration of a database schema",
  },
  {
    id: "vsl",
    title: "Vietnamese Sign Language Dataset",
    short: "VSL Dataset",
    category: "NLP data",
    summary:
      "A dataset mapping standard Vietnamese sentences to Vietnamese Sign Language syntax, used to train a sentence conversion model. It covers affirmative, negative and interrogative sentences.",
    meta: [
      { label: "Type", value: "Team project" },
      { label: "Field", value: "Natural language processing" },
      { label: "Goal", value: "Support the Deaf community" },
    ],
    stack: ["Data collection", "NLP", "Data normalization"],
    img: "/assets/img/photo-vsl.webp",
    alt: "A sign language interpreter at work",
  },
  {
    id: "deepchess",
    title: "DeepChessRL",
    short: "DeepChessRL",
    category: "AI course project",
    summary:
      "A chess environment for training reinforcement learning agents, with a PPO agent measured against heuristic and Stockfish opponents and a Pygame board for playing against them.",
    meta: [
      { label: "Type", value: "Team course project" },
      { label: "Field", value: "Reinforcement learning" },
      { label: "Agents", value: "PPO, heuristic, Stockfish" },
    ],
    stack: ["Python", "Reinforcement learning", "PPO", "python-chess", "Pygame"],
    links: [{ label: "Source code", href: "https://github.com/ziu222/DeepChessRL" }],
  },
  {
    id: "restaurant",
    title: "Restaurant Ordering App",
    short: "Restaurant",
    category: "Mobile + API course project",
    summary:
      "A restaurant ordering system with a React Native mobile app and a Django REST API. Customers browse and compare dishes and order from a cart; chefs manage their dishes and incoming orders; admins follow orders and statistics.",
    meta: [
      { label: "Type", value: "Team course project" },
      { label: "Clients", value: "Mobile app" },
      { label: "Roles", value: "Customer, chef, admin" },
    ],
    stack: ["Django", "Django REST", "Python", "React Native"],
    links: [{ label: "Source code", href: "https://github.com/ziu222/Restaurant_django" }],
  },
  {
    id: "puzzle",
    title: "Sliding Puzzle Solver",
    short: "Sliding Puzzle",
    category: "Algorithms",
    summary:
      "A 3x4 sliding tile puzzle in the browser with an A* solver using the Manhattan distance heuristic. The optimal solution can be played back step by step on the same board you play with the keyboard.",
    meta: [
      { label: "Type", value: "Personal project" },
      { label: "Algorithm", value: "A* search" },
      { label: "Heuristic", value: "Manhattan distance" },
    ],
    stack: ["JavaScript", "A* search", "HTML", "CSS"],
    links: [{ label: "Source code", href: "https://github.com/ziu222/Sliding-puzzle" }],
  },
];


const stackGroups: (StackGroup & { desc: string })[] = [
  {
    id: "front",
    color: "#FF7A93",
    title: "Frontend",
    desc: "Modern interfaces built around the user experience.",
    items: [
      { name: "React", logo: "react" },
      { name: "TypeScript", logo: "typescript" },
      { name: "JavaScript", logo: "javascript" },
      { name: "Tailwind CSS", logo: "tailwindcss" },
      { name: "Vite", logo: "vite" },
    ],
  },
  {
    id: "back",
    color: "#F4EFE6",
    title: "Backend",
    desc: "API design, microservices and AI model integration.",
    items: [
      { name: "Java", logo: "openjdk" },
      { name: "Spring Boot", logo: "springboot" },
      { name: "Spring AI", logo: "spring" },
      { name: "Node.js", logo: "nodedotjs" },
      { name: "FastAPI", logo: "fastapi" },
      { name: "Python", logo: "python" },
      { name: "Kafka", mono: "kf" },
    ],
  },
  {
    id: "data",
    color: "#C8A2B0",
    title: "Databases",
    desc: "Data modeling, access control and vector search.",
    items: [
      { name: "PostgreSQL", logo: "postgresql" },
      { name: "pgvector", mono: "pg" },
      { name: "Supabase", logo: "supabase" },
      { name: "MongoDB", logo: "mongodb" },
    ],
  },
  {
    id: "cloud",
    color: "#FFD9A8",
    title: "Cloud and tooling",
    desc: "Packaging, deployment and team project management.",
    items: [
      { name: "Docker", logo: "docker" },
      { name: "AWS Lambda", logo: "awslambda" },
      { name: "AWS Cognito", logo: "amazoncognito" },
      { name: "Git", logo: "git" },
      { name: "GitHub", logo: "github" },
      { name: "Jira", logo: "jira" },
      { name: "Terraform", mono: "tf" },
    ],
  },
];

// Thematic stops, not dated claims: the last two are "now" and "next".
const journey = [
  { title: "HCMC Open University", text: "Computer Science, now in my final year." },
  { title: "MindX", text: "Full-stack Web course, building product skills." },
  { title: "MedBook", text: "Frontend for a hospital appointment platform, in a team of three." },
  { title: "Graduation project", status: "In progress", text: "Dishcover: 8 microservices, a RAG chatbot and Vision AI, live online." },
  { title: "SCTV", status: "Now", next: true, text: "Software Engineer Intern at Vietnam's leading cable TV and broadband network." },
];
const journeyPath = Array.from({ length: 51 }, (_, i) => {
  const x = i * 20;
  // crosses the midline exactly under each of the five column centres (100, 300, ... 900)
  return `${i ? "L" : "M"}${x} ${(40 + 26 * Math.sin((Math.PI * (x - 100)) / 200)).toFixed(1)}`;
}).join(" ");

const launchBurst = (e: MouseEvent<HTMLAnchorElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  sparkBurst(r.left + r.width / 2, r.top, { launch: true });
};

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => { el.dataset.in = ""; });
      return;
    }
    // Two-way: fades in on entry and back out on exit, rising from whichever edge it left by.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          // an attribute, not a class: React rewrites className on re-render (e.g. group hover) and would wipe it
          el.toggleAttribute("data-in", entry.isIntersecting);
          if (!entry.isIntersecting) el.dataset.side = entry.boundingClientRect.top < 0 ? "above" : "below";
        }
      },
      { rootMargin: "-6% 0px -12% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function NghiaPage() {
  useReveal();
  useHeroSnap("#projects");
  const [active, setActive] = useState<StackGroupId | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  // null until mounted: the server can't know the visitor's preference
  const initialMotion = useSyncExternalStore(noSubscribe, readMotion, () => null);
  const [picked, setPicked] = useState<MotionMode | null>(null);
  const motion = picked ?? initialMotion;
  const [epoch, setEpoch] = useState(0);
  const toggleMotion = () => {
    const next = motion === "full" ? "reduce" : "full";
    writeMotion(next);
    setPicked(next);
    setEpoch((e) => e + 1);
  };

  return (
    <div className="ng-page">
      <Loader poster={scrollScrubScenes[0].poster} />
      {/* keyed so each canvas/engine restarts under the new motion mode */}
      <Starfield key={`sky-${epoch}`} />
      <header className="ng-nav">
        <a className="ng-brand" href="#intro">
          <img src="/assets/img/mark.png" alt="" width={30} height={30} />
          Bùi Trọng Nghĩa
        </a>
        <nav className="ng-nav-links" aria-label="Main navigation">
          <a href="#projects">Projects</a>
          <a href="#skills">Skills</a>
          <a href="#about">About</a>
        </nav>
        <button
          type="button"
          className="ng-motion"
          onClick={toggleMotion}
          aria-pressed={motion === "full"}
          aria-label="Motion effects"
          title={motion === "full" ? "Turn motion off" : "Turn motion on"}
          disabled={motion === null}
        >
          <Sparkle size={18} weight={motion === "full" ? "fill" : "regular"} />
          <span>Motion</span>
        </button>
        <a className="ng-cta ng-cta--rose" href="#contact">
          Contact
        </a>
      </header>

      <main>
        <ScrollScrub key={`scrub-${epoch}`} scenes={scrollScrubScenes} theme={scrollScrubTheme} />
        <div className="ng-horizon" aria-hidden="true"><span className="ng-horizon-glint" /></div>

        <section className="ng-section" id="projects" aria-labelledby="projects-title">
          <div className="ng-wrap">
            <div className="ng-head" data-reveal>
              <p className="ng-index">01 / Projects</p>
              <h2 className="ng-h2" id="projects-title"><Words text="Featured projects" /></h2>
              <p className="ng-lede">Projects I have helped build, spanning user interfaces, backend architecture and system analysis and design.</p>
            </div>

            <ProjectMap key={`map-${epoch}`} projects={projects} />
          </div>
        </section>

        <section className="ng-section" id="skills" aria-labelledby="skills-title">
          <div className="ng-wrap">
            <div className="ng-head" data-reveal>
              <p className="ng-index">02 / Skills</p>
              <h2 className="ng-h2" id="skills-title"><Words text="Technical skills" /></h2>
              <p className="ng-lede">Technologies I have used in real projects. Each planet is a technology; select one to see which projects use it.</p>
            </div>
            <div className="ng-stack">
              <div className="ng-stack-visual" data-reveal>
                <OrbitStack key={`orbit-${epoch}`} groups={stackGroups} active={active} tech={tech} onTech={setTech} projects={projects} />
              </div>
              <div className="ng-stack-groups">
                {stackGroups.map((g) => (
                  <div
                    key={g.id}
                    className={`ng-group ${active === g.id ? "is-active" : ""}`}
                    data-group={g.id}
                    data-reveal
                    onMouseEnter={() => setActive(g.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(g.id)}
                    onBlur={() => setActive(null)}
                    tabIndex={0}
                  >
                    <div className="ng-group-head">
                      <h3>{g.title}</h3>
                      <p>{g.desc}</p>
                    </div>
                    <ul className="ng-tech">
                      {g.items.map((t, ti) => (
                        <li key={t.name} style={{ "--i": ti } as CSSProperties} data-on={tech === t.name ? "" : undefined}>
                          <button type="button" aria-pressed={tech === t.name} onClick={() => setTech(tech === t.name ? null : t.name)}>
                            {t.logo ? (
                              <img src={`/assets/logos/${t.logo}.svg`} alt="" width={22} height={22} />
                            ) : (
                              <span className="ng-mono" aria-hidden="true">{t.mono}</span>
                            )}
                            {t.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ng-section" id="about" aria-labelledby="about-title">
          <span className="ng-beam ng-beam--section" aria-hidden="true" />
          <div className="ng-wrap">
            <div className="ng-about">
              <div className="ng-head" data-reveal>
                <p className="ng-index">03 / About</p>
                <h2 className="ng-h2" id="about-title"><Words text="About me" /></h2>
                <p className="ng-lede">I am a final-year Computer Science student and a Software Engineer Intern at SCTV, with a solid foundation in frontend development with React. I am expanding into microservices architecture, database design and AI integration, with the goal of building complete products across both frontend and backend.</p>
              </div>
              <CrewBadge />
            </div>
            <ol className="ng-journey" data-reveal aria-label="Journey">
              <svg className="ng-journey-path" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true">
                <path d={journeyPath} pathLength={100} />
              </svg>
              {journey.map((s, i) => (
                <li key={s.title} style={{ "--i": i } as CSSProperties} data-next={s.next ? "" : undefined}>
                  <span className="ng-journey-dot" aria-hidden="true" />
                  <h3>{s.title}</h3>
                  {s.status ? <span className="ng-journey-status">{s.status}</span> : null}
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ng-section ng-contact" id="contact" aria-labelledby="contact-title">
          <ContactDust key={`dust-${epoch}`} />
          <div className="ng-orbits" aria-hidden="true">
            <div className="ng-orbit ng-orbit--a"><span /></div>
            <div className="ng-orbit ng-orbit--b"><span /></div>
            <div className="ng-orbit ng-orbit--c"><span /></div>
          </div>
          <div className="ng-wrap" data-reveal>
            <p className="ng-index">04 / Contact</p>
            <h2 className="ng-h2" id="contact-title"><Words text="Open to new opportunities" /></h2>
            <p className="ng-lede">I am currently a Software Engineer Intern at SCTV. I am always happy to talk about projects, collaboration and future opportunities.</p>
            <div className="ng-hero-actions">
              <a className="ng-cta ng-cta--rose" href="https://linkedin.com/in/btn2812" target="_blank" rel="noreferrer" onClick={launchBurst}>Connect on LinkedIn</a>
              <a className="ng-cta ng-cta--ghost" href="https://github.com/ziu222" target="_blank" rel="noreferrer" onClick={launchBurst}>GitHub</a>
            </div>
          </div>
        </section>
      </main>

      <FactMeteors enabled={motion === "full"} />
      <MusicPlayer />
      <Terminal projects={projects} skills={stackGroups} />

      <footer className="ng-footer">
        <p>© 2026 Bùi Trọng Nghĩa</p>
        <p>
          <button type="button" className="ng-term-open" onClick={() => window.dispatchEvent(new Event("ng:terminal"))}>
            Open the terminal
          </button>{" "}
          or press <kbd>~</kbd> anywhere
        </p>
        <p className="ng-credits">
          Images from Wikimedia Commons:{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Vegetables_on_Cutting_Board.jpg" target="_blank" rel="noreferrer">vegetables (CC0)</a>,{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Close-up_of_a_woman_putting_a_turntable_needle_on_the_vinyl.jpg" target="_blank" rel="noreferrer">vinyl record, Shixart1985 (CC BY 2.0)</a>,{" "}
          <a href="https://commons.wikimedia.org/wiki/File:MediaWiki_1.10_database_schema.png" target="_blank" rel="noreferrer">database schema (CC BY-SA 3.0)</a>,{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Ghanaian_sign_language_interpreter_working_at_University_of_Education_Winneba.jpg" target="_blank" rel="noreferrer">sign language interpreter (CC BY-SA 4.0)</a>. Technology logos: Simple Icons.
        </p>
      </footer>
    </div>
  );
}
