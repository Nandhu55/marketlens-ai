// MarketLens Price Streamer
// Connects to Upstox V3 Market Data Feed (WebSocket) and broadcasts normalized
// live ticks to frontend clients via Socket.IO.
//
// Architecture:
//   Upstox WS (wss://api.upstox.com/v3/feed/market-data-feed)
//     → decode → normalize → validate → Socket.IO broadcast
//     → frontend clients
//
// Security: UPSTOX_ANALYTICS_TOKEN is NEVER sent to clients.

import { Server } from 'socket.io';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Configuration ──────────────────────────────────────────────────

const PORT = 3003;
const UPSTOX_WS_URL = 'wss://api.upstox.com/v3/feed/market-data-feed';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 50;
const STALE_THRESHOLD_MS = 60_000; // 60s — no tick = stale
const HEARTBEAT_INTERVAL_MS = 15_000;

// Initial symbols to subscribe to
const INITIAL_SYMBOLS = ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY'];

// ── Symbol Mapping (mirrors src/lib/market-data/symbol-mapping.ts) ──

interface SymbolEntry {
  symbol: string;
  name: string;
  exchange: string;
  instrumentKey: string;
}

const SYMBOL_MAP: Record<string, SymbolEntry> = {
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE002A01018',
  },
  TCS: {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE467B01029',
  },
  INFY: {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE009A01021',
  },
  HDFCBANK: {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE040A01034',
  },
  ICICIBANK: {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE090A01021',
  },
  SBIN: {
    symbol: 'SBIN',
    name: 'State Bank of India',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE062A01020',
  },
  WIPRO: {
    symbol: 'WIPRO',
    name: 'Wipro Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE075A01022',
  },
  ITC: {
    symbol: 'ITC',
    name: 'ITC Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE154A01025',
  },
  BHARTIARTL: {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE397D01024',
  },
  HINDUNILVR: {
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE030A01027',
  },
  KOTAKBANK: {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE237A01028',
  },
  LT: {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE018A01030',
  },
  AXISBANK: {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE238A01034',
  },
  HCLTECH: {
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE860A01027',
  },
  BAJFINANCE: {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE296A01024',
  },
  MARUTI: {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE585B01010',
  },
  ASIANPAINT: {
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE021A01026',
  },
  SUNPHARMA: {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE044A01036',
  },
  TATAMOTORS: {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE155A01022',
  },
  POWERGRID: {
    symbol: 'POWERGRID',
    name: 'Power Grid Corporation of India Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE752E01010',
  },
  ADANIENT: {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE423A01024',
  },
  TITAN: {
    symbol: 'TITAN',
    name: 'Titan Company Ltd.',
    exchange: 'NSE',
    instrumentKey: 'NSE_EQ|INE280A01028',
  },
  NIFTY: {
    symbol: 'NIFTY',
    name: 'Nifty 50',
    exchange: 'NSE',
    instrumentKey: 'NSE_INDEX|Nifty 50',
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank',
    exchange: 'NSE',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
  },
};

// ── Types ───────────────────────────────────────────────────────────

type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

type DataStatus = 'LIVE' | 'CONNECTING' | 'UNAVAILABLE';

interface NormalizedTick {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: 'upstox';
  dataStatus: DataStatus;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  marketStatus?: string;
}

interface ConnectionInfo {
  status: ConnectionStatus;
  upstoxStatus: ConnectionStatus;
  subscribedSymbols: string[];
  staleSymbols: string[];
  connectedClients: number;
  lastUpstoxConnect?: string;
  reconnectAttempt?: number;
}

// ── Token Loading ───────────────────────────────────────────────────
// NEVER logged, NEVER sent to clients

function loadToken(): string | null {
  // 1. Environment variable (highest priority)
  const envToken = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (envToken && envToken.trim() !== '' && !envToken.includes('YOUR_')) {
    return envToken.trim();
  }

  // 2. Read from project root .env.local and .env
  const paths = [
    join(__dirname, '../../.env.local'),
    join(__dirname, '../../.env'),
  ];

  for (const p of paths) {
    try {
      const content = readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed === '') continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key === 'UPSTOX_ANALYTICS_TOKEN' && val !== '' && !val.includes('YOUR_')) {
          return val;
        }
      }
    } catch {
      // File not found or not readable — continue
    }
  }

  return null;
}

