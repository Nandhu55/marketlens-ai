// Twelve Data Market Data Provider
// Server-side only. API key is never sent to the client.
//
// Twelve Data API endpoints used:
//   - Quote:       GET /quote?symbol={sym}&interval=1day
//   - Time Series: GET /time_series?symbol={sym}&interval={interval}&outputsize={n}
//   - Symbol Search: GET /symbol_search?symbol={query}
//   - Market Status: GET /market_status?symbol={sym}
//
// Authentication: apikey query parameter from TWELVE_DATA_API_KEY env var.
// Supports US and global equities, indices, forex, crypto.

import type {
  MarketQuote,
  OHLCVCandle,
  MarketDataProvider,
  ProviderStatus,
  MarketDataError,
} from './types';
import { getCached, setCache } from '@/lib/cache';

const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

// ── API Key Access ───────────────────────────────────────────────
// NEVER logged, never returned, never put in NEXT_PUBLIC_

function getApiKey(): string | null {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key || key.trim() === '' || key.includes('YOUR_')) return null;
  return key.trim();
}

// ── Fetch with timeout ────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 15000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Extract numeric value from unknown with a fallback. */
function num(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return isNaN(n) ? fallback : n;
}

// ── US Symbol Normalization ──────────────────────────────────────
// Twelve Data expects exchange-qualified symbols for some markets.
// For US stocks on major exchanges, the simple ticker works (AAPL, MSFT, etc.)
// For Indian ADRs or dual-listed stocks, we use the US-listed ticker.

