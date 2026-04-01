import { buildPalette, getResponsiveFontSize, getLineHeight } from './render/palette.ts'
import { buildCharLookup, renderToCanvas, type CharLookup } from './render/canvas-text-renderer.ts'
import { createViewport, pan, zoom, updatePriceRange } from './chart/viewport.ts'
import { renderChartToCanvas, readCanvasToGrid, createPixelGrid, type PixelGrid } from './chart/canvas-chart.ts'
import { createFlowField, updateFlowField, type FlowField } from './render/bg-flow.ts'
import { fetchCandles, subscribeKlines } from './data/feed.ts'
import { fetchOrderBook, subscribeOrderBook, type OrderBook } from './data/orderbook.ts'
import { generateSampleData } from './data/sample.ts'
import { sma, rsi } from './data/indicators.ts'
import type { Candle } from './data/types.ts'

const PAIRS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
]
const INTERVALS: { interval: '1m'|'5m'|'15m'|'1h'|'4h'|'1d'; label: string }[] = [
  { interval: '1m', label: '1m' }, { interval: '5m', label: '5m' },
  { interval: '15m', label: '15m' }, { interval: '1h', label: '1h' },
  { interval: '4h', label: '4h' }, { interval: '1d', label: '1D' },
]

let currentPair = PAIRS[0]!
let currentInterval = INTERVALS[3]!

const artEl = document.getElementById('art')!
const statsEl = document.getElementById('stats')!
const controlsEl = document.getElementById('controls')!

// --- Display canvas (visible — replaces innerHTML divs) ---
const displayCanvas = document.createElement('canvas')
displayCanvas.style.width = '100%'
displayCanvas.style.height = '100%'
displayCanvas.style.display = 'block'
artEl.appendChild(displayCanvas)
const displayCtx = displayCanvas.getContext('2d')!

// --- Hidden chart canvas ---
const chartCanvas = document.createElement('canvas')
const chartCtx = chartCanvas.getContext('2d', { willReadFrequently: true })!

// --- Palette ---
let currentFontSize = getResponsiveFontSize()
let lineHeight = getLineHeight(currentFontSize)
let palette = buildPalette(currentFontSize)

// --- Data ---
let candles: Candle[] = []
let sma20: (number | null)[] = []
let sma50: (number | null)[] = []
let rsi14: (number | null)[] = []
let orderBook: OrderBook | null = null
let unsubKline: (() => void) | null = null
let unsubBook: (() => void) | null = null

function recomputeIndicators() {
  sma20 = sma(candles, 20)
  sma50 = sma(candles, 50)
  rsi14 = rsi(candles, 14)
}

// --- Rendering state ---
let avgCharW = palette.reduce((s, p) => s + p.width, 0) / palette.length
let charLookup: CharLookup = buildCharLookup(palette, 8)
let pixelGrid: PixelGrid = createPixelGrid(1, 1)
let flow: FlowField = createFlowField(1, 1, 0.6)
let COLS = 0, ROWS = 0
let vp = createViewport(0, 0, candles)
let chartDirty = true
let animFrame = 0
let lastInteraction = 0
let glowPending = false

function initGrid() {
  const newFontSize = getResponsiveFontSize()
  if (newFontSize !== currentFontSize) {
    currentFontSize = newFontSize
    lineHeight = getLineHeight(currentFontSize)
    palette = buildPalette(currentFontSize)
    avgCharW = palette.reduce((s, p) => s + p.width, 0) / palette.length
  }

  COLS = Math.min(380, Math.floor(window.innerWidth / avgCharW))
  ROWS = Math.min(160, Math.floor(window.innerHeight / lineHeight))

  const targetCellW = window.innerWidth / COLS
  charLookup = buildCharLookup(palette, targetCellW)
  pixelGrid = createPixelGrid(COLS, ROWS)
  const aspect = avgCharW / lineHeight
  flow = createFlowField(COLS, ROWS, aspect)
  vp = createViewport(COLS, ROWS, candles)
  chartDirty = true
}

// --- Axis labels ---
let cachedAxisLabels: Map<string, string> = new Map()

