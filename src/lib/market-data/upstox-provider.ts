// Upstox Market Data Provider
// Server-side only. Token is never sent to the client.
//
// Upstox API endpoints used (verified against live API):
//   - Quote:          GET /v2/market-quote/quotes?instrument_key={key}&instrument_key={key2}
//   - Historical:     GET /v2/historical-candle/{instrumentKey}/{interval}/{toDate}/{fromDate}
//
// Authentication: Bearer token from UPSTOX_ANALYTICS_TOKEN env var.
// Candle format (7 elements): [timestamp, open, high, low, close, volume, OI]

import type {
  MarketQuote,
  OHLCVCandle,
  MarketDataProvider,
  ProviderStatus,
  MarketDataError,
} from './types';
import { getIndianSymbolMapping } from './symbol-mapping';
import { getIndianMarketStatus } from './indian-market-status';
import { getCached, setCache } from '@/lib/cache';

const UPSTOX_BASE_URL = 'https://api.upstox.com';

// ── Token Access ────────────────────────────────────────────────
// NEVER logged, never returned, never put in NEXT_PUBLIC_

function getToken(): string | null {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (!token || token.trim() === '') return null;
  return token.trim();
}

// ── Headers ──────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// ── Helper: fetch with timeout ─────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number }
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
  return typeof v === 'number' && !isNaN(v) ? v : fallback;
}

