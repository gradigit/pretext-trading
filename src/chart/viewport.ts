import type { Candle } from '../data/types.ts'

export type Viewport = {
  cols: number
  rows: number
  startIndex: number
  visibleCount: number
  priceMin: number
  priceMax: number
  chartRowStart: number
  chartRowEnd: number
  volumeRowStart: number
  volumeRowEnd: number
  rsiRowStart: number
  rsiRowEnd: number
  axisColStart: number
  chartColStart: number
  chartColEnd: number
  bookColStart: number
  bookColEnd: number
  showBook: boolean
  showRsi: boolean
  colsPerCandle: number
}

const PRICE_PADDING = 0.05

export function createViewport(cols: number, rows: number, candles: Candle[], startIndex?: number): Viewport {
  const isNarrow = cols < 80
  const isMedium = cols < 140

  // Responsive price axis width
  const priceAxisCols = isNarrow ? 7 : 10
  const chartColStart = priceAxisCols

  // Hide order book on narrow screens
  const showBook = !isNarrow && !isMedium
  const bookCols = showBook ? Math.max(16, Math.floor(cols * 0.15)) : 0
  const chartColEnd = cols - bookCols

  const chartCols = chartColEnd - chartColStart
  const colsPerCandle = Math.max(2, Math.min(7, Math.floor(chartCols / (isNarrow ? 30 : 60))))
  const visibleCount = Math.floor(chartCols / colsPerCandle)
  const si = startIndex ?? Math.max(0, candles.length - visibleCount)

  // Hide RSI on very narrow screens
  const showRsi = rows > 30

  // Row allocation — responsive
  let chartRowEnd: number, volumeRowEnd: number, rsiRowStart: number, rsiRowEnd: number

  if (showRsi) {
    chartRowEnd = Math.floor(rows * (showBook ? 0.55 : 0.58))
    volumeRowEnd = Math.floor(rows * (showBook ? 0.68 : 0.72))
    rsiRowStart = volumeRowEnd + 2
    rsiRowEnd = Math.floor(rows * 0.90)
  } else {
    chartRowEnd = Math.floor(rows * 0.70)
    volumeRowEnd = Math.floor(rows * 0.88)
    rsiRowStart = volumeRowEnd
    rsiRowEnd = volumeRowEnd
  }

  const vp: Viewport = {
    cols, rows,
    startIndex: si, visibleCount,
    priceMin: 0, priceMax: 0,
    chartRowStart: 0,
    chartRowEnd,
    volumeRowStart: chartRowEnd + 1,
    volumeRowEnd,
    rsiRowStart,
    rsiRowEnd,
    axisColStart: 0,
    chartColStart,
    chartColEnd,
    bookColStart: showBook ? chartColEnd + 1 : cols,
    bookColEnd: cols,
    showBook,
    showRsi,
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
  const chartCols = vp.chartColEnd - vp.chartColStart
  const newCpc = Math.max(2, Math.min(11, Math.round(vp.colsPerCandle * factor)))
  if (newCpc === vp.colsPerCandle) return
  vp.colsPerCandle = newCpc
  vp.visibleCount = Math.floor(chartCols / vp.colsPerCandle)
  vp.startIndex = Math.max(0, Math.min(candles.length - vp.visibleCount, centerCandle - Math.floor(vp.visibleCount / 2)))
  updatePriceRange(vp, candles)
}
