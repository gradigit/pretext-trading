import type { Viewport } from './viewport.ts'

export function priceToRow(price: number, vp: Viewport): number {
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  return vp.chartRowStart + Math.floor((vp.priceMax - price) / (vp.priceMax - vp.priceMin) * chartRows)
}

export function rowToPrice(row: number, vp: Viewport): number {
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  return vp.priceMax - ((row - vp.chartRowStart) / chartRows) * (vp.priceMax - vp.priceMin)
}

export function candleColStart(candleVisibleIndex: number, vp: Viewport): number {
  return vp.chartColStart + candleVisibleIndex * vp.colsPerCandle
}

export function colToCandleIndex(col: number, vp: Viewport): number {
  if (col < vp.chartColStart) return -1
  return Math.floor((col - vp.chartColStart) / vp.colsPerCandle)
}

export function colToDataIndex(col: number, vp: Viewport): number {
  const vi = colToCandleIndex(col, vp)
  if (vi < 0) return -1
  return vp.startIndex + vi
}
