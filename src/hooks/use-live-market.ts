'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import type { LiveTick, WsConnectionStatus, WsConnectionInfo } from '@/lib/store';

// ── Singleton Socket.IO Connection ──────────────────────────────────
// Only ONE connection to the price-streamer per browser tab.
// The hook ref-counts mounts: first mount creates, last mount would
// destroy (but we keep it alive for the app lifetime).

const STREAMER_PORT = 3003;
const STREAMER_URL = `/?XTransformPort=${STREAMER_PORT}`;

let socketInstance: Socket | null = null;
let mountCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let staleCheckInterval: ReturnType<typeof setInterval> | null = null;

function createSocket(): Socket {
  if (socketInstance) return socketInstance;

  const socket = io(STREAMER_URL, {
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  socketInstance = socket;

  socket.on('connect', () => {
    console.log('[LiveMarket] Socket.IO connected to price-streamer');
    useAppStore.getState().setWsConnectionStatus('CONNECTING'); // Streamer may still be connecting to Upstox
    // Request current status from streamer
    socket.emit('get_status');
  });

  socket.on('disconnect', (reason) => {
    console.log(`[LiveMarket] Socket.IO disconnected: ${reason}`);
    useAppStore.getState().setWsConnectionStatus('DISCONNECTED');
  });

  socket.on('connect_error', (err) => {
    console.warn('[LiveMarket] Socket.IO connection error:', err.message);
    useAppStore.getState().setWsConnectionStatus('ERROR');
  });

  // Receive live tick
  socket.on('tick', (tick: LiveTick) => {
    if (!tick || !tick.symbol || typeof tick.price !== 'number' || tick.price <= 0) return;
    useAppStore.getState().updateLiveTick(tick);
  });

  // Receive initial ticks (snapshot of current state)
  socket.on('initial_ticks', (ticks: LiveTick[]) => {
    if (!Array.isArray(ticks)) return;
    for (const tick of ticks) {
      if (tick && tick.symbol && typeof tick.price === 'number' && tick.price > 0) {
        useAppStore.getState().updateLiveTick(tick);
      }
    }
  });

  // Receive connection status updates from streamer
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

  // Heartbeat from streamer
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
 * useLiveMarket — Singleton hook for connecting to the price-streamer.
 *
 * Rules:
 * - First mount creates the Socket.IO connection.
 * - Subsequent mounts increment a ref-count but reuse the same socket.
 * - Unmount decrements the ref-count; the socket persists for app lifetime.
 * - Call `subscribe(symbols)` to subscribe to additional symbols.
 * - Call `unsubscribe(symbols)` to unsubscribe.
 *
 * The hook returns nothing; all state is in the Zustand store.
 */
export function useLiveMarket() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // Strict mode guard
    mountedRef.current = true;
    mountCount++;

    const socket = createSocket();
    startStaleChecker();

    // Auto-subscribe to initial symbols on first connection
    const handleConnect = () => {
      socket.emit('subscribe', ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY']);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    return () => {
      socket.off('connect', handleConnect);
      mountCount--;
      if (mountCount <= 0) {
        mountCount = 0;
        stopStaleChecker();
        // Don't disconnect — keep for app lifetime.
        // The socket will clean up when the page unloads.
      }
    };
  }, []);

  const subscribe = useCallback((symbols: string[]) => {
    if (socketInstance?.connected) {
      socketInstance.emit('subscribe', symbols);
    }
  }, []);

  const unsubscribe = useCallback((symbols: string[]) => {
    if (socketInstance?.connected) {
      socketInstance.emit('unsubscribe', symbols);
    }
  }, []);

  const requestStatus = useCallback(() => {
    if (socketInstance?.connected) {
      socketInstance.emit('get_status');
    }
  }, []);

  return { subscribe, unsubscribe, requestStatus };
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
 */
export function getDataStatus(symbol: string): 'LIVE' | 'CONNECTING' | 'UNAVAILABLE' {
  const { wsConnectionStatus, liveTicks, staleSymbols } = useAppStore.getState();
  const upper = symbol.toUpperCase();

  if (wsConnectionStatus === 'CONNECTED' && liveTicks[upper] && !staleSymbols.includes(upper)) {
    return 'LIVE';
  }
  if (wsConnectionStatus === 'CONNECTING' || wsConnectionStatus === 'RECONNECTING') {
    return 'CONNECTING';
  }
  return 'UNAVAILABLE';
}
