import type { OrderBook } from '../data/orderbook.ts'
import type { CellInfo } from './compositor.ts'
import { setCell } from './compositor.ts'

// Renders order book as a depth visualization on the right side of the chart
export function renderOrderBook(
  grid: CellInfo[][],
  book: OrderBook | null,
  startCol: number,
  endCol: number,
  startRow: number,
  endRow: number,
): void {
  if (!book || book.bids.length === 0) return

  const midRow = startRow + Math.floor((endRow - startRow) / 2)
  const bookCols = endCol - startCol
  const halfRows = midRow - startRow

  // Find max cumulative quantity for scaling
  let maxCumQty = 0
  let cumBid = 0
  for (const b of book.bids) { cumBid += b.quantity; if (cumBid > maxCumQty) maxCumQty = cumBid }
  let cumAsk = 0
  for (const a of book.asks) { cumAsk += a.quantity; if (cumAsk > maxCumQty) maxCumQty = cumAsk }
  if (maxCumQty === 0) return

  // Render bids (below midpoint, green, growing left)
  let cumQty = 0
  const bidLevels = Math.min(book.bids.length, halfRows)
  for (let i = 0; i < bidLevels; i++) {
    cumQty += book.bids[i]!.quantity
    const barWidth = Math.max(1, Math.round((cumQty / maxCumQty) * bookCols))
    const row = midRow + i + 1
    if (row >= endRow) break

    // Price label
    const priceStr = book.bids[i]!.price.toFixed(0)
    for (let j = 0; j < priceStr.length && j < bookCols - barWidth - 1; j++) {
      setCell(grid, row, startCol + j, 0.4, 'xhair', 95, priceStr[j])
    }

    // Depth bar (right-aligned)
    for (let c = 0; c < barWidth; c++) {
      const brightness = 0.15 + (c / barWidth) * 0.35
      setCell(grid, row, endCol - 1 - c, brightness, 'bull', 45)
    }
  }

  // Render asks (above midpoint, red, growing left)
  cumQty = 0
  const askLevels = Math.min(book.asks.length, halfRows)
  for (let i = 0; i < askLevels; i++) {
    cumQty += book.asks[i]!.quantity
    const barWidth = Math.max(1, Math.round((cumQty / maxCumQty) * bookCols))
    const row = midRow - i - 1
    if (row < startRow) break

    const priceStr = book.asks[i]!.price.toFixed(0)
    for (let j = 0; j < priceStr.length && j < bookCols - barWidth - 1; j++) {
      setCell(grid, row, startCol + j, 0.4, 'xhair', 95, priceStr[j])
    }

    for (let c = 0; c < barWidth; c++) {
      const brightness = 0.15 + (c / barWidth) * 0.35
      setCell(grid, row, endCol - 1 - c, brightness, 'bear', 45)
    }
  }

  // Spread label at midpoint
  if (book.asks.length > 0 && book.bids.length > 0) {
    const spread = (book.asks[0]!.price - book.bids[0]!.price).toFixed(1)
    const label = `spread ${spread}`
    for (let j = 0; j < label.length && startCol + j < endCol; j++) {
      setCell(grid, midRow, startCol + j, 0.35, 'xhair', 95, label[j])
    }
  }
}
