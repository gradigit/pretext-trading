import type { Viewport } from './viewport.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { priceToRow } from './geometry.ts'
import { candleColStart } from './geometry.ts'

const INDICATOR_BRIGHTNESS = 0.65

export function renderIndicator(
  grid: CellInfo[][],
  values: (number | null)[],
  vp: Viewport,
  color: string,
): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, values.length)
  let prevRow = -1

  for (let i = vp.startIndex; i < end; i++) {
    const val = values[i]
    if (val === null) { prevRow = -1; continue }

    const vi = i - vp.startIndex
    const col = candleColStart(vi, vp) + Math.floor(vp.colsPerCandle / 2)
    const row = priceToRow(val, vp)

    if (row >= vp.chartRowStart && row < vp.chartRowEnd) {
      setCell(grid, row, col, INDICATOR_BRIGHTNESS, color, 50)

      // Connect to previous point with intermediate cells for smoother line
      if (prevRow >= 0 && Math.abs(row - prevRow) > 1) {
        const step = row > prevRow ? 1 : -1
        const prevCol = col - vp.colsPerCandle
        for (let r = prevRow + step; r !== row; r += step) {
          const interpCol = Math.round(prevCol + (col - prevCol) * ((r - prevRow) / (row - prevRow)))
          if (r >= vp.chartRowStart && r < vp.chartRowEnd) {
            setCell(grid, r, interpCol, INDICATOR_BRIGHTNESS * 0.6, color, 50)
          }
        }
      }
    }

    prevRow = row
  }
}
