import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { OrderBook } from '../data/orderbook.ts'

// Bright, saturated colors for clear color classification
const BULL = '#00e85c'
const BULL_WICK = '#006628'
const BULL_VOL = '#007830'
const BEAR = '#ff2050'
const BEAR_WICK = '#801028'
const BEAR_VOL = '#901838'
const MA1 = '#4db8ff'
const MA2 = '#ffaa22'
const GRID_LINE = '#1c1c35'
const BG = '#000000'
const BOOK_BID_COLOR = '#00501c'
const BOOK_ASK_COLOR = '#601020'
const RSI_LINE_BULL = '#00cc50'
const RSI_LINE_BEAR = '#ff3355'
const RSI_LINE_NEUT = '#5599dd'
const RSI_LEVEL = '#181830'
const XHAIR = 'rgba(255,255,255,0.35)'

// Supersample factor: render at Nx resolution for smoother edges
const SS = 2

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
    cols,
    rows,
  }
}

// Secondary canvas for blur pass
let blurCanvas: HTMLCanvasElement | null = null
let blurCtx: CanvasRenderingContext2D | null = null

function getBlurCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!blurCanvas) {
    blurCanvas = document.createElement('canvas')
    blurCtx = blurCanvas.getContext('2d')!
  }
  if (blurCanvas.width !== w) blurCanvas.width = w
  if (blurCanvas.height !== h) blurCanvas.height = h
  return [blurCanvas, blurCtx!]
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
  // Render at supersampled resolution
  const w = vp.cols * SS
  const h = vp.rows * SS
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  const S = SS // shorthand
  function priceToY(price: number): number {
    return (vp.chartRowStart + (vp.priceMax - price) / priceRange * chartRows) * S
  }

  // --- Subtle background texture (very dim noise in chart area) ---
  const bgImageData = ctx.createImageData(w, h)
  const bgData = bgImageData.data
  // Seed-based pseudo-random for consistency
  for (let i = 0; i < bgData.length; i += 4) {
    const noise = Math.random() < 0.03 ? 5 + Math.floor(Math.random() * 4) : 0
    bgData[i] = noise
    bgData[i + 1] = noise
    bgData[i + 2] = Math.floor(noise * 1.3)
    bgData[i + 3] = 255
  }
  ctx.putImageData(bgImageData, 0, 0)

  // --- Grid lines ---
  ctx.strokeStyle = GRID_LINE
  ctx.lineWidth = S

  const labelCount = Math.max(2, Math.min(8, Math.floor(chartRows / 10)))
  const priceStep = priceRange / labelCount
  const mag = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / mag) * mag
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const y = Math.round(priceToY(price))
    if (y > vp.chartRowStart * S && y < vp.chartRowEnd * S) {
      ctx.beginPath()
      ctx.moveTo(vp.chartColStart * S, y)
      ctx.lineTo(vp.chartColEnd * S, y)
      ctx.stroke()
    }
  }

  const timeLabelInterval = Math.max(1, Math.ceil(14 / vp.colsPerCandle))
  for (let i = vp.startIndex; i < end; i += timeLabelInterval) {
    const vi = i - vp.startIndex
    const x = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * S
    ctx.beginPath()
    ctx.moveTo(x, vp.chartRowStart * S)
    ctx.lineTo(x, vp.chartRowEnd * S)
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
      const x = (vp.chartColStart + vi * vp.colsPerCandle) * S
      const barH = Math.max(S, Math.round((c.volume / maxVol) * volumeRows * S))
      const bodyW = Math.max(S, (vp.colsPerCandle - 1) * S)

      ctx.fillStyle = c.close >= c.open ? BULL_VOL : BEAR_VOL
      ctx.fillRect(x, vp.volumeRowEnd * S - barH, bodyW, barH)
    }
  }

  // --- Candlesticks ---
  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    const vi = i - vp.startIndex
    const centerX = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * S
    const isBull = c.close >= c.open
    const bodyW = Math.max(S, (vp.colsPerCandle - 1) * S)
    const bodyX = (vp.chartColStart + vi * vp.colsPerCandle) * S

    const yHigh = priceToY(c.high)
    const yLow = priceToY(c.low)
    const yOpen = priceToY(c.open)
    const yClose = priceToY(c.close)
    const bodyTop = Math.min(yOpen, yClose)
    const bodyBot = Math.max(yOpen, yClose)

    // Wick
    ctx.strokeStyle = isBull ? BULL_WICK : BEAR_WICK
    ctx.lineWidth = S
    ctx.beginPath()
    ctx.moveTo(centerX, yHigh)
    ctx.lineTo(centerX, yLow)
    ctx.stroke()

    // Body
    ctx.fillStyle = isBull ? BULL : BEAR
    const bodyH = Math.max(S, bodyBot - bodyTop)
    ctx.fillRect(bodyX, bodyTop, bodyW, bodyH)
  }

  // --- MA lines ---
  drawMALine(ctx, sma20, vp, MA1, S * 1.2)
  drawMALine(ctx, sma50, vp, MA2, S * 1.2)

  // --- RSI panel ---
  if (vp.showRsi) {
    renderRSIToCanvas(ctx, rsi14, vp)
  }

  // --- Order book ---
  if (vp.showBook && orderBook) {
    renderOrderBookToCanvas(ctx, orderBook, vp)
  }

  // --- Glow pass: blur the entire canvas for soft edges ---
  const [bCanvas, bCtx] = getBlurCanvas(w, h)
  bCtx.filter = `blur(${S}px)`
  bCtx.drawImage(canvas, 0, 0)
  bCtx.filter = 'none'

  // Composite: additive blend of blurred version (glow) onto sharp original
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.25
  ctx.drawImage(bCanvas, 0, 0)
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'

  // --- Crosshair (drawn AFTER glow so it stays sharp) ---
  if (mouseCol >= vp.chartColStart && mouseCol < vp.chartColEnd &&
      mouseRow >= 0 && mouseRow < vp.rsiRowEnd) {
    ctx.strokeStyle = XHAIR
    ctx.lineWidth = S
    ctx.setLineDash([S * 2, S * 2])
    ctx.beginPath()
    ctx.moveTo(vp.chartColStart * S, mouseRow * S + S / 2)
    ctx.lineTo(vp.chartColEnd * S, mouseRow * S + S / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mouseCol * S + S / 2, 0)
    ctx.lineTo(mouseCol * S + S / 2, vp.rsiRowEnd * S)
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
    const x = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * SS
    const y = (vp.chartRowStart + (vp.priceMax - val) / priceRange * chartRows) * SS

    if (!started) { ctx.moveTo(x, y); started = true }
    else { ctx.lineTo(x, y) }
  }
  ctx.stroke()
}

