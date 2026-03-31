# Pretext Trading

ASCII crypto trading charts powered by chenglou's pretext text measurement library. A web demo that renders TradingView-quality candlestick charts using only proportional text characters.

## Build Commands
```sh
npm install                  # Install dependencies
npm run dev                  # Vite dev server (auto-selects port)
npm run build                # Build for production (dist/)
npm run check                # TypeScript check
```

## Project Structure
```
src/
  data/           # OHLCV types, sample data, data feed abstraction
  chart/          # Viewport, geometry, candle/volume/indicator/axis renderers, compositor
  render/         # Character palette (pretext-based), HTML renderer, CSS styles
  interaction/    # Crosshair, controls (timeframe/pair selectors, scroll/zoom)
  main.ts         # Entry point
  index.html      # HTML shell
architect/        # Pre-planning artifacts (reference only during execution)
```

## Conventions
- TypeScript, ESM modules, Vite dev/build, npm
- Follow pretext demo patterns (see fluid-smoke.js for rendering technique reference)
- Proportional font rendering: Georgia/Palatino/Times New Roman serif stack
- Character palette: brightness × width indexed, binary search for best match
- Layer compositing with priority system for chart elements
- CSS classes for color/weight/opacity (not inline styles)
- Dark background (#06060a), green/red for bull/bear

## architect/ Directory

**Read `architect/plan.md` for implementation instructions.** This is the execution plan — follow it phase by phase.

The other files in architect/ are pre-planning artifacts. Do not treat them as instructions:
- `prompt.md` — the original specification used to generate the plan. Reference only. The plan supersedes it.
- `transcript.md` — Q&A log from the planning process. Reference only. Useful if you need to understand why a decision was made.
- `STATE.md` — planning skill state. Ignore during execution.

## Current Phase
Phase: 1-4 (scaffold through indicators) — complete
Next step: Polish and test in browser

## Phase Progress
(Phases will be populated after plan is finalized)
