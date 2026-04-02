// Pretext-powered DOM renderer — same technique as fluid-smoke demo
// Uses prepareWithSegments for precise character width measurement,
// accumulates row widths, centers with paddingLeft

import { COLOR_CLASSES, type PixelGrid } from '../chart/canvas-chart.ts'
import type { PaletteEntry } from './palette.ts'
import type { FlowField } from './bg-flow.ts'
import { findTopN, esc, wCls, spaceWidth, PROP_FAMILY } from './palette.ts'

const ANIM_VARIANTS = 4

const FLOW_CHARS = 'アイウエオカキクケコサシスセソタチツテト∑∏∫√∞≡≈π⊕⊗⠁⠂⠃⠄⠅⠆·∙∘°'
const FLOW_CLASS = 'flow'

// Animated lookup: multiple character variants per brightness level
// Each variant stores the pre-built HTML span AND the pretext-measured width
type AnimVariant = { html: string; width: number }
type AnimEntry = { variants: AnimVariant[] }

export function buildAnimLookup(
  palette: PaletteEntry[],
  targetCellW: number,
  fontSize: number,
): AnimEntry[][] {
  const spW = spaceWidth(fontSize)
  const tables: AnimEntry[][] = []

  for (let ci = 0; ci < COLOR_CLASSES.length; ci++) {
    const colorClass = COLOR_CLASSES[ci]!
    const lookup: AnimEntry[] = []

    for (let byte = 0; byte < 256; byte++) {
      if (byte < 5 || ci === 0) {
        lookup.push({ variants: [{ html: ' ', width: spW }] })
        continue
      }

      // findTopN uses pretext-measured widths in its scoring function
      const candidates = findTopN(palette, byte / 255, targetCellW, ANIM_VARIANTS)
      const ai = Math.max(1, Math.min(10, Math.round((byte / 255) * 10)))
      const variants: AnimVariant[] = candidates.map(m => ({
        html: `<span class="${colorClass} ${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`,
        width: m.width, // pretext-measured width — used for row centering
      }))
      lookup.push({ variants })
    }
    tables.push(lookup)
  }

  return tables
}

// Pre-measure flow character widths with pretext
import { prepareWithSegments } from '@chenglou/pretext'

let flowCharWidths: number[] = []
export function measureFlowChars(fontSize: number): void {
  const font = `400 ${fontSize}px ${PROP_FAMILY}`
  flowCharWidths = []
  for (const ch of FLOW_CHARS) {
    const p = prepareWithSegments(ch, font)
    flowCharWidths.push(p.widths.length > 0 ? p.widths[0]! : fontSize * 0.5)
  }
}

// Render pixel grid to DOM rows using pretext-measured widths
// This is the fluid-smoke technique: build innerHTML, accumulate widths, center with paddingLeft
import type { Viewport } from '../chart/viewport.ts'

export function renderToDOM(
  grid: PixelGrid,
  rowEls: HTMLDivElement[],
  lookups: AnimEntry[][],
  fontSize: number,
  axisLabels: Map<string, string>,
  animFrame: number,
  flow: FlowField,
  mouseCol: number = -1,
  mouseRow: number = -1,
  vp?: Viewport,
): void {
  const spW = spaceWidth(fontSize)
  const { cols, rows, brightness, colorIdx } = grid
  const rowWidths: number[] = []
  const labelW = fontSize * 0.55 // approximate label char width

  for (let r = 0; r < rows && r < rowEls.length; r++) {
    const rowOffset = r * cols
    let html = ''
    let tw = 0 // accumulated row width from pretext-measured char widths
    let spaceRun = 0

    for (let c = 0; c < cols; c++) {
      // Axis labels
      const labelChar = axisLabels.get(`${r},${c}`)
      if (labelChar) {
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        html += `<span class="label">${esc(labelChar)}</span>`
        tw += labelW
        continue
      }

      const ci = colorIdx[rowOffset + c]!
      const byte = Math.min(255, (brightness[rowOffset + c]! * 255) | 0)

      // Crosshair override — render dim xhair character on crosshair lines
      const onCrosshair = (mouseRow >= 0 && mouseCol >= 0) &&
        ((r === mouseRow && c >= (vp?.chartColStart ?? 0)) || c === mouseCol)

      if (onCrosshair && byte < 5) {
        // Empty cell on crosshair line → render dim crosshair char
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        const xEntry = lookups[6]![30]! // xhair color at low brightness
        const xv = xEntry.variants[0]!
        html += xv.html
        tw += xv.width
        continue
      }

      if (byte >= 5 && ci !== 0) {
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        const entry = lookups[ci]![byte]!
        const phase = (animFrame + r * 7 + c * 13) % entry.variants.length
        const v = entry.variants[phase]!
        html += v.html
        tw += v.width // pretext-measured width!
      } else {
        // Empty — check flow field
        const flowDensity = (r < flow.rows && c < flow.cols) ? flow.density[r * flow.cols + c]! : 0
        if (flowDensity > 0.03) {
          if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
          const charIdx = ((animFrame * 3 + r * 11 + c * 17) % FLOW_CHARS.length + FLOW_CHARS.length) % FLOW_CHARS.length
          const ai = Math.max(1, Math.min(3, Math.round(flowDensity * 8)))
          html += `<span class="${FLOW_CLASS} a${ai}">${esc(FLOW_CHARS[charIdx]!)}</span>`
          tw += flowCharWidths[charIdx] ?? spW
        } else {
          spaceRun++
        }
      }
    }
    if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun }

    rowEls[r]!.innerHTML = html
    rowWidths.push(tw)
  }

  // Center rows using pretext-measured widths (fluid-smoke technique)
  const maxW = Math.max(...rowWidths)
  const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2)
  for (let r = 0; r < rowEls.length && r < rowWidths.length; r++) {
    rowEls[r]!.style.paddingLeft = blockOffset + (maxW - rowWidths[r]!) / 2 + 'px'
  }
}
