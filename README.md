# Bùi Trọng Nghĩa · Portfolio

A space-themed personal portfolio: you fly through a galaxy, land on a star map where every
project is a planet, and meet Nova, a pixel astronaut who runs the hidden mission-control terminal.

I'm a final-year Computer Science student at Ho Chi Minh City Open University and a Software
Engineer Intern at SCTV, building full-stack products with React and Spring Boot.

## Highlights

- **Galaxy turntable intro.** The loader is a vinyl record with a galaxy pressed into it, spinning
  up to 33⅓ rpm while three tilted orbits draw themselves as assets load.
- **Scroll-scrubbed hero.** A 10 second film split into three story beats. One scroll gesture glides
  to the next beat, and the film scrubs along the way.
- **Project star map.** Nine rendered planets, one per project. Click a planet (or its name) and the
  camera flies to it with the project's details, stack and links beside it.
- **Skill constellation.** Pick a technology in the orbit and glowing threads connect it to the
  projects that use it.
- **Crew pass.** An ID badge on a lanyard with pendulum physics: drag it to swing, tap it to flip.
- **Generative soundtrack.** Four tracks synthesised live with the Web Audio API (no audio files),
  with a mini turntable player, track list, shuffle and crossfades.
- **Mission-control terminal.** Press `~` anywhere. Nova watches your cursor, reacts to commands,
  wears headphones when music plays and dozes off when left alone.
- **Motion that respects the visitor.** Follows the OS reduced-motion setting, with a Motion toggle
  in the navigation to override it.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR) on Vite
- TypeScript, Tailwind CSS v4 and hand-written CSS
- Canvas 2D for the star map, orbit system, loader and starfield
- Web Audio API for the soundtrack
- Scroll-driven CSS animations (`animation-timeline`) where supported
- Built for Cloudflare Workers (Wrangler)

## Getting started

Requires [Bun](https://bun.sh).

```bash
cd app
bun install
bun run dev
```

Other scripts:

| Command | What it does |
| --- | --- |
| `bun run build` | UI checks, type generation, typecheck and production build |
| `bun run typecheck` | Route generation and TypeScript check |
| `bun run lint` | ESLint |
| `bun run preview` | Preview the production build |

## Project structure

```
app/
  public/assets/
    world/        hero film segments and their exact first-frame posters
    planets/      rendered planet images for the star map
    img/          project screenshots, badge photo, social image
    logos/        technology logos (Simple Icons)
  src/
    components/nghia/          the portfolio: page, sections, loader, map, terminal, Nova
    components/scroll-scrub/   scroll-scrub film engine
    lib/ambient.ts             generative soundtrack
    lib/motion.ts              reduced-motion preference and override
    scroll-scrub-scenes.ts     hero story beats
```

## Credits

- Photos from Wikimedia Commons: vegetables (CC0), vinyl record by Shixart1985 (CC BY 2.0),
  database schema (CC BY-SA 3.0), sign language interpreter (CC BY-SA 4.0).
- Technology logos: [Simple Icons](https://simpleicons.org).
- Hero film and planet renders generated with Higgsfield.

## Contact

- LinkedIn: [linkedin.com/in/btn2812](https://linkedin.com/in/btn2812)
- GitHub: [github.com/ziu222](https://github.com/ziu222)
