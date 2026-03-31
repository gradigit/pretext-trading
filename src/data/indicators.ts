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

export function ema(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (prev === null) {
      // First EMA value = SMA
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += candles[j]!.close
      prev = sum / period
      result.push(prev)
    } else {
      prev = candles[i]!.close * k + prev * (1 - k)
      result.push(prev)
    }
  }
  return result
}

export function rsi(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  let avgGain = 0, avgLoss = 0

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { result.push(null); continue }

    const change = candles[i]!.close - candles[i - 1]!.close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    if (i <= period) {
      avgGain += gain
      avgLoss += loss
      if (i === period) {
        avgGain /= period
        avgLoss /= period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        result.push(100 - 100 / (1 + rs))
      } else {
        result.push(null)
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }
  return result
}

export function macd(candles: Candle[], fast = 12, slow = 26, signal = 9): {
  macd: (number | null)[]
  signal: (number | null)[]
  histogram: (number | null)[]
} {
  const emaFast = ema(candles, fast)
  const emaSlow = ema(candles, slow)
  const macdLine: (number | null)[] = []

  for (let i = 0; i < candles.length; i++) {
    const f = emaFast[i], s = emaSlow[i]
    macdLine.push(f !== null && s !== null ? f - s : null)
  }

  // Signal line = EMA of MACD line
  const signalLine: (number | null)[] = []
  const histogram: (number | null)[] = []
  const k = 2 / (signal + 1)
  let prevSignal: number | null = null
  let count = 0

  for (let i = 0; i < macdLine.length; i++) {
    const m = macdLine[i]
    if (m === null) {
      signalLine.push(null)
      histogram.push(null)
    } else if (prevSignal === null) {
      count++
      if (count < signal) {
        signalLine.push(null)
        histogram.push(null)
      } else {
        // First signal = average of first N MACD values
        let sum = 0, c = 0
        for (let j = i; j >= 0 && c < signal; j--) {
          if (macdLine[j] !== null) { sum += macdLine[j]!; c++ }
        }
        prevSignal = c > 0 ? sum / c : m
        signalLine.push(prevSignal)
        histogram.push(m - prevSignal)
      }
    } else {
      prevSignal = m * k + prevSignal * (1 - k)
      signalLine.push(prevSignal)
      histogram.push(m - prevSignal)
    }
  }

  return { macd: macdLine, signal: signalLine, histogram }
}
