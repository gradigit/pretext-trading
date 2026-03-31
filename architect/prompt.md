# Pretext Trading: ASCII Crypto Charts

Build a web-based crypto charting demo that renders TradingView-quality candlestick charts using only text characters, powered by chenglou's `@chenglou/pretext` library for precise proportional text measurement and layout.

## Core Vision

A beautiful, interactive crypto chart rendered entirely in text — no canvas, SVG, or images. The demo should make viewers say "I can't believe this is pure text." It's a showcase of what's possible with pretext's text measurement capabilities applied to data visualization.

## What It Is

A single-page web demo (browser-based, not terminal) that displays:
- Candlestick charts for crypto trading pairs (BTC/USDT primary)
- Volume bars below the main chart
- 1-2 moving average overlays (e.g., SMA 20, SMA 50)
- Interactive crosshair with price/time readout
- Time axis (X) and price axis (Y) with clean labels
- Multiple selectable timeframes (1m, 5m, 15m, 1h, 4h, 1D)
- 2-3 selectable trading pairs
- Optional live data via Binance WebSocket (with bundled sample data fallback)

## Technology Stack

- **Rendering engine**: `@chenglou/pretext` (npm package) for text measurement
- **Language**: TypeScript
- **Build system**: Bun (matching pretext's ecosystem)
- **Deployment**: Static site, deployable to GitHub Pages
- **Data**: Bundled sample OHLCV data + optional Binance public API

## Rendering Technique

Adapt the proven technique from pretext's fluid-smoke and variable-typographic-ascii demos:

### Initialization (one-time, at startup)

1. **Font detection**: Use `document.fonts.check()` to determine which font in the stack (Georgia → Palatino → Times New Roman → serif) is actually resolved. Record the resolved font.
2. **Palette construction**: Build once, cache, only rebuild if font config changes.

### Character Palette System
1. Define the character set: ` .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (78 chars from the proven fluid-smoke demo set). Do NOT include Unicode block elements — they render inconsistently in proportional serif fonts and break width measurement accuracy. The brightness-mapping approach with this ASCII set achieves better results with proportional fonts than block elements would.
2. For each character × 3 font weights (300, 500, 800) × 2 styles (normal, italic) = ~468 palette entries:
   - Measure brightness via hidden canvas `getImageData` (estimateBrightness pattern from fluid-smoke)
   - Measure precise width via `prepareWithSegments()` from pretext
3. Normalize brightness to [0, 1] range, sort palette by brightness, use binary search for fast lookup
4. Compute `targetCellWidth = containerWidth / COLS` (global, shared by all cells in a frame). This is the ideal uniform cell width — `findBest(targetBrightness, targetCellWidth)` selects the character closest in both brightness AND width.
5. **Column alignment caveat**: Since characters are proportional, actual widths won't exactly equal targetCellWidth. Per-row width error accumulates across columns. This means vertical alignment is approximate (~1-2px drift). This is acceptable — the fluid-smoke and variable-ascii demos use the same approach and look great. Each row is centered via paddingLeft adjustment to correct total-width differences.

### Chart-Specific Rendering
Unlike the fluid-smoke demo (which maps a continuous brightness field), chart rendering maps discrete financial data to a character grid.

#### Coordinate Mapping
- **Y-axis (price → row)**: The visible price range [minPrice, maxPrice] maps linearly to grid rows [0, chartRows]. Row 0 = maxPrice (top), row chartRows-1 = minPrice (bottom). Price per row = (maxPrice - minPrice) / chartRows. Add ~5% padding above/below the high/low range.
- **X-axis (time → column)**: Each candle occupies a fixed column allocation: 1 column gap + 1 column body + 1 column gap = 3 columns per candle. This gives visual separation between candles. With a 200-column grid and 3-column allocation, ~66 candles are visible. Adjust allocation based on zoom level.

#### Candle Grid Filling Algorithm
For each visible candle at column group [c, c+1, c+2]:
1. Compute row positions: `rowHigh = priceToRow(high)`, `rowLow = priceToRow(low)`, `rowOpen = priceToRow(open)`, `rowClose = priceToRow(close)`
2. `bodyTop = min(rowOpen, rowClose)`, `bodyBottom = max(rowOpen, rowClose)`
3. Column c (left gap): empty
4. Column c+1 (body column):
   - Rows from `rowHigh` to `bodyTop-1`: wick (medium brightness, ~0.4)
   - Rows from `bodyTop` to `bodyBottom`: body (high brightness, ~0.85)
   - Rows from `bodyBottom+1` to `rowLow`: wick (medium brightness, ~0.4)
5. Column c+2 (right gap): empty
6. Color: green if close >= open, red if close < open

#### Layer Compositing
Each renderer produces a 2D array of `CellInfo`:
```typescript
type CellInfo = {
  brightness: number  // 0-1
  color: string       // CSS class name: 'bull', 'bear', 'grid', 'ma1', 'ma2'
  priority: number    // higher wins
  text?: string       // for axis labels — use literal text instead of palette lookup
}
```

Priority order (highest wins):
1. **Axis labels** (priority 100) — literal text, white/gray, NOT palette-mapped
2. **Crosshair** (priority 90) — thin line characters, white
3. **Candle body** (priority 80) — high brightness, green/red
4. **Candle wick** (priority 60) — medium brightness, green/red
5. **Indicator line** (priority 50) — medium brightness, blue/orange per indicator
6. **Volume bar** (priority 40) — brightness proportional to relative volume, green/red
7. **Grid line** (priority 20) — very low brightness (~0.1), subtle gray
8. **Empty space** (priority 0) — space character

When compositing, for each cell take the layer with highest priority that has brightness > 0 (or has text content for labels).

#### Color via CSS Classes
- `.bull` — green shades for bullish candles/volume
- `.bear` — red shades for bearish candles/volume
- `.grid` — subtle gray for grid lines
- `.ma1` — blue for SMA 20
- `.ma2` — orange for SMA 50
- `.xhair` — white for crosshair
- Opacity classes `.a1` through `.a10` for brightness depth
- Weight classes `.w3` / `.w5` / `.w8` for font weight

#### Row Rendering
For each row of the grid:
1. Iterate cells left to right
2. For each cell:
   - If `cell.text` is set (axis label): render as literal text span
   - Else if `cell.brightness > 0.025`: `findBest(brightness, targetCellWidth)` → wrap in `<span class="{color} {weight} {opacity}">`
   - Else: append space character
3. Set row element's innerHTML
4. Measure actual row width, apply paddingLeft for centering

### Font & Typography
- Font family: `Georgia, Palatino, "Times New Roman", serif` (proportional — this is key)
- Font size: `14px` (exact — palette is built at this size)
- Line height: `17px` (exact — row elements use this height)
- Changing font size or family requires a full palette rebuild
- The proportional font is what makes this look dramatically better than monospace ASCII art
- At startup, detect the resolved font via `document.fonts.check()` and use it consistently

## Architecture

### Data Layer
- `data/sample-btcusdt.json` — bundled OHLCV sample data (enough for meaningful chart)
- `data/types.ts` — OHLCV type definitions: `{ time: number, open: number, high: number, low: number, close: number, volume: number }`
- `data/feed.ts` — data feed abstraction: loads sample data, optionally connects to Binance WebSocket for live updates
- Indicator calculations: SMA, with extensible pattern for adding more

### Chart Engine
- `chart/viewport.ts` — manages the visible window: which candles are visible, price range (Y), time range (X), zoom level
- `chart/geometry.ts` — maps data coordinates (price, time) to grid coordinates (row, col) and back
- `chart/candle-renderer.ts` — computes what each grid cell should display for candlestick layer
- `chart/volume-renderer.ts` — computes volume bar layer
- `chart/indicator-renderer.ts` — computes indicator overlay layer (moving averages)
- `chart/axis-renderer.ts` — computes axis labels and grid lines
- `chart/compositor.ts` — combines all layers into final grid: for each cell, determines the highest-priority element and its visual properties (brightness, color)

### Rendering Layer
- `render/palette.ts` — builds the character palette (brightness + width indexed), adapted from the fluid-smoke pattern
- `render/renderer.ts` — takes the composited grid and produces HTML spans for each row, measures widths, centers rows
- `render/styles.css` — CSS classes for colors, weights, opacity levels, font setup

### Interaction Layer
- `interaction/crosshair.ts` — tracks mouse position, maps to grid cell, maps to data coordinates
- `interaction/controls.ts` — timeframe selector, pair selector, scroll/zoom handlers

### Main
- `index.html` — HTML shell with the grid container, controls UI
- `main.ts` — entry point, wires everything together, starts the render loop

## Rendering Pipeline (per frame)

1. **Data**: Get visible candles from viewport + feed (include lookback data for indicators — SMA 50 needs 49 candles before the first visible candle)
2. **Compute indicators**: Calculate SMA values for visible range using lookback data
3. **Grid sizing**: Calculate COLS/ROWS from window dimensions. Compute `targetCellWidth = containerWidth / COLS`.
4. **Layer rendering**: Each renderer produces a 2D array of `CellInfo` (see type definition above) for its layer. Note: `targetCellWidth` is global (not per-cell) — all cells in a frame share the same target width.
5. **Compositing**: Merge layers by priority. Short-circuit: once a cell has a high-priority element (brightness > 0 or text set), skip lower layers.
6. **Character selection**: For each cell: if `cell.text` is set, use literal character. Otherwise `findBest(brightness, targetCellWidth)` from cached palette.
7. **HTML generation**: Build row innerHTML with colored/weighted spans
8. **DOM update**: Set each row element's innerHTML, adjust paddingLeft for centering
9. **Crosshair**: If mouse is over chart, apply crosshair via dirty-rect update (only re-render changed rows/columns)

## Visual Design

### Color Palette (dark background)
- Background: `#06060a` (near-black, matching pretext demos)
- Bullish candle body: bright green (`#00c853` or similar)
- Bearish candle body: bright red (`#ff1744` or similar)
- Bullish wick: dimmer green
- Bearish wick: dimmer red
- Volume (bullish): muted green
- Volume (bearish): muted red
- Grid lines: very subtle gray (low opacity)
- Axis text: light gray
- SMA 20: blue
- SMA 50: orange
- Crosshair: white, with price/time label boxes

### Grid Layout
```
┌─────────────────────────────────────────────────────┐
│  Price                                              │
│  Axis    ┌────────────────────────────────────────┐ │
│          │                                        │ │
│  68,500  │   Main Chart Area (candlesticks +      │ │
│          │   indicators + grid)                    │ │
│  68,000  │                                        │ │
│          │                                        │ │
│  67,500  │                                        │ │
│          ├────────────────────────────────────────┤ │
│          │   Volume Bars (shorter section)         │ │
│          ├────────────────────────────────────────┤ │
│          │   Time Axis Labels                     │ │
│          └────────────────────────────────────────┘ │
│                                                     │
│  [BTC/USDT ▼] [1h ▼]  Price: 68,234  Vol: 1.2M    │
└─────────────────────────────────────────────────────┘
```

The chart area, volume area, and axes are ALL rendered as text characters using the palette system. Only the control bar at the bottom uses standard HTML elements.

## Interaction

- **Crosshair**: Mouse position → highlight corresponding row and column. Use a **dirty-rect approach**: only re-render the 2 rows and update the column cells that changed since the last mouse position. Cache the base (non-crosshair) composited grid so crosshair updates don't require full recomposition. Show price label at the row edge and time label at the column edge.
- **Scroll**: Mouse wheel or drag → pan through time (shift viewport left/right). Re-render only when viewport actually changes.
- **Zoom**: Ctrl+wheel → zoom in/out (change number of visible candles). Adjust column allocation per candle accordingly.
- **Timeframe**: Click selector → reload data for new timeframe
- **Pair**: Click selector → reload data for new pair

## Performance Strategy

**Budget per frame** (16ms target for 60fps):
- Layer rendering + compositing: ~2-4ms (5 layers × 16K cells with priority short-circuit)
- Character selection: ~1-2ms (16K `findBest()` calls with binary search)
- HTML generation + DOM update: ~4-8ms (innerHTML for ~80 rows)
- Remaining headroom: ~2-6ms

**Optimizations:**
- **Palette**: Built once at startup (~50-200ms). Never rebuilt per-frame.
- **Static layer caching**: Grid lines don't change unless viewport moves. Pre-composite static layers and only recompose when viewport changes.
- **Crosshair**: Dirty-rect — only update rows/columns that changed, not the entire grid.
- **Resize**: Recalculate COLS/ROWS and targetCellWidth on resize (debounced 150ms), but don't rebuild palette.
- **Short-circuit compositing**: If a cell has a candle body (priority 80), skip checking lower-priority layers immediately.

## Data Format

OHLCV (standard):
```typescript
type Candle = {
  time: number      // Unix timestamp in milliseconds
  open: number      // Opening price
  high: number      // Highest price
  low: number       // Lowest price
  close: number     // Closing price
  volume: number    // Trading volume
}
```

Sample data: Use actual historical BTC/USDT 1h data downloaded from Binance's public kline API. Include at least 500 candles covering a period with interesting price action (trends, reversals, volume spikes). Alternatively, generate realistic synthetic OHLCV data with proper statistical properties (random walk with drift, realistic wick/body ratios, volume correlation with price moves). Bundle as JSON in the project.

## Success Criteria

1. **Visual fidelity**: Candlestick chart is immediately recognizable as a professional trading chart — not just an ASCII toy
2. **Aesthetic quality**: The proportional text rendering creates a unique, beautiful visual that's clearly superior to monospace ASCII charts
3. **Performance**: Smooth interaction at 30+ fps (target 60fps) for scrolling, crosshair tracking
4. **Correctness**: Candle proportions accurately represent OHLCV data. Indicators calculate correctly.
5. **Wow factor**: First impression should be "this is all text?!"

## Constraints

- Must use `@chenglou/pretext` for text measurement — this is the point of the demo
- Must be pure text rendering — no canvas, SVG, WebGL, or image elements for the chart itself
- Must work in modern browsers (Chrome, Firefox, Safari)
- Must work offline with bundled sample data (live data is optional enhancement)
- Proportional font (not monospace) — this is what makes it look dramatically better

## Out of Scope (v1)

- Drawing tools (trendlines, fibonacci)
- Custom indicator scripting
- Multi-chart layouts / split screen
- Order book / depth chart
- Alerts or notifications
- Trading / order placement
- User preferences persistence
- Mobile-optimized layouts
- RSI/MACD sub-panels (stretch goal for v1, could add later)
