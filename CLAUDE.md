# Raqaa (رقعة): referee and display app

Raqaa is an in-person territory competition. Four neighbourhoods (teams) build on an iso map (9×9 or 7×7) by answering questions, and fight over plots in auctions won by challenges. This project builds the system that runs it: a referee screen on a laptop and a display screen on a TV, both from one web app that works offline. It is published as a website that installs as an app, and also built as a single HTML file.

## Sources of truth

Read these before any work. They are in Arabic.

| File | Use it for |
| --- | --- |
| `docs/decisions.md` | Decisions agreed with Mohd after the docs review. Overrides the requirements, the screens and the phase prompts wherever they conflict. Read it first. |
| `docs/raqaa-requirements.pdf` (or `.html`) | Rules, flows, events, state, tech, acceptance criteria, phases. Authoritative for behaviour. |
| `docs/raqaa-identity.pdf` | Colours, type, logo, icons, the map's look. |
| `docs/raqaa-screens.pdf` and `docs/screens/*.png` | Every screen state. `D` = display (TV), `R` = referee. `docs/screens/INDEX.md` lists them. |
| `reference/iso-board.md` | How to draw the iso map and the final podium. |

- If they conflict: `docs/decisions.md` wins over everything. Otherwise the requirements win on behaviour, and the identity and screens win on looks.
- The screens show direction, not a pixel-final spec. Improve details when building or testing shows a better way, but keep the visual language (tokens, components, layout logic) and tell Mohd what you changed.
- The requirements link to an older external "rules" document. You don't need it: the requirements already contain every rule.
- When a rule is unclear or missing, ask Mohd. Don't invent rules.

## Stack and hard constraints

- Vite, TypeScript and React. One build makes two outputs from the same code:
  - the website, which installs as an app and works offline after the first visit (web app manifest and service worker). It is published on CranL (cranl.com) from the private GitHub repo, connected in the last phase;
  - `raqaa.html`, one self-contained file built with `vite-plugin-singlefile`. It opens by double-click (`file://`) as the offline backup.
- Both run fully offline in Chrome or Edge on Windows. The app makes no network requests of its own: no CDN, no Google Fonts, no analytics. The only network use is the site loading and updating itself. Both builds carry a Content-Security-Policy that enforces this (`tools/pwa.ts`); `raqaa.html` allows no connections at all. Keep it, and widen it only on purpose.
- An update never reloads a running competition: a new version applies the next time the app opens. Saved games carry a schema version.
- Questions never ship inside the published code. They come from the referee's file.
- Embed Alexandria 400/600/900 from `assets/fonts`, as WOFF2.
- Two windows: the referee and the display (`#display`). They sync over `BroadcastChannel` and, as a fallback, `localStorage` "storage" events; every message goes over both and the display drops copies (`src/state/sync.ts`). Each works alone in Chrome and Edge, on the website and from `file://`; `?sync=broadcast` or `?sync=storage` keeps one, for tests. The display can be opened from its own link at any time. When it opens it shows the last snapshot kept in `localStorage` (so it works while the referee window is closed), and asks for the full state; only renders the state and the last event, and never changes anything. The referee window is the only writer.
- The state is event-sourced. Every change is an event, and state is a pure fold of the events over the initial state. Undo removes the last event and recomputes. Generated content (math problems, scrambled sentences, memory items) and each event's time live in the event's payload. A timer running out is an event.
- Save the setup and the events to `localStorage` after every event. On open, the referee goes straight back to the saved competition, with no "resume" prompt. Export and import a competition as a JSON file.
- The rules engine lives in `src/engine`: pure functions with no UI, supporting both map sizes. Use the event names from the requirements' events table, with the changes in `docs/decisions.md`.
- Tests: Vitest, with at least one test per acceptance criterion. Playwright, on the installed Chrome and Edge, for two windows, reloads and offline use.
- Read the question file (Excel or CSV) with SheetJS from its official distribution (the copy on the npm registry is outdated), bundled into the app.
- Animate with the Web Animations API. Under `prefers-reduced-motion`, every motion becomes an instant change.
- The display plays sounds generated with the Web Audio API, with no audio files. Audio starts on the display's first click, and the referee can mute it.
- Mohd works on Windows. The project lives in OneDrive and must stay there, with `node_modules` inside it; OneDrive uploads it, by Mohd's choice. Use pnpm with the settings in `pnpm-workspace.yaml`: `nodeLinker: hoisted` and `packageImportMethod: copy` keep `node_modules` as plain files with no links. OneDrive follows directory links and uploads their targets, so never move dependencies out through junctions, symlinks or an outside virtual store.
- Package scripts must work on Windows (PowerShell), with no bash-only syntax: `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm test`, `pnpm e2e` (builds, then runs Playwright), `pnpm lint`, and `pnpm icons` (redraws `public/icons` from the mark).

