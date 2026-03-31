import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { priceToRow, candleColStart } from './geometry.ts'

const BODY_BRIGHTNESS = 0.95
const WICK_BRIGHTNESS = 0.55

export function renderCandles(grid: CellInfo[][], candles: Candle[], vp: Viewport): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)

  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    const vi = i - vp.startIndex
    const colBase = candleColStart(vi, vp)
    const color = c.close >= c.open ? 'bull' : 'bear'

    const rowHigh = priceToRow(c.high, vp)
    const rowLow = priceToRow(c.low, vp)
    const rowOpen = priceToRow(c.open, vp)
    const rowClose = priceToRow(c.close, vp)
    const bodyTop = Math.min(rowOpen, rowClose)
    const bodyBottom = Math.max(rowOpen, rowClose)

    const bodyCol = colBase + Math.floor(vp.colsPerCandle / 2)

    // Body fills most of the candle allocation (leave 1 gap col on each side at most)
    const bodyHalfWidth = vp.colsPerCandle <= 2
      ? 0
      : Math.max(0, Math.floor((vp.colsPerCandle - 1) / 2))

    // Wick
    for (let r = rowHigh; r < bodyTop; r++) {
      setCell(grid, r, bodyCol, WICK_BRIGHTNESS, color, 60)
    }
    for (let r = bodyBottom + 1; r <= rowLow; r++) {
      setCell(grid, r, bodyCol, WICK_BRIGHTNESS, color, 60)
    }

    // Body — fill wide, with slight brightness variation for depth
    for (let r = bodyTop; r <= bodyBottom; r++) {
      for (let dc = -bodyHalfWidth; dc <= bodyHalfWidth; dc++) {
        // Slightly dimmer at edges for a rounded look
        const edgeFade = bodyHalfWidth > 0 ? 1.0 - Math.abs(dc) / (bodyHalfWidth + 2) * 0.15 : 1.0
        setCell(grid, r, bodyCol + dc, BODY_BRIGHTNESS * edgeFade, color, 80)
      }
    }

    // Ensure at least 1 row of body even for doji candles
    if (bodyTop === bodyBottom) {
      for (let dc = -bodyHalfWidth; dc <= bodyHalfWidth; dc++) {
        setCell(grid, bodyTop, bodyCol + dc, BODY_BRIGHTNESS, color, 80)
      }
    }
  }
}
