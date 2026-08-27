import { NextResponse } from 'next/server';
import { fetchRealStockQuote } from '@/lib/ai-service';
import { KNOWN_SYMBOLS } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // Search local known symbols first
  const localMatches = KNOWN_SYMBOLS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

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
          price: quote?.price || 0,
          change: quote?.change || 0,
          changePercent: quote?.changePercent || 0,
          hasRealPrice: !!quote,
        };
      } catch {
        return { ...s, price: 0, change: 0, changePercent: 0, hasRealPrice: false };
      }
    })
  );

  return NextResponse.json({ results: enriched });
}