// ── Utility ─────────────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && !isNaN(v) ? v : fallback;
}

function getBackoffDelay(attempt: number): number {
  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, RECONNECT_MAX_DELAY_MS);
}

// ── Upstox WebSocket Manager ────────────────────────────────────────

class UpstoxFeedManager {
  private ws: WebSocket | null = null;
  private token: string | null;
  private subscribedKeys = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;
  private lastTickTimes = new Map<string, number>();
  private onTick: (tick: NormalizedTick) => void;
  private onStatusChange: (status: ConnectionStatus) => void;
  private subscriptionGuid = 0;

  constructor(
    token: string | null,
    onTick: (tick: NormalizedTick) => void,
    onStatusChange: (status: ConnectionStatus) => void,
  ) {
    this.token = token;
    this.onTick = onTick;
    this.onStatusChange = onStatusChange;
  }

  getStatus(): ConnectionStatus {
    if (!this.ws) return 'DISCONNECTED';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'CONNECTING';
    if (this.ws.readyState === WebSocket.OPEN) return 'CONNECTED';
    return 'DISCONNECTED';
  }

  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  getLastUpstoxConnect(): string | undefined {
    return this._lastConnectTime;
  }

  private _lastConnectTime: string | undefined;

  getSubscribedSymbols(): string[] {
    const symbols: string[] = [];
    for (const key of this.subscribedKeys) {
      const entry = Object.values(SYMBOL_MAP).find((e) => e.instrumentKey === key);
      if (entry) symbols.push(entry.symbol);
    }
    return symbols;
  }

