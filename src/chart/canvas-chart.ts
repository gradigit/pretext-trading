import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { OrderBook } from '../data/orderbook.ts'

// Colors — bright and saturated for clear classification after downsampling
const BULL_BODY = '#00ff66'
const BULL_WICK = '#00aa44'
const BULL_VOL = '#008833'
const BEAR_BODY = '#ff2255'
const BEAR_WICK = '#cc2244'
const BEAR_VOL = '#991133'
const MA1_COLOR = '#44aaff'
const MA2_COLOR = '#ffaa00'
const GRID_COLOR = 'rgba(90,90,160,0.30)'
const BG_COLOR = '#060610'
const BOOK_BID = '#00aa40'
const BOOK_ASK = '#cc2244'
const XHAIR_COLOR = 'rgba(200,200,255,0.5)'
const RSI_BULL = '#00cc44'
const RSI_BEAR = '#ee2244'
const RSI_NEUT = '#3399ff'
const RSI_LEVEL = 'rgba(80,80,140,0.2)'

export type PixelGrid = {
  brightness: Float32Array
  colorIdx: Uint8Array
  cols: number
  rows: number
}

export const COLOR_CLASSES = ['', 'bull', 'bear', 'grid', 'ma1', 'ma2', 'xhair'] as const

export function createPixelGrid(cols: number, rows: number): PixelGrid {
  return {
    brightness: new Float32Array(cols * rows),
    colorIdx: new Uint8Array(cols * rows),
    cols, rows,
  }
}

// Cached glow canvas
let _glowCvs: HTMLCanvasElement | null = null
let _glowCtx: CanvasRenderingContext2D | null = null
function getGlowCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!_glowCvs) { _glowCvs = document.createElement('canvas'); _glowCtx = _glowCvs.getContext('2d')! }
  if (_glowCvs.width !== w) _glowCvs.width = w
  if (_glowCvs.height !== h) _glowCvs.height = h
  return [_glowCvs, _glowCtx!]
}

