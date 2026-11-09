# Spine Tech

Website for **Spine Tech**: hardware and software solutions for companies and agencies, with AI integration that connects organizations into concrete, working workflows.

- **Live site:** https://spine-tech.vercel.app
- **Repository:** https://github.com/dev-eloper-365/Spine-Tech

## Reference

The layout, spacing and motion are modeled on the portfolio of Ryan Ritzenthaler:

- Site: https://www.ryanritzenthaler.com/
- Awwwards: https://www.awwwards.com/sites/ryan-ritzenthaler-portfolio-v2

The component types, measurements and interaction style follow the reference. The content, the brand mark, the images (generated placeholders in `public/art/`) and the code are original to this project.

## Stack

- [Vite](https://vite.dev/) + plain TypeScript (no framework)
- [Lenis](https://github.com/darkroomengineering/lenis) for smooth scrolling
- [OGL](https://github.com/oframe/ogl) for WebGL:
  - `src/gl/hero.ts` – spine-shaped hero surface with tile glitch and iridescent rim
  - `src/gl/title.ts` – liquid hover effect on the hero title (stable-fluids simulation with an RGB split)
  - `src/gl/end.ts` – end scene with stars and a sun
- Fonts: Inter (variable, via Fontsource) and Respira Black (`public/fonts/`)

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

## Compare tool

`tools/compare.html` shows the reference site and the local build side by side, so spacing and motion can be checked against each other.

1. Start the dev server with `npm run dev`.
2. Open http://localhost:5173/tools/compare.html.

Both sides render at the same fixed viewport (default 1440 × 813) and are scaled to fit their pane, so viewport-based sizes match exactly. Use the buttons in the bottom-right corner to switch the width to 1440, 1280 or 390 (mobile). You can also set the viewport with query parameters, for example `?w=1280&h=800`.

The tool is for development only. It is not part of the production build.

## Project structure

```
index.html            all page sections
src/main.ts           scroll, cursor, spinners, marquee, services slides, preloader, WebGL loading
src/data.ts           project list (placeholder content)
src/gl/               WebGL effects (hero, title, end scene)
src/styles/main.css   all styles
public/art/           generated placeholder images (scripts/gen-art.mjs)
public/fonts/         display font
tools/compare.html    side-by-side compare tool
SPINE_CONTEXT.md      working notes: decisions, measurements and progress log
```

## Deployment

The site is deployed on Vercel (project `spine-tech`). To deploy from the command line:

```bash
vercel deploy --prod
```

## Placeholder content to replace

- Project names and details in `src/data.ts`
- Contact email `hello@spinetech.example`
- Images in `public/art/`
