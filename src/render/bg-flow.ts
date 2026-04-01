// Background flow field — subtle animated texture behind chart elements
// Adapted from fluid-smoke advection technique

export type FlowField = {
  density: Float32Array
  temp: Float32Array
  cols: number
  rows: number
  aspect: number // character width / height ratio
}

export function createFlowField(cols: number, rows: number, aspect: number): FlowField {
  return {
    density: new Float32Array(cols * rows),
    temp: new Float32Array(cols * rows),
    cols, rows, aspect,
  }
}

// Emitters — subtle energy sources scattered across chart area
const EMITTERS = [
  { cx: 0.2, cy: 0.3, orbitR: 0.12, freq: 0.15, phase: 0, strength: 0.06 },
  { cx: 0.6, cy: 0.25, orbitR: 0.08, freq: 0.12, phase: 2.1, strength: 0.05 },
  { cx: 0.4, cy: 0.6, orbitR: 0.10, freq: 0.18, phase: 4.2, strength: 0.04 },
  { cx: 0.8, cy: 0.5, orbitR: 0.06, freq: 0.20, phase: 1.0, strength: 0.05 },
]

// Velocity field — layered sine waves for organic flow
function getVel(c: number, r: number, t: number, field: FlowField): [number, number] {
  const nx = c / field.cols
  const ny = r / field.rows

  // Slow, dreamy flow (reduced speeds from fluid-smoke)
  let vx = Math.sin(ny * 6.28 + t * 0.12) * 1.2
         + Math.cos((nx + ny) * 10 + t * 0.2) * 0.4
         + Math.sin(nx * 20 + ny * 15 + t * 0.3) * 0.15

  let vy = Math.cos(nx * 4 + t * 0.15) * 0.8
         + Math.sin((nx - ny) * 8 + t * 0.18) * 0.4
         + Math.cos(nx * 15 - ny * 20 + t * 0.25) * 0.15

  vy *= field.aspect
  return [vx, vy]
}

export function updateFlowField(field: FlowField, t: number): void {
  const { cols, rows, density, temp, aspect } = field
  const aspect2 = aspect * aspect

  // Skip on very small grids (mobile perf)
  if (cols * rows > 30000) return

  // Advection — move density along velocity field
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [vx, vy] = getVel(c, r, t, field)
      let sx = Math.max(0, Math.min(cols - 1.001, c - vx))
      let sy = Math.max(0, Math.min(rows - 1.001, r - vy))
      const x0 = sx | 0, y0 = sy | 0
      const x1 = Math.min(x0 + 1, cols - 1), y1 = Math.min(y0 + 1, rows - 1)
      const fx = sx - x0, fy = sy - y0
      temp[r * cols + c] =
        density[y0 * cols + x0] * (1 - fx) * (1 - fy) +
        density[y0 * cols + x1] * fx * (1 - fy) +
        density[y1 * cols + x0] * (1 - fx) * fy +
        density[y1 * cols + x1] * fx * fy
    }
  }

  // Swap buffers
  field.density = temp
  field.temp = density

  // Diffusion — smooth density
  const d = field.density
  const t2 = field.temp
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c
      const avg = (d[i - 1]! + d[i + 1]! + (d[i - cols]! + d[i + cols]!) * aspect2) / (2 + 2 * aspect2)
      t2[i] = d[i]! * 0.90 + avg * 0.10
    }
  }
  field.density = t2
  field.temp = d

  // Emitters — inject density at orbiting positions
  const spread = 3
  for (const e of EMITTERS) {
    const ex = (e.cx + Math.cos(t * e.freq + e.phase) * e.orbitR) * cols
    const ey = (e.cy + Math.sin(t * e.freq * 0.7 + e.phase) * e.orbitR * 0.8) * rows
    const ec = ex | 0, er = ey | 0
    for (let dr = -spread; dr <= spread; dr++) {
      for (let dc = -spread; dc <= spread; dc++) {
        const rr = er + dr, cc = ec + dc
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
          const drScaled = dr / aspect
          const dist = Math.sqrt(drScaled * drScaled + dc * dc)
          const s = Math.max(0, 1 - dist / (spread + 1))
          field.density[rr * cols + cc] = Math.min(1, field.density[rr * cols + cc]! + s * e.strength)
        }
      }
    }
  }

  // Decay
  for (let i = 0; i < cols * rows; i++) {
    field.density[i]! *= 0.975
  }
}