export function renderChartToCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  vp: Viewport,
  sma20: (number | null)[],
  sma50: (number | null)[],
  rsi14: (number | null)[],
  orderBook: OrderBook | null,
  mouseCol: number,
  mouseRow: number,
  _screenW: number,
  _screenH: number,
  enableGlow: boolean = true,
): void {
  // Render at 2× grid resolution — fast with decent anti-aliasing
  const SCALE = 2
  const w = vp.cols * SCALE
  const h = vp.rows * SCALE
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  const cellW = SCALE
  const cellH = SCALE

  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, w, h)

  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  function priceToY(price: number): number {
    return (vp.chartRowStart + (vp.priceMax - price) / priceRange * chartRows) * cellH
  }

  function colToX(col: number): number {
    return col * cellW
  }

  // --- Grid lines ---
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1

  const labelCount = Math.max(2, Math.min(8, Math.floor(chartRows / 10)))
  const priceStep = priceRange / labelCount
  const mag = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / mag) * mag
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const y = priceToY(price)
    if (y > vp.chartRowStart * cellH + cellH && y < vp.chartRowEnd * cellH - cellH) {
      ctx.beginPath()
      ctx.moveTo(colToX(vp.chartColStart), y)
      ctx.lineTo(colToX(vp.chartColEnd), y)
      ctx.stroke()
    }
  }

  const timeLabelInterval = Math.max(1, Math.ceil(14 / vp.colsPerCandle))
  for (let i = vp.startIndex; i < end; i += timeLabelInterval) {
    const vi = i - vp.startIndex
    const x = colToX(vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2))
    ctx.beginPath()
    ctx.moveTo(x, vp.chartRowStart * cellH)
    ctx.lineTo(x, vp.chartRowEnd * cellH)
    ctx.stroke()
  }

  // --- Volume bars ---
  const volumeRows = vp.volumeRowEnd - vp.volumeRowStart
  let maxVol = 0
  for (let i = vp.startIndex; i < end; i++) {
    if (candles[i]!.volume > maxVol) maxVol = candles[i]!.volume
  }

  if (maxVol > 0) {
    for (let i = vp.startIndex; i < end; i++) {
      const c = candles[i]!
      const vi = i - vp.startIndex
      const x = colToX(vp.chartColStart + vi * vp.colsPerCandle)
      const barH = Math.max(1, (c.volume / maxVol) * volumeRows * cellH)
      const bodyW = Math.max(1, (vp.colsPerCandle - 1) * cellW)

      ctx.fillStyle = c.close >= c.open ? BULL_VOL : BEAR_VOL
      ctx.fillRect(x, vp.volumeRowEnd * cellH - barH, bodyW, barH)
    }
  }

  // --- Candlesticks ---
  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    const vi = i - vp.startIndex
    const isBull = c.close >= c.open

    // Pixel positions — body fills most of the allocation, small gap
    const gap = cellW * 0.3
    const candleLeft = colToX(vp.chartColStart + vi * vp.colsPerCandle) + gap
    const candleCenter = colToX(vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2))
    const bodyW = Math.max(2, vp.colsPerCandle * cellW - gap * 2)

    const yHigh = priceToY(c.high)
    const yLow = priceToY(c.low)
    const yOpen = priceToY(c.open)
    const yClose = priceToY(c.close)
    const bodyTop = Math.min(yOpen, yClose)
    const bodyBot = Math.max(yOpen, yClose)
    const bodyH = Math.max(1, bodyBot - bodyTop)

    // Wick — thin line
    ctx.strokeStyle = isBull ? BULL_WICK : BEAR_WICK
    ctx.lineWidth = Math.max(1, cellW * 0.3)
    ctx.beginPath()
    ctx.moveTo(candleCenter, yHigh)
    ctx.lineTo(candleCenter, bodyTop)
    ctx.moveTo(candleCenter, bodyBot)
    ctx.lineTo(candleCenter, yLow)
    ctx.stroke()

    // Body — solid filled rectangle
    ctx.fillStyle = isBull ? BULL_BODY : BEAR_BODY
    ctx.fillRect(candleLeft, bodyTop, bodyW, bodyH)
  }

  // --- MA lines ---
  drawMALine(ctx, sma20, vp, MA1_COLOR, Math.max(1.5, cellW * 0.4), cellW, cellH)
  drawMALine(ctx, sma50, vp, MA2_COLOR, Math.max(1.5, cellW * 0.4), cellW, cellH)

  // --- RSI panel ---
  if (vp.showRsi) {
    renderRSI(ctx, rsi14, vp, cellW, cellH)
  }

  // --- Order book ---
  if (vp.showBook && orderBook) {
    renderOrderBook(ctx, orderBook, vp, cellW, cellH)
  }

  // --- Glow pass: blur then additive blend (skip during fast interaction) ---
  if (enableGlow) {
    const [glowCvs, glowCtx2] = getGlowCanvas(canvas.width, canvas.height)
    glowCtx2.filter = `blur(${SCALE + 1}px)`
    glowCtx2.drawImage(canvas, 0, 0)
    glowCtx2.filter = 'none'
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.35
    ctx.drawImage(glowCvs, 0, 0)
    ctx.globalAlpha = 1.0
    ctx.globalCompositeOperation = 'source-over'
  }

  // --- Crosshair ---
  if (mouseCol >= vp.chartColStart && mouseCol < vp.chartColEnd &&
      mouseRow >= 0 && mouseRow < vp.rsiRowEnd) {
    ctx.strokeStyle = XHAIR_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(colToX(vp.chartColStart), mouseRow * cellH + cellH / 2)
    ctx.lineTo(colToX(vp.chartColEnd), mouseRow * cellH + cellH / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mouseCol * cellW + cellW / 2, 0)
    ctx.lineTo(mouseCol * cellW + cellW / 2, vp.rsiRowEnd * cellH)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawMALine(
  ctx: CanvasRenderingContext2D,
  values: (number | null)[],
  vp: Viewport,
  color: string,
  width: number,
  cellW: number,
  cellH: number,
): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, values.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  let started = false

  for (let i = vp.startIndex; i < end; i++) {
    const val = values[i]
    if (val === null) { started = false; continue }
    const vi = i - vp.startIndex
    const x = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * cellW
    const y = (vp.chartRowStart + (vp.priceMax - val) / priceRange * chartRows) * cellH

    if (!started) { ctx.moveTo(x, y); started = true }
    else { ctx.lineTo(x, y) }
  }
  ctx.stroke()
}

