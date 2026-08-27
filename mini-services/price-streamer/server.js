const { Server } = require('socket.io');
const { createServer } = require('http');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');
const WebSocket = require('ws');
const protobuf = require('protobufjs');

const PORT = 3003;
const UPSTOX_WS_URL = 'wss://api.upstox.com/v3/feed/market-data-feed';
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;
const MAX_ATTEMPTS = 50;
const STALE_MS = 60000;
const HB_MS = 15000;
const INITIAL = ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY'];

const SYMBOL_MAP = {
  RELIANCE: { symbol: 'RELIANCE', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE002A01018' },
  TCS: { symbol: 'TCS', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE467B01029' },
  INFY: { symbol: 'INFY', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE009A01021' },
  HDFCBANK: { symbol: 'HDFCBANK', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE040A01034' },
  ICICIBANK: { symbol: 'ICICIBANK', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE090A01021' },
  SBIN: { symbol: 'SBIN', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE062A01020' },
  WIPRO: { symbol: 'WIPRO', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE075A01022' },
  ITC: { symbol: 'ITC', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE154A01025' },
  BHARTIARTL: { symbol: 'BHARTIARTL', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE397D01024' },
  HINDUNILVR: { symbol: 'HINDUNILVR', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE030A01027' },
  KOTAKBANK: { symbol: 'KOTAKBANK', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE237A01028' },
  LT: { symbol: 'LT', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE018A01030' },
  AXISBANK: { symbol: 'AXISBANK', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE238A01034' },
  HCLTECH: { symbol: 'HCLTECH', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE860A01027' },
  BAJFINANCE: { symbol: 'BAJFINANCE', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE296A01024' },
  MARUTI: { symbol: 'MARUTI', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE585B01010' },
  ASIANPAINT: { symbol: 'ASIANPAINT', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE021A01026' },
  SUNPHARMA: { symbol: 'SUNPHARMA', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE044A01036' },
  TATAMOTORS: { symbol: 'TATAMOTORS', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE155A01022' },
  POWERGRID: { symbol: 'POWERGRID', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE752E01010' },
  ADANIENT: { symbol: 'ADANIENT', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE423A01024' },
  TITAN: { symbol: 'TITAN', exchange: 'NSE', instrumentKey: 'NSE_EQ|INE280A01028' },
  NIFTY: { symbol: 'NIFTY', exchange: 'NSE', instrumentKey: 'NSE_INDEX|Nifty 50' },
  BANKNIFTY: { symbol: 'BANKNIFTY', exchange: 'NSE', instrumentKey: 'NSE_INDEX|Nifty Bank' },
};

// ── Token (NEVER logged) ────────────────────────────────────────
function loadToken() {
  const env = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (env && env.trim() && !env.includes('YOUR_')) return env.trim();
  for (const p of [join(__dirname, '../../.env.local'), join(__dirname, '../../.env')]) {
    try {
      for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim(); if (!t || t[0] === '#') continue;
        const i = t.indexOf('='); if (i < 0) continue;
        const k = t.substring(0, i).trim(), v = t.substring(i + 1).trim().replace(/^[\'"]|[\'"]$/g, '');
        if (k === 'UPSTOX_ANALYTICS_TOKEN' && v && !v.includes('YOUR_')) return v;
      }
    } catch {}
  }
  return null;
}

function sn(n, fb = 0) { if (n == null) return fb; if (typeof n === 'number') return isNaN(n) ? fb : n; if (typeof n === 'object' && typeof n.toNumber === 'function') { try { const v = n.toNumber(); return isNaN(v) ? fb : v; } catch { return fb; } } return fb; }

// ── HTTP + Socket.IO (start first to keep process alive) ───────
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' }, pingTimeout: 60000, pingInterval: 25000 });
const token = loadToken();
if (token) console.log('[Streamer] Token loaded'); else console.warn('[Streamer] No token');

const ticks = {};
let status = 'DISCONNECTED';

// ── Upstox Feed Manager ──────────────────────────────────────────
class FeedMgr {
  constructor(token, onTick, onStatus) {
    this.token = token; this.onTick = onTick; this.onStatus = onStatus;
    this.ws = null; this.subs = new Set(); this.pending = new Set();
    this.attempt = 0; this.timer = null; this.shuttingDown = false;
    this.lastTick = new Map(); this.seen = new Set(); this.lastConnect = undefined;
  }
  getStatus() { if (!this.ws) return 'DISCONNECTED'; if (this.ws.readyState === 1) return 'CONNECTED'; return this.ws.readyState === 0 ? 'CONNECTING' : 'DISCONNECTED'; }
  getSymbols() { const r = []; for (const k of this.subs) { const e = Object.values(SYMBOL_MAP).find(x => x.instrumentKey === k); if (e) r.push(e.symbol); } return r; }
  getStale() { const n = Date.now(), s = []; for (const [sym, ts] of this.lastTick) { if (n - ts > STALE_MS) s.push(sym); } return s; }

  subscribe(syms, mode = 'full') {
    if (!this.ws || this.ws.readyState !== 1) {
      syms.forEach(s => { const e = SYMBOL_MAP[s.toUpperCase()]; if (e) this.pending.add(e.instrumentKey); }); return false;
    }
    const keys = []; syms.forEach(s => { const e = SYMBOL_MAP[s.toUpperCase()]; if (e && !this.subs.has(e.instrumentKey)) keys.push(e.instrumentKey); });
    if (!keys.length) return true;
    this.ws.send(Buffer.from(JSON.stringify({ guid: Date.now() + '-' + Math.random().toString(36).slice(2), method: 'sub', data: { mode, instrumentKeys: keys } })));
    keys.forEach(k => { this.subs.add(k); this.pending.delete(k); });
    console.log('[Upstox] Subscribe:', keys.join(', '));
    return true;
  }

  unsubscribe(syms) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    const keys = []; syms.forEach(s => { const e = SYMBOL_MAP[s.toUpperCase()]; if (e && this.subs.has(e.instrumentKey)) keys.push(e.instrumentKey); });
    if (!keys.length) return true;
    this.ws.send(Buffer.from(JSON.stringify({ guid: Date.now() + '', method: 'unsub', data: { instrumentKeys: keys } })));
    keys.forEach(k => this.subs.delete(k));
  }

  connect() {
    if (this.shuttingDown || (this.ws && this.ws.readyState === 1)) return;
    if (!this.token) { this.onStatus('ERROR'); return; }
    if (!FeedType) { setTimeout(() => this.connect(), 1000); return; }
    this._cleanup();
    this.onStatus(this.attempt > 0 ? 'RECONNECTING' : 'CONNECTING');
    console.log('[Upstox] Connecting (attempt ' + (this.attempt + 1) + ')...');
    try {
      this.ws = new WebSocket(UPSTOX_WS_URL, { headers: { Authorization: 'Bearer ' + this.token, Accept: 'application/json', 'Api-Version': '3' }, followRedirects: true, handshakeTimeout: 15000 });
    } catch (e) { this._reconnect(); return; }
    this.ws.on('open', () => {
      console.log('[Upstox] Connected'); this.attempt = 0; this.lastConnect = new Date().toISOString(); this.onStatus('CONNECTED');
      const all = [...new Set([...this.subs, ...this.pending])];
      if (all.length) { this.ws.send(Buffer.from(JSON.stringify({ guid: Date.now() + '', method: 'sub', data: { mode: 'full', instrumentKeys: all } }))); all.forEach(k => this.subs.add(k)); this.pending.clear(); }
    });
    this.ws.on('message', data => { try { const buf = Buffer.isBuffer(data) ? data : Buffer.from(data); const d = FeedType.decode(buf); if (d.type === 2) return; const feeds = d.feeds; if (!feeds) return; for (const [ik, f] of Object.entries(feeds)) { const m = Object.values(SYMBOL_MAP).find(x => x.instrumentKey === ik); if (m) { const t = this._tick(m, f, d.type); if (t) this.onTick(t); } } } catch {} });
    this.ws.on('close', (c) => { console.log('[Upstox] Closed (' + c + ')'); this.onStatus('DISCONNECTED'); if (!this.shuttingDown) this._reconnect(); });
    this.ws.on('error', e => { console.error('[Upstox] Error:', e.message); this.onStatus('ERROR'); });
  }

  _tick(mapping, feed, type) {
    let ltp = 0, ltt = 0, cp = 0, vtt = 0, o = 0, h = 0, l = 0, c = 0, isIdx = false;
    if (feed.fullFeed) {
      if (feed.fullFeed.marketFF) {
        const m = feed.fullFeed.marketFF;
        if (m.ltpc) { ltp = sn(m.ltpc.ltp); ltt = sn(m.ltpc.ltt); cp = sn(m.ltpc.cp); }
        vtt = sn(m.vtt);
        if (m.marketOHLC?.ohlc) m.marketOHLC.ohlc.forEach(x => { if (x.interval === '1d') { o = sn(x.open); h = sn(x.high); l = sn(x.low); c = sn(x.close); } });
      } else if (feed.fullFeed.indexFF) {
        isIdx = true; const i = feed.fullFeed.indexFF;
        if (i.ltpc) { ltp = sn(i.ltpc.ltp); ltt = sn(i.ltpc.ltt); cp = sn(i.ltpc.cp); }
        if (i.marketOHLC?.ohlc) i.marketOHLC.ohlc.forEach(x => { if (x.interval === '1d') { o = sn(x.open); h = sn(x.high); l = sn(x.low); c = sn(x.close); } });
      }
    }
    if (!ltp && feed.ltpc) { ltp = sn(feed.ltpc.ltp); ltt = sn(feed.ltpc.ltt); cp = sn(feed.ltpc.cp); }
    if (ltp <= 0) return null;
    const chg = Math.round((ltp - cp) * 100) / 100;
    const pct = cp > 0 ? Math.round((chg / cp) * 10000) / 100 : 0;
    this.lastTick.set(mapping.symbol, Date.now());
    if (type === 0 && !this.seen.has(mapping.symbol)) { this.seen.add(mapping.symbol); console.log('[Upstox] Initial feed: ' + mapping.symbol + ' LTP=' + ltp + ' CP=' + cp + ' Vol=' + vtt); }
    const ts = ltt > 0 ? new Date(ltt * 1000).toISOString() : new Date().toISOString();
    const tick = { symbol: mapping.symbol, exchange: mapping.exchange, price: ltp, change: chg, changePercent: pct, volume: vtt, timestamp: ts, source: 'upstox', dataStatus: 'LIVE', ltp, marketStatus: isIdx ? 'INDEX' : 'EQUITY' };
    if (o > 0) tick.open = o; if (h > 0) tick.high = h; if (l > 0) tick.low = l; if (c > 0) tick.close = c; if (cp > 0) tick.previousClose = cp;
    return tick;
  }

  _reconnect() {
    if (this.shuttingDown) return;
    if (this.attempt >= MAX_ATTEMPTS) { this.onStatus('ERROR'); return; }
    const d = Math.min(RECONNECT_BASE * Math.pow(2, this.attempt), RECONNECT_MAX);
    this.attempt++;
    console.log('[Upstox] Reconnect in ' + d + 'ms (attempt ' + this.attempt + ')');
    this.timer = setTimeout(() => { this.timer = null; this.connect(); }, d);
  }
  _cleanup() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } if (this.ws) { this.ws.removeAllListeners(); try { if (this.ws.readyState <= 1) this.ws.close(1000); } catch {} this.ws = null; } }
  shutdown() { this.shuttingDown = true; this._cleanup(); this.onStatus('DISCONNECTED'); }
}

let FeedType = null;
const mgr = new FeedMgr(token, tick => { ticks[tick.symbol] = tick; io.emit('tick', tick); }, s => { status = s; io.emit('connection_status', { upstoxStatus: s }); console.log('[Streamer] Upstox: ' + s); });

function getInfo() { return { status, upstoxStatus: status, subscribedSymbols: mgr.getSymbols(), staleSymbols: mgr.getStale(), connectedClients: io.engine.clientsCount, lastUpstoxConnect: mgr.lastConnect, reconnectAttempt: mgr.attempt }; }

io.on('connection', sock => {
  console.log('[Streamer] Client ' + sock.id + ' (total: ' + io.engine.clientsCount + ')');
  sock.emit('connection_status', getInfo());
  const ct = Object.values(ticks); if (ct.length) sock.emit('initial_ticks', ct);
  sock.on('subscribe', syms => { if (!Array.isArray(syms)) return; const v = syms.filter(s => s.toUpperCase() in SYMBOL_MAP); if (v.length) { mgr.subscribe(v); sock.emit('subscribe_result', { symbols: v, subscribedSymbols: mgr.getSymbols() }); } });
  sock.on('unsubscribe', syms => { if (Array.isArray(syms)) mgr.unsubscribe(syms); });
  sock.on('get_status', () => sock.emit('connection_status', getInfo()));
  sock.on('disconnect', () => console.log('[Streamer] Disconnect ' + sock.id));
});

setInterval(() => io.emit('heartbeat', { timestamp: new Date().toISOString(), ...getInfo() }), HB_MS);

httpServer.listen(PORT, '0.0.0.0', () => console.log('[Streamer] Port ' + PORT + ' ready'));

protobuf.load(resolve(__dirname, './proto/MarketDataFeedV3.proto'), (err, root) => {
  if (err) { console.error('[Streamer] Proto load failed:', err); return; }
  FeedType = root.lookupType('com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse');
  console.log('[Streamer] Protobuf ready');
  if (token) { setTimeout(() => { mgr.connect(); setTimeout(() => mgr.subscribe(INITIAL), 2000); }, 500); }
});

process.on('uncaughtException', e => console.error('[Streamer] Uncaught:', e));
process.on('unhandledRejection', r => console.error('[Streamer] Rejection:', r));
function shutdown() { console.log('[Streamer] Shutting down...'); mgr.shutdown(); io.close(); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
