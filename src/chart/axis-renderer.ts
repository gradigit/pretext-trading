import type { Viewport } from './viewport.ts'
import type { Candle } from '../data/types.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { priceToRow } from './geometry.ts'

function formatPrice(price: number, short: boolean): string {
  if (short) {
    // Compact format for narrow screens
    if (price >= 1000) return (price / 1000).toFixed(1) + 'k'
    if (price >= 1) return price.toFixed(1)
    return price.toFixed(3)
  }
  if (price >= 1000) return price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${h}:${m}`
}

function formatTimeShort(timestamp: number): string {
  const d = new Date(timestamp)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function renderAxes(grid: CellInfo[][], candles: Candle[], vp: Viewport): void {
  const chartRows = vp.chartRowEnd - vp.chartRowStart
  const priceRange = vp.priceMax - vp.priceMin
  const isNarrow = vp.cols < 80

  // Price axis: labels evenly spaced
  const labelCount = Math.max(2, Math.min(8, Math.floor(chartRows / 8)))
  const priceStep = priceRange / labelCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(priceStep)))
  const niceStep = Math.ceil(priceStep / magnitude) * magnitude
  const firstPrice = Math.ceil(vp.priceMin / niceStep) * niceStep

  for (let price = firstPrice; price < vp.priceMax; price += niceStep) {
    const row = priceToRow(price, vp)
    if (row < vp.chartRowStart + 1 || row >= vp.chartRowEnd - 1) continue

    const label = formatPrice(price, isNarrow)
    const maxLabelLen = vp.chartColStart - 1
    for (let j = 0; j < label.length && j < maxLabelLen; j++) {
      setCell(grid, row, j, 0.55, 'xhair', 100, label[j])
    }

    // Horizontal grid line
    for (let c = vp.chartColStart; c < vp.chartColEnd; c++) {
      setCell(grid, row, c, 0.06, 'grid', 20)
    }
  }

  // Time axis — compute label spacing to prevent overlap
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const timeRow = Math.min(vp.volumeRowEnd + 1, vp.rows - 3)

  // Choose format based on available space per label
  const colsPerLabel = vp.colsPerCandle * Math.max(1, Math.floor(vp.visibleCount / 6))
  const useShortFormat = colsPerLabel < 12 || isNarrow
  const sampleLabel = useShortFormat ? '00:00' : '03/30 12:00'
  const labelLen = sampleLabel.length

  // Ensure labels don't overlap: minimum spacing = label length + 2 gap chars
  const minColSpacing = labelLen + 2
  const labelInterval = Math.max(1, Math.ceil(minColSpacing / vp.colsPerCandle))

  let lastLabelEndCol = -1
  for (let i = vp.startIndex; i < end; i += labelInterval) {
    const vi = i - vp.startIndex
    const col = vp.chartColStart + vi * vp.colsPerCandle + Math.floor(vp.colsPerCandle / 2)
    const label = useShortFormat ? formatTimeShort(candles[i]!.time) : formatTime(candles[i]!.time)
    const startCol = col - Math.floor(label.length / 2)

    // Skip if would overlap previous label
    if (startCol <= lastLabelEndCol + 1) continue

    for (let j = 0; j < label.length; j++) {
      const c = startCol + j
      if (c >= 0 && c < vp.chartColEnd && timeRow < vp.rows) {
        setCell(grid, timeRow, c, 0.40, 'xhair', 100, label[j])
      }
    }
    lastLabelEndCol = startCol + label.length

    // Vertical grid line
    for (let r = vp.chartRowStart; r < vp.chartRowEnd; r++) {
      setCell(grid, r, col, 0.04, 'grid', 20)
    }
  }
}
