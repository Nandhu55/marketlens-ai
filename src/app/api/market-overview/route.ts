import { NextResponse } from 'next/server';
import {
  isIndianSymbol,
  isUSSymbol,
  getMarketDataProviderStatus,
  getIndianMarketStatus,
  fetchQuote,
  isMarketDataError,
  type MarketQuote,
} from '@/lib/market-data';
import { getCompanyName } from '@/lib/stock-utils';

/**
 * Fetch quotes for a list of symbols using the market-data providers.
 * Indian → Upstox, US → Twelve Data.
 * If a symbol fails, it is omitted — other symbols still succeed.
 */
async function fetchQuotesFromProviders(symbols: string[]) {
  const realQuotes: Record<string, {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    name: string;
    source: string;
    fetchedAt: string;
  }> = {};

  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const quoteResult = await fetchQuote(sym);
      if (isMarketDataError(quoteResult)) return null;
      return { sym, quote: quoteResult.data };
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      const { sym, quote } = result.value;
      realQuotes[sym] = {
        price: quote.price,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        volume: quote.volume || 0,
        name: getCompanyName(sym),
        source: quote.source,
        fetchedAt: quote.timestamp,
      };
    }
  });

  return realQuotes;
}

/**
 * Compute top gainers and losers from the fetched quotes.
 */
function computeGainersLosers(quotes: Record<string, { price: number; changePercent: number; name: string; source: string }>) {
  const entries = Object.entries(quotes)
    .map(([symbol, q]) => ({ symbol, change: q.changePercent, price: q.price, name: q.name }))
    .filter(e => e.price > 0);

  const sorted = [...entries].sort((a, b) => b.change - a.change);
  const topGainers = sorted.filter(e => e.change > 0).slice(0, 5);
  const topLosers = sorted.filter(e => e.change < 0).reverse().slice(0, 5);

  return { topGainers, topLosers };
}

export async function GET() {
  try {
    // Fetch quotes for major US and Indian symbols
    const usSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOG'];
    const indianSymbols = ['RELIANCE', 'TCS', 'INFY'];
    const allSymbols = [...usSymbols, ...indianSymbols];

    const [quotes, providerStatus, indianMarketStatus] = await Promise.all([
      fetchQuotesFromProviders(allSymbols),
      getMarketDataProviderStatus().catch(() => ({
        indian: 'UNKNOWN' as const,
        us: 'UNKNOWN' as const,
        indianProvider: 'upstox',
        usProvider: 'finnhub',
      })),
      Promise.resolve(getIndianMarketStatus()),
    ]);

    const { topGainers, topLosers } = computeGainersLosers(quotes);

    // Compute fear & greed index from market sentiment
    // Simple heuristic: positive bias = higher index
    const allChanges = Object.values(quotes).map(q => q.changePercent);
    const avgChange = allChanges.length > 0 ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length : 0;
    const fearGreedIndex = Math.round(Math.max(0, Math.min(100, 50 + avgChange * 5)));

    return NextResponse.json({
      success: true,
      hasRealData: Object.keys(quotes).length > 0,
      overview: {
        fearGreedIndex,
        marketTrend: fearGreedIndex > 55 ? 'Bullish' : fearGreedIndex < 45 ? 'Bearish' : 'Neutral',
        topGainers,
        topLosers,
        mostActive: Object.entries(quotes)
          .map(([symbol, q]) => ({ symbol, volume: q.volume, price: q.price, name: q.name }))
          .filter(e => e.volume > 0)
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 5),
        marketStatus: indianMarketStatus,
      },
      quotes,
      symbolsWithRealData: Object.keys(quotes),
      providerStatus,
      indianMarketStatus,
    });
  } catch (error) {
    console.error('Market overview error:', error);
    return NextResponse.json({
      success: false,
      hasRealData: false,
      overview: {
        fearGreedIndex: 0,
        marketTrend: 'Unknown',
        topGainers: [],
        topLosers: [],
        mostActive: [],
        marketStatus: 'Unknown',
      },
      quotes: {},
      symbolsWithRealData: [],
      providerStatus: {
        indian: 'UNKNOWN' as const,
        us: 'UNKNOWN' as const,
        indianProvider: 'upstox',
        usProvider: 'finnhub',
      },
      indianMarketStatus: 'UNKNOWN',
    });
  }
}