function renderRSI(
  ctx: CanvasRenderingContext2D,
  rsi14: (number | null)[],
  vp: Viewport,
  cellW: number,
  cellH: number,
): void {
  const panelTop = vp.rsiRowStart * cellH
  const panelH = (vp.rsiRowEnd - vp.rsiRowStart) * cellH
  const y70 = panelTop + (1 - 70 / 100) * panelH
  const y30 = panelTop + (1 - 30 / 100) * panelH
  const y50 = panelTop + panelH / 2

  ctx.strokeStyle = RSI_LEVEL
  ctx.lineWidth = 1
  for (const y of [y70, y30, y50]) {
    ctx.beginPath()
    ctx.moveTo(vp.chartColStart * cellW, y)
    ctx.lineTo(vp.chartColEnd * cellW, y)
    ctx.stroke()
  }

  const end = Math.min(vp.startIndex + vp.visibleCount, rsi14.length)
  ctx.lineWidth = Math.max(1.5, cellW * 0.3)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Draw as segments with color changes
  let prevX = 0, prevY = 0, started = false
  for (let i = vp.startIndex; i < end; i++) {
    const val = rsi14[i]
    if (val === null) { started = false; continue }
    const vi = i - vp.startIndex
    const x = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * cellW
    const y = panelTop + (1 - val / 100) * panelH

    if (started) {
      ctx.strokeStyle = val >= 70 ? RSI_BEAR : val <= 30 ? RSI_BULL : RSI_NEUT
      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    prevX = x; prevY = y; started = true
  }
}

function renderOrderBook(
  ctx: CanvasRenderingContext2D,
  book: OrderBook,
  vp: Viewport,
  cellW: number,
  cellH: number,
): void {
  if (book.bids.length === 0) return
  const bookLeft = vp.bookColStart * cellW
  const bookRight = vp.bookColEnd * cellW
  const bookW = bookRight - bookLeft
  const midY = (vp.chartRowStart + (vp.chartRowEnd - vp.chartRowStart) / 2) * cellH
  const halfH = midY - vp.chartRowStart * cellH

  let maxCum = 0, cum = 0
  for (const b of book.bids) { cum += b.quantity; if (cum > maxCum) maxCum = cum }
  cum = 0
  for (const a of book.asks) { cum += a.quantity; if (cum > maxCum) maxCum = cum }
  if (maxCum === 0) return

  cum = 0
  const rowH = cellH
  for (let i = 0; i < book.bids.length && (i + 1) * rowH < halfH; i++) {
    cum += book.bids[i]!.quantity
    const barW = Math.max(2, (cum / maxCum) * bookW)
    ctx.fillStyle = BOOK_BID
    ctx.fillRect(bookRight - barW, midY + i * rowH, barW, rowH - 1)
  }

  cum = 0
  for (let i = 0; i < book.asks.length && (i + 1) * rowH < halfH; i++) {
    cum += book.asks[i]!.quantity
    const barW = Math.max(2, (cum / maxCum) * bookW)
    ctx.fillStyle = BOOK_ASK
    ctx.fillRect(bookRight - barW, midY - (i + 1) * rowH, barW, rowH - 1)
  }
}

// --- Downsample canvas to character grid ---
const SCALE = 2

export function readCanvasToGrid(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
): void {
  const { cols, rows } = grid
  const sw = cols * SCALE
  const sh = rows * SCALE
  const imgData = ctx.getImageData(0, 0, sw, sh).data

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Average the 3×3 pixel block
      let rSum = 0, gSum = 0, bSum = 0
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const idx = ((r * SCALE + dy) * sw + (c * SCALE + dx)) * 4
          rSum += imgData[idx]!
          gSum += imgData[idx + 1]!
          bSum += imgData[idx + 2]!
        }
      }

      const n = SCALE * SCALE
      const rr = rSum / n
      const gg = gSum / n
      const bb = bSum / n

      const i = r * cols + c
      // Use max channel for brightness (vivid), luminance for classification
      const mx = Math.max(rr, gg, bb)
      const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb
      let rawBrightness = Math.min(1, mx / 180)

      grid.brightness[i] = rawBrightness

      // Color classification (from raw pixel data, not quantized)
      if (lum < 4) {
        grid.colorIdx[i] = 0
      } else if (gg > rr * 1.2 && gg > bb * 1.2) {
        grid.colorIdx[i] = 1 // bull
      } else if (rr > gg * 1.2 && rr > bb * 1.2) {
        grid.colorIdx[i] = 2 // bear
      } else if (bb > rr * 1.15 && bb > gg * 1.15) {
        grid.colorIdx[i] = 4 // ma1
      } else if (rr > bb * 1.2 && gg > bb * 1.1 && rr > 35) {
        grid.colorIdx[i] = 5 // ma2
      } else if (lum > 8) {
        grid.colorIdx[i] = 3 // grid
      } else {
        grid.colorIdx[i] = 0
      }
    }
  }
}
