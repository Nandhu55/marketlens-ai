"use strict";
// MarketLens Price Streamer
// Connects to Upstox V3 Market Data Feed (WebSocket, protobuf binary)
// and broadcasts normalized live ticks to frontend clients via Socket.IO.
//
// Architecture:
//   Upstox WS (wss://api.upstox.com/v3/feed/market-data-feed)
//     → protobuf decode → normalize → validate → Socket.IO broadcast
//     → frontend clients (Zustand store)
//
// Security: UPSTOX_ANALYTICS_TOKEN is NEVER sent to clients.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const ws_1 = require("ws");
const protobufjs_1 = __importDefault(require("protobufjs"));
// ── Configuration ──────────────────────────────────────────────────
const PORT = 3003;
const UPSTOX_WS_URL = 'wss://api.upstox.com/v3/feed/market-data-feed';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 50;
const STALE_THRESHOLD_MS = 60000;
const HEARTBEAT_INTERVAL_MS = 15000;
const INITIAL_SYMBOLS = ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY'];
const SYMBOL_MAP = {
    RELIANCE: { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE002A01018' },
    TCS: { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE467B01029' },
    INFY: { symbol: 'INFY', name: 'Infosys Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE009A01021' },
    HDFCBANK: { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE040A01034' },
    ICICIBANK: { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE090A01021' },
    SBIN: { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE062A01020' },
    WIPRO: { symbol: 'WIPRO', name: 'Wipro Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE075A01022' },
    ITC: { symbol: 'ITC', name: 'ITC Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE154A01025' },
    BHARTIARTL: { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE397D01024' },
    HINDUNILVR: { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE030A01027' },
    KOTAKBANK: { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE237A01028' },
    LT: { symbol: 'LT', name: 'Larsen & Toubro Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE018A01030' },
    AXISBANK: { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE238A01034' },
    HCLTECH: { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE860A01027' },
    BAJFINANCE: { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE296A01024' },
    MARUTI: { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE585B01010' },
    ASIANPAINT: { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE021A01026' },
    SUNPHARMA: { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE044A01036' },
    TATAMOTORS: { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE155A01022' },
    POWERGRID: { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE752E01010' },
    ADANIENT: { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE423A01024' },
    TITAN: { symbol: 'TITAN', name: 'Titan Company Ltd.', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE280A01028' },
    NIFTY: { symbol: 'NIFTY', name: 'Nifty 50', exchange: 'NSE', instrumentKey: 'NSE_INDEX|Nifty 50' },
    BANKNIFTY: { symbol: 'BANKNIFTY', name: 'Nifty Bank', exchange: 'NSE', instrumentKey: 'NSE_INDEX|Nifty Bank' },
};
const MARKET_STATUS_MAP = {
    0: 'PRE_OPEN', 1: 'PRE_OPEN_END', 2: 'OPEN', 3: 'CLOSE', 4: 'CLOSING', 5: 'CLOSING_END',
};
// ── Token Loading (server-side only, NEVER logged) ──────────────────
function loadToken() {
    const envToken = process.env.UPSTOX_ANALYTICS_TOKEN;
    if (envToken && envToken.trim() !== '' && !envToken.includes('YOUR_'))
        return envToken.trim();
    for (const p of [(0, path_1.join)(__dirname, '../../.env.local'), (0, path_1.join)(__dirname, '../../.env')]) {
        try {
            const content = (0, fs_1.readFileSync)(p, 'utf-8');
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (trimmed.startsWith('#') || trimmed === '')
                    continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx < 0)
                    continue;
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim().replace(/^[\'"]|[\'"]$/g, '');
                if (key === 'UPSTOX_ANALYTICS_TOKEN' && val && !val.includes('YOUR_'))
                    return val;
            }
        }
        catch { /* not found */ }
    }
    return null;
}
// ── Utility ─────────────────────────────────────────────────────────
function safeNum(n, fallback = 0) {
    if (n == null)
        return fallback;
    if (typeof n === 'number')
        return isNaN(n) ? fallback : n;
    if (typeof n === 'object' && typeof n.toNumber === 'function') {
        try {
            const v = n.toNumber();
            return isNaN(v) ? fallback : v;
        }
        catch {
            return fallback;
        }
    }
    return fallback;
}
function getBackoffDelay(attempt) {
    return Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
}
function generateGuid() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}
// ── Protobuf globals ────────────────────────────────────────────────
let FeedResponseType = null;
// ── Upstox Feed Manager ─────────────────────────────────────────────
class UpstoxFeedManager {
    constructor(token, onTick, onStatusChange) {
        this.ws = null;
        this.subscribedKeys = new Set();
        this.pendingKeys = new Set();
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.isShuttingDown = false;
        this.lastTickTimes = new Map();
        this.initialFeedSeen = new Set();
        this.token = token;
        this.onTick = onTick;
        this.onStatusChange = onStatusChange;
    }
    getStatus() {
        if (!this.ws)
            return 'DISCONNECTED';
        if (this.ws.readyState === ws_1.WebSocket.CONNECTING)
            return 'CONNECTING';
        if (this.ws.readyState === ws_1.WebSocket.OPEN)
            return 'CONNECTED';
        return 'DISCONNECTED';
    }
    getReconnectAttempt() { return this.reconnectAttempt; }
    getLastUpstoxConnect() { return this._lastConnectTime; }
    getSubscribedSymbols() {
        const result = [];
        for (const key of this.subscribedKeys) {
            const entry = Object.values(SYMBOL_MAP).find(e => e.instrumentKey === key);
            if (entry)
                result.push(entry.symbol);
        }
        return result;
    }
    getStaleSymbols() {
        const now = Date.now();
        const stale = [];
        for (const [sym, ts] of this.lastTickTimes) {
            if (now - ts > STALE_THRESHOLD_MS)
                stale.push(sym);
        }
        return stale;
    }
    subscribe(symbols, mode = 'full') {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN) {
            for (const s of symbols) {
                const e = SYMBOL_MAP[s.toUpperCase()];
                if (e)
                    this.pendingKeys.add(e.instrumentKey);
            }
            return false;
        }
        const keys = [];
        for (const s of symbols) {
            const e = SYMBOL_MAP[s.toUpperCase()];
            if (e && !this.subscribedKeys.has(e.instrumentKey))
                keys.push(e.instrumentKey);
        }
        if (keys.length === 0)
            return true;
        try {
            this.ws.send(Buffer.from(JSON.stringify({ guid: generateGuid(), method: 'sub', data: { mode, instrumentKeys: keys } })));
            keys.forEach(k => { this.subscribedKeys.add(k); this.pendingKeys.delete(k); });
            console.log(`[Upstox] Subscribe sent: ${keys.join(', ')}`);
            return true;
        }
        catch (err) {
            console.error('[Upstox] Subscribe failed:', err);
            return false;
        }
    }
    unsubscribe(symbols) {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN)
            return false;
        const keys = [];
        for (const s of symbols) {
            const e = SYMBOL_MAP[s.toUpperCase()];
            if (e && this.subscribedKeys.has(e.instrumentKey))
                keys.push(e.instrumentKey);
        }
        if (keys.length === 0)
            return true;
        try {
            this.ws.send(Buffer.from(JSON.stringify({ guid: generateGuid(), method: 'unsub', data: { instrumentKeys: keys } })));
            keys.forEach(k => this.subscribedKeys.delete(k));
            console.log(`[Upstox] Unsubscribe sent: ${keys.join(', ')}`);
            return true;
        }
        catch (err) {
            console.error('[Upstox] Unsubscribe failed:', err);
            return false;
        }
    }
    connect() {
        if (this.isShuttingDown || (this.ws && this.ws.readyState === ws_1.WebSocket.OPEN))
            return;
        if (!this.token) {
            this.onStatusChange('ERROR');
            return;
        }
        if (!FeedResponseType) {
            setTimeout(() => this.connect(), 1000);
            return;
        }
        this.cleanup();
        this.onStatusChange(this.reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');
        console.log(`[Upstox] Connecting (attempt ${this.reconnectAttempt + 1})...`);
        try {
            this.ws = new ws_1.WebSocket(UPSTOX_WS_URL, {
                headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json', 'Api-Version': '3' },
                followRedirects: true, handshakeTimeout: 15000,
            });
        }
        catch (err) {
            this.scheduleReconnect();
            return;
        }
        this.ws.on('open', () => {
            console.log('[Upstox] Connected to feed');
            this.reconnectAttempt = 0;
            this._lastConnectTime = new Date().toISOString();
            this.onStatusChange('CONNECTED');
            // Restore subscriptions
            const toRestore = [...this.subscribedKeys, ...this.pendingKeys];
            if (toRestore.length > 0) {
                this.ws.send(Buffer.from(JSON.stringify({ guid: generateGuid(), method: 'sub', data: { mode: 'full', instrumentKeys: [...new Set(toRestore)] } })));
                toRestore.forEach(k => this.subscribedKeys.add(k));
                this.pendingKeys.clear();
                console.log(`[Upstox] Restored ${toRestore.length} subscription(s)`);
            }
        });
        this.ws.on('message', (data) => {
            try {
                this.decodeAndProcess(Buffer.isBuffer(data) ? data : Buffer.from(data));
            }
            catch (err) { /* skip malformed */ }
        });
        this.ws.on('close', (code, reason) => {
            console.log(`[Upstox] Disconnected (code=${code})`);
            this.onStatusChange('DISCONNECTED');
            if (!this.isShuttingDown)
                this.scheduleReconnect();
        });
        this.ws.on('error', (err) => { console.error(`[Upstox] Error: ${err.message}`); this.onStatusChange('ERROR'); });
    }
    decodeAndProcess(buf) {
        if (!FeedResponseType)
            return;
        const decoded = FeedResponseType.decode(buf);
        if (decoded.type === 2) { /* market_info */
            return;
        }
        const feeds = decoded.feeds;
        if (!feeds)
            return;
        for (const [instrumentKey, feed] of Object.entries(feeds)) {
            const mapping = Object.values(SYMBOL_MAP).find(e => e.instrumentKey === instrumentKey);
            if (!mapping)
                continue;
            const tick = this.extractTick(mapping, feed, decoded.type);
            if (tick)
                this.onTick(tick);
        }
    }
    extractTick(mapping, feed, feedType) {
        let ltp = 0, ltt = 0, cp = 0, vtt = 0, open = 0, high = 0, low = 0, close = 0, isIndex = false;
        if (feed.fullFeed) {
            if (feed.fullFeed.marketFF) {
                const m = feed.fullFeed.marketFF;
                if (m.ltpc) {
                    ltp = safeNum(m.ltpc.ltp);
                    ltt = safeNum(m.ltpc.ltt);
                    cp = safeNum(m.ltpc.cp);
                }
                vtt = safeNum(m.vtt);
                if (m.marketOHLC?.ohlc)
                    for (const o of m.marketOHLC.ohlc) {
                        if (o.interval === '1d') {
                            open = safeNum(o.open);
                            high = safeNum(o.high);
                            low = safeNum(o.low);
                            close = safeNum(o.close);
                        }
                    }
            }
            else if (feed.fullFeed.indexFF) {
                isIndex = true;
                const i = feed.fullFeed.indexFF;
                if (i.ltpc) {
                    ltp = safeNum(i.ltpc.ltp);
                    ltt = safeNum(i.ltpc.ltt);
                    cp = safeNum(i.ltpc.cp);
                }
                if (i.marketOHLC?.ohlc)
                    for (const o of i.marketOHLC.ohlc) {
                        if (o.interval === '1d') {
                            open = safeNum(o.open);
                            high = safeNum(o.high);
                            low = safeNum(o.low);
                            close = safeNum(o.close);
                        }
                    }
            }
        }
        if (!ltp && feed.ltpc) {
            ltp = safeNum(feed.ltpc.ltp);
            ltt = safeNum(feed.ltpc.ltt);
            cp = safeNum(feed.ltpc.cp);
        }
        if (ltp <= 0)
            return null;
        const prevClose = cp > 0 ? cp : 0;
        const change = Math.round((ltp - prevClose) * 100) / 100;
        const changePercent = prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0;
        this.lastTickTimes.set(mapping.symbol, Date.now());
        if (feedType === 0 && !this.initialFeedSeen.has(mapping.symbol)) {
            this.initialFeedSeen.add(mapping.symbol);
            console.log(`[Upstox] Initial feed: ${mapping.symbol} LTP=${ltp} CP=${cp} Vol=${vtt}`);
        }
        const tickTs = ltt > 0 ? new Date(ltt * 1000).toISOString() : new Date().toISOString();
        return {
            symbol: mapping.symbol, exchange: mapping.exchange, price: ltp, change, changePercent, volume: vtt,
            timestamp: tickTs, source: 'upstox', dataStatus: 'LIVE', ltp,
            ...(open > 0 ? { open } : {}), ...(high > 0 ? { high } : {}), ...(low > 0 ? { low } : {}),
            ...(close > 0 ? { close } : {}), ...(prevClose > 0 ? { previousClose: prevClose } : {}),
            marketStatus: isIndex ? 'INDEX' : 'EQUITY',
        };
    }
    scheduleReconnect() {
        if (this.isShuttingDown)
            return;
        if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
            this.onStatusChange('ERROR');
            return;
        }
        const delay = getBackoffDelay(this.reconnectAttempt);
        this.reconnectAttempt++;
        console.log(`[Upstox] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`);
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, delay);
    }
    cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            try {
                if (this.ws.readyState <= 1)
                    this.ws.close(1000);
            }
            catch { }
            this.ws = null;
        }
    }
    shutdown() { this.isShuttingDown = true; this.cleanup(); this.onStatusChange('DISCONNECTED'); }
}
// ═══════════════════════════════════════════════════════════════════
// Start Socket.IO server FIRST (keeps Node process alive)
// ═══════════════════════════════════════════════════════════════════
const httpServer = (0, http_1.createServer)();
const io = new socket_io_1.Server(httpServer, { cors: { origin: '*' }, pingTimeout: 60000, pingInterval: 25000 });
// ── Token & Manager ─────────────────────────────────────────────────
const token = loadToken();
if (token)
    console.log('[Streamer] Upstox token loaded');
else
    console.warn('[Streamer] No UPSTOX_ANALYTICS_TOKEN found');
const latestTicks = {};
let upstoxStatus = 'DISCONNECTED';
const feedManager = new UpstoxFeedManager(token, (tick) => { latestTicks[tick.symbol] = tick; io.emit('tick', tick); }, (status) => { upstoxStatus = status; io.emit('connection_status', { upstoxStatus: status }); console.log(`[Streamer] Upstox status: ${status}`); });
function getConnectionInfo() {
    return { status: upstoxStatus, upstoxStatus, subscribedSymbols: feedManager.getSubscribedSymbols(), staleSymbols: feedManager.getStaleSymbols(), connectedClients: io.engine.clientsCount, lastUpstoxConnect: feedManager.getLastUpstoxConnect(), reconnectAttempt: feedManager.getReconnectAttempt() };
}
// ── Socket.IO Events ────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[Streamer] Client ${socket.id} connected (total: ${io.engine.clientsCount})`);
    socket.emit('connection_status', getConnectionInfo());
    const ticks = Object.values(latestTicks);
    if (ticks.length > 0)
        socket.emit('initial_ticks', ticks);
    socket.on('subscribe', (symbols) => {
        if (!Array.isArray(symbols))
            return;
        const valid = symbols.filter(s => s.toUpperCase() in SYMBOL_MAP);
        if (valid.length === 0)
            return;
        console.log(`[Streamer] ${socket.id} subscribe: ${valid.join(', ')}`);
        feedManager.subscribe(valid);
        socket.emit('subscribe_result', { symbols: valid, subscribedSymbols: feedManager.getSubscribedSymbols() });
    });
    socket.on('unsubscribe', (symbols) => {
        if (!Array.isArray(symbols))
            return;
        feedManager.unsubscribe(symbols.filter(s => s.toUpperCase() in SYMBOL_MAP));
    });
    socket.on('get_status', () => socket.emit('connection_status', getConnectionInfo()));
    socket.on('disconnect', () => console.log(`[Streamer] Client ${socket.id} disconnected (total: ${io.engine.clientsCount})`));
});
// ── Heartbeat ────────────────────────────────────────────────────────
setInterval(() => io.emit('heartbeat', { timestamp: new Date().toISOString(), ...getConnectionInfo() }), HEARTBEAT_INTERVAL_MS);
// ── Start HTTP Server ───────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`[Streamer] Price streaming service on port ${PORT}`);
});
// ── Load Protobuf & Connect ─────────────────────────────────────────
protobufjs_1.default.load((0, path_1.resolve)(__dirname, './proto/MarketDataFeedV3.proto'), (error, root) => {
    if (error) {
        console.error('[Streamer] FATAL: protobuf load failed:', error);
        return;
    }
    FeedResponseType = root.lookupType('com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse');
    console.log('[Streamer] Protobuf ready');
    if (token) {
        setTimeout(() => { feedManager.connect(); setTimeout(() => feedManager.subscribe(INITIAL_SYMBOLS), 2000); }, 500);
    }
});
// ── Error Handling ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => console.error('[Streamer] Uncaught:', err));
process.on('unhandledRejection', (r) => console.error('[Streamer] Unhandled rejection:', r));
function shutdown() { console.log('[Streamer] Shutting down...'); feedManager.shutdown(); io.close(); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
