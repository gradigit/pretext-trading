import { prepareWithSegments } from '@chenglou/pretext'

// --- Configuration ---
export const FONT_SIZE = 14
export const LINE_HEIGHT = 17
export const PROP_FAMILY = 'Georgia, Palatino, "Times New Roman", serif'
const CHARSET = ' .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const WEIGHTS = [300, 500, 800] as const
const FONT_STYLES = ['normal', 'italic'] as const

export type PaletteEntry = {
  char: string
  weight: number
  style: string
  font: string
  width: number
  brightness: number
}

// --- Brightness estimation via offscreen canvas ---
const bCvs = document.createElement('canvas')
bCvs.width = bCvs.height = 28
const bCtx = bCvs.getContext('2d', { willReadFrequently: true })!

function estimateBrightness(ch: string, font: string): number {
  bCtx.clearRect(0, 0, 28, 28)
  bCtx.font = font
  bCtx.fillStyle = '#fff'
  bCtx.textBaseline = 'middle'
  bCtx.fillText(ch, 1, 14)
  const d = bCtx.getImageData(0, 0, 28, 28).data
  let sum = 0
  for (let i = 3; i < d.length; i += 4) sum += d[i]
  return sum / (255 * 784)
}

// --- Build palette ---
export function buildPalette(): PaletteEntry[] {
  const palette: PaletteEntry[] = []
  for (const style of FONT_STYLES) {
    for (const weight of WEIGHTS) {
      const font = `${style === 'italic' ? 'italic ' : ''}${weight} ${FONT_SIZE}px ${PROP_FAMILY}`
      for (const ch of CHARSET) {
        if (ch === ' ') continue
        const p = prepareWithSegments(ch, font)
        const width = p.widths.length > 0 ? p.widths[0]! : 0
        if (width <= 0) continue
        palette.push({ char: ch, weight, style, font, width, brightness: estimateBrightness(ch, font) })
      }
    }
  }

  const maxB = Math.max(...palette.map(p => p.brightness))
  if (maxB > 0) for (const p of palette) p.brightness /= maxB
  palette.sort((a, b) => a.brightness - b.brightness)

  return palette
}

// --- Character selection ---
export function findBest(palette: PaletteEntry[], targetB: number, targetW: number): PaletteEntry {
  let lo = 0, hi = palette.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (palette[mid]!.brightness < targetB) lo = mid + 1
    else hi = mid
  }
  let bestScore = Infinity
  let best = palette[lo]!
  for (let i = Math.max(0, lo - 15); i < Math.min(palette.length, lo + 15); i++) {
    const p = palette[i]!
    const score = Math.abs(p.brightness - targetB) * 2.5 + Math.abs(p.width - targetW) / targetW
    if (score < bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}

// --- HTML helpers ---
export function esc(c: string): string {
  if (c === '&') return '&amp;'
  if (c === '<') return '&lt;'
  if (c === '>') return '&gt;'
  return c
}

export function wCls(w: number, s: string): string {
  const wc = w === 300 ? 'w3' : w === 500 ? 'w5' : 'w8'
  return s === 'italic' ? wc + ' it' : wc
}

// --- Color-specific brightness lookup tables ---
export type ColorLookupEntry = {
  html: string
  width: number
}

export function buildColorLookup(
  palette: PaletteEntry[],
  colorClass: string,
  targetCellW: number,
  spaceW: number
): ColorLookupEntry[] {
  const lookup: ColorLookupEntry[] = []
  for (let byte = 0; byte < 256; byte++) {
    const brightness = byte / 255
    if (brightness < 0.025) {
      lookup.push({ html: ' ', width: spaceW })
      continue
    }
    const match = findBest(palette, brightness, targetCellW)
    const ai = Math.max(1, Math.min(10, Math.round(brightness * 10)))
    lookup.push({
      html: `<span class="${colorClass} ${wCls(match.weight, match.style)} a${ai}">${esc(match.char)}</span>`,
      width: match.width,
    })
  }
  return lookup
}

// Space width approximation (matches fluid-smoke)
export const spaceWidth = (fontSize: number) => fontSize * 0.27