  getStaleSymbols(): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [sym, ts] of this.lastTickTimes) {
      if (now - ts > STALE_THRESHOLD_MS) {
        stale.push(sym);
      }
    }
    return stale;
  }

  subscribe(symbols: string[]): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    const keysToSubscribe: string[] = [];
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const entry = SYMBOL_MAP[upper];
      if (entry && !this.subscribedKeys.has(entry.instrumentKey)) {
        keysToSubscribe.push(entry.instrumentKey);
      }
    }

    if (keysToSubscribe.length === 0) return true;

    this.subscriptionGuid++;
    const msg = {
      guid: String(this.subscriptionGuid),
      method: 'subscribe',
      data: {
        mode: 'full',
        instrumentKeys: keysToSubscribe,
      },
    };

    try {
      this.ws.send(JSON.stringify(msg));
      for (const k of keysToSubscribe) {
        this.subscribedKeys.add(k);
      }
      console.log(`[Upstox] Subscribed: ${keysToSubscribe.join(', ')}`);
      return true;
    } catch (err) {
      console.error('[Upstox] Failed to send subscribe:', err);
      return false;
    }
  }

  unsubscribe(symbols: string[]): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    const keysToUnsub: string[] = [];
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const entry = SYMBOL_MAP[upper];
      if (entry && this.subscribedKeys.has(entry.instrumentKey)) {
        keysToUnsub.push(entry.instrumentKey);
      }
    }

    if (keysToUnsub.length === 0) return true;

    this.subscriptionGuid++;
    const msg = {
      guid: String(this.subscriptionGuid),
      method: 'unsubscribe',
      data: {
        instrumentKeys: keysToUnsub,
      },
    };

    try {
      this.ws.send(JSON.stringify(msg));
      for (const k of keysToUnsub) {
        this.subscribedKeys.delete(k);
      }
      console.log(`[Upstox] Unsubscribed: ${keysToUnsub.join(', ')}`);
      return true;
    } catch (err) {
      console.error('[Upstox] Failed to send unsubscribe:', err);
      return false;
    }
  }

  connect(): void {
    if (this.isShuttingDown) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    if (!this.token) {
      console.error('[Upstox] No UPSTOX_ANALYTICS_TOKEN configured');
      this.onStatusChange('ERROR');
      return;
    }

    this.cleanupWs();

    if (this.reconnectAttempt > 0) {
      this.onStatusChange('RECONNECTING');
    } else {
      this.onStatusChange('CONNECTING');
    }

    console.log(`[Upstox] Connecting to ${UPSTOX_WS_URL} (attempt ${this.reconnectAttempt + 1})...`);

    try {
      this.ws = new WebSocket(UPSTOX_WS_URL, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
          'Api-Version': '3',
        },
      });
    } catch (err) {
      console.error('[Upstox] WebSocket creation failed:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Upstox] Connected');
      this.reconnectAttempt = 0;
      this._lastConnectTime = new Date().toISOString();
      this.onStatusChange('CONNECTED');

      // Restore subscriptions
      if (this.subscribedKeys.size > 0) {
        this.subscriptionGuid++;
        const msg = {
          guid: String(this.subscriptionGuid),
          method: 'subscribe',
          data: {
            mode: 'full',
            instrumentKeys: [...this.subscribedKeys],
          },
        };
        this.ws!.send(JSON.stringify(msg));
        console.log(`[Upstox] Restored ${this.subscribedKeys.size} subscription(s)`);
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data));
        this.handleMessage(data);
      } catch (err) {
        console.error('[Upstox] Failed to parse message:', err);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[Upstox] Disconnected (code=${event.code}, reason=${event.reason || 'none'})`);
      this.onStatusChange('DISCONNECTED');
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event: Event) => {
      console.error('[Upstox] WebSocket error');
      this.onStatusChange('ERROR');
    };
  }

  private handleMessage(data: Record<string, unknown>): void {
    const method = String(data.method || '');

    if (method === 'feed') {
      this.handleFeed(data);
    } else if (method === 'sub') {
      console.log('[Upstox] Subscription acknowledged');
    } else if (method === 'unsub') {
      console.log('[Upstox] Unsubscription acknowledged');
    } else if (method === 'error') {
      console.error('[Upstox] Error from server:', JSON.stringify(data));
    } else {
      console.log(`[Upstox] Unknown method: ${method}`);
    }
  }

  private handleFeed(data: Record<string, unknown>): void {
    const feedData = data.data as Record<string, unknown> | undefined;
    if (!feedData) return;

    const exchangeData = feedData.exchange_data;
    if (!Array.isArray(exchangeData)) return;

    for (const item of exchangeData) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;

      const instrumentKey = String(entry.instrument_key || '');
      if (!instrumentKey) continue;

      // Find symbol for this instrument key
      const mapping = Object.values(SYMBOL_MAP).find(
        (e) => e.instrumentKey === instrumentKey,
      );
      if (!mapping) continue;

      // Extract fields
      const ltp = num(entry.last_traded_price);
      if (ltp <= 0) continue;

      const ohlc = entry.ohlc as Record<string, unknown> | undefined;
      const change = num(entry.change);
      const changePercent = num(entry.change_percent);
      const volume = num(entry.volume_traded);
      const timestamp = String(entry.timestamp || new Date().toISOString());
      const marketStatus = String(entry.market_status || 'UNKNOWN');

      const open = ohlc ? num(ohlc.open) : undefined;
      const high = ohlc ? num(ohlc.high) : undefined;
      const low = ohlc ? num(ohlc.low) : undefined;
      const close = ohlc ? num(ohlc.close) : undefined;
      const previousClose = close > 0 && change !== 0 ? close - change : undefined;

      // Update last tick time
      this.lastTickTimes.set(mapping.symbol, Date.now());

      const tick: NormalizedTick = {
        symbol: mapping.symbol,
        exchange: mapping.exchange,
        price: ltp,
        change,
        changePercent,
        volume,
        timestamp,
        source: 'upstox',
        dataStatus: 'LIVE',
        ltp,
        ...(open > 0 ? { open } : {}),
        ...(high > 0 ? { high } : {}),
        ...(low > 0 ? { low } : {}),
        ...(close > 0 ? { close } : {}),
        ...(previousClose !== undefined && previousClose > 0 ? { previousClose } : {}),
        marketStatus,
      };

      this.onTick(tick);
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[Upstox] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping.`);
      this.onStatusChange('ERROR');
      return;
    }

    const delay = getBackoffDelay(this.reconnectAttempt);
    this.reconnectAttempt++;
    console.log(`[Upstox] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cleanupWs(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'Cleanup');
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }

  shutdown(): void {
    this.isShuttingDown = true;
    console.log('[Upstox] Shutting down...');
    this.cleanupWs();
    this.onStatusChange('DISCONNECTED');
  }
}

// ── Socket.IO Server ────────────────────────────────────────────────

const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Token & Manager Setup ───────────────────────────────────────────

const token = loadToken();
if (!token) {
  console.warn('[Streamer] WARNING: UPSTOX_ANALYTICS_TOKEN not found in env or .env files');
  console.warn('[Streamer] Upstox WebSocket will NOT connect. Set the token and restart.');
} else {
  console.log('[Streamer] Upstox token loaded from environment');
}

// Latest ticks storage
const latestTicks: Record<string, NormalizedTick> = {};

let upstoxConnectionStatus: ConnectionStatus = 'DISCONNECTED';

const feedManager = new UpstoxFeedManager(
  token,
  (tick: NormalizedTick) => {
    // Store latest tick
    latestTicks[tick.symbol] = tick;
    // Broadcast to all connected Socket.IO clients
    io.emit('tick', tick);
  },
  (status: ConnectionStatus) => {
    upstoxConnectionStatus = status;
    io.emit('connection_status', { upstoxStatus: status });
    console.log(`[Streamer] Upstox status: ${status}`);
  },
);

// ── Socket.IO Event Handlers ────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[Streamer] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`);

  // Send current connection info
  socket.emit('connection_status', getConnectionInfo());

  // Send current ticks for all subscribed symbols
  const currentTicks = Object.values(latestTicks);
  if (currentTicks.length > 0) {
    socket.emit('initial_ticks', currentTicks);
  }

  // Subscribe to symbols
  socket.on('subscribe', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    const validSymbols = symbols.filter((s) => {
      const upper = s.toUpperCase();
      return upper in SYMBOL_MAP;
    });
    if (validSymbols.length === 0) return;

    console.log(`[Streamer] ${socket.id} requested subscribe: ${validSymbols.join(', ')}`);
    const success = feedManager.subscribe(validSymbols);
    socket.emit('subscribe_result', {
      symbols: validSymbols,
      success,
      subscribedSymbols: feedManager.getSubscribedSymbols(),
    });
  });

  // Unsubscribe from symbols
  socket.on('unsubscribe', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    const validSymbols = symbols.filter((s) => s.toUpperCase() in SYMBOL_MAP);
    if (validSymbols.length === 0) return;

    console.log(`[Streamer] ${socket.id} requested unsubscribe: ${validSymbols.join(', ')}`);
    feedManager.unsubscribe(validSymbols);
    socket.emit('unsubscribe_result', {
      symbols: validSymbols,
      subscribedSymbols: feedManager.getSubscribedSymbols(),
    });
  });

  // Get connection info
  socket.on('get_status', () => {
    socket.emit('connection_status', getConnectionInfo());
  });

  socket.on('disconnect', () => {
    console.log(`[Streamer] Client disconnected: ${socket.id} (total: ${io.engine.clientsCount})`);
  });
});

