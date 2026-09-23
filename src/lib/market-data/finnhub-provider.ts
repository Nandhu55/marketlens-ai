// Finnhub Market Data Provider
// Server-side only. API key is NEVER sent to the client.
//
// Finnhub API endpoints used:
//   - Quote:          GET /api/v1/quote?symbol={sym}
//   - Stock Candle:   GET /api/v1/stock/candle?symbol={sym}&resolution=D&from={unix}&to={unix}
//   - Symbol Search:  GET /api/v1/search?q={query}
//   - Company Profile: GET /api/v1/stock/profile2?symbol={sym}
//
// Authentication: token query parameter from FINNHUB_API_KEY env var.
// Supports US equities on NASDAQ/NYSE. Free tier: 60 calls/min.

import type {
  MarketQuote,
  OHLCVCandle,
  MarketDataProvider,
  ProviderStatus,
  MarketDataError,
  SymbolSearchResult,
} from './types';
import { getCached, setCache } from '@/lib/cache';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// ── API Key Access ───────────────────────────────────────────────
// NEVER logged, never returned, never put in NEXT_PUBLIC_

function getApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY;
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

// ── US Symbol Map ────────────────────────────────────────────────
// Finnhub uses standard US ticker symbols directly.

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
};

/** Check if a symbol is a known US market symbol. */
export function isUSSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return upper in US_SYMBOL_MAP;
}

/** Get US symbol metadata. */
export function getUSSymbolMapping(symbol: string): { symbol: string; exchange: string; name: string } | null {
  return US_SYMBOL_MAP[symbol.toUpperCase()] || null;
}

/** Get all known US symbols. */
export function getAllUSSymbols(): Array<{ symbol: string; exchange: string; name: string }> {
  return Object.values(US_SYMBOL_MAP);
}

// ── Company Profile (Fundamentals) ────────────────────────────────

export interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

/**
 * Fetch company profile from Finnhub.
 * Returns fundamentals: market cap, name, industry, etc.
 */
export async function getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile | MarketDataError> {
  const upper = symbol.toUpperCase();
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      code: 'NOT_CONFIGURED',
      message: 'FINNHUB_API_KEY is not configured',
      symbol: upper,
      provider: 'finnhub',
    };
  }

  const cacheKey = `finnhub:profile:${upper}`;
  const cached = getCached<FinnhubCompanyProfile>(cacheKey, 600_000); // 10 min
  if (cached) return cached;

  try {
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(upper)}&token=${apiKey}`;
    const resp = await fetchWithTimeout(url, { timeout: 12000 });

    if (resp.status === 401 || resp.status === 403) {
      return { code: 'AUTH_ERROR', message: 'Finnhub authentication failed', symbol: upper, provider: 'finnhub' };
    }
    if (resp.status === 429) {
      return { code: 'RATE_LIMITED', message: 'Finnhub rate limit reached', symbol: upper, provider: 'finnhub' };
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { code: 'NETWORK_ERROR', message: `Finnhub API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'finnhub' };
    }

    const data = (await resp.json()) as Record<string, unknown>;

    // Finnhub returns empty object {} for unknown symbols
    if (!data || Object.keys(data).length === 0) {
      return { code: 'NO_DATA', message: `No profile data for ${upper}`, symbol: upper, provider: 'finnhub' };
    }

    const profile: FinnhubCompanyProfile = {
      country: String(data.country || ''),
      currency: String(data.currency || 'USD'),
      exchange: String(data.exchange || ''),
      finnhubIndustry: String(data.finnhubIndustry || ''),
      ipo: String(data.ipo || ''),
      logo: String(data.logo || ''),
      marketCapitalization: num(data.marketCapitalization),
      name: String(data.name || ''),
      phone: String(data.phone || ''),
      shareOutstanding: num(data.shareOutstanding),
      ticker: String(data.ticker || upper),
      weburl: String(data.weburl || ''),
    };

    setCache(cacheKey, profile);
    return profile;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'finnhub' };
  }
}

// ── Provider Implementation ──────────────────────────────────────