function buildAxisLabels(): Map<string, string> {
  const labels = new Map<string, string>()
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin
  const isNarrow = COLS < 80

  const labelCount = Math.max(2, Math.min(8, Math.floor(chartRows / 10)))
  const priceStep = priceRange / labelCount
  const mag = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / mag) * mag
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const row = vp.chartRowStart + Math.floor((vp.priceMax - price) / priceRange * chartRows)
    if (row <= vp.chartRowStart || row >= vp.chartRowEnd - 1) continue
    const label = isNarrow
      ? (price >= 1000 ? (price / 1000).toFixed(1) + 'k' : price.toFixed(1))
      : (price >= 1000 ? price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : price.toFixed(2))
    for (let j = 0; j < label.length && j < vp.chartColStart - 1; j++) {
      labels.set(`${row},${j}`, label[j]!)
    }
  }

  const timeLabelInterval = Math.max(1, Math.ceil(14 / vp.colsPerCandle))
  const timeRow = Math.min(vp.volumeRowEnd + 1, ROWS - 2)
  let lastEnd = -1
  for (let i = vp.startIndex; i < end; i += timeLabelInterval) {
    const vi = i - vp.startIndex
    const col = vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
    const d = new Date(candles[i]!.time)
    const label = isNarrow
      ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      : `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    const start = col - Math.floor(label.length / 2)
    if (start <= lastEnd + 1) continue
    for (let j = 0; j < label.length; j++) {
      const c = start + j
      if (c >= 0 && c < COLS && timeRow < ROWS) labels.set(`${timeRow},${c}`, label[j]!)
    }
    lastEnd = start + label.length
  }

  if (vp.showRsi) {
    const panelH = vp.rsiRowEnd - vp.rsiRowStart
    const row70 = vp.rsiRowStart + Math.floor((1 - 70 / 100) * panelH)
    const row30 = vp.rsiRowStart + Math.floor((1 - 30 / 100) * panelH)
    for (const [row, text] of [[row70, '70'], [row30, '30']] as const) {
      for (let j = 0; j < text.length && j < vp.chartColStart - 1; j++) {
        labels.set(`${row},${j + 1}`, text[j]!)
      }
    }
  }

  return labels
}

// --- Load data ---
async function loadData() {
  if (unsubKline) { unsubKline(); unsubKline = null }
  if (unsubBook) { unsubBook(); unsubBook = null }
  try {
    candles = await fetchCandles(currentPair.symbol, currentInterval.interval, 500)
  } catch { candles = generateSampleData(500) }
  recomputeIndicators()
  initGrid()
  try {
    unsubKline = subscribeKlines(currentPair.symbol, currentInterval.interval, (candle, isClosed) => {
      if (candles.length === 0) return
      const last = candles[candles.length - 1]!
      if (candle.time === last.time) candles[candles.length - 1] = candle
      else if (isClosed || candle.time > last.time) candles.push(candle)
      recomputeIndicators(); updatePriceRange(vp, candles); chartDirty = true
    })
  } catch {}
  try {
    orderBook = await fetchOrderBook(currentPair.symbol, 20)
    unsubBook = subscribeOrderBook(currentPair.symbol, (book) => { orderBook = book; chartDirty = true })
  } catch { orderBook = null }
}

// --- Controls ---
function buildControls() {
  const pairSelect = document.createElement('select')
  for (const p of PAIRS) {
    const opt = document.createElement('option')
    opt.value = p.symbol; opt.textContent = p.label
    if (p.symbol === currentPair.symbol) opt.selected = true
    pairSelect.appendChild(opt)
  }
  pairSelect.addEventListener('change', () => { currentPair = PAIRS.find(p => p.symbol === pairSelect.value) ?? PAIRS[0]!; loadData() })

  const intSelect = document.createElement('select')
  for (const iv of INTERVALS) {
    const opt = document.createElement('option')
    opt.value = iv.interval; opt.textContent = iv.label
    if (iv.interval === currentInterval.interval) opt.selected = true
    intSelect.appendChild(opt)
  }
  intSelect.addEventListener('change', () => { currentInterval = INTERVALS.find(i => i.interval === intSelect.value) ?? INTERVALS[3]!; loadData() })

  controlsEl.appendChild(pairSelect)
  controlsEl.appendChild(intSelect)
  controlsEl.style.display = 'block'
}

// --- Events ---
let resizeTimer = 0
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(initGrid, 150) })

let pendingScroll = 0, scrollTimer = 0
window.addEventListener('wheel', (e) => {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    zoom(vp, e.deltaY > 0 ? 1.2 : 0.8, candles); chartDirty = true; lastInteraction = performance.now()
  } else {
    pendingScroll += e.deltaY > 0 ? 3 : -3
    if (!scrollTimer) {
      scrollTimer = window.setTimeout(() => {
        pan(vp, pendingScroll, candles); pendingScroll = 0; scrollTimer = 0
        chartDirty = true; lastInteraction = performance.now()
      }, 30)
    }
  }
}, { passive: false })

let mouseCol = -1, mouseRow = -1
artEl.addEventListener('mousemove', (e: MouseEvent) => {
  mouseCol = Math.floor(e.clientX / (window.innerWidth / COLS))
  mouseRow = Math.floor(e.clientY / lineHeight)
  chartDirty = true; lastInteraction = performance.now()
})
artEl.addEventListener('mouseleave', () => { mouseCol = -1; mouseRow = -1; chartDirty = true })

setInterval(() => { chartDirty = true }, 2000)

// --- Render loop (canvas-based — no innerHTML!) ---
let fc = 0, lastFps = 0, dispFps = 0

function render(now: number): void {
  requestAnimationFrame(render)
  if (COLS === 0 || candles.length === 0) return

  // Re-render chart data when dirty
  if (chartDirty) {
    chartDirty = false
    const isInteracting = (now - lastInteraction) < 200
    renderChartToCanvas(chartCanvas, chartCtx, candles, vp, sma20, sma50, rsi14, orderBook, mouseCol, mouseRow, 0, 0, !isInteracting)
    readCanvasToGrid(chartCtx, pixelGrid)
    cachedAxisLabels = buildAxisLabels()
    if (isInteracting && !glowPending) {
      glowPending = true
      setTimeout(() => { glowPending = false; chartDirty = true }, 300)
    }
  }

  // Advance animation
  animFrame++
  const t = now / 1000
  if (COLS * ROWS <= 25000) updateFlowField(flow, t)

  // Render text to visible canvas — fast! No DOM manipulation
  renderToCanvas(displayCanvas, displayCtx, pixelGrid, charLookup, currentFontSize, lineHeight, cachedAxisLabels, animFrame, flow)

  // Stats
  fc++
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000))
    fc = 0; lastFps = now
    const last = candles[candles.length - 1]
    const priceStr = last ? last.close.toLocaleString() : '—'
    const rsiVal = rsi14[rsi14.length - 1]
    const rsiStr = rsiVal !== null ? ` RSI ${rsiVal.toFixed(1)}` : ''
    statsEl.textContent = `${currentPair.label} ${currentInterval.label} | ${priceStr} |${rsiStr} | ${COLS}×${ROWS} | ${dispFps} fps`
  }
}

buildControls()
loadData().then(() => requestAnimationFrame(render))
