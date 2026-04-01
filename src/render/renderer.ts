import { COLOR_CLASSES, type PixelGrid } from '../chart/canvas-chart.ts'
import type { PaletteEntry } from './palette.ts'
import { findTopN, esc, wCls, spaceWidth } from './palette.ts'

// Each brightness level stores N character variants for animation cycling
type AnimEntry = {
  variants: { html: string; width: number }[]
}

const ANIM_VARIANTS = 4 // characters to cycle through per brightness level

// Matrix rain characters — ethereal, flowing
const RAIN_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン゙゚ⅡⅢⅣⅤⅥⅦⅧⅨⅩ∑∏∫√∞≡≈πΩ⊕⊗'

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

// Matrix rain state — one drop per column
export type RainState = {
  heads: Float32Array    // y position of each rain drop head
  speeds: Float32Array   // fall speed per column
  lengths: Float32Array  // trail length per column
  chars: Uint16Array     // current character index per column
}

export function createRainState(cols: number): RainState {
  const heads = new Float32Array(cols)
  const speeds = new Float32Array(cols)
  const lengths = new Float32Array(cols)
  const chars = new Uint16Array(cols)

  for (let c = 0; c < cols; c++) {
    heads[c] = Math.random() * -50 // start off-screen
    speeds[c] = 0.3 + Math.random() * 0.8
    lengths[c] = 4 + Math.random() * 12
    chars[c] = Math.floor(Math.random() * RAIN_CHARS.length)
  }
  return { heads, speeds, lengths, chars }
}

export function advanceRain(rain: RainState, rows: number): void {
  for (let c = 0; c < rain.heads.length; c++) {
    rain.heads[c] += rain.speeds[c]
    // Reset when fully off bottom
    if (rain.heads[c] - rain.lengths[c] > rows) {
      rain.heads[c] = Math.random() * -20
      rain.speeds[c] = 0.3 + Math.random() * 0.8
      rain.lengths[c] = 4 + Math.random() * 12
    }
    // Cycle character
    if (Math.random() < 0.1) {
      rain.chars[c] = Math.floor(Math.random() * RAIN_CHARS.length)
    }
  }
}

export function renderPixelGrid(
  grid: PixelGrid,
  rowEls: HTMLDivElement[],
  lookups: AnimEntry[][],
  fontSize: number,
  axisLabels: Map<string, string>,
  animFrame: number,
  rain: RainState,
): void {
  const spW = spaceWidth(fontSize)
  const { cols, rows, brightness, colorIdx } = grid
  const rowWidths: number[] = []

  for (let r = 0; r < rows && r < rowEls.length; r++) {
    const rowOffset = r * cols
    let html = ''
    let tw = 0
    let spaceRun = 0

    for (let c = 0; c < cols; c++) {
      // Axis labels always take priority
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
        // Chart content — animate character selection
        if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
        const entry = lookups[ci]![byte]!
        // Spatial hash + time for per-cell animation phase
        const phase = (animFrame + r * 7 + c * 13) % entry.variants.length
        const v = entry.variants[phase]!
        html += v.html
        tw += v.width
      } else {
        // Empty cell — check for matrix rain
        const headY = rain.heads[c]!
        const dist = r - headY
        if (dist >= 0 && dist < rain.lengths[c]!) {
          if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun; spaceRun = 0 }
          // Brightness fades along trail (head is brightest)
          const trailFade = 1 - dist / rain.lengths[c]!
          const rainBright = trailFade * 0.12 // very dim
          const ai = Math.max(1, Math.min(3, Math.round(rainBright * 10)))
          const charIdx = (rain.chars[c]! + Math.floor(dist)) % RAIN_CHARS.length
          const ch = RAIN_CHARS[charIdx]!
          html += `<span class="rain a${ai}">${esc(ch)}</span>`
          tw += spW * 1.5 // approximate
        } else {
          spaceRun++
        }
      }
    }
    if (spaceRun > 0) { html += ' '.repeat(spaceRun); tw += spW * spaceRun }

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
