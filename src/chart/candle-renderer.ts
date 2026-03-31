import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { priceToRow, candleColStart } from './geometry.ts'

const BODY_BRIGHTNESS = 0.85
const WICK_BRIGHTNESS = 0.40

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

    // Body column is in the middle of the candle allocation
    const bodyCol = colBase + Math.floor(vp.colsPerCandle / 2)

    // Fill wider body for wider candle allocations
    const bodyHalfWidth = Math.max(0, Math.floor((vp.colsPerCandle - 2) / 2))

    // Wick: from high to bodyTop, and from bodyBottom to low
    for (let r = rowHigh; r < bodyTop; r++) {
      setCell(grid, r, bodyCol, WICK_BRIGHTNESS, color, 60)
    }
    for (let r = bodyBottom + 1; r <= rowLow; r++) {
      setCell(grid, r, bodyCol, WICK_BRIGHTNESS, color, 60)
    }

    // Body: fill multiple columns for wider candles
    for (let r = bodyTop; r <= bodyBottom; r++) {
      for (let dc = -bodyHalfWidth; dc <= bodyHalfWidth; dc++) {
        setCell(grid, r, bodyCol + dc, BODY_BRIGHTNESS, color, 80)
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