export const finnhubProvider: MarketDataProvider = {
  name: 'finnhub',
  supportedMarkets: ['US'],

  async getStatus(): Promise<ProviderStatus> {
    const apiKey = getApiKey();
    if (!apiKey) return 'NOT_CONFIGURED';

    try {
      // Use quote endpoint with a known symbol to check connectivity
      const url = `${FINNHUB_BASE_URL}/quote?symbol=AAPL&token=${apiKey}`;
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
        message: 'FINNHUB_API_KEY is not configured',
        symbol: upper,
        provider: 'finnhub',
      };
    }

    const cacheKey = `finnhub:quote:${upper}`;
    const cached = getCached<MarketQuote>(cacheKey, 60_000); // 1 min for quotes
    if (cached) return cached;

    try {
      // Fetch both quote and profile in parallel for richer data
      const quoteUrl = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(upper)}&token=${apiKey}`;
      const [quoteResp] = await Promise.all([
        fetchWithTimeout(quoteUrl, { timeout: 12000 }),
      ]);

      if (quoteResp.status === 401 || quoteResp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Finnhub authentication failed', symbol: upper, provider: 'finnhub' };
      }
      if (quoteResp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Finnhub rate limit reached', symbol: upper, provider: 'finnhub' };
      }
      if (!quoteResp.ok) {
        const body = await quoteResp.text().catch(() => '');
        return { code: 'NETWORK_ERROR', message: `Finnhub API error ${quoteResp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'finnhub' };
      }

      const data = (await quoteResp.json()) as Record<string, unknown>;

      // Finnhub quote returns: { c: currentPrice, h: high, l: low, o: open, pc: prevClose, t: timestamp, dp: changePercent }
      const currentPrice = num(data.c);
      if (currentPrice <= 0) {
        return { code: 'NO_DATA', message: `No quote data for ${upper}`, symbol: upper, provider: 'finnhub' };
      }

      const previousClose = num(data.pc);
      const change = previousClose > 0 ? currentPrice - previousClose : 0;
      const changePercent = num(data.dp);

      // Determine market status from Finnhub data
      // Finnhub doesn't return is_market_open in quote; we infer from US market hours
      const isMarketOpen = isUSMarketOpen();

      const mapping = US_SYMBOL_MAP[upper];
      const quote: MarketQuote = {
        symbol: upper,
        exchange: mapping?.exchange || String(data.exchange || 'US'),
        market: 'US',
        price: currentPrice,
        open: num(data.o, -1) >= 0 ? num(data.o) : undefined,
        high: num(data.h, -1) >= 0 ? num(data.h) : undefined,
        low: num(data.l, -1) >= 0 ? num(data.l) : undefined,
        previousClose: previousClose > 0 ? previousClose : undefined,
        volume: num(data.v, -1) >= 0 ? num(data.v) : undefined,
        change,
        changePercent,
        timestamp: new Date().toISOString(),
        marketStatus: isMarketOpen ? 'OPEN' : 'CLOSED',
        source: 'finnhub',
      };

      setCache(cacheKey, quote);
      return quote;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'finnhub' };
    }
  },

  async getHistoricalOHLCV(symbol: string, days: number): Promise<OHLCVCandle[] | MarketDataError> {
    const upper = symbol.toUpperCase();
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        code: 'NOT_CONFIGURED',
        message: 'FINNHUB_API_KEY is not configured',
        symbol: upper,
        provider: 'finnhub',
      };
    }

    const cacheKey = `finnhub:ohlcv:${upper}:${days}`;
    const cached = getCached<OHLCVCandle[]>(cacheKey, 600_000); // 10 min for historical
    if (cached) return cached;

    try {
      // Finnhub stock/candle requires unix timestamps
      const to = Math.floor(Date.now() / 1000);
      // Request extra calendar days to account for weekends/holidays
      const calendarDaysBack = Math.ceil(days * 1.5) + 5;
      const from = to - calendarDaysBack * 86400;

      const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(upper)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
      const resp = await fetchWithTimeout(url, { timeout: 15000 });

      if (resp.status === 401 || resp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Finnhub authentication failed', symbol: upper, provider: 'finnhub' };
      }
      if (resp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Finnhub rate limit reached', symbol: upper, provider: 'finnhub' };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return { code: 'NETWORK_ERROR', message: `Finnhub API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'finnhub' };
      }

      const data = (await resp.json()) as Record<string, unknown>;

      // Finnhub returns: { c: close[], h: high[], l: low[], o: open[], s: "ok", t: timestamp[], v: volume[] }
      if (data.s !== 'ok' && data.s !== 'no_data') {
        return { code: 'NO_DATA', message: `Finnhub candle error for ${upper}`, symbol: upper, provider: 'finnhub' };
      }

      const closes = Array.isArray(data.c) ? data.c : [];
      const opens = Array.isArray(data.o) ? data.o : [];
      const highs = Array.isArray(data.h) ? data.h : [];
      const lows = Array.isArray(data.l) ? data.l : [];
      const volumes = Array.isArray(data.v) ? data.v : [];
      const timestamps = Array.isArray(data.t) ? data.t : [];

      if (closes.length === 0) {
        return { code: 'NO_DATA', message: `No historical data for ${upper}`, symbol: upper, provider: 'finnhub' };
      }

      // Build candles from parallel arrays (Finnhub returns chronological order)
      const candles: OHLCVCandle[] = [];
      for (let i = 0; i < closes.length; i++) {
        const open = num(opens[i]);
        const high = num(highs[i]);
        const low = num(lows[i]);
        const close = num(closes[i]);
        const volume = num(volumes[i]);
        const ts = num(timestamps[i]);

        if (open <= 0 || close <= 0 || high <= 0 || low <= 0) continue;

        candles.push({
          timestamp: ts > 0 ? new Date(ts * 1000).toISOString() : '',
          open,
          high,
          low,
          close,
          volume,
        });
      }

      // Take the most recent `days` candles (already chronological)
      const sliced = candles.slice(-days);

      if (sliced.length < 3) {
        return {
          code: 'NO_DATA',
          message: `Insufficient historical data for ${upper} (got ${sliced.length} candles)`,
          symbol: upper,
          provider: 'finnhub',
        };
      }

      setCache(cacheKey, sliced);
      return sliced;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'finnhub' };
    }
  },
};

