import { create } from 'zustand';

export type PageId =
  | 'dashboard'
  | 'live-market'
  | 'ai-prediction'
  | 'technical-analysis'
  | 'news-sentiment'
  | 'forecast'
  | 'portfolio'
  | 'screener'
  | 'ai-assistant'
  | 'alerts'
  | 'reports'
  | 'settings'
  | 'about';

interface StockState {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface RealQuote {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  source: string;
  fetchedAt: string;
}

export interface MarketOverviewData {
  fearGreedIndex: number;
  marketTrend: string;
  topGainers: Array<{ symbol: string; change: number }>;
  topLosers: Array<{ symbol: string; change: number }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AlertItem {
  id: string;
  symbol: string;
  type: string;
  value: number;
  triggered: boolean;
  createdAt: string;
}

// ── Live Market WebSocket State ──────────────────────────────────────

export type WsConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type LiveDataStatus = 'LIVE' | 'CONNECTING' | 'UNAVAILABLE';

export interface LiveTick {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: 'upstox';
  dataStatus: LiveDataStatus;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  marketStatus?: string;
}

export interface WsConnectionInfo {
  status: WsConnectionStatus;
  upstoxStatus: WsConnectionStatus;
  subscribedSymbols: string[];
  staleSymbols: string[];
  connectedClients: number;
  lastUpstoxConnect?: string;
  reconnectAttempt?: number;
}

// ── App State Interface ─────────────────────────────────────────────

interface AppState {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  selectedStock: StockState;
  setSelectedStock: (stock: StockState) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  searchHistory: string[];
  addSearchHistory: (query: string) => void;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  // REST-based real-time data
  realQuotes: Record<string, RealQuote>;
  setRealQuotes: (quotes: Record<string, RealQuote>) => void;
  marketOverview: MarketOverviewData | null;
  setMarketOverview: (overview: MarketOverviewData | null) => void;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  // WebSocket live market state
  wsConnectionStatus: WsConnectionStatus;
  setWsConnectionStatus: (status: WsConnectionStatus) => void;
  liveTicks: Record<string, LiveTick>;
  updateLiveTick: (tick: LiveTick) => void;
  subscribedWsSymbols: string[];
  setSubscribedWsSymbols: (symbols: string[]) => void;
  staleSymbols: string[];
  setStaleSymbols: (symbols: string[]) => void;
  // Chat messages
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
  removeChatMessage: (index: number) => void;
  // Alerts
  alerts: AlertItem[];
  addAlert: (alert: AlertItem) => void;
  removeAlert: (id: string) => void;
}

const defaultStock: StockState = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 0,
  change: 0,
  changePercent: 0,
  volume: 0,
  marketCap: 0,
};

export const useAppStore = create<AppState>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  selectedStock: defaultStock,
  setSelectedStock: (stock) => set({ selectedStock: stock }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  isDarkMode: true,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  searchHistory: [],
  addSearchHistory: (query) =>
    set((state) => ({
      searchHistory: [query, ...state.searchHistory.filter((q) => q !== query)].slice(0, 20),
    })),
  watchlist: ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOG'],
  addToWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.includes(symbol)
        ? state.watchlist
        : [...state.watchlist, symbol],
    })),
  removeFromWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.filter((s) => s !== symbol),
    })),
  // REST-based real-time data
  realQuotes: {},
  setRealQuotes: (quotes) => set({ realQuotes: quotes }),
  marketOverview: null,
  setMarketOverview: (overview) => set({ marketOverview: overview }),
  isLive: false,
  setIsLive: (live) => set({ isLive: live }),
  // WebSocket live market state
  wsConnectionStatus: 'DISCONNECTED',
  setWsConnectionStatus: (status) => set({ wsConnectionStatus: status }),
  liveTicks: {},
  updateLiveTick: (tick) =>
    set((state) => ({
      liveTicks: { ...state.liveTicks, [tick.symbol]: tick },
    })),
  subscribedWsSymbols: [],
  setSubscribedWsSymbols: (symbols) => set({ subscribedWsSymbols: symbols }),
  staleSymbols: [],
  setStaleSymbols: (symbols) => set({ staleSymbols: symbols }),
  // Chat messages
  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChatMessages: () => set({ chatMessages: [] }),
  removeChatMessage: (index) =>
    set((state) => ({
      chatMessages: state.chatMessages.filter((_, i) => i !== index),
    })),
  // Alerts
  alerts: [],
  addAlert: (alert) =>
    set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
}));
