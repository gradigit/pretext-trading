export type CellInfo = {
  brightness: number  // 0-1
  color: string       // CSS class: 'bull', 'bear', 'grid', 'ma1', 'ma2', 'xhair'
  priority: number    // higher wins
  text?: string       // literal text for axis labels (bypasses palette)
}

const EMPTY: CellInfo = { brightness: 0, color: '', priority: 0 }

export function createGrid(cols: number, rows: number): CellInfo[][] {
  const grid: CellInfo[][] = []
  for (let r = 0; r < rows; r++) {
    const row: CellInfo[] = []
    for (let c = 0; c < cols; c++) {
      row.push({ brightness: 0, color: '', priority: 0 })
    }
    grid.push(row)
  }
  return grid
}

export function clearGrid(grid: CellInfo[][]): void {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]!
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!
      cell.brightness = 0
      cell.color = ''
      cell.priority = 0
      cell.text = undefined
    }
  }
}

export function setCell(grid: CellInfo[][], row: number, col: number, brightness: number, color: string, priority: number, text?: string): void {
  if (row < 0 || row >= grid.length) return
  const r = grid[row]!
  if (col < 0 || col >= r.length) return
  const cell = r[col]!
  if (priority > cell.priority) {
    cell.brightness = brightness
    cell.color = color
    cell.priority = priority
    cell.text = text
  }
}
