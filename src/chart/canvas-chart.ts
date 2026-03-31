import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { OrderBook } from '../data/orderbook.ts'

// Color encoding: we use specific RGB values so the pixel reader
// can determine which CSS color class to use.
// Green channel dominant → bull, Red dominant → bear,
// Blue dominant → ma1, Orange (R+G) → ma2, Gray → grid/xhair
const BULL = '#00c853'
const BULL_DIM = '#004d20'
const BULL_VOL = '#00602a'
const BEAR = '#e8143c'
const BEAR_DIM = '#5c0818'
const BEAR_VOL = '#6b1020'
const MA1 = '#42a5f5'  // blue
const MA2 = '#ff9800'  // orange
const GRID = '#222238'
const RSI_OB = '#5c0818'  // overbought line
const RSI_OS = '#004d20'  // oversold line
const RSI_MID = '#121225'
const BG = '#000000'
const BOOK_BID = '#003d15'
const BOOK_ASK = '#4a0a18'

export type PixelInfo = {
  brightness: number
  colorClass: string
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
): void {
  const w = vp.cols
  const h = vp.rows
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  // Background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  function priceToY(price: number): number {
    return vp.chartRowStart + (vp.priceMax - price) / priceRange * chartRows
  }

  function candleX(vi: number): number {
    return vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
  }

  // --- Grid lines ---
  ctx.strokeStyle = GRID
  ctx.lineWidth = 1

  // Horizontal grid lines at nice price levels
  const labelCount = Math.max(2, Math.min(8, Math.floor(chartRows / 10)))
  const priceStep = priceRange / labelCount
  const mag = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / mag) * mag
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const y = Math.round(priceToY(price))
    if (y > vp.chartRowStart && y < vp.chartRowEnd - 1) {
      ctx.beginPath()
      ctx.moveTo(vp.chartColStart, y + 0.5)
      ctx.lineTo(vp.chartColEnd, y + 0.5)
      ctx.stroke()
    }
  }

  // Vertical grid lines
  const timeLabelInterval = Math.max(1, Math.ceil(14 / vp.colsPerCandle))
  for (let i = vp.startIndex; i < end; i += timeLabelInterval) {
    const vi = i - vp.startIndex
    const x = candleX(vi)
    ctx.beginPath()
    ctx.moveTo(x + 0.5, vp.chartRowStart)
    ctx.lineTo(x + 0.5, vp.chartRowEnd)
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
      const x = vp.chartColStart + vi * vp.colsPerCandle
      const barH = Math.max(1, Math.round((c.volume / maxVol) * volumeRows))
      const bodyW = Math.max(1, vp.colsPerCandle - 1)

      ctx.fillStyle = c.close >= c.open ? BULL_VOL : BEAR_VOL
      ctx.fillRect(x, vp.volumeRowEnd - barH, bodyW, barH)
    }
  }

  // --- Candlesticks ---
  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    const vi = i - vp.startIndex
    const centerX = candleX(vi)
    const isBull = c.close >= c.open
    const bodyW = Math.max(1, vp.colsPerCandle - 1)
    const bodyX = vp.chartColStart + vi * vp.colsPerCandle

    const yHigh = priceToY(c.high)
    const yLow = priceToY(c.low)
    const yOpen = priceToY(c.open)
    const yClose = priceToY(c.close)
    const bodyTop = Math.min(yOpen, yClose)
    const bodyBot = Math.max(yOpen, yClose)

    // Wick
    ctx.strokeStyle = isBull ? BULL_DIM : BEAR_DIM
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX + 0.5, yHigh)
    ctx.lineTo(centerX + 0.5, yLow)
    ctx.stroke()

    // Body (filled rectangle)
    ctx.fillStyle = isBull ? BULL : BEAR
    const bodyH = Math.max(1, bodyBot - bodyTop)
    ctx.fillRect(bodyX, bodyTop, bodyW, bodyH)
  }

  // --- MA lines ---
  drawMALine(ctx, sma20, vp, MA1, 1.5)
  drawMALine(ctx, sma50, vp, MA2, 1.5)

  // --- RSI panel ---
  if (vp.showRsi) {
    renderRSIToCanvas(ctx, rsi14, vp)
  }

  // --- Order book ---
  if (vp.showBook && orderBook) {
    renderOrderBookToCanvas(ctx, orderBook, vp)
  }

  // --- Crosshair ---
  if (mouseCol >= vp.chartColStart && mouseCol < vp.chartColEnd &&
      mouseRow >= 0 && mouseRow < vp.rsiRowEnd) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    // Horizontal line
    ctx.beginPath()
    ctx.moveTo(vp.chartColStart, mouseRow + 0.5)
    ctx.lineTo(vp.chartColEnd, mouseRow + 0.5)
    ctx.stroke()
    // Vertical line
    ctx.beginPath()
    ctx.moveTo(mouseCol + 0.5, 0)
    ctx.lineTo(mouseCol + 0.5, vp.rsiRowEnd)
    ctx.stroke()
  }
}

