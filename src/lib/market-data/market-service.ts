// Market Service — Facade layer for market data
// Routes requests to the correct provider based on symbol market.
// - Indian symbols → Upstox provider
// - US symbols → Finnhub provider
// AI services (prediction, forecast, news, chat) remain in ai-service.ts.

import type {
  MarketQuote,
  OHLCVCandle,
  ProviderStatus,
  MarketDataError,
  ProviderResult,
  SymbolSearchResult,
} from './types';
import { isIndianSymbol } from './symbol-mapping';
import { upstoxProvider } from './upstox-provider';
import { finnhubProvider, isUSSymbol, searchSymbols as finnhubSearchSymbols } from './finnhub-provider';

// ── Provider Status ──────────────────────────────────────────────

export async function getMarketDataProviderStatus(): Promise<{
  indian: ProviderStatus;
  us: ProviderStatus;
  indianProvider: string;
  usProvider: string;
}> {
  const [indian, us] = await Promise.all([
    upstoxProvider.getStatus(),
    finnhubProvider.getStatus(),
  ]);
  return {
    indian,
    us,
    indianProvider: 'upstox',
    usProvider: 'finnhub',
  };
}

// ── Type Guard ───────────────────────────────────────────────────

export function isMarketDataError<T>(
  result: T | MarketDataError
): result is MarketDataError {
  return (
    result !== null &&
    typeof result === 'object' &&
    'code' in result &&
    'message' in result
  );
}

// ── Symbol Classification ────────────────────────────────────────

/** Determine which market a symbol belongs to. */
export function getSymbolMarket(symbol: string): 'IN' | 'US' | 'UNKNOWN' {
  const upper = symbol.toUpperCase();
  if (isIndianSymbol(upper)) return 'IN';
  if (isUSSymbol(upper)) return 'US';
  // Default unknown symbols to US (most common global tickers)
  return 'US';
}

// ── Quote Fetching ───────────────────────────────────────────────

/**
 * Fetch a real market quote.
 * - Indian symbols → Upstox provider (NO web search, NO LLM).
 * - US symbols → Finnhub provider (NO web search, NO LLM).
 */
export async function fetchQuote(symbol: string): Promise<ProviderResult<MarketQuote> | MarketDataError> {
  const upper = symbol.toUpperCase();

  // Indian symbols → Upstox
  if (isIndianSymbol(upper)) {
    const result = await upstoxProvider.getQuote(upper);
    if (isMarketDataError(result)) return result;

    return {
      data: result,
      source: 'upstox',
      dataStatus: result.marketStatus === 'OPEN' ? 'LIVE' : 'HISTORICAL',
      timestamp: result.timestamp,
    };
  }

  // US symbols → Finnhub
  if (isUSSymbol(upper) || !isIndianSymbol(upper)) {
    const result = await finnhubProvider.getQuote(upper);
    if (isMarketDataError(result)) return result;

    return {
      data: result,
      source: 'finnhub',
      dataStatus: result.marketStatus === 'OPEN' ? 'LIVE' : 'HISTORICAL',
      timestamp: result.timestamp,
    };
  }

  return {
    code: 'NOT_CONFIGURED',
    message: `No market data provider configured for ${upper}`,
    symbol: upper,
    provider: 'none',
  };
}

// ── Historical OHLCV ─────────────────────────────────────────────

/**
 * Fetch historical OHLCV candles.
 * - Indian symbols → Upstox Historical Candle API (NO web search, NO LLM, NO fabrication).
 * - US symbols → Finnhub Stock Candle API (NO web search, NO LLM, NO fabrication).
 */
export async function fetchOHLCV(
  symbol: string,
  days: number = 90
): Promise<ProviderResult<OHLCVCandle[]> | MarketDataError> {
  const upper = symbol.toUpperCase();

  // Indian symbols → Upstox
  if (isIndianSymbol(upper)) {
    const result = await upstoxProvider.getHistoricalOHLCV(upper, days);
    if (isMarketDataError(result)) return result;

    return {
      data: result,
      source: 'upstox',
      dataStatus: 'HISTORICAL',
      timestamp: new Date().toISOString(),
    };
  }

  // US symbols → Finnhub
  if (isUSSymbol(upper) || !isIndianSymbol(upper)) {
    const result = await finnhubProvider.getHistoricalOHLCV(upper, days);
    if (isMarketDataError(result)) return result;

    return {
      data: result,
      source: 'finnhub',
      dataStatus: 'HISTORICAL',
      timestamp: new Date().toISOString(),
    };
  }

  return {
    code: 'NOT_CONFIGURED',
    message: `No market data provider configured for ${upper}`,
    symbol: upper,
    provider: 'none',
  };
}

// ── Symbol Search ────────────────────────────────────────────────

/**
 * Search for symbols using provider's search endpoint.
 * Falls back to local mapping if provider is unavailable.
 */
export async function searchSymbolsProvider(query: string): Promise<SymbolSearchResult[] | MarketDataError> {
  // Try Finnhub symbol search
  const result = await finnhubSearchSymbols(query);
  if (!isMarketDataError(result)) {
    return result.map(r => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      type: r.type,
      currency: r.currency,
    }));
  }

  // If provider search fails, return the error
  return result;
}
