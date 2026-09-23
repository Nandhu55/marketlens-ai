// MarketLens US Price Streamer
// Connects to Finnhub WebSocket (wss://ws.finnhub.io)
// and broadcasts normalized live ticks to frontend clients via Socket.IO.
//
// Architecture:
//   Finnhub WS (wss://ws.finnhub.io?token=KEY)
//     → parse trade data → normalize → validate → Socket.IO broadcast
//     → frontend clients (Zustand store)
//
// Security: FINNHUB_API_KEY is NEVER sent to clients.

import { Server } from 'socket.io';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WebSocket as WsLib } from 'ws';

// ── Configuration ──────────────────────────────────────────────────

const PORT = 3004;
const FINNHUB_WS_URL = 'wss://ws.finnhub.io';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 50;
const STALE_THRESHOLD_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

const INITIAL_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOG', 'META', 'AMZN'];

// ── US Symbol Map ──────────────────────────────────────────────────

interface SymbolEntry {
  symbol: string;
  name: string;
  exchange: string;
}

const SYMBOL_MAP: Record<string, SymbolEntry> = {
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  MSFT: { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ' },
  TSLA: { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ' },
  GOOG: { symbol: 'GOOG', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  META: { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
  AMZN: { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  JPM: { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  V: { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  WMT: { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  JNJ: { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
  MA: { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
  PG: { symbol: 'PG', name: 'Procter & Gamble', exchange: 'NYSE' },
  UNH: { symbol: 'UNH', name: 'UnitedHealth Group', exchange: 'NYSE' },
  HD: { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE' },
  DIS: { symbol: 'DIS', name: 'Walt Disney Co.', exchange: 'NYSE' },
  NFLX: { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
};

// ── Types ───────────────────────────────────────────────────────────

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';
type DataStatus = 'LIVE' | 'CONNECTING' | 'UNAVAILABLE';

interface NormalizedTick {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: 'finnhub';
  dataStatus: DataStatus;
  ltp?: number;
}

interface ConnectionInfo {
  status: ConnectionStatus;
  finnhubStatus: ConnectionStatus;
  subscribedSymbols: string[];
  staleSymbols: string[];
  connectedClients: number;
  lastFinnhubConnect?: string;
  reconnectAttempt?: number;
}

// ── Token Loading (server-side only, NEVER logged) ──────────────────

function loadApiKey(): string | null {
  const envKey = process.env.FINNHUB_API_KEY;
  if (envKey && envKey.trim() !== '' && !envKey.includes('YOUR_')) return envKey.trim();
  for (const p of [join(__dirname, '../../.env.local'), join(__dirname, '../../.env')]) {
    try {
      const content = readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed === '') continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'FINNHUB_API_KEY' && val && !val.includes('YOUR_')) return val;
      }
    } catch { /* not found */ }
  }
  return null;
}

// ── Utility ─────────────────────────────────────────────────────────

function safeNum(n: unknown, fallback = 0): number {
  if (n == null) return fallback;
  if (typeof n === 'number') return isNaN(n) ? fallback : n;
  return fallback;
}

function getBackoffDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
}

// ── Finnhub Feed Manager ─────────────────────────────────────────────

class FinnhubFeedManager {
  private ws: WsLib | null = null;
  private apiKey: string | null;
  private subscribedSymbols = new Set<string>();
  private pendingSymbols = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;
  private lastTickTimes = new Map<string, number>();
  // Track previous close prices for computing change/changePercent
  private previousCloses = new Map<string, number>();
  private _lastConnectTime: string | undefined;
  private onTick: (tick: NormalizedTick) => void;
  private onStatusChange: (status: ConnectionStatus) => void;

  constructor(
    apiKey: string | null,
    onTick: (tick: NormalizedTick) => void,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.apiKey = apiKey;
    this.onTick = onTick;
    this.onStatusChange = onStatusChange;
  }

  getStatus(): ConnectionStatus {
    if (!this.ws) return 'DISCONNECTED';
    if (this.ws.readyState === WsLib.CONNECTING) return 'CONNECTING';
    if (this.ws.readyState === WsLib.OPEN) return 'CONNECTED';
    return 'DISCONNECTED';
  }
  getReconnectAttempt() { return this.reconnectAttempt; }
  getLastFinnhubConnect() { return this._lastConnectTime; }

  getSubscribedSymbols(): string[] {
    return [...this.subscribedSymbols];
  }

  getStaleSymbols(): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [sym, ts] of this.lastTickTimes) {
      if (now - ts > STALE_THRESHOLD_MS) stale.push(sym);
    }
    return stale;
  }

  /** Set previous close price (for computing change from trade price) */
  setPreviousClose(symbol: string, prevClose: number): void {
    this.previousCloses.set(symbol, prevClose);
  }

  subscribe(symbols: string[]): boolean {
    // Queue symbols regardless of connection state
    for (const s of symbols) {
      const upper = s.toUpperCase();
      if (upper in SYMBOL_MAP) {
        this.pendingSymbols.add(upper);
      }
    }

    if (!this.ws || this.ws.readyState !== WsLib.OPEN) {
      return false;
    }

    const toSubscribe = [...this.pendingSymbols].filter(s => !this.subscribedSymbols.has(s));
    if (toSubscribe.length === 0) return true;

    for (const symbol of toSubscribe) {
      try {
        this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        this.subscribedSymbols.add(symbol);
        this.pendingSymbols.delete(symbol);
        console.log(`[Finnhub] Subscribed: ${symbol}`);
      } catch (err) {
        console.error(`[Finnhub] Subscribe failed for ${symbol}:`, err);
      }
    }
    return true;
  }

  unsubscribe(symbols: string[]): boolean {
    if (!this.ws || this.ws.readyState !== WsLib.OPEN) return false;

    for (const s of symbols) {
      const upper = s.toUpperCase();
      if (this.subscribedSymbols.has(upper)) {
        try {
          this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol: upper }));
          this.subscribedSymbols.delete(upper);
          console.log(`[Finnhub] Unsubscribed: ${upper}`);
        } catch (err) {
          console.error(`[Finnhub] Unsubscribe failed for ${upper}:`, err);
        }
      }
    }
    return true;
  }

  connect(): void {
    if (this.isShuttingDown || (this.ws && this.ws.readyState === WsLib.OPEN)) return;
    if (!this.apiKey) {
      this.onStatusChange('ERROR');
      return;
    }

    this.cleanup();
    this.onStatusChange(this.reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');
    console.log(`[Finnhub] Connecting (attempt ${this.reconnectAttempt + 1})...`);

    try {
      this.ws = new WsLib(`${FINNHUB_WS_URL}?token=${this.apiKey}`, {
        handshakeTimeout: 15000,
      });
    } catch (err) {
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[Finnhub] Connected to WebSocket');
      this.reconnectAttempt = 0;
      this._lastConnectTime = new Date().toISOString();
      this.onStatusChange('CONNECTED');

      // Restore subscriptions
      const toRestore = [...this.subscribedSymbols, ...this.pendingSymbols];
      if (toRestore.length > 0) {
        for (const symbol of [...new Set(toRestore)]) {
          try {
            this.ws!.send(JSON.stringify({ type: 'subscribe', symbol }));
            this.subscribedSymbols.add(symbol);
            this.pendingSymbols.delete(symbol);
          } catch (err) {
            console.error(`[Finnhub] Re-subscribe failed for ${symbol}:`, err);
          }
        }
        console.log(`[Finnhub] Restored ${toRestore.length} subscription(s)`);
      }
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        this.processMessage(text);
      } catch (err) {
        // skip malformed
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[Finnhub] Disconnected (code=${code})`);
      this.onStatusChange('DISCONNECTED');
      if (!this.isShuttingDown) this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      console.error(`[Finnhub] Error: ${err.message}`);
      this.onStatusChange('ERROR');
    });
  }

  private processMessage(text: string): void {
    const msg = JSON.parse(text) as Record<string, unknown>;

    // Finnhub sends trade events
    if (msg.type === 'trade') {
      const dataArray = Array.isArray(msg.data) ? msg.data : [];
      for (const trade of dataArray) {
        const t = trade as Record<string, unknown>;
        const symbol = String(t.s || '');
        const price = safeNum(t.p);
        const timestamp = safeNum(t.t);
        const volume = safeNum(t.v, 1);

        if (!symbol || price <= 0) continue;

        const mapping = SYMBOL_MAP[symbol];
        if (!mapping) continue;

        // Compute change and changePercent from previous close if available
        const prevClose = this.previousCloses.get(symbol);
        const change = prevClose && prevClose > 0 ? Math.round((price - prevClose) * 100) / 100 : 0;
        const changePercent = prevClose && prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0;

        this.lastTickTimes.set(symbol, Date.now());

        const tickTs = timestamp > 0 ? new Date(timestamp).toISOString() : new Date().toISOString();

        const tick: NormalizedTick = {
          symbol,
          exchange: mapping.exchange,
          price,
          change,
          changePercent,
          volume,
          timestamp: tickTs,
          source: 'finnhub',
          dataStatus: 'LIVE',
          ltp: price,
        };

        this.onTick(tick);
      }
    }

    // Finnhub sends ping/heartbeat
    if (msg.type === 'ping') {
      // No action needed
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatusChange('ERROR');
      return;
    }
    const delay = getBackoffDelay(this.reconnectAttempt);
    this.reconnectAttempt++;
    console.log(`[Finnhub] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      try {
        if (this.ws.readyState <= 1) this.ws.close(1000);
      } catch {}
      this.ws = null;
    }
  }

  shutdown(): void {
    this.isShuttingDown = true;
    this.cleanup();
    this.onStatusChange('DISCONNECTED');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Start Socket.IO server FIRST (keeps Node process alive)
// ═══════════════════════════════════════════════════════════════════

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Token & Manager ─────────────────────────────────────────────────

const apiKey = loadApiKey();
if (apiKey) {
  console.log('[US-Streamer] Finnhub API key loaded');
} else {
  console.warn('[US-Streamer] No FINNHUB_API_KEY found');
}

const latestTicks: Record<string, NormalizedTick> = {};
let finnhubStatus: ConnectionStatus = 'DISCONNECTED';

const feedManager = new FinnhubFeedManager(
  apiKey,
  (tick) => {
    latestTicks[tick.symbol] = tick;
    io.emit('tick', tick);
  },
  (status) => {
    finnhubStatus = status;
    io.emit('connection_status', { finnhubStatus: status });
    console.log(`[US-Streamer] Finnhub status: ${status}`);
  }
);

// ── Fetch previous close prices for accurate change computation ─────
// On startup, fetch quote data from Finnhub REST API to populate previousCloses

async function fetchPreviousCloses(): Promise<void> {
  if (!apiKey) return;

  for (const symbol of INITIAL_SYMBOLS) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json() as Record<string, unknown>;
        const prevClose = safeNum(data.pc);
        if (prevClose > 0) {
          feedManager.setPreviousClose(symbol, prevClose);
          console.log(`[US-Streamer] ${symbol} previousClose=${prevClose}`);
        }
      }
    } catch {
      // Skip on error — change will be 0 until we get data
    }
    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 1100));
  }
}

function getConnectionInfo(): ConnectionInfo {
  return {
    status: finnhubStatus,
    finnhubStatus,
    subscribedSymbols: feedManager.getSubscribedSymbols(),
    staleSymbols: feedManager.getStaleSymbols(),
    connectedClients: io.engine.clientsCount,
    lastFinnhubConnect: feedManager.getLastFinnhubConnect(),
    reconnectAttempt: feedManager.getReconnectAttempt(),
  };
}

// ── Socket.IO Events ────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[US-Streamer] Client ${socket.id} connected (total: ${io.engine.clientsCount})`);
  socket.emit('connection_status', getConnectionInfo());
  const ticks = Object.values(latestTicks);
  if (ticks.length > 0) socket.emit('initial_ticks', ticks);

  socket.on('subscribe', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    const valid = symbols.filter(s => s.toUpperCase() in SYMBOL_MAP);
    if (valid.length === 0) return;
    console.log(`[US-Streamer] ${socket.id} subscribe: ${valid.join(', ')}`);
    feedManager.subscribe(valid);
    socket.emit('subscribe_result', {
      symbols: valid,
      subscribedSymbols: feedManager.getSubscribedSymbols(),
    });
  });

  socket.on('unsubscribe', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    feedManager.unsubscribe(symbols.filter(s => s.toUpperCase() in SYMBOL_MAP));
  });

  socket.on('get_status', () => socket.emit('connection_status', getConnectionInfo()));
  socket.on('disconnect', () =>
    console.log(`[US-Streamer] Client ${socket.id} disconnected (total: ${io.engine.clientsCount})`)
  );
});

// ── Heartbeat ────────────────────────────────────────────────────────

setInterval(
  () => io.emit('heartbeat', { timestamp: new Date().toISOString(), ...getConnectionInfo() }),
  HEARTBEAT_INTERVAL_MS
);

// ── Start HTTP Server ───────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[US-Streamer] US price streaming service on port ${PORT}`);
});

// ── Connect Finnhub WebSocket ───────────────────────────────────────

if (apiKey) {
  // Fetch previous closes first, then connect WebSocket
  fetchPreviousCloses().then(() => {
    feedManager.connect();
    setTimeout(() => feedManager.subscribe(INITIAL_SYMBOLS), 2000);
  });
}

// ── Error Handling ──────────────────────────────────────────────────

process.on('uncaughtException', (err) => console.error('[US-Streamer] Uncaught:', err));
process.on('unhandledRejection', (r) => console.error('[US-Streamer] Unhandled rejection:', r));

function shutdown() {
  console.log('[US-Streamer] Shutting down...');
  feedManager.shutdown();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