function drawMALine(
  ctx: CanvasRenderingContext2D,
  values: (number | null)[],
  vp: Viewport,
  color: string,
  width: number,
): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, values.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  let started = false

  for (let i = vp.startIndex; i < end; i++) {
    const val = values[i]
    if (val === null) { started = false; continue }

    const vi = i - vp.startIndex
    const x = vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
    const y = vp.chartRowStart + (vp.priceMax - val) / priceRange * chartRows

    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

function renderRSIToCanvas(
  ctx: CanvasRenderingContext2D,
  rsi14: (number | null)[],
  vp: Viewport,
): void {
  const panelH = vp.rsiRowEnd - vp.rsiRowStart
  const row70 = vp.rsiRowStart + Math.floor((1 - 70 / 100) * panelH)
  const row30 = vp.rsiRowStart + Math.floor((1 - 30 / 100) * panelH)
  const row50 = vp.rsiRowStart + Math.floor((1 - 50 / 100) * panelH)

  // OB/OS lines
  ctx.strokeStyle = RSI_OB
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(vp.chartColStart, row70 + 0.5); ctx.lineTo(vp.chartColEnd, row70 + 0.5); ctx.stroke()
  ctx.strokeStyle = RSI_OS
  ctx.beginPath(); ctx.moveTo(vp.chartColStart, row30 + 0.5); ctx.lineTo(vp.chartColEnd, row30 + 0.5); ctx.stroke()
  ctx.strokeStyle = RSI_MID
  ctx.beginPath(); ctx.moveTo(vp.chartColStart, row50 + 0.5); ctx.lineTo(vp.chartColEnd, row50 + 0.5); ctx.stroke()

  // RSI line
  const end = Math.min(vp.startIndex + vp.visibleCount, rsi14.length)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  let started = false

  for (let i = vp.startIndex; i < end; i++) {
    const val = rsi14[i]
    if (val === null) { started = false; continue }

    const vi = i - vp.startIndex
    const x = vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
    const y = vp.rsiRowStart + (1 - val / 100) * panelH

    // Color based on level
    if (!started) {
      ctx.strokeStyle = val >= 70 ? BEAR : val <= 30 ? BULL : MA1
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

function renderOrderBookToCanvas(
  ctx: CanvasRenderingContext2D,
  book: OrderBook,
  vp: Viewport,
): void {
  if (book.bids.length === 0) return

  const midRow = vp.chartRowStart + Math.floor((vp.chartRowEnd - vp.chartRowStart) / 2)
  const bookW = vp.bookColEnd - vp.bookColStart
  const halfRows = midRow - vp.chartRowStart

  let maxCum = 0
  let cum = 0
  for (const b of book.bids) { cum += b.quantity; if (cum > maxCum) maxCum = cum }
  cum = 0
  for (const a of book.asks) { cum += a.quantity; if (cum > maxCum) maxCum = cum }
  if (maxCum === 0) return

  // Bids (green, below mid)
  cum = 0
  for (let i = 0; i < Math.min(book.bids.length, halfRows); i++) {
    cum += book.bids[i]!.quantity
    const barW = Math.max(1, Math.round((cum / maxCum) * bookW))
    const row = midRow + i + 1
    if (row >= vp.chartRowEnd) break
    ctx.fillStyle = BOOK_BID
    ctx.fillRect(vp.bookColEnd - barW, row, barW, 1)
  }

  // Asks (red, above mid)
  cum = 0
  for (let i = 0; i < Math.min(book.asks.length, halfRows); i++) {
    cum += book.asks[i]!.quantity
    const barW = Math.max(1, Math.round((cum / maxCum) * bookW))
    const row = midRow - i - 1
    if (row < vp.chartRowStart) break
    ctx.fillStyle = BOOK_ASK
    ctx.fillRect(vp.bookColEnd - barW, row, barW, 1)
  }
}

// --- Read canvas pixels into flat typed arrays (zero allocation per frame) ---
export type PixelGrid = {
  brightness: Float32Array  // row-major, cols * rows
  colorIdx: Uint8Array      // 0=space, 1=bull, 2=bear, 3=grid, 4=ma1, 5=ma2, 6=xhair
  cols: number
  rows: number
}

export const COLOR_CLASSES = ['', 'bull', 'bear', 'grid', 'ma1', 'ma2', 'xhair'] as const

export function createPixelGrid(cols: number, rows: number): PixelGrid {
  return {
    brightness: new Float32Array(cols * rows),
    colorIdx: new Uint8Array(cols * rows),
    cols,
    rows,
  }
}

export function readCanvasToGrid(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
): void {
  const { cols, rows } = grid
  const imgData = ctx.getImageData(0, 0, cols, rows).data

  for (let i = 0, len = cols * rows; i < len; i++) {
    const idx = i * 4
    const r = imgData[idx]!
    const g = imgData[idx + 1]!
    const b = imgData[idx + 2]!

    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b)
    grid.brightness[i] = mx / 255

    if (mx < 5) {
      grid.colorIdx[i] = 0 // space
    } else if (g > r * 1.3 && g > b * 1.3) {
      grid.colorIdx[i] = 1 // bull
    } else if (r > g * 1.3 && r > b * 1.3) {
      grid.colorIdx[i] = 2 // bear
    } else if (b > r * 1.2 && b > g * 1.2) {
      grid.colorIdx[i] = 4 // ma1
    } else if (r > b * 1.3 && g > b * 1.2 && r > 40) {
      grid.colorIdx[i] = 5 // ma2
    } else {
      grid.colorIdx[i] = 6 // xhair
    }
  }
}
