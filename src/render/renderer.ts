import type { CellInfo } from '../chart/compositor.ts'
import type { PaletteEntry } from './palette.ts'
import { findBest, esc, wCls, spaceWidth } from './palette.ts'

export function renderGrid(
  grid: CellInfo[][],
  rowEls: HTMLDivElement[],
  palette: PaletteEntry[],
  targetCellW: number,
  fontSize: number,
): void {
  const spaceW = spaceWidth(fontSize)
  const rowWidths: number[] = []

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]!
    let html = ''
    let tw = 0

    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!

      if (cell.text) {
        html += `<span class="label">${esc(cell.text)}</span>`
        tw += targetCellW
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

  // Center rows
  const maxW = Math.max(...rowWidths)
  const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2)
  for (let r = 0; r < rowEls.length; r++) {
    rowEls[r]!.style.paddingLeft = blockOffset + (maxW - (rowWidths[r] ?? 0)) / 2 + 'px'
  }
}
