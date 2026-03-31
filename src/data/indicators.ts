import type { Candle } from './types.ts'

export function sma(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i]!.close
    if (i >= period) sum -= candles[i - period]!.close
    result.push(i >= period - 1 ? sum / period : null)
  }
  return result
}