// ── Helper Functions ────────────────────────────────────────────────

function getConnectionInfo(): ConnectionInfo {
  return {
    status: upstoxConnectionStatus,
    upstoxStatus: upstoxConnectionStatus,
    subscribedSymbols: feedManager.getSubscribedSymbols(),
    staleSymbols: feedManager.getStaleSymbols(),
    connectedClients: io.engine.clientsCount,
    lastUpstoxConnect: feedManager.getLastUpstoxConnect(),
    reconnectAttempt: feedManager.getReconnectAttempt(),
  };
}

// ── Periodic Heartbeat ──────────────────────────────────────────────

setInterval(() => {
  const info = getConnectionInfo();
  io.emit('heartbeat', {
    timestamp: new Date().toISOString(),
    ...info,
  });
}, HEARTBEAT_INTERVAL_MS);

// ── Start Server ────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Streamer] Price streaming service running on port ${PORT}`);
  console.log(`[Streamer] Socket.IO path: /`);

  if (token) {
    // Connect to Upstox after a short delay to ensure server is ready
    setTimeout(() => {
      feedManager.connect();
      // Subscribe to initial symbols
      setTimeout(() => {
        feedManager.subscribe(INITIAL_SYMBOLS);
      }, 2000);
    }, 500);
  } else {
    console.log('[Streamer] Waiting for UPSTOX_ANALYTICS_TOKEN to be configured...');
  }
});

// ── Global Error Handling ───────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[Streamer] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Streamer] Unhandled rejection:', reason);
});

// ── Graceful Shutdown ───────────────────────────────────────────────

function shutdown() {
  console.log('[Streamer] Received shutdown signal...');
  feedManager.shutdown();
  io.close();
  httpServer.close(() => {
    console.log('[Streamer] Server closed');
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