function renderRSIToCanvas(ctx: CanvasRenderingContext2D, rsi14: (number | null)[], vp: Viewport): void {
  const S = SS
  const panelH = (vp.rsiRowEnd - vp.rsiRowStart) * S
  const panelTop = vp.rsiRowStart * S
  const row70 = panelTop + Math.floor((1 - 70 / 100) * panelH)
  const row30 = panelTop + Math.floor((1 - 30 / 100) * panelH)
  const row50 = panelTop + Math.floor(panelH / 2)

  ctx.strokeStyle = RSI_LEVEL
  ctx.lineWidth = S
  for (const y of [row70, row30, row50]) {
    ctx.beginPath()
    ctx.moveTo(vp.chartColStart * S, y)
    ctx.lineTo(vp.chartColEnd * S, y)
    ctx.stroke()
  }

  // RSI line
  const end = Math.min(vp.startIndex + vp.visibleCount, rsi14.length)
  ctx.lineWidth = S * 1.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let started = false
  let lastColor = RSI_LINE_NEUT

  for (let i = vp.startIndex; i < end; i++) {
    const val = rsi14[i]
    if (val === null) { started = false; continue }
    const vi = i - vp.startIndex
    const x = (vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)) * S
    const y = panelTop + (1 - val / 100) * panelH

    const newColor = val >= 70 ? RSI_LINE_BEAR : val <= 30 ? RSI_LINE_BULL : RSI_LINE_NEUT
    if (newColor !== lastColor && started) {
      ctx.stroke()
      ctx.beginPath()
      ctx.strokeStyle = newColor
      ctx.moveTo(x, y)
      lastColor = newColor
    } else if (!started) {
      ctx.strokeStyle = newColor
      ctx.moveTo(x, y)
      started = true
      lastColor = newColor
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

function renderOrderBookToCanvas(ctx: CanvasRenderingContext2D, book: OrderBook, vp: Viewport): void {
  if (book.bids.length === 0) return
  const S = SS
  const midRow = (vp.chartRowStart + Math.floor((vp.chartRowEnd - vp.chartRowStart) / 2)) * S
  const bookW = (vp.bookColEnd - vp.bookColStart) * S
  const halfRows = (midRow - vp.chartRowStart * S)

  let maxCum = 0, cum = 0
  for (const b of book.bids) { cum += b.quantity; if (cum > maxCum) maxCum = cum }
  cum = 0
  for (const a of book.asks) { cum += a.quantity; if (cum > maxCum) maxCum = cum }
  if (maxCum === 0) return

  cum = 0
  for (let i = 0; i < Math.min(book.bids.length, halfRows / S); i++) {
    cum += book.bids[i]!.quantity
    const barW = Math.max(S, Math.round((cum / maxCum) * bookW))
    const row = midRow + (i + 1) * S
    if (row >= vp.chartRowEnd * S) break
    ctx.fillStyle = BOOK_BID_COLOR
    ctx.fillRect(vp.bookColEnd * S - barW, row, barW, S)
  }

  cum = 0
  for (let i = 0; i < Math.min(book.asks.length, halfRows / S); i++) {
    cum += book.asks[i]!.quantity
    const barW = Math.max(S, Math.round((cum / maxCum) * bookW))
    const row = midRow - (i + 1) * S
    if (row < vp.chartRowStart * S) break
    ctx.fillStyle = BOOK_ASK_COLOR
    ctx.fillRect(vp.bookColEnd * S - barW, row, barW, S)
  }
}

// --- Read supersampled canvas → downsample to grid ---
export function readCanvasToGrid(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
): void {
  const { cols, rows } = grid
  const sw = cols * SS
  const sh = rows * SS
  const imgData = ctx.getImageData(0, 0, sw, sh).data

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Average SS×SS pixel block
      let rr = 0, gg = 0, bb = 0
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const idx = ((r * SS + dy) * sw + (c * SS + dx)) * 4
          rr += imgData[idx]!
          gg += imgData[idx + 1]!
          bb += imgData[idx + 2]!
        }
      }
      const n = SS * SS
      rr = rr / n; gg = gg / n; bb = bb / n

      const i = r * cols + c
      const mx = rr > gg ? (rr > bb ? rr : bb) : (gg > bb ? gg : bb)
      grid.brightness[i] = mx / 255

      if (mx < 4) {
        grid.colorIdx[i] = 0
      } else if (gg > rr * 1.3 && gg > bb * 1.3) {
        grid.colorIdx[i] = 1 // bull
      } else if (rr > gg * 1.3 && rr > bb * 1.3) {
        grid.colorIdx[i] = 2 // bear
      } else if (bb > rr * 1.2 && bb > gg * 1.2) {
        grid.colorIdx[i] = 4 // ma1
      } else if (rr > bb * 1.3 && gg > bb * 1.2 && rr > 30) {
        grid.colorIdx[i] = 5 // ma2
      } else if (mx > 10) {
        grid.colorIdx[i] = 3 // grid (dim gray)
      } else {
        grid.colorIdx[i] = 0
      }
    }
  }
}
