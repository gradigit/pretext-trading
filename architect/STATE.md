# Forge State
## Current Stage: finalized (Step 10-11)
## Mode: 1
## Depth: full
## Categories Asked: [1-core-vision, 2-requirements, 3-prior-art, 4-architecture, 6-performance, 8-integration, 11-tradeoffs, 12-scope]
## Categories Skipped: [5-edge-cases (demo project), 7-security (no auth/data), 9-testing (visual verification), 10-deployment (static web)]
## Categories Remaining: []
## Key Decisions:
- Platform: Web demo (browser-based, NOT terminal TUI)
- Library: chenglou/pretext (text-based rendering)
- Domain: Crypto trading charts (TradingView-style)
- Rendering: Pure text — no canvas, SVG, or images. Uses proportional font (Georgia) with pretext for width measurement.
- Technique: Character palette system (brightness × width indexed), adapted from fluid-smoke demo
- Audience: Open source community
- North star: Aesthetic quality — "I can't believe this is text"
- Data source: Bundled sample data + optional Binance WebSocket
- Priority: Quality > Simplicity > Speed > Flexibility > Cost
- Scope v1: BTC/USDT candlestick, volume, 1-2 MAs, crosshair, multi-timeframe
- Build system: Bun + TypeScript (matching pretext ecosystem)
- Candle layout: 3-column allocation per candle (gap-body-gap)
- Layer compositing with priority system for overlapping elements
- User delegated all questionnaire decisions
