import { create } from 'zustand';

export type PageId =
  | 'dashboard'
  | 'live-market'
  | 'ai-prediction'
  | 'technical-analysis'
  | 'news-sentiment'
  | 'forecast'
  | 'portfolio'
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
}

const defaultStock: StockState = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 198.45,
  change: 2.34,
  changePercent: 1.19,
  volume: 54234567,
  marketCap: 3050000000000,
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
}));