const US_SYMBOL_MAP: Record<string, { symbol: string; exchange: string; name: string }> = {
  AAPL: { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.' },
  MSFT: { symbol: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corp.' },
  TSLA: { symbol: 'TSLA', exchange: 'NASDAQ', name: 'Tesla Inc.' },
  NVDA: { symbol: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corp.' },
  GOOG: { symbol: 'GOOG', exchange: 'NASDAQ', name: 'Alphabet Inc.' },
  META: { symbol: 'META', exchange: 'NASDAQ', name: 'Meta Platforms Inc.' },
  AMZN: { symbol: 'AMZN', exchange: 'NASDAQ', name: 'Amazon.com Inc.' },
  JPM: { symbol: 'JPM', exchange: 'NYSE', name: 'JPMorgan Chase & Co.' },
  V: { symbol: 'V', exchange: 'NYSE', name: 'Visa Inc.' },
  WMT: { symbol: 'WMT', exchange: 'NYSE', name: 'Walmart Inc.' },
  JNJ: { symbol: 'JNJ', exchange: 'NYSE', name: 'Johnson & Johnson' },
  MA: { symbol: 'MA', exchange: 'NYSE', name: 'Mastercard Inc.' },
  PG: { symbol: 'PG', exchange: 'NYSE', name: 'Procter & Gamble' },
  UNH: { symbol: 'UNH', exchange: 'NYSE', name: 'UnitedHealth Group' },
  HD: { symbol: 'HD', exchange: 'NYSE', name: 'Home Depot Inc.' },
  DIS: { symbol: 'DIS', exchange: 'NYSE', name: 'Walt Disney Co.' },
  NFLX: { symbol: 'NFLX', exchange: 'NASDAQ', name: 'Netflix Inc.' },
  // Indian ADRs / dual-listed on US exchanges
  INFY: { symbol: 'INFY', exchange: 'NYSE', name: 'Infosys ADR' },
};

/** Get the Twelve Data symbol format for a US stock. */
function getTwelveDataSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  const mapped = US_SYMBOL_MAP[upper];
  if (mapped) return mapped.symbol;
  return upper; // Pass through as-is for unknown symbols
}

/** Check if a symbol is a known US market symbol. */
export function isUSSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return upper in US_SYMBOL_MAP;
}

/** Get US symbol metadata. */
export function getUSSymbolMapping(symbol: string): { symbol: string; exchange: string; name: string } | null {
  return US_SYMBOL_MAP[symbol.toUpperCase()] || null;
}

// ── Interval Mapping ──────────────────────────────────────────────
// Map our canonical intervals to Twelve Data interval strings.

const INTERVAL_MAP: Record<string, string> = {
  '1minute': '1min',
  '5minute': '5min',
  '15minute': '15min',
  '30minute': '30min',
  '1hour': '1h',
  '1day': '1day',
  '1week': '1week',
  '1month': '1month',
};

/** Map our candle interval to Twelve Data format. */
export function mapInterval(interval: string): string {
  return INTERVAL_MAP[interval] || '1day';
}

// ── Provider Implementation ──────────────────────────────────────

export const twelveDataProvider: MarketDataProvider = {
  name: 'twelvedata',
  supportedMarkets: ['US'],

  async getStatus(): Promise<ProviderStatus> {
    const apiKey = getApiKey();
    if (!apiKey) return 'NOT_CONFIGURED';

    try {
      // Use a lightweight endpoint to check connectivity
      const url = `${TWELVE_DATA_BASE_URL}/price?symbol=AAPL&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, { timeout: 8000 });
      if (resp.status === 401 || resp.status === 403) return 'AUTH_ERROR';
      if (resp.status === 429) return 'RATE_LIMITED';
      if (resp.ok) return 'CONNECTED';
      return 'NETWORK_ERROR';
    } catch {
      return 'NETWORK_ERROR';
    }
  },

  async getQuote(symbol: string): Promise<MarketQuote | MarketDataError> {
    const upper = symbol.toUpperCase();
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        code: 'NOT_CONFIGURED',
        message: 'TWELVE_DATA_API_KEY is not configured',
        symbol: upper,
        provider: 'twelvedata',
      };
    }

    const tdSymbol = getTwelveDataSymbol(upper);
    const cacheKey = `twelvedata:quote:${tdSymbol}`;
    const cached = getCached<MarketQuote>(cacheKey, 60_000); // 1 min for quotes
    if (cached) return cached;

    try {
      const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${encodeURIComponent(tdSymbol)}&interval=1day&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, { timeout: 12000 });

      if (resp.status === 401 || resp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Twelve Data authentication failed', symbol: upper, provider: 'twelvedata' };
      }
      if (resp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Twelve Data rate limit reached', symbol: upper, provider: 'twelvedata' };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return { code: 'NETWORK_ERROR', message: `Twelve Data API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'twelvedata' };
      }

      const data = (await resp.json()) as Record<string, unknown>;

      // Check for Twelve Data error response
      if (data.status === 'error') {
        const msg = String(data.message || 'Unknown error');
        if (msg.includes('Invalid symbol')) {
          return { code: 'NO_DATA', message: `Symbol ${upper} not found`, symbol: upper, provider: 'twelvedata' };
        }
        return { code: 'NO_DATA', message: msg, symbol: upper, provider: 'twelvedata' };
      }

      const price = num(data.close);
      if (price <= 0) {
        return { code: 'NO_DATA', message: `Invalid quote data for ${upper}`, symbol: upper, provider: 'twelvedata' };
      }

      const previousClose = num(data.previous_close);
      const change = num(data.change);
      const changePercent = num(data.percent_change);

      // Determine market status from Twelve Data
      const isMarketOpen = data.is_market_open === true || data.is_market_open === 'true';

      const mapping = US_SYMBOL_MAP[upper];
      const quote: MarketQuote = {
        symbol: upper,
        exchange: mapping?.exchange || String(data.exchange || 'US'),
        market: 'US',
        price,
        open: num(data.open, -1) >= 0 ? num(data.open) : undefined,
        high: num(data.high, -1) >= 0 ? num(data.high) : undefined,
        low: num(data.low, -1) >= 0 ? num(data.low) : undefined,
        previousClose: previousClose > 0 ? previousClose : undefined,
        volume: num(data.volume, -1) >= 0 ? num(data.volume) : undefined,
        change,
        changePercent,
        timestamp: String(data.timestamp || new Date().toISOString()),
        marketStatus: isMarketOpen ? 'OPEN' : 'CLOSED',
        source: 'twelvedata',
      };

      setCache(cacheKey, quote);
      return quote;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'twelvedata' };
    }
  },

  async getHistoricalOHLCV(symbol: string, days: number): Promise<OHLCVCandle[] | MarketDataError> {
    const upper = symbol.toUpperCase();
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        code: 'NOT_CONFIGURED',
        message: 'TWELVE_DATA_API_KEY is not configured',
        symbol: upper,
        provider: 'twelvedata',
      };
    }

    const tdSymbol = getTwelveDataSymbol(upper);
    const cacheKey = `twelvedata:ohlcv:${tdSymbol}:${days}`;
    const cached = getCached<OHLCVCandle[]>(cacheKey, 600_000); // 10 min for historical
    if (cached) return cached;

    try {
      const outputsize = Math.min(days + 10, 500); // Request a few extra to account for non-trading days
      const url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, { timeout: 15000 });

      if (resp.status === 401 || resp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Twelve Data authentication failed', symbol: upper, provider: 'twelvedata' };
      }
      if (resp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Twelve Data rate limit reached', symbol: upper, provider: 'twelvedata' };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return { code: 'NETWORK_ERROR', message: `Twelve Data API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'twelvedata' };
      }

      const data = (await resp.json()) as Record<string, unknown>;

      // Check for Twelve Data error response
      if (data.status === 'error') {
        const msg = String(data.message || 'Unknown error');
        return { code: 'NO_DATA', message: msg, symbol: upper, provider: 'twelvedata' };
      }

      const values = Array.isArray(data.values) ? data.values : [];
      if (values.length === 0) {
        return { code: 'NO_DATA', message: `No historical data returned for ${upper}`, symbol: upper, provider: 'twelvedata' };
      }

      // Twelve Data returns candles in REVERSE chronological order (newest first).
      // Map to OHLCVCandle and reverse to chronological order.
      const candles: OHLCVCandle[] = values
        .map((v: Record<string, unknown>) => {
          const open = num(v.open);
          const high = num(v.high);
          const low = num(v.low);
          const close = num(v.close);
          const volume = num(v.volume);

          if (open <= 0 || close <= 0 || high <= 0 || low <= 0) return null;

          return {
            timestamp: String(v.datetime || ''),
            open,
            high,
            low,
            close,
            volume,
          };
        })
        .filter((c: OHLCVCandle | null): c is OHLCVCandle => c !== null);

      // Reverse to chronological (oldest first) and take `days` candles
      const sliced = candles.reverse().slice(-days);

      if (sliced.length < 3) {
        return {
          code: 'NO_DATA',
          message: `Insufficient historical data for ${upper} (got ${sliced.length} candles)`,
          symbol: upper,
          provider: 'twelvedata',
        };
      }

      setCache(cacheKey, sliced);
      return sliced;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'twelvedata' };
    }
  },
};

