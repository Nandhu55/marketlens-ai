'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import type { LiveTick, WsConnectionStatus, WsConnectionInfo } from '@/lib/store';

// ── Singleton Socket.IO Connections ─────────────────────────────────
// TWO connections: one to price-streamer (India/Upstox, port 3003),
// one to us-streamer (US/Finnhub, port 3004).
// Each hook ref-counts mounts: first mount creates, last would
// destroy (but we keep alive for the app lifetime).

const INDIA_STREAMER_PORT = 3003;
const US_STREAMER_PORT = 3004;
const INDIA_STREAMER_URL = `/?XTransformPort=${INDIA_STREAMER_PORT}`;
const US_STREAMER_URL = `/?XTransformPort=${US_STREAMER_PORT}`;

// ── India (Upstox) Socket ──────────────────────────────────────────

let indiaSocket: Socket | null = null;
let indiaMountCount = 0;
let staleCheckInterval: ReturnType<typeof setInterval> | null = null;

function createIndiaSocket(): Socket {
  if (indiaSocket) return indiaSocket;

  const socket = io(INDIA_STREAMER_URL, {
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  indiaSocket = socket;

  socket.on('connect', () => {
    console.log('[LiveMarket-India] Socket.IO connected to price-streamer');
    useAppStore.getState().setWsConnectionStatus('CONNECTING');
    socket.emit('get_status');
  });

  socket.on('disconnect', (reason) => {
    console.log(`[LiveMarket-India] Socket.IO disconnected: ${reason}`);
    useAppStore.getState().setWsConnectionStatus('DISCONNECTED');
  });

  socket.on('connect_error', (err) => {
    console.warn('[LiveMarket-India] Socket.IO connection error:', err.message);
    useAppStore.getState().setWsConnectionStatus('ERROR');
  });

  socket.on('tick', (tick: LiveTick) => {
    if (!tick || !tick.symbol || typeof tick.price !== 'number' || tick.price <= 0) return;
    useAppStore.getState().updateLiveTick(tick);
  });

  socket.on('initial_ticks', (ticks: LiveTick[]) => {
    if (!Array.isArray(ticks)) return;
    for (const tick of ticks) {
      if (tick && tick.symbol && typeof tick.price === 'number' && tick.price > 0) {
        useAppStore.getState().updateLiveTick(tick);
      }
    }
  });

  socket.on('connection_status', (info: WsConnectionInfo) => {
    if (info.upstoxStatus) {
      useAppStore.getState().setWsConnectionStatus(info.upstoxStatus);
    }
    if (info.subscribedSymbols) {
      useAppStore.getState().setSubscribedWsSymbols(info.subscribedSymbols);
    }
    if (info.staleSymbols) {
      useAppStore.getState().setStaleSymbols(info.staleSymbols);
    }
  });

  socket.on('heartbeat', (info: WsConnectionInfo) => {
    if (info.upstoxStatus) {
      useAppStore.getState().setWsConnectionStatus(info.upstoxStatus);
    }
    if (info.subscribedSymbols) {
      useAppStore.getState().setSubscribedWsSymbols(info.subscribedSymbols);
    }
    if (info.staleSymbols) {
      useAppStore.getState().setStaleSymbols(info.staleSymbols);
    }
  });

  return socket;
}

// ── US (Finnhub) Socket ────────────────────────────────────────────

let usSocket: Socket | null = null;
let usMountCount = 0;

function createUSSocket(): Socket {
  if (usSocket) return usSocket;

  const socket = io(US_STREAMER_URL, {
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  usSocket = socket;

  socket.on('connect', () => {
    console.log('[LiveMarket-US] Socket.IO connected to us-streamer');
    useAppStore.getState().setUsWsConnectionStatus('CONNECTING');
    socket.emit('get_status');
  });

  socket.on('disconnect', (reason) => {
    console.log(`[LiveMarket-US] Socket.IO disconnected: ${reason}`);
    useAppStore.getState().setUsWsConnectionStatus('DISCONNECTED');
  });

  socket.on('connect_error', (err) => {
    console.warn('[LiveMarket-US] Socket.IO connection error:', err.message);
    useAppStore.getState().setUsWsConnectionStatus('ERROR');
  });

  socket.on('tick', (tick: LiveTick) => {
    if (!tick || !tick.symbol || typeof tick.price !== 'number' || tick.price <= 0) return;
    useAppStore.getState().updateLiveTick(tick);
  });

  socket.on('initial_ticks', (ticks: LiveTick[]) => {
    if (!Array.isArray(ticks)) return;
    for (const tick of ticks) {
      if (tick && tick.symbol && typeof tick.price === 'number' && tick.price > 0) {
        useAppStore.getState().updateLiveTick(tick);
      }
    }
  });

  socket.on('connection_status', (info: WsConnectionInfo) => {
    if (info.finnhubStatus) {
      useAppStore.getState().setUsWsConnectionStatus(info.finnhubStatus);
    }
    if (info.subscribedSymbols) {
      useAppStore.getState().setSubscribedWsSymbols(info.subscribedSymbols);
    }
    if (info.staleSymbols) {
      useAppStore.getState().setStaleSymbols(info.staleSymbols);
    }
  });

  socket.on('heartbeat', (info: WsConnectionInfo) => {
    if (info.finnhubStatus) {
      useAppStore.getState().setUsWsConnectionStatus(info.finnhubStatus);
    }
    if (info.subscribedSymbols) {
      useAppStore.getState().setSubscribedWsSymbols(info.subscribedSymbols);
    }
    if (info.staleSymbols) {
      useAppStore.getState().setStaleSymbols(info.staleSymbols);
    }
  });

  return socket;
}

// ── Stale Data Checker ──────────────────────────────────────────────
// If a tick is older than 60s, mark it as stale in the store.

function startStaleChecker() {
  if (staleCheckInterval) return;
  staleCheckInterval = setInterval(() => {
    const { liveTicks, setStaleSymbols } = useAppStore.getState();
    const now = Date.now();
    const stale: string[] = [];
    for (const [sym, tick] of Object.entries(liveTicks)) {
      if (tick.dataStatus === 'LIVE') {
        const tickTime = new Date(tick.timestamp).getTime();
        if (now - tickTime > 60_000) {
          stale.push(sym);
        }
      }
    }
    setStaleSymbols(stale);
  }, 10_000);
}

function stopStaleChecker() {
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * useLiveMarket — Dual hook for connecting to both price-streamers.
 *
 * India: Upstox V3 WebSocket → price-streamer (port 3003) → Socket.IO → browser
 * US:    Finnhub WebSocket → us-streamer (port 3004) → Socket.IO → browser
 *
 * Rules:
 * - First mount creates both Socket.IO connections.
 * - Subsequent mounts increment ref-counts but reuse sockets.
 * - Unmount decrements ref-counts; sockets persist for app lifetime.
 * - Call `subscribeIndia(symbols)` / `subscribeUS(symbols)` to subscribe.
 * - Call `unsubscribeIndia(symbols)` / `unsubscribeUS(symbols)` to unsubscribe.
 *
 * The hook returns nothing; all state is in the Zustand store.
 */
export function useLiveMarket() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // Strict mode guard
    mountedRef.current = true;
    indiaMountCount++;
    usMountCount++;

    const indSock = createIndiaSocket();
    const usSock = createUSSocket();
    startStaleChecker();

    // Auto-subscribe to initial Indian symbols
    const handleIndiaConnect = () => {
      indSock.emit('subscribe', ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY']);
    };

    // Auto-subscribe to initial US symbols
    const handleUSConnect = () => {
      usSock.emit('subscribe', ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOG', 'META', 'AMZN']);
    };

    if (indSock.connected) {
      handleIndiaConnect();
    } else {
      indSock.on('connect', handleIndiaConnect);
    }

    if (usSock.connected) {
      handleUSConnect();
    } else {
      usSock.on('connect', handleUSConnect);
    }

    return () => {
      indSock.off('connect', handleIndiaConnect);
      usSock.off('connect', handleUSConnect);
      indiaMountCount--;
      usMountCount--;
      if (indiaMountCount <= 0 && usMountCount <= 0) {
        indiaMountCount = 0;
        usMountCount = 0;
        stopStaleChecker();
      }
    };
  }, []);

  const subscribeIndia = useCallback((symbols: string[]) => {
    if (indiaSocket?.connected) {
      indiaSocket.emit('subscribe', symbols);
    }
  }, []);

  const unsubscribeIndia = useCallback((symbols: string[]) => {
    if (indiaSocket?.connected) {
      indiaSocket.emit('unsubscribe', symbols);
    }
  }, []);

  const subscribeUS = useCallback((symbols: string[]) => {
    if (usSocket?.connected) {
      usSocket.emit('subscribe', symbols);
    }
  }, []);

  const unsubscribeUS = useCallback((symbols: string[]) => {
    if (usSocket?.connected) {
      usSocket.emit('unsubscribe', symbols);
    }
  }, []);

  const requestStatus = useCallback(() => {
    if (indiaSocket?.connected) {
      indiaSocket.emit('get_status');
    }
    if (usSocket?.connected) {
      usSocket.emit('get_status');
    }
  }, []);

  return { subscribeIndia, unsubscribeIndia, subscribeUS, unsubscribeUS, requestStatus };
}

// ── Helper: Get effective live price for a symbol ───────────────────

/**
 * Returns the live tick if available and not stale, otherwise null.
 */
export function getLiveTick(symbol: string): LiveTick | null {
  const { liveTicks, staleSymbols } = useAppStore.getState();
  const tick = liveTicks[symbol.toUpperCase()];
  if (!tick) return null;
  if (staleSymbols.includes(symbol.toUpperCase())) return null;
  return tick;
}

/**
 * Returns the data status for a symbol considering WebSocket state.
 * Checks both India and US connections.
 */
export function getDataStatus(symbol: string): 'LIVE' | 'CONNECTING' | 'UNAVAILABLE' {
  const { wsConnectionStatus, usWsConnectionStatus, liveTicks, staleSymbols } = useAppStore.getState();
  const upper = symbol.toUpperCase();

  // Check India connection
  const indiaLive = wsConnectionStatus === 'CONNECTED' && liveTicks[upper] && !staleSymbols.includes(upper);
  // Check US connection
  const usLive = usWsConnectionStatus === 'CONNECTED' && liveTicks[upper] && !staleSymbols.includes(upper);

  if (indiaLive || usLive) return 'LIVE';

  const indiaConnecting = wsConnectionStatus === 'CONNECTING' || wsConnectionStatus === 'RECONNECTING';
  const usConnecting = usWsConnectionStatus === 'CONNECTING' || usWsConnectionStatus === 'RECONNECTING';

  if (indiaConnecting || usConnecting) return 'CONNECTING';

  return 'UNAVAILABLE';
}
