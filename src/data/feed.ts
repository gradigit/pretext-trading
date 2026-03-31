import type { Candle } from './types.ts'

type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

const BINANCE_REST = 'https://api.binance.com/api/v3/klines'
const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

// Fetch historical candles from Binance REST API
export async function fetchCandles(
  symbol: string,
  interval: KlineInterval,
  limit: number = 500,
): Promise<Candle[]> {
  const url = `${BINANCE_REST}?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status}`)
  const data: unknown[][] = await resp.json()

  return data.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }))
}

// Subscribe to live kline updates via WebSocket
export function subscribeKlines(
  symbol: string,
  interval: KlineInterval,
  onUpdate: (candle: Candle, isClosed: boolean) => void,
): () => void {
  const stream = `${symbol.toLowerCase()}@kline_${interval}`
  const ws = new WebSocket(`${BINANCE_WS}/${stream}`)

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    const k = msg.k
    if (!k) return
    onUpdate(
      {
        time: k.t as number,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      },
      k.x as boolean,
    )
  }

  ws.onerror = () => ws.close()

  let reconnectTimer: ReturnType<typeof setTimeout>
  ws.onclose = () => {
    reconnectTimer = setTimeout(() => {
      const unsub = subscribeKlines(symbol, interval, onUpdate)
      cleanup = unsub
    }, 3000)
  }

  let cleanup = () => {
    clearTimeout(reconnectTimer)
    ws.onclose = null
    ws.close()
  }

  return () => cleanup()
}
