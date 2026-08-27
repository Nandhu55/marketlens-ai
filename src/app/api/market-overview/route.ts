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

  // Fetch quotes in parallel with a per-stock timeout
  const results = await Promise.allSettled(
    symbols.map((sym) =>
      Promise.race([
        fetchRealStockQuote(sym),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
      ])
    )
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      const sym = symbols[i];
      realQuotes[sym] = {
        price: result.value.price,
        change: result.value.change,
        changePercent: result.value.changePercent,
        volume: result.value.volume,
        name: result.value.name || sym,
        source: result.value.source,
        fetchedAt: result.value.fetchedAt,
      };
    }
  });

  return realQuotes;
}

export async function GET() {
  try {
    const symbols = ['AAPL', 'TSLA', 'MSFT', 'NVDA'];

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