import type { Candle } from '../data/types.ts'
import type { Viewport } from './viewport.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'
import { candleColStart } from './geometry.ts'

export function renderVolume(grid: CellInfo[][], candles: Candle[], vp: Viewport): void {
  const end = Math.min(vp.startIndex + vp.visibleCount, candles.length)
  const volumeRows = vp.volumeRowEnd - vp.volumeRowStart

  // Find max volume in visible range
  let maxVol = 0
  for (let i = vp.startIndex; i < end; i++) {
    if (candles[i]!.volume > maxVol) maxVol = candles[i]!.volume
  }
  if (maxVol === 0) return

  for (let i = vp.startIndex; i < end; i++) {
    const c = candles[i]!
    const vi = i - vp.startIndex
    const colBase = candleColStart(vi, vp)
    const color = c.close >= c.open ? 'bull' : 'bear'

    const barHeight = Math.max(1, Math.round((c.volume / maxVol) * volumeRows))
    const bodyCol = colBase + Math.floor(vp.colsPerCandle / 2)
    const bodyHalfWidth = Math.max(0, Math.floor((vp.colsPerCandle - 2) / 2))

    for (let h = 0; h < barHeight; h++) {
      const row = vp.volumeRowEnd - 1 - h
      const brightness = 0.3 + (h / volumeRows) * 0.4 // brighter toward top
      for (let dc = -bodyHalfWidth; dc <= bodyHalfWidth; dc++) {
        setCell(grid, row, bodyCol + dc, brightness, color, 40)
      }
    }
  }
}
