import { NextResponse } from 'next/server';
import { fetchRealStockQuote } from '@/lib/ai-service';
import { KNOWN_SYMBOLS } from '@/lib/stock-utils';
import { getAllIndianSymbols } from '@/lib/market-data';

/** Merge US KNOWN_SYMBOLS with Indian symbols for unified search. */
function getAllSymbols(): Array<{ symbol: string; name: string; sector: string; exchange: string; market?: string }> {
  const us = KNOWN_SYMBOLS.map(s => ({ ...s, market: 'US' }));
  const indian = getAllIndianSymbols().map(s => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector || '',
    exchange: s.exchange,
    market: 'IN',
  }));
  return [...indian, ...us]; // Indian first for this app
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const allSymbols = getAllSymbols();
  const upper = query.toUpperCase();

  // Search local symbols (both Indian and US)
  const localMatches = allSymbols
    .filter(
      (s) =>
        s.symbol.toLowerCase().includes(upper) ||
        s.name.toLowerCase().includes(upper)
    )
    .slice(0, 10);

  // Try to fetch real prices for matched symbols
  const enriched = await Promise.all(
    localMatches.map(async (s) => {
      try {
        const quote = await fetchRealStockQuote(s.symbol);
        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          exchange: s.exchange,
          market: s.market,
          price: quote?.price || 0,
          change: quote?.change || 0,
          changePercent: quote?.changePercent || 0,
          hasRealPrice: !!quote,
        };
      } catch {
        return {
          ...s,
          price: 0,
          change: 0,
          changePercent: 0,
          hasRealPrice: false,
        };
      }
    })
  );

  return NextResponse.json({ results: enriched });
}