// ── Symbol Search ──────────────────────────────────────────────────

export interface TDSymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
}

/**
 * Search for symbols using Twelve Data's symbol search endpoint.
 * Returns normalized results. Falls back to null if unavailable.
 */
export async function searchSymbols(query: string): Promise<TDSymbolSearchResult[] | MarketDataError> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      code: 'NOT_CONFIGURED',
      message: 'TWELVE_DATA_API_KEY is not configured',
      provider: 'twelvedata',
    };
  }

  const cacheKey = `twelvedata:search:${query}`;
  const cached = getCached<TDSymbolSearchResult[]>(cacheKey, 300_000); // 5 min
  if (cached) return cached;

  try {
    const url = `${TWELVE_DATA_BASE_URL}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${apiKey}`;
    const resp = await fetchWithTimeout(url, { timeout: 8000 });

    if (resp.status === 401 || resp.status === 403) {
      return { code: 'AUTH_ERROR', message: 'Twelve Data authentication failed', provider: 'twelvedata' };
    }
    if (resp.status === 429) {
      return { code: 'RATE_LIMITED', message: 'Twelve Data rate limit reached', provider: 'twelvedata' };
    }
    if (!resp.ok) {
      return { code: 'NETWORK_ERROR', message: `Twelve Data search error ${resp.status}`, provider: 'twelvedata' };
    }

    const data = (await resp.json()) as Record<string, unknown>;

    if (data.status === 'error') {
      return { code: 'NO_DATA', message: String(data.message || 'Search error'), provider: 'twelvedata' };
    }

    const results = Array.isArray(data.data) ? data.data : [];
    const mapped: TDSymbolSearchResult[] = results
      .slice(0, 10)
      .map((item: Record<string, unknown>) => ({
        symbol: String(item.symbol || ''),
        name: String(item.instrument_name || ''),
        exchange: String(item.exchange || ''),
        type: String(item.instrument_type || ''),
        currency: String(item.currency || 'USD'),
      }));

    setCache(cacheKey, mapped);
    return mapped;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { code: 'NETWORK_ERROR', message, provider: 'twelvedata' };
  }
}
