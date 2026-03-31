import type { CellInfo } from '../chart/compositor.ts'
import type { PaletteEntry } from './palette.ts'
import { findBest, esc, wCls, spaceWidth, FONT_SIZE } from './palette.ts'

const spaceW = spaceWidth(FONT_SIZE)

export function renderGrid(
  grid: CellInfo[][],
  rowEls: HTMLDivElement[],
  palette: PaletteEntry[],
  targetCellW: number,
): void {
  const rowWidths: number[] = []

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]!
    let html = ''
    let tw = 0

    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!

      if (cell.text) {
        // Axis label: literal text character
        html += `<span class="label">${esc(cell.text)}</span>`
        tw += targetCellW // approximate width for labels
      } else if (cell.brightness > 0.025) {
        const m = findBest(palette, cell.brightness, targetCellW)
        const ai = Math.max(1, Math.min(10, Math.round(cell.brightness * 10)))
        html += `<span class="${cell.color} ${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`
        tw += m.width
      } else {
        html += ' '
        tw += spaceW
      }
    }

    if (rowEls[r]) {
      rowEls[r]!.innerHTML = html
    }
    rowWidths.push(tw)
  }

  // Center rows (fluid-smoke technique)
  const maxW = Math.max(...rowWidths)
  const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2)
  for (let r = 0; r < rowEls.length; r++) {
    rowEls[r]!.style.paddingLeft = blockOffset + (maxW - (rowWidths[r] ?? 0)) / 2 + 'px'
  }
}
