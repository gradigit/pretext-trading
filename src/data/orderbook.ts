export type OrderBookEntry = { price: number; quantity: number }
export type OrderBook = { bids: OrderBookEntry[]; asks: OrderBookEntry[] }

const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

// Fetch order book snapshot
export async function fetchOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${limit}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Order book fetch failed: ${resp.status}`)
  const data = await resp.json()
  return {
    bids: (data.bids as string[][]).map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
    asks: (data.asks as string[][]).map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
  }
}

// Subscribe to order book diff stream
export function subscribeOrderBook(
  symbol: string,
  onUpdate: (book: OrderBook) => void,
): () => void {
  // Use partial book depth stream (top 20 levels, 1000ms updates)
  const stream = `${symbol.toLowerCase()}@depth20@1000ms`
  const ws = new WebSocket(`${BINANCE_WS}/${stream}`)

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (!data.bids || !data.asks) return
    onUpdate({
      bids: (data.bids as string[][]).map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
      asks: (data.asks as string[][]).map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) })),
    })
  }

  ws.onerror = () => ws.close()

  let reconnectTimer: ReturnType<typeof setTimeout>
  ws.onclose = () => {
    reconnectTimer = setTimeout(() => {
      const unsub = subscribeOrderBook(symbol, onUpdate)
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
