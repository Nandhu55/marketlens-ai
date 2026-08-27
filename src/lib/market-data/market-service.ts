// Market Service — Facade layer for market data
// Routes requests to the correct provider based on symbol market.
// AI services (prediction, forecast, news, chat) remain in ai-service.ts.

import type {
  MarketQuote,
  OHLCVCandle,
  ProviderStatus,
  MarketDataError,
  ProviderResult,
} from './types';
import { isIndianSymbol } from './symbol-mapping';
import { upstoxProvider } from './upstox-provider';

// ── Provider Status ──────────────────────────────────────────────

export async function getMarketDataProviderStatus(): Promise<{
  indian: ProviderStatus;
  provider: string;
}> {
  const indian = await upstoxProvider.getStatus();
  return { indian, provider: 'upstox' };
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

// ── Quote Fetching ───────────────────────────────────────────────

/**
 * Fetch a real market quote.
 * - Indian symbols → Upstox provider (NO web search, NO LLM).
 * - US symbols → returns NOT_CONFIGURED (not implemented in this phase).
 */
export async function fetchQuote(symbol: string): Promise<ProviderResult<MarketQuote> | MarketDataError> {
  const upper = symbol.toUpperCase();

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

  // US market data is not handled in Phase 2
  return {
    code: 'NOT_CONFIGURED',
    message: `US market data is not yet connected for ${upper}`,
    symbol: upper,
    provider: 'none',
  };
}

// ── Historical OHLCV ─────────────────────────────────────────────

/**
 * Fetch historical OHLCV candles.
 * - Indian symbols → Upstox Historical Candle API (NO web search, NO LLM, NO fabrication).
 * - US symbols → returns NOT_CONFIGURED.
 */
export async function fetchOHLCV(
  symbol: string,
  days: number = 90
): Promise<ProviderResult<OHLCVCandle[]> | MarketDataError> {
  const upper = symbol.toUpperCase();

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

  return {
    code: 'NOT_CONFIGURED',
    message: `US market data is not yet connected for ${upper}`,
    symbol: upper,
    provider: 'none',
  };
}
