import { NextResponse } from 'next/server';
import { fetchMarketOverview, fetchRealStockQuote } from '@/lib/ai-service';
import { STOCKS } from '@/lib/stock-utils';

// Fetch quotes sequentially with a small delay to avoid rate limits
async function fetchQuotesSequentially(symbols: string[]) {
  const realQuotes: Record<string, {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    source: string;
    fetchedAt: string;
  }> = {};

  // Only fetch the first 6 stocks to stay within rate limits
  // Others will be fetched on-demand when user navigates to them
  const symbolsToFetch = symbols.slice(0, 6);

  for (const sym of symbolsToFetch) {
    try {
      const quote = await fetchRealStockQuote(sym);
      if (quote && quote.price > 0) {
        realQuotes[sym] = {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          source: quote.source,
          fetchedAt: quote.fetchedAt,
        };
      }
    } catch {
      // Continue with other stocks even if one fails
    }
    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return realQuotes;
}

export async function GET() {
  try {
    // Fetch market overview and quotes in parallel (overview makes 1 search, quotes make up to 6)
    const [overview, quotes] = await Promise.all([
      fetchMarketOverview().catch(() => null),
      fetchQuotesSequentially(Object.keys(STOCKS)),
    ]);

    return NextResponse.json({
      success: true,
      hasRealData: Object.keys(quotes).length > 0,
      overview: overview || {
        fearGreedIndex: 50,
        marketTrend: 'Neutral',
        topGainers: [],
        topLosers: [],
      },
      quotes,
      symbolsWithRealData: Object.keys(quotes),
    });
  } catch (error) {
    console.error('Market overview error:', error);
    return NextResponse.json({
      success: false,
      hasRealData: false,
      overview: { fearGreedIndex: 50, marketTrend: 'Neutral', topGainers: [], topLosers: [] },
      quotes: {},
      symbolsWithRealData: [],
    });
  }
}