// ── Symbol Search ──────────────────────────────────────────────────

/**
 * Search for symbols using Finnhub's search endpoint.
 * Returns normalized SymbolSearchResult[].
 */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[] | MarketDataError> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      code: 'NOT_CONFIGURED',
      message: 'FINNHUB_API_KEY is not configured',
      provider: 'finnhub',
    };
  }

  const cacheKey = `finnhub:search:${query}`;
  const cached = getCached<SymbolSearchResult[]>(cacheKey, 300_000); // 5 min
  if (cached) return cached;

  try {
    const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
    const resp = await fetchWithTimeout(url, { timeout: 8000 });

    if (resp.status === 401 || resp.status === 403) {
      return { code: 'AUTH_ERROR', message: 'Finnhub authentication failed', provider: 'finnhub' };
    }
    if (resp.status === 429) {
      return { code: 'RATE_LIMITED', message: 'Finnhub rate limit reached', provider: 'finnhub' };
    }
    if (!resp.ok) {
      return { code: 'NETWORK_ERROR', message: `Finnhub search error ${resp.status}`, provider: 'finnhub' };
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const results = Array.isArray(data.result) ? data.result : [];

    const mapped: SymbolSearchResult[] = results
      .filter((item: Record<string, unknown>) => {
        // Filter out forex/crypto/futures — only equities
        const type = String(item.type || '');
        return type === 'Common Stock' || type === 'ETF' || type === 'ADR' || type === '';
      })
      .slice(0, 10)
      .map((item: Record<string, unknown>) => ({
        symbol: String(item.symbol || ''),
        name: String(item.description || ''),
        exchange: String(item.displaySymbol || '').includes('.') ? String(item.displaySymbol).split('.')[1] : '',
        type: String(item.type || ''),
        currency: 'USD',
      }));

    setCache(cacheKey, mapped);
    return mapped;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { code: 'NETWORK_ERROR', message, provider: 'finnhub' };
  }
}

// ── US Market Status ─────────────────────────────────────────────

/**
 * Determine if the US market (NYSE/NASDAQ) is currently open.
 * Regular hours: 9:30 AM – 4:00 PM ET, Monday – Friday.
 */
function isUSMarketOpen(): boolean {
  const now = new Date();

  // Use America/New_York timezone
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'long',
  });

  const parts = etFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const weekday = getPart('weekday');

  if (weekday === 'Saturday' || weekday === 'Sunday') return false;

  const totalMinutes = hour * 60 + minute;

  // Regular session: 9:30 – 16:00 ET
  return totalMinutes >= 570 && totalMinutes < 960;
}

/** Public export for market status check. */
export function getUSMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN' {
  const now = new Date();

  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'long',
  });

  const parts = etFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const weekday = getPart('weekday');

  if (weekday === 'Saturday' || weekday === 'Sunday') return 'CLOSED';

  const totalMinutes = hour * 60 + minute;

  // Pre-market: 4:00 – 9:29 ET
  if (totalMinutes >= 240 && totalMinutes < 570) return 'PRE_MARKET';
  // Regular session: 9:30 – 15:59 ET
  if (totalMinutes >= 570 && totalMinutes < 960) return 'OPEN';
  // Post-market: 16:00 – 20:00 ET
  if (totalMinutes >= 960 && totalMinutes <= 1200) return 'POST_MARKET';

  return 'CLOSED';
}