## UI conventions

- **Language and numbers**
  - Set Arabic UI everywhere with `lang="ar"` and `dir="rtl"`.
  - Show numbers in Arabic-Indic digits with the Arabic thousands separator (٣٬١٠٠).
  - Format all numbers through one helper.
- **Names in code:** use the code names from the requirements glossary (القاموس), such as `team`, `plot`, `base`, `center`, `day`, `question`, `player`, `permit`, `move`, `build`, `auction`, `challenge`, `bidder`, `defender`, `points`, `fence`, `crane`, `bridge`, `plan`, `inspector`, `missions`, `referee` and `winner`.
- **Population:** population = points × 100. The screens always show population, never points.
- **Teams**
  - A team's colour always appears with its symbol: coral triangle, blue circle, green square, gold diamond.
  - Text and symbols on team colours are ink `#13213D`.
  - Team names are set in setup and change between competitions, so never hard-code them.
- **Turn on the display:** never show build-order numbers. The «دوره», «يبني» or «يزايد» arrow marks the active team. The referee screen keeps the order list.
- **Colours:** use the tokens in `assets/tokens.css` and `assets/tokens.json`. Ask before adding a colour.
- **Shapes**
  - Use fully rounded pills only for the population bubble and the referee's status. Other tags and chips get radius 6 to 8.
  - Cards that need emphasis use a white background with a coloured border, not a tinted fill.
- **Text:** don't add captions or helper text unless they are strictly needed. Elements should explain themselves.
- **Accessibility:** touch targets are at least 44px and the focus ring is 3px.
- **Sizes**
  - The referee screen supports 1280×720 and up, and was designed at 1440×900.
  - Build the display as a fixed 1280×720 stage, scaled to fit any 16:9 screen.

## Assets

| Folder | Contents |
| --- | --- |
| `assets/brand` | Logo (full and horizontal, day and night) and `mark.svg`, the game icon (also the favicon). |
| `assets/icons` | 24-grid icons in `currentColor`. Draw new icons in the same style: 24 grid, 2.6 stroke, round caps and joins, or solid shapes. This includes the memory images. |
| `assets/teams` | The team symbols. |
| `assets/cards` | Action-card art (200 grid) and `cards.json` with the Arabic names. |
| `assets/fonts` | Alexandria (TTF originals and the WOFF2 the app uses) and its license note. |
| `reference/*.py` | The Python that drew the identity and the screens (`map9.py` the iso map, `mark3.py` the logo, `mayor.py` the final podium). Port the maths, not the code. |

## How we work

- **Keep it basic, with high quality.** Choose the simplest design that meets the requirements well. Don't add features, warnings, screens, settings or tooling Mohd didn't ask for; mention an idea in one line at most.
- **You run everything.** Mohd doesn't run commands. Install, build, run the tests and check the screens yourself (the browser pane works well). Show Mohd results they can see without a terminal: the browser pane, `dist\raqaa.html` by double-click, or the published site.
- **One phase at a time.** The requirements list 7 phases, and `prompts/` has one prompt per phase. Never start the next phase on your own.
- **Plan first.** Start every phase with a short plan, then wait for Mohd's approval.
- **Engine before UI.** Keep the engine pure and tested before any UI depends on it.
- **Decisions:** record every decision Mohd makes in `docs/decisions.md`, in Arabic. When a decision changes the stack or a convention, update this file too.
- **End-of-phase report**, short and plain, covering:
  - what you built;
  - what Mohd can look at and click, with no commands;
  - which acceptance criteria are covered;
  - assumptions and open questions.
- **Commit** once, at the end of each phase, with a clear message. No commits for each step along the way.
- **Push** to GitHub only when Mohd asks.

## Target layout

```
src/engine     rules, reducer, selectors (pure, tested); index.ts exports it all, scenarios.ts has ready-made games
src/state      events, persistence, window sync
src/ui         shared components: TeamBadge, Sign, Timer, Board, Button
src/referee    referee screens (R01–R13)
src/display    display stage and states (D01–D21)
src/content    built-in banks (spelling, ordering, memory) as JSON + SVG
tests/         Vitest
e2e/           Playwright
tools/         build plugins (website and single file), service worker template, icon script
public/        web app manifest and app icons (website only)
```
