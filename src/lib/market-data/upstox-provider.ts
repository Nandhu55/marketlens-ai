// Upstox V3 Market Data Provider
// Server-side only. Token is never sent to the client.
//
// Upstox V3 API endpoints used:
//   - Market Quote:  GET /v3/market-quote/{instrumentKey}
//   - Historical:    GET /v3/historical-candle/{instrumentKey}/{interval}/{toDate}/{fromDate}
//
// Authentication: Bearer token from UPSTOX_ANALYTICS_TOKEN env var.

import type {
  MarketQuote,
  OHLCVCandle,
  MarketDataProvider,
  ProviderStatus,
  MarketDataError,
} from './types';
import { getInstrumentKey, getIndianSymbolMapping, type SymbolMappingEntry } from './symbol-mapping';
import { getIndianMarketStatus } from './indian-market-status';
import { getCached, setCache } from '@/lib/cache';

const UPSTOX_BASE_URL = 'https://api.upstox.com/v3';

// ── Token Access ────────────────────────────────────────────────
// NEVER logged, never returned, never put in NEXT_PUBLIC_

function getToken(): string | null {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (!token || token.trim() === '') return null;
  return token.trim();
}

// ── Helper: HTTP with auth + timeout ────────────────────────────

async function upstoxFetch<T>(path: string, timeoutMs: number = 15000): Promise<T> {
  const token = getToken();
  if (!token) {
    throw Object.assign(new Error('UPSTOX_ANALYTICS_TOKEN is not configured'), {
      code: 'NOT_CONFIGURED' as ProviderStatus,
    });
  }

  const url = `${UPSTOX_BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error('Upstox authentication failed'), {
        code: 'AUTH_ERROR' as ProviderStatus,
      });
    }

    if (response.status === 429) {
      throw Object.assign(new Error('Upstox rate limit reached'), {
        code: 'RATE_LIMITED' as ProviderStatus,
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw Object.assign(new Error(`Upstox API error ${response.status}: ${body.substring(0, 200)}`), {
        code: 'NETWORK_ERROR' as ProviderStatus,
      });
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    // Preserve our custom error codes
    if (err && typeof err === 'object' && 'code' in err) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw Object.assign(new Error('Market data provider temporarily unavailable'), {
        code: 'NETWORK_ERROR' as ProviderStatus,
      });
    }

    throw Object.assign(
      new Error(err instanceof Error ? err.message : 'Network error'),
      { code: 'NETWORK_ERROR' as ProviderStatus }
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── Provider Implementation ──────────────────────────────────────

export const upstoxProvider: MarketDataProvider = {
  name: 'upstox',
  supportedMarkets: ['IN'],

  async getStatus(): Promise<ProviderStatus> {
    const token = getToken();
    if (!token) return 'NOT_CONFIGURED';

    try {
      // Quick health check: try fetching NIFTY 50 quote
      await upstoxFetch('/market-quote/NSE_INDEX%7CNifty%2050', 8000);
      return 'CONNECTED';
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        return (err as { code: ProviderStatus }).code;
      }
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
      const encodedKey = encodeURIComponent(mapping.instrumentKey);
      const data = await upstoxFetch<Record<string, unknown>>(
        `/market-quote/${encodedKey}`,
        12000
      );

      const qd = data?.data as Record<string, unknown> | undefined;
      if (!qd || typeof qd.last_price !== 'number' || qd.last_price <= 0) {
        return {
          code: 'NO_DATA',
          message: `No market data returned for ${upper}`,
          symbol: upper,
          provider: 'upstox',
        };
      }

      const previousClose = typeof qd.previous_close === 'number' ? qd.previous_close
        : typeof qd.close === 'number' ? qd.close : 0;
      const lastPrice = qd.last_price as number;
      const change = previousClose > 0 ? lastPrice - previousClose : 0;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      const ohlc = (qd.ohlc as Record<string, unknown>) || {};

      const quote: MarketQuote = {
        symbol: upper,
        exchange: mapping.exchange,
        market: 'IN',
        price: lastPrice,
        open: typeof ohlc.open === 'number' ? ohlc.open : undefined,
        high: typeof ohlc.high === 'number' ? ohlc.high
          : typeof qd.day_high === 'number' ? qd.day_high : undefined,
        low: typeof ohlc.low === 'number' ? ohlc.low
          : typeof qd.day_low === 'number' ? qd.day_low : undefined,
        previousClose: previousClose > 0 ? previousClose : undefined,
        volume: typeof qd.volume_traded === 'number' ? qd.volume_traded : undefined,
        change,
        changePercent,
        timestamp: new Date().toISOString(),
        marketStatus: getIndianMarketStatus(),
        source: 'upstox',
      };

      setCache(cacheKey, quote);
      return quote;
    } catch (err: unknown) {
      const code = (err && typeof err === 'object' && 'code' in err)
        ? (err as { code: ProviderStatus }).code
        : 'NETWORK_ERROR';
      const message = err instanceof Error ? err.message : 'Unknown error';

      return {
        code,
        message,
        symbol: upper,
        provider: 'upstox',
      };
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

    // Cache OHLCV for 10 minutes
    const cacheKey = `upstox:ohlcv:${mapping.instrumentKey}:${days}`;
    const cached = getCached<OHLCVCandle[]>(cacheKey, 600_000);
    if (cached) return cached;

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days + 5); // extra buffer for non-trading days

      const toStr = toDate.toISOString().split('T')[0];
      const fromStr = fromDate.toISOString().split('T')[0];

      const encodedKey = encodeURIComponent(mapping.instrumentKey);
      const data = await upstoxFetch<Record<string, unknown>>(
        `/historical-candle/${encodedKey}/1day/${toStr}/${fromStr}`,
        15000
      );

      const inner = data?.data as Record<string, unknown> | undefined;
      const candles = Array.isArray(inner?.candles) ? inner.candles : [];
      if (!Array.isArray(candles) || candles.length === 0) {
        return {
          code: 'NO_DATA',
          message: `No historical data returned for ${upper}`,
          symbol: upper,
          provider: 'upstox',
        };
      }

      // Upstox candle format: [timestamp, open, high, low, close, volume]
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
        .filter((c: OHLCVCandle | null): c is OHLCVCandle => c !== null)
        .slice(-days); // Trim to exactly `days` most recent

      if (result.length < 5) {
        return {
          code: 'NO_DATA',
          message: `Insufficient historical data for ${upper} (got ${result.length} candles)`,
          symbol: upper,
          provider: 'upstox',
        };
      }

      setCache(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const code = (err && typeof err === 'object' && 'code' in err)
        ? (err as { code: ProviderStatus }).code
        : 'NETWORK_ERROR';
      const message = err instanceof Error ? err.message : 'Unknown error';

      return {
        code,
        message,
        symbol: upper,
        provider: 'upstox',
      };
    }
  },
};
