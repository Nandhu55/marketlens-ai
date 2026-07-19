import { NextResponse } from 'next/server';
import { fetchMarketOverview, fetchRealStockQuote } from '@/lib/ai-service';

async function fetchQuotesSequentially(symbols: string[]) {
  const realQuotes: Record<string, {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    name: string;
    source: string;
    fetchedAt: string;
  }> = {};

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
          name: quote.name || sym,
          source: quote.source,
          fetchedAt: quote.fetchedAt,
        };
      }
    } catch {
      // Continue with other stocks
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return realQuotes;
}

export async function GET() {
  try {
    const symbols = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOG', 'META', 'AMZN', 'JPM', 'V', 'NFLX'];

    const [overview, quotes] = await Promise.all([
      fetchMarketOverview().catch(() => null),
      fetchQuotesSequentially(symbols),
    ]);

    return NextResponse.json({
      success: true,
      hasRealData: Object.keys(quotes).length > 0 || !!overview,
      overview: overview || {
        fearGreedIndex: 0,
        marketTrend: 'Unknown',
        topGainers: [],
        topLosers: [],
        mostActive: [],
        marketStatus: 'Unknown',
      },
      quotes,
      symbolsWithRealData: Object.keys(quotes),
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
    });
  }
}