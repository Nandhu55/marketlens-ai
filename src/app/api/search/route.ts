import { NextResponse } from 'next/server';
import { KNOWN_SYMBOLS } from '@/lib/stock-utils';
import {
  getAllIndianSymbols,
  isIndianSymbol,
  searchSymbolsProvider,
  isMarketDataError,
  fetchQuote,
  isUSSymbol,
} from '@/lib/market-data';

/** Merge US KNOWN_SYMBOLS with Indian symbols for unified search. */
function getAllSymbols(): Array<{ symbol: string; name: string; sector: string; exchange: string; market?: string }> {
  const us = KNOWN_SYMBOLS.filter(s => !isIndianSymbol(s.symbol)).map(s => ({ ...s, market: 'US' }));
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
        s.symbol.toUpperCase().includes(upper) ||
        s.name.toUpperCase().includes(upper)
    )
    .slice(0, 10);

  // Try provider symbol search (Finnhub) for additional results
  let providerMatches: Array<{ symbol: string; name: string; exchange?: string; type?: string; market?: string }> = [];
  const providerResult = await searchSymbolsProvider(query);
  if (!isMarketDataError(providerResult) && providerResult.length > 0) {
    providerMatches = providerResult
      .filter(r => r.type === 'Common Stock' || r.type === 'ETF' || r.type === 'Index' || !r.type)
      .filter(r => !localMatches.some(l => l.symbol.toUpperCase() === r.symbol.toUpperCase()))
      .slice(0, 5)
      .map(r => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchange,
        type: r.type,
        market: 'US' as const,
      }));
  }

  // Merge local + provider results (dedup by symbol)
  // Normalize to a common shape with sector always present
  const allMatches: Array<{ symbol: string; name: string; sector: string; exchange: string; market?: string }> = [
    ...localMatches,
    ...providerMatches.map(p => ({ symbol: p.symbol, name: p.name, sector: '', exchange: p.exchange || '', market: p.market })),
  ];

  // Fetch real prices for matched symbols
  const enriched = await Promise.all(
    allMatches.map(async (s) => {
      try {
        const quoteResult = await fetchQuote(s.symbol);
        if (isMarketDataError(quoteResult)) {
          return {
            symbol: s.symbol,
            name: s.name,
            sector: s.sector || '',
            exchange: s.exchange || '',
            market: s.market,
            price: 0,
            change: 0,
            changePercent: 0,
            hasRealPrice: false,
          };
        }
        const mq = quoteResult.data;
        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector || '',
          exchange: s.exchange || mq.exchange,
          market: s.market || (isIndianSymbol(s.symbol) ? 'IN' : 'US'),
          price: mq.price,
          change: mq.change || 0,
          changePercent: mq.changePercent || 0,
          hasRealPrice: true,
        };
      } catch {
        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector || '',
          exchange: s.exchange || '',
          market: s.market,
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
