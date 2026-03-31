import { COLOR_CLASSES, type PixelGrid } from '../chart/canvas-chart.ts'
import type { PaletteEntry } from './palette.ts'
import { findBest, esc, wCls, spaceWidth } from './palette.ts'

type LookupEntry = { html: string; width: number }

// Pre-compute brightness→HTML lookup per color class index
export function buildLookupTables(
  palette: PaletteEntry[],
  targetCellW: number,
  fontSize: number,
): LookupEntry[][] {
  const spaceW = spaceWidth(fontSize)
  const tables: LookupEntry[][] = []

  for (let ci = 0; ci < COLOR_CLASSES.length; ci++) {
    const colorClass = COLOR_CLASSES[ci]!
    const lookup: LookupEntry[] = []
    for (let byte = 0; byte < 256; byte++) {
      const brightness = byte / 255
      if (byte < 8 || ci === 0) {
        lookup.push({ html: ' ', width: spaceW })
        continue
      }
      const m = findBest(palette, brightness, targetCellW)
      const ai = Math.max(1, Math.min(10, Math.round(brightness * 10)))
      lookup.push({
        html: `<span class="${colorClass} ${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`,
        width: m.width,
      })
    }
    tables.push(lookup)
  }

  return tables
}

export function renderPixelGrid(
  grid: PixelGrid,
  rowEls: HTMLDivElement[],
  lookups: LookupEntry[][],
  fontSize: number,
  axisLabels: Map<string, string>,
): void {
  const spaceW = spaceWidth(fontSize)
  const { cols, rows, brightness, colorIdx } = grid
  const rowWidths: number[] = []

  for (let r = 0; r < rows && r < rowEls.length; r++) {
    const rowOffset = r * cols
    let html = ''
    let tw = 0
    let spaceRun = 0

    for (let c = 0; c < cols; c++) {
      const labelChar = axisLabels.get(`${r},${c}`)

      if (labelChar) {
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spaceW * spaceRun; spaceRun = 0 }
        html += `<span class="label">${labelChar}</span>`
        tw += spaceW * 1.2
        continue
      }

      const ci = colorIdx[rowOffset + c]!
      const byte = Math.min(255, (brightness[rowOffset + c]! * 255) | 0)

      if (byte < 8 || ci === 0) {
        spaceRun++
      } else {
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spaceW * spaceRun; spaceRun = 0 }
        const entry = lookups[ci]![byte]!
        html += entry.html
        tw += entry.width
      }
    }
    if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spaceW * spaceRun }

    rowEls[r]!.innerHTML = html
    rowWidths.push(tw)
  }

  // Center rows
  const maxW = Math.max(...rowWidths)
  const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2)
  for (let r = 0; r < rowEls.length && r < rowWidths.length; r++) {
    rowEls[r]!.style.paddingLeft = blockOffset + (maxW - rowWidths[r]!) / 2 + 'px'
  }
}
