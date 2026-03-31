import type { Viewport } from './viewport.ts'
import type { Candle } from '../data/types.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { priceToRow } from './geometry.ts'

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function renderAxes(grid: CellInfo[][], candles: Candle[], vp: Viewport): void {
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin

  // Price axis: ~5-8 labels evenly spaced
  const labelCount = Math.max(3, Math.min(8, Math.floor(chartRows / 8)))
  const priceStep = priceRange / labelCount

  // Round price step to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / magnitude) * magnitude
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const row = priceToRow(price, vp)
    if (row < vp.chartRowStart || row >= vp.chartRowEnd) continue

    // Price label on left
    const label = formatPrice(price)
    for (let j = 0; j < label.length && j < vp.axisColStart + vp.chartColStart - 1; j++) {
      setCell(grid, row, j + 1, 0.55, 'xhair', 100, label[j])
    }

    // Horizontal grid line
    for (let c = vp.chartColStart; c < vp.cols; c++) {
      setCell(grid, row, c, 0.06, 'grid', 20)
    }
  }

  // Time axis: labels at regular intervals
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const timeRow = vp.volumeRowEnd + 1
  const labelInterval = Math.max(1, Math.floor(vp.visibleCount / 8))

  for (let i = vp.startIndex; i < end; i += labelInterval) {
    const vi = i - vp.startIndex
    const col = vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
    const label = formatTime(candles[i]!.time)

    // Time label
    for (let j = 0; j < label.length; j++) {
      if (col - 2 + j < vp.cols && timeRow < vp.rows) {
        setCell(grid, timeRow, col - 2 + j, 0.45, 'xhair', 100, label[j])
      }
    }

    // Vertical grid line
    for (let r = vp.chartRowStart; r < vp.chartRowEnd; r++) {
      setCell(grid, r, col, 0.04, 'grid', 20)
    }
  }
}
