import { COLOR_CLASSES, type PixelGrid } from '../chart/canvas-chart.ts'
import type { PaletteEntry } from './palette.ts'
import type { FlowField } from './bg-flow.ts'
import { findTopN, PROP_FAMILY } from './palette.ts'

const ANIM_VARIANTS = 4

// Color palette matching CSS classes
const COLOR_MAP: Record<string, string> = {
  '': '#000000',
  bull: '#00ff66',
  bear: '#ff2255',
  grid: 'rgba(90,90,160,0.35)',
  ma1: '#44aaff',
  ma2: '#ffaa00',
  xhair: 'rgba(200,200,255,0.6)',
}

const FLOW_CHARS = 'アイウエオカキクケコサシスセソタチツテト∑∏∫√∞≡≈π⊕⊗⠁⠂⠃⠄⠅⠆·∙∘°'
const FLOW_COLOR = 'rgba(40,180,160,0.08)'
const LABEL_COLOR = 'rgba(255,255,255,0.6)'

// Pre-computed lookup: for each color class × brightness byte → array of candidate chars + widths
export type CharLookup = {
  chars: string[][]   // [colorIdx][byte] → array of ANIM_VARIANTS chars
  weights: number[][] // [colorIdx][byte] → array of font weights
  styles: string[][]  // [colorIdx][byte] → array of font styles
}

export function buildCharLookup(
  palette: PaletteEntry[],
  targetCellW: number,
): CharLookup {
  const chars: string[][] = []
  const weights: number[][] = []
  const styles: string[][] = []

  for (let ci = 0; ci < COLOR_CLASSES.length; ci++) {
    const cChars: string[] = []
    const cWeights: number[] = []
    const cStyles: string[] = []

    for (let byte = 0; byte < 256; byte++) {
      if (byte < 5 || ci === 0) {
        // Pack ANIM_VARIANTS spaces
        for (let v = 0; v < ANIM_VARIANTS; v++) {
          cChars.push(' ')
          cWeights.push(400)
          cStyles.push('normal')
        }
        continue
      }

      const candidates = findTopN(palette, byte / 255, targetCellW, ANIM_VARIANTS)
      for (let v = 0; v < ANIM_VARIANTS; v++) {
        const c = candidates[v % candidates.length]!
        cChars.push(c.char)
        cWeights.push(c.weight)
        cStyles.push(c.style)
      }
    }
    chars.push(cChars)
    weights.push(cWeights)
    styles.push(cStyles)
  }

  return { chars, weights, styles }
}

export function renderToCanvas(
  displayCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
  lookup: CharLookup,
  fontSize: number,
  lineHeight: number,
  axisLabels: Map<string, string>,
  animFrame: number,
  flow: FlowField,
): void {
  const { cols, rows, brightness, colorIdx } = grid
  const w = displayCanvas.parentElement?.clientWidth ?? window.innerWidth
  const h = displayCanvas.parentElement?.clientHeight ?? window.innerHeight

  if (displayCanvas.width !== w) displayCanvas.width = w
  if (displayCanvas.height !== h) displayCanvas.height = h

  // Clear
  ctx.fillStyle = '#060610'
  ctx.fillRect(0, 0, w, h)

  const cellW = w / cols
  const cellH = lineHeight

  ctx.textBaseline = 'middle'

  for (let r = 0; r < rows; r++) {
    const y = r * cellH + cellH / 2
    if (y > h) break
    const rowOffset = r * cols

    for (let c = 0; c < cols; c++) {
      const x = c * cellW

      // Axis labels
      const labelChar = axisLabels.get(`${r},${c}`)
      if (labelChar) {
        ctx.fillStyle = LABEL_COLOR
        ctx.font = `400 ${fontSize}px ${PROP_FAMILY}`
        ctx.fillText(labelChar, x, y)
        continue
      }

      const ci = colorIdx[rowOffset + c]!
      const byte = Math.min(255, (brightness[rowOffset + c]! * 255) | 0)

      if (byte >= 5 && ci !== 0) {
        // Chart content — pick animated character variant
        const phase = (animFrame + r * 7 + c * 13) % ANIM_VARIANTS
        const idx = byte * ANIM_VARIANTS + phase
        const ch = lookup.chars[ci]![idx]!
        const weight = lookup.weights[ci]![idx]!
        const style = lookup.styles[ci]![idx]!

        // Alpha from brightness
        const alpha = Math.min(1, byte / 200)
        const baseColor = COLOR_MAP[COLOR_CLASSES[ci]!] ?? '#ffffff'

        ctx.globalAlpha = alpha
        ctx.fillStyle = baseColor
        ctx.font = `${style === 'italic' ? 'italic ' : ''}${weight} ${fontSize}px ${PROP_FAMILY}`
        ctx.fillText(ch, x, y)
        ctx.globalAlpha = 1
      } else {
        // Empty — check flow field for background animation
        const flowDensity = (r < flow.rows && c < flow.cols) ? flow.density[r * flow.cols + c]! : 0
        if (flowDensity > 0.03) {
          const charIdx = ((animFrame * 3 + r * 11 + c * 17) % FLOW_CHARS.length + FLOW_CHARS.length) % FLOW_CHARS.length
          ctx.globalAlpha = Math.min(0.12, flowDensity * 0.3)
          ctx.fillStyle = FLOW_COLOR
          ctx.font = `400 ${fontSize}px ${PROP_FAMILY}`
          ctx.fillText(FLOW_CHARS[charIdx]!, x, y)
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
