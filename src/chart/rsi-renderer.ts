import type { Viewport } from './viewport.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { candleColStart } from './geometry.ts'

// Renders RSI in a sub-panel with overbought/oversold levels
export function renderRSI(
  grid: CellInfo[][],
  rsiValues: (number | null)[],
  vp: Viewport,
  startRow: number,
  endRow: number,
): void {
  const panelRows = endRow - startRow
  const end = Math.min(vp.startIndex + vp.visibleCount, rsiValues.length)

  // Overbought (70) and oversold (30) horizontal lines
  const row70 = startRow + Math.floor((1 - 70 / 100) * panelRows)
  const row30 = startRow + Math.floor((1 - 30 / 100) * panelRows)
  const row50 = startRow + Math.floor((1 - 50 / 100) * panelRows)

  for (let c = vp.chartColStart; c < vp.cols; c++) {
    setCell(grid, row70, c, 0.06, 'bear', 15)
    setCell(grid, row30, c, 0.06, 'bull', 15)
    setCell(grid, row50, c, 0.03, 'grid', 10)
  }

  // RSI level labels
  const labels = [
    { row: row70, text: '70' },
    { row: row30, text: '30' },
  ]
  for (const { row, text } of labels) {
    for (let j = 0; j < text.length && j < vp.chartColStart; j++) {
      setCell(grid, row, j + 1, 0.35, 'xhair', 95, text[j])
    }
  }

  // RSI line
  let prevRow = -1
  for (let i = vp.startIndex; i < end; i++) {
    const val = rsiValues[i]
    if (val === null) { prevRow = -1; continue }

    const vi = i - vp.startIndex
    const col = candleColStart(vi, vp) + Math.floor(vp.colsPerCandle / 2)
    const row = startRow + Math.floor((1 - val / 100) * panelRows)

    if (row >= startRow && row < endRow) {
      // Color based on RSI value: overbought=red, oversold=green, neutral=blue
      const color = val >= 70 ? 'bear' : val <= 30 ? 'bull' : 'ma1'
      setCell(grid, row, col, 0.7, color, 50)

      // Connect to previous
      if (prevRow >= 0 && Math.abs(row - prevRow) > 1) {
        const step = row > prevRow ? 1 : -1
        const prevCol = col - vp.colsPerCandle
        for (let r = prevRow + step; r !== row; r += step) {
          const interpCol = Math.round(prevCol + (col - prevCol) * ((r - prevRow) / (row - prevRow)))
          if (r >= startRow && r < endRow) {
            const interpVal = 100 * (1 - (r - startRow) / panelRows)
            const c = interpVal >= 70 ? 'bear' : interpVal <= 30 ? 'bull' : 'ma1'
            setCell(grid, r, interpCol, 0.45, c, 50)
          }
        }
      }
    }

    prevRow = row
  }
}