/** Safe division, returns 0 if divisor is 0 or invalid. */
function pctChange(current: number, previous: number): number {
  if (previous <= 0 || current <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

// ── Provider Implementation ──────────────────────────────────────

export const upstoxProvider: MarketDataProvider = {
  name: 'upstox',
  supportedMarkets: ['IN'],

  async getStatus(): Promise<ProviderStatus> {
    const token = getToken();
    if (!token) return 'NOT_CONFIGURED';

    try {
      const url = `${UPSTOX_BASE_URL}/v2/market-quote/quotes?instrument_key=${encodeURIComponent('NSE_INDEX|Nifty 50')}`;
      const resp = await fetchWithTimeout(url, { headers: getAuthHeaders(), timeout: 8000 });
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
    const mapping = getIndianSymbolMapping(upper);

    if (!mapping) {
      return {
        code: 'NO_DATA',
        message: `Symbol ${upper} is not supported by the Indian market provider`,
        symbol: upper,
        provider: 'upstox',
      };
    }

    const cacheKey = `upstox:quote:${mapping.instrumentKey}`;
    const cached = getCached<MarketQuote>(cacheKey, 60_000); // 1 min for quotes
    if (cached) return cached;

    try {
      const url = `${UPSTOX_BASE_URL}/v2/market-quote/quotes?instrument_key=${encodeURIComponent(mapping.instrumentKey)}`;
      const resp = await fetchWithTimeout(url, { headers: getAuthHeaders(), timeout: 12000 });

      if (resp.status === 401 || resp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Upstox authentication failed', symbol: upper, provider: 'upstox' };
      }
      if (resp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Upstox rate limit reached', symbol: upper, provider: 'upstox' };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return { code: 'NETWORK_ERROR', message: `Upstox API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'upstox' };
      }

      const data = (await resp.json()) as Record<string, unknown>;
      const allData = data?.data as Record<string, Record<string, unknown>> | undefined;
      if (!allData || Object.keys(allData).length === 0) {
        return { code: 'NO_DATA', message: `No market data returned for ${upper} (instrument may not be available with current token scope)`, symbol: upper, provider: 'upstox' };
      }

      // Find the matching entry — key format varies (pipe or colon)
      const entry = Object.values(allData)[0];
      const lastPrice = num(entry.last_price);
      if (lastPrice <= 0) {
        return { code: 'NO_DATA', message: `Invalid quote data for ${upper}`, symbol: upper, provider: 'upstox' };
      }

      const ohlc = (entry.ohlc as Record<string, number>) || {};
      const previousClose = num(ohlc.close);
      const change = num(entry.net_change);
      const changePercent = pctChange(lastPrice, previousClose + change);

      const quote: MarketQuote = {
        symbol: upper,
        exchange: mapping.exchange,
        market: 'IN',
        price: lastPrice,
        open: num(ohlc.open, -1) >= 0 ? ohlc.open : undefined,
        high: num(ohlc.high, -1) >= 0 ? ohlc.high : undefined,
        low: num(ohlc.low, -1) >= 0 ? ohlc.low : undefined,
        previousClose: previousClose > 0 ? previousClose : undefined,
        volume: num(entry.volume, -1) >= 0 ? num(entry.volume) : undefined,
        change,
        changePercent,
        timestamp: String(entry.timestamp || new Date().toISOString()),
        marketStatus: getIndianMarketStatus(),
        source: 'upstox',
      };

      setCache(cacheKey, quote);
      return quote;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'upstox' };
    }
  },

  async getHistoricalOHLCV(symbol: string, days: number): Promise<OHLCVCandle[] | MarketDataError> {
    const upper = symbol.toUpperCase();
    const mapping = getIndianSymbolMapping(upper);

    if (!mapping) {
      return {
        code: 'NO_DATA',
        message: `Symbol ${upper} is not supported by the Indian market provider`,
        symbol: upper,
        provider: 'upstox',
      };
    }

    const cacheKey = `upstox:ohlcv:${mapping.instrumentKey}:${days}`;
    const cached = getCached<OHLCVCandle[]>(cacheKey, 600_000); // 10 min
    if (cached) return cached;

    try {
      // ── Date calculation (IST-aware) ────────────────────────
      // Upstox V2 expects: /day/{toDate}/{fromDate}  where toDate >= fromDate
      // toDate is the more recent date, fromDate is the older date.
      // We use IST dates (not UTC) because NSE trading follows IST calendar.
      const now = new Date();
      const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
      const istNow = new Date(now.getTime() + istOffsetMs + now.getTimezoneOffset() * 60 * 1000);

      // toDate = today in IST
      const toStr = istNow.toISOString().split('T')[0];

      // fromDate = (days + buffer) calendar days before today in IST
      // Buffer of ~40% extra calendar days to account for weekends/holidays
      const calendarDaysBack = Math.ceil(days * 1.45) + 2;
      const fromIST = new Date(istNow);
      fromIST.setDate(fromIST.getDate() - calendarDaysBack);
      const fromStr = fromIST.toISOString().split('T')[0];

      // V2 historical candle: toDate BEFORE fromDate in URL path
      const url = `${UPSTOX_BASE_URL}/v2/historical-candle/${encodeURIComponent(mapping.instrumentKey)}/day/${toStr}/${fromStr}`;
      const resp = await fetchWithTimeout(url, { headers: getAuthHeaders(), timeout: 15000 });

      if (resp.status === 401 || resp.status === 403) {
        return { code: 'AUTH_ERROR', message: 'Upstox authentication failed', symbol: upper, provider: 'upstox' };
      }
      if (resp.status === 429) {
        return { code: 'RATE_LIMITED', message: 'Upstox rate limit reached', symbol: upper, provider: 'upstox' };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        // Distinguish "invalid instrument" from other errors
        if (body.includes('UDAPI100011')) {
          return { code: 'NO_DATA', message: `Instrument key not found for ${upper} (may not be available with current token scope)`, symbol: upper, provider: 'upstox' };
        }
        return { code: 'NETWORK_ERROR', message: `Upstox API error ${resp.status}: ${body.substring(0, 200)}`, symbol: upper, provider: 'upstox' };
      }

      const data = (await resp.json()) as Record<string, unknown>;
      const inner = data?.data as Record<string, unknown> | undefined;
      const candles = Array.isArray(inner?.candles) ? inner.candles : [];
      if (!Array.isArray(candles) || candles.length === 0) {
        return { code: 'NO_DATA', message: `No historical data returned for ${upper}`, symbol: upper, provider: 'upstox' };
      }

      // Upstox candle format: [timestamp, open, high, low, close, volume, OI] — 7 elements
      // Upstox V2 returns candles in REVERSE chronological order (newest first).
      // We need: most recent `days` candles in CHRONOLOGICAL order (oldest first).
      const result: OHLCVCandle[] = candles
        .map((c: unknown[]) => {
          if (!Array.isArray(c) || c.length < 6) return null;
          const ts = String(c[0]);
          const open = Number(c[1]);
          const high = Number(c[2]);
          const low = Number(c[3]);
          const close = Number(c[4]);
          const volume = Number(c[5]);

          if (isNaN(open) || isNaN(close) || isNaN(high) || isNaN(low)) return null;
          if (open <= 0 || close <= 0) return null;

          return {
            timestamp: ts,
            open,
            high,
            low,
            close,
            volume: isNaN(volume) ? 0 : volume,
          };
        })
        .filter((c: OHLCVCandle | null): c is OHLCVCandle => c !== null);

      // Take the first `days` elements (newest) then reverse to chronological
      const sliced = result.slice(0, days).reverse();

      if (sliced.length < 3) {
        return {
          code: 'NO_DATA',
          message: `Insufficient historical data for ${upper} (got ${sliced.length} candles)`,
          symbol: upper,
          provider: 'upstox',
        };
      }

      setCache(cacheKey, sliced);
      return sliced;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { code: 'NETWORK_ERROR', message, symbol: upper, provider: 'upstox' };
    }
  },
};
