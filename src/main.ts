import { buildPalette, LINE_HEIGHT } from './render/palette.ts'
import { renderGrid } from './render/renderer.ts'
import { createGrid, clearGrid } from './chart/compositor.ts'
import { createViewport, pan, zoom, updatePriceRange } from './chart/viewport.ts'
import { renderCandles } from './chart/candle-renderer.ts'
import { renderVolume } from './chart/volume-renderer.ts'
import { renderAxes } from './chart/axis-renderer.ts'
import { renderIndicator } from './chart/indicator-renderer.ts'
import { renderOrderBook } from './chart/orderbook-renderer.ts'
import { renderRSI } from './chart/rsi-renderer.ts'
import { fetchCandles, subscribeKlines } from './data/feed.ts'
import { fetchOrderBook, subscribeOrderBook, type OrderBook } from './data/orderbook.ts'
import { generateSampleData } from './data/sample.ts'
import { sma, rsi } from './data/indicators.ts'
import type { Candle } from './data/types.ts'

// --- Config ---
type PairConfig = { symbol: string; label: string }
type IntervalConfig = { interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'; label: string }

const PAIRS: PairConfig[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
]

const INTERVALS: IntervalConfig[] = [
  { interval: '1m', label: '1m' },
  { interval: '5m', label: '5m' },
  { interval: '15m', label: '15m' },
  { interval: '1h', label: '1h' },
  { interval: '4h', label: '4h' },
  { interval: '1d', label: '1D' },
]

let currentPair = PAIRS[0]!
let currentInterval = INTERVALS[3]!

// --- DOM ---
const artEl = document.getElementById('art')!
const statsEl = document.getElementById('stats')!
const controlsEl = document.getElementById('controls')!

// --- Palette (one-time) ---
const t0 = performance.now()
const palette = buildPalette()
const paletteMs = (performance.now() - t0).toFixed(0)

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

// --- Grid ---
const avgCharW = palette.reduce((s, p) => s + p.width, 0) / palette.length
let COLS = 0, ROWS = 0
let rowEls: HTMLDivElement[] = []
let grid = createGrid(0, 0)
let vp = createViewport(0, 0, candles)

function initGrid() {
  COLS = Math.min(280, Math.floor(window.innerWidth / avgCharW))
  ROWS = Math.min(100, Math.floor(window.innerHeight / LINE_HEIGHT))
  grid = createGrid(COLS, ROWS)
  vp = createViewport(COLS, ROWS, candles)

  artEl.innerHTML = ''
  rowEls = []
  for (let r = 0; r < ROWS; r++) {
    const div = document.createElement('div')
    div.className = 'r'
    div.style.height = div.style.lineHeight = LINE_HEIGHT + 'px'
    artEl.appendChild(div)
    rowEls.push(div)
  }
}

// --- Load data ---
async function loadData() {
  if (unsubKline) { unsubKline(); unsubKline = null }
  if (unsubBook) { unsubBook(); unsubBook = null }

  try {
    candles = await fetchCandles(currentPair.symbol, currentInterval.interval, 500)
  } catch {
    candles = generateSampleData(500)
  }
  recomputeIndicators()
  initGrid()

  // Live kline updates
  try {
    unsubKline = subscribeKlines(currentPair.symbol, currentInterval.interval, (candle, isClosed) => {
      if (candles.length === 0) return
      const last = candles[candles.length - 1]!
      if (candle.time === last.time) {
        candles[candles.length - 1] = candle
      } else if (isClosed || candle.time > last.time) {
        candles.push(candle)
      }
      recomputeIndicators()
      updatePriceRange(vp, candles)
    })
  } catch { /* offline — fine */ }

  // Order book
  try {
    orderBook = await fetchOrderBook(currentPair.symbol, 20)
    unsubBook = subscribeOrderBook(currentPair.symbol, (book) => { orderBook = book })
  } catch {
    orderBook = null
  }
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
  pairSelect.addEventListener('change', () => {
    currentPair = PAIRS.find(p => p.symbol === pairSelect.value) ?? PAIRS[0]!
    loadData()
  })

  const intSelect = document.createElement('select')
  for (const iv of INTERVALS) {
    const opt = document.createElement('option')
    opt.value = iv.interval; opt.textContent = iv.label
    if (iv.interval === currentInterval.interval) opt.selected = true
    intSelect.appendChild(opt)
  }
  intSelect.addEventListener('change', () => {
    currentInterval = INTERVALS.find(i => i.interval === intSelect.value) ?? INTERVALS[3]!
    loadData()
  })

  controlsEl.appendChild(pairSelect)
  controlsEl.appendChild(intSelect)
  controlsEl.style.display = 'block'
}

// --- Resize ---
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(initGrid, 150)
})

// --- Scroll/zoom ---
window.addEventListener('wheel', (e) => {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    zoom(vp, e.deltaY > 0 ? 1.2 : 0.8, candles)
  } else {
    pan(vp, e.deltaY > 0 ? 3 : -3, candles)
  }
}, { passive: false })

// --- Crosshair ---
let mouseCol = -1, mouseRow = -1

artEl.addEventListener('mousemove', (e: MouseEvent) => {
  mouseCol = Math.floor(e.clientX / (window.innerWidth / COLS))
  mouseRow = Math.floor(e.clientY / LINE_HEIGHT)
})
artEl.addEventListener('mouseleave', () => { mouseCol = -1; mouseRow = -1 })

// --- Render ---
let fc = 0, lastFps = 0, dispFps = 0

function render(now: number): void {
  if (COLS === 0 || candles.length === 0) { requestAnimationFrame(render); return }

  const targetCellW = window.innerWidth / COLS

  clearGrid(grid)

  // Chart layers
  renderAxes(grid, candles, vp)
  renderVolume(grid, candles, vp)
  renderIndicator(grid, sma50, vp, 'ma2')
  renderIndicator(grid, sma20, vp, 'ma1')
  renderCandles(grid, candles, vp)

  // RSI sub-panel
  renderRSI(grid, rsi14, vp, vp.rsiRowStart, vp.rsiRowEnd)

  // Order book (right side)
  renderOrderBook(grid, orderBook, vp.bookColStart, vp.bookColEnd, vp.chartRowStart, vp.chartRowEnd)

  // Crosshair
  if (mouseRow >= 0 && mouseCol >= 0) {
    for (let c = vp.chartColStart; c < vp.chartColEnd; c++) {
      const cell = grid[mouseRow]?.[c]
      if (cell && cell.priority < 90) {
        cell.brightness = 0.25; cell.color = 'xhair'; cell.priority = 90
      }
    }
    for (let r = 0; r < vp.rsiRowEnd; r++) {
      const cell = grid[r]?.[mouseCol]
      if (cell && cell.priority < 90) {
        cell.brightness = 0.15; cell.color = 'xhair'; cell.priority = 90
      }
    }
  }

  renderGrid(grid, rowEls, palette, targetCellW)

  // Stats
  fc++
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000))
    fc = 0; lastFps = now
    const last = candles[candles.length - 1]
    const priceStr = last ? last.close.toLocaleString() : '—'
    const rsiVal = rsi14[rsi14.length - 1]
    const rsiStr = rsiVal !== null ? `RSI ${rsiVal.toFixed(1)}` : ''
    statsEl.textContent = `${currentPair.label} ${currentInterval.label} | ${priceStr} | ${rsiStr} | ${COLS}×${ROWS} | ${dispFps} fps`
  }

  requestAnimationFrame(render)
}

// --- Start ---
buildControls()
loadData().then(() => requestAnimationFrame(render))
