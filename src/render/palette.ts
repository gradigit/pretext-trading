import { prepareWithSegments } from '@chenglou/pretext'

// --- Configuration ---
export const PROP_FAMILY = 'Georgia, Palatino, "Times New Roman", serif'
// Dense charset: alphanumeric + symbols + Unicode dots/blocks/shading for dithered look
const CHARSET = ' .,:;·•°¹²³⁴⁺⁻`\'-_~!|/\\()[]{}?<>^=+*#@%&$£€¥©®™§¶†‡abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789░▒▓█▀▄▌▐─│┌┐└┘├┤┬┴┼━┃╋○●◦◘◙■□▪▫▬▮▯◆◇◈★☆♦♣♠♥∙∘∞≡≈≠±÷×∑∏∫√∂∆∇πΩαβγδεθλμσφψω'
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

// Detect responsive font size from CSS — small for high density
export function getResponsiveFontSize(): number {
  const w = window.innerWidth
  if (w <= 600) return 5
  if (w <= 1024) return 6
  return 8
}

export function getLineHeight(fontSize: number): number {
  return Math.round(fontSize * 1.21)
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

// --- Build palette for a given font size ---
export function buildPalette(fontSize: number): PaletteEntry[] {
  const palette: PaletteEntry[] = []
  for (const style of FONT_STYLES) {
    for (const weight of WEIGHTS) {
      const font = `${style === 'italic' ? 'italic ' : ''}${weight} ${fontSize}px ${PROP_FAMILY}`
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

// Space width approximation (matches fluid-smoke)
export const spaceWidth = (fontSize: number) => fontSize * 0.27
