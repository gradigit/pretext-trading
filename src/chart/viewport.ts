import type { Candle } from '../data/types.ts'

export type Viewport = {
  // Grid dimensions
  cols: number
  rows: number
  // Data window
  startIndex: number
  visibleCount: number
  // Price range (auto-scaled to visible candles)
  priceMin: number
  priceMax: number
  // Layout allocation (rows)
  chartRowStart: number
  chartRowEnd: number    // exclusive
  volumeRowStart: number
  volumeRowEnd: number   // exclusive
  axisColStart: number   // price axis starts here (left side)
  chartColStart: number  // chart area starts after price axis
  // Candle geometry
  colsPerCandle: number
}

const PRICE_AXIS_COLS = 10
const PRICE_PADDING = 0.05 // 5% padding above/below

export function createViewport(cols: number, rows: number, candles: Candle[], startIndex?: number): Viewport {
  const chartColStart = PRICE_AXIS_COLS
  const chartCols = cols - chartColStart
  const colsPerCandle = Math.max(3, Math.min(7, Math.floor(chartCols / 60)))
  const visibleCount = Math.floor(chartCols / colsPerCandle)
  const si = startIndex ?? Math.max(0, candles.length - visibleCount)

  // Row allocation: 70% chart, 20% volume, rest time axis
  const chartRowEnd = Math.floor(rows * 0.72)
  const volumeRowEnd = Math.floor(rows * 0.92)

  const vp: Viewport = {
    cols,
    rows,
    startIndex: si,
    visibleCount,
    priceMin: 0,
    priceMax: 0,
    chartRowStart: 0,
    chartRowEnd,
    volumeRowStart: chartRowEnd + 1,
    volumeRowEnd,
    axisColStart: 0,
    chartColStart,
    colsPerCandle,
  }

  updatePriceRange(vp, candles)
  return vp
}

export function updatePriceRange(vp: Viewport, candles: Candle[]): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  let lo = Infinity, hi = -Infinity
  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    if (c.low < lo) lo = c.low
    if (c.high > hi) hi = c.high
  }
  if (lo === Infinity) { lo = 60000; hi = 70000 }
  const range = hi - lo
  vp.priceMin = lo - range * PRICE_PADDING
  vp.priceMax = hi + range * PRICE_PADDING
}

export function pan(vp: Viewport, delta: number, candles: Candle[]): void {
  vp.startIndex = Math.max(0, Math.min(candles.length - vp.visibleCount, vp.startIndex + delta))
  updatePriceRange(vp, candles)
}

export function zoom(vp: Viewport, factor: number, candles: Candle[]): void {
  const centerCandle = vp.startIndex + Math.floor(vp.visibleCount / 2)
  const chartCols = vp.cols - vp.chartColStart
  const newCpc = Math.max(3, Math.min(11, Math.round(vp.colsPerCandle * factor)))
  if (newCpc === vp.colsPerCandle) return
  vp.colsPerCandle = newCpc
  vp.visibleCount = Math.floor(chartCols / vp.colsPerCandle)
  vp.startIndex = Math.max(0, Math.min(candles.length - vp.visibleCount, centerCandle - Math.floor(vp.visibleCount / 2)))
  updatePriceRange(vp, candles)
}
