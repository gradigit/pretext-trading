import { COLOR_CLASSES, type PixelGrid } from '../chart/canvas-chart.ts'
import type { PaletteEntry } from './palette.ts'
import type { FlowField } from './bg-flow.ts'
import { findTopN, esc, wCls, spaceWidth } from './palette.ts'

type AnimEntry = {
  variants: { html: string; width: number }[]
}

const ANIM_VARIANTS = 4

// Flow/rain characters — katakana, symbols, operators for matrix aesthetic
const FLOW_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン∑∏∫√∞≡≈π⊕⊗⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏·∙∘°⋅░▒'

export function buildAnimLookupTables(
  palette: PaletteEntry[],
  targetCellW: number,
  fontSize: number,
): AnimEntry[][] {
  const tables: AnimEntry[][] = []

  for (let ci = 0; ci < COLOR_CLASSES.length; ci++) {
    const colorClass = COLOR_CLASSES[ci]!
    const lookup: AnimEntry[] = []

    for (let byte = 0; byte < 256; byte++) {
      const brightness = byte / 255
      if (byte < 5 || ci === 0) {
        lookup.push({ variants: [{ html: ' ', width: spaceWidth(fontSize) }] })
        continue
      }

      const candidates = findTopN(palette, brightness, targetCellW, ANIM_VARIANTS)
      const ai = Math.max(1, Math.min(10, Math.round(brightness * 10)))
      const variants = candidates.map(m => ({
        html: `<span class="${colorClass} ${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`,
        width: m.width,
      }))

      lookup.push({ variants })
    }
    tables.push(lookup)
  }

  return tables
}

export function renderPixelGrid(
  grid: PixelGrid,
  rowEls: HTMLDivElement[],
  lookups: AnimEntry[][],
  fontSize: number,
  axisLabels: Map<string, string>,
  animFrame: number,
  flow: FlowField,
  startRow: number = 0,
  endRow?: number,
): void {
  const spW = spaceWidth(fontSize)
  const { cols, rows, brightness, colorIdx } = grid
  const rowWidths: number[] = []
  const rEnd = Math.min(endRow ?? rows, rows, rowEls.length)

  for (let r = startRow; r < rEnd; r++) {
    const rowOffset = r * cols
    let html = ''
    let tw = 0
    let spaceRun = 0

    for (let c = 0; c < cols; c++) {
      // Axis labels always win
      const labelChar = axisLabels.get(`${r},${c}`)
      if (labelChar) {
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        html += `<span class="label">${labelChar}</span>`
        tw += spW * 1.2
        continue
      }

      const ci = colorIdx[rowOffset + c]!
      const byte = Math.min(255, (brightness[rowOffset + c]! * 255) | 0)

      if (byte >= 5 && ci !== 0) {
        // Chart content — animated character cycling
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        const entry = lookups[ci]![byte]!
        const phase = (animFrame + r * 7 + c * 13) % entry.variants.length
        const v = entry.variants[phase]!
        html += v.html
        tw += v.width
      } else {
        // Empty cell — check flow field for background animation
        const flowDensity = (r < flow.rows && c < flow.cols) ? flow.density[r * flow.cols + c]! : 0

        if (flowDensity > 0.03) {
          if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
          // Pick a flowing character based on position + time
          const charIdx = ((animFrame * 3 + r * 11 + c * 17) % FLOW_CHARS.length + FLOW_CHARS.length) % FLOW_CHARS.length
          const ch = FLOW_CHARS[charIdx]!
          const ai = Math.max(1, Math.min(3, Math.round(flowDensity * 8)))
          html += `<span class="flow a${ai}">${esc(ch)}</span>`
          tw += spW * 1.3
        } else {
          spaceRun++
        }
      }
    }
    if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun }

    rowEls[r]!.innerHTML = html
    rowWidths.push(tw)
  }

  // Center rows (only the ones we rendered)
  if (rowWidths.length > 0) {
    const maxW = Math.max(...rowWidths)
    const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2)
    for (let i = 0; i < rowWidths.length; i++) {
      rowEls[startRow + i]!.style.paddingLeft = blockOffset + (maxW - rowWidths[i]!) / 2 + 'px'
    }
  }
}
