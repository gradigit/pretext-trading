import { buildPalette, FONT_SIZE, LINE_HEIGHT, spaceWidth } from './render/palette.ts'
import { renderGrid } from './render/renderer.ts'
import { createGrid, clearGrid } from './chart/compositor.ts'
import { createViewport, pan, zoom, updatePriceRange } from './chart/viewport.ts'
import { renderCandles } from './chart/candle-renderer.ts'
import { renderVolume } from './chart/volume-renderer.ts'
import { renderAxes } from './chart/axis-renderer.ts'
import { renderIndicator } from './chart/indicator-renderer.ts'
import { generateSampleData } from './data/sample.ts'
import { sma } from './data/indicators.ts'

// --- DOM setup ---
const artEl = document.getElementById('art')!
const statsEl = document.getElementById('stats')!

// --- Build palette (one-time, ~50-200ms) ---
const t0 = performance.now()
const palette = buildPalette()
const paletteMs = (performance.now() - t0).toFixed(0)

// --- Load data ---
const candles = generateSampleData(600)
const sma20 = sma(candles, 20)
const sma50 = sma(candles, 50)

// --- Grid state ---
const avgCharW = palette.reduce((s, p) => s + p.width, 0) / palette.length
let COLS = 0
let ROWS = 0
let rowEls: HTMLDivElement[] = []
let grid = createGrid(0, 0)
let vp = createViewport(0, 0, candles)

function initGrid() {
  COLS = Math.min(250, Math.floor(window.innerWidth / avgCharW))
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

// --- Resize handling ---
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(initGrid, 150)
})

initGrid()

// --- Interaction: scroll and zoom ---
window.addEventListener('wheel', (e) => {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    const factor = e.deltaY > 0 ? 1.2 : 0.8
    zoom(vp, factor, candles)
  } else {
    // Pan
    const delta = e.deltaY > 0 ? 3 : -3
    pan(vp, delta, candles)
  }
}, { passive: false })

// --- Crosshair state ---
let mouseCol = -1
let mouseRow = -1

artEl.addEventListener('mousemove', (e: MouseEvent) => {
  mouseCol = Math.floor(e.clientX / (window.innerWidth / COLS))
  mouseRow = Math.floor(e.clientY / LINE_HEIGHT)
})

artEl.addEventListener('mouseleave', () => {
  mouseCol = -1
  mouseRow = -1
})

// --- Render loop ---
let fc = 0
let lastFps = 0
let dispFps = 0

function render(now: number): void {
  const targetCellW = window.innerWidth / COLS

  // Clear and composite layers
  clearGrid(grid)
  renderAxes(grid, candles, vp)
  renderVolume(grid, candles, vp)
  renderIndicator(grid, sma50, vp, 'ma2')
  renderIndicator(grid, sma20, vp, 'ma1')
  renderCandles(grid, candles, vp)

  // Crosshair
  if (mouseRow >= 0 && mouseCol >= 0) {
    for (let c = vp.chartColStart; c < COLS; c++) {
      const cell = grid[mouseRow]?.[c]
      if (cell && cell.priority < 90) {
        cell.brightness = 0.25
        cell.color = 'xhair'
        cell.priority = 90
      }
    }
    for (let r = 0; r < vp.volumeRowEnd; r++) {
      const cell = grid[r]?.[mouseCol]
      if (cell && cell.priority < 90) {
        cell.brightness = 0.15
        cell.color = 'xhair'
        cell.priority = 90
      }
    }
  }

  // Render to DOM
  renderGrid(grid, rowEls, palette, targetCellW)

  // FPS counter
  fc++
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000))
    fc = 0
    lastFps = now
    statsEl.textContent = `${COLS}×${ROWS} | ${palette.length} chars | ${dispFps} fps | palette ${paletteMs}ms`
  }

  requestAnimationFrame(render)
}

requestAnimationFrame(render)
