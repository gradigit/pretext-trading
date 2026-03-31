import type { Candle } from './types.ts'

// Generate realistic synthetic BTC/USDT 1h OHLCV data
export function generateSampleData(count: number = 500, startPrice: number = 65000): Candle[] {
  const candles: Candle[] = []
  let price = startPrice
  const baseTime = Date.now() - count * 3600_000 // count hours ago

  for (let i = 0; i < count; i++) {
    const time = baseTime + i * 3600_000

    // Random walk with slight upward drift and mean reversion
    const volatility = 0.003 + Math.random() * 0.007 // 0.3% - 1% per candle
    const drift = (65000 - price) * 0.0001 // mean reversion toward 65000
    const change = (Math.random() - 0.48 + drift) * volatility * price

    const open = price
    const close = open + change

    // Wicks extend beyond body with realistic ratios
    const bodySize = Math.abs(close - open)
    const upperWick = bodySize * (0.2 + Math.random() * 1.5)
    const lowerWick = bodySize * (0.2 + Math.random() * 1.5)

    const high = Math.max(open, close) + upperWick
    const low = Math.min(open, close) - lowerWick

    // Volume correlates with price movement (bigger moves = more volume)
    const baseVolume = 500 + Math.random() * 2000
    const moveMultiplier = 1 + (bodySize / price) * 200
    const volume = baseVolume * moveMultiplier

    candles.push({
      time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    })

    price = close
  }

  return candles
}
