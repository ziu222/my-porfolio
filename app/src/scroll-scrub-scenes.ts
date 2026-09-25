/**
 * Scene data for the scroll-scrub journey.
 *
 * One continuous 10s film (deep space -> spiral arm -> galaxy core) cut into three
 * back-to-back segments, one per story beat: frames 0-80, 81-160, 161-240. Each cut
 * starts on the frame right after the previous one ends, so the take reads as unbroken.
 * Segments are 1080p/720p all-intra (every frame a keyframe) so scroll seeks stay cheap.
 * Every poster is the exact first frame of its encoded segment.
 */
import { createElement } from "react";

import type {
  ScrollScrubScene,
  ScrollScrubTheme,
} from "@/components/scroll-scrub/scroll-scrub";

export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#FF7A93",
  background: "#07060C",
  ink: "#F4EFE6",
  muted: "#A79FB3",
};

const stat = (value: string, label: string) =>
  createElement(
    "div",
    { className: "ng-stat", key: value },
    createElement("dt", null, label),
    createElement("dd", null, value),
  );

const experienceStats = createElement(
  "dl",
  { className: "ng-stats" },
  stat("8", "microservices in Dishcover, my graduation project, now live online"),
  stat("6", "featured projects, from user interfaces and microservices to system design"),
  stat("IELTS 6.5", "English proficiency"),
);

const goalActions = createElement(
  "div",
  { className: "ng-hero-actions" },
  createElement("a", { className: "ng-cta ng-cta--rose", href: "#projects" }, "View projects"),
  createElement("a", { className: "ng-cta ng-cta--ghost", href: "#contact" }, "Contact"),
);

const world = "/assets/world";

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    id: "intro",
    label: "Intro",
    kicker: "Portfolio 2026",
    title: "Bùi Trọng Nghĩa",
    body: "Final-year Computer Science student at Ho Chi Minh City Open University, building full-stack products with React and Spring Boot.",
    tags: ["React", "Spring Boot", "PostgreSQL"],
    clip: `${world}/beat-01.mp4`,
    mobileClip: `${world}/beat-01-mobile.mp4`,
    poster: `${world}/beat-01-poster.jpg`,
    mobilePoster: `${world}/beat-01-mobile-poster.jpg`,
    scroll: 1.1,
  },
  {
    id: "experience",
    label: "Experience",
    title: "Experience from real projects",
    body: "Hands-on work across the stack, from interface to database.",
    actions: experienceStats,
    clip: `${world}/beat-02.mp4`,
    mobileClip: `${world}/beat-02-mobile.mp4`,
    poster: `${world}/beat-02-poster.jpg`,
    mobilePoster: `${world}/beat-02-mobile-poster.jpg`,
    scroll: 1.1,
  },
  {
    id: "goal",
    label: "Goal",
    title: "Software Engineer Intern at SCTV",
    body: "Building software at Vietnam's leading cable TV and broadband network while finishing my Computer Science degree.",
    actions: goalActions,
    clip: `${world}/beat-03.mp4`,
    mobileClip: `${world}/beat-03-mobile.mp4`,
    poster: `${world}/beat-03-poster.jpg`,
    mobilePoster: `${world}/beat-03-mobile-poster.jpg`,
    scroll: 1.1,
  },
];
