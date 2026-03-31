# TODO

## Current Phase: Implementation

### Completed
- [x] Project scaffold — package.json, tsconfig, Vite, npm
- [x] Character palette system (palette.ts) — brightness + width measurement, findBest binary search
- [x] Sample data generator — 600 synthetic BTC/USDT candles
- [x] Viewport management — price range auto-scaling, pan, zoom
- [x] Geometry mapping — price→row, candleCol, colToDataIndex
- [x] Candle renderer — body + wick with brightness levels, bull/bear color
- [x] Volume renderer — proportional bars, color-matched
- [x] Axis renderer — price labels, time labels, grid lines
- [x] Indicator renderer — SMA with line interpolation
- [x] Compositor — priority-based cell merging
- [x] HTML renderer — innerHTML generation, paddingLeft centering
- [x] Main entry — full pipeline, render loop, scroll/zoom, crosshair
- [x] CSS — color ramps for bull/bear/grid/ma1/ma2/xhair (10 opacity levels each)
- [x] TypeScript compiles clean
- [x] Vite dev server running

### In Progress
- [ ] Browser testing and visual tuning

### Blocked / Issues
- Bun not available (no sudo for unzip install) — switched to npm + Vite

### Deviations from Plan
- Using Vite instead of Bun for dev server and build (Bun not installed, no sudo access)
- index.html at project root (Vite convention) instead of src/
