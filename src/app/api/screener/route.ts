import { NextResponse } from 'next/server';
import { fetchRealStockQuote, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators, KNOWN_SYMBOLS } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minPrice = parseFloat(searchParams.get('minPrice') || '0');
  const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999');
  const sector = searchParams.get('sector') || '';
  const minRSI = parseFloat(searchParams.get('minRSI') || '0');
  const maxRSI = parseFloat(searchParams.get('maxRSI') || '100');

  try {
    // Fetch real data for all known symbols (with rate limiting)
    const results: Array<{
      symbol: string;
      name: string;
      sector: string;
      exchange: string;
      price: number;
      change: number;
      changePercent: number;
      volume: number;
      marketCap: number;
      pe: number;
      rsi?: number;
      macd?: number;
      hasRealData: boolean;
    }> = [];

    const symbols = KNOWN_SYMBOLS.slice(0, 12); // Limit to avoid rate limits

    for (const sym of symbols) {
      // Apply filters that don't need API call
      if (sector && !sym.sector.toLowerCase().includes(sector.toLowerCase())) continue;

      try {
        const quote = await fetchRealStockQuote(sym.symbol);
        if (!quote || quote.price <= 0) continue;
        if (quote.price < minPrice || quote.price > maxPrice) continue;

        // Fetch OHLCV for technical indicators
        let rsi: number | undefined;
        let macd: number | undefined;
        try {
          const ohlcv = await fetchHistoricalOHLCV(sym.symbol, 30);
          if (ohlcv && ohlcv.length >= 20) {
            const computed = computeAllIndicators(ohlcv);
            if (computed) {
              rsi = computed.latest.rsi;
              macd = computed.latest.macd;
              if (rsi !== undefined && (rsi < minRSI || rsi > maxRSI)) continue;
            }
          }
        } catch {
          // OHLCV fetch failed, skip RSI filter
        }

        results.push({
          symbol: sym.symbol,
          name: sym.name,
          sector: sym.sector,
          exchange: sym.exchange,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          marketCap: quote.marketCap,
          pe: quote.pe,
          rsi,
          macd,
          hasRealData: true,
        });
      } catch {
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return NextResponse.json({
      results,
      total: results.length,
      dataSource: 'real',
    });
  } catch (error) {
    console.error('Screener error:', error);
    return NextResponse.json({
      results: [],
      total: 0,
      error: 'Screener data unavailable. Try again.',
      dataSource: 'none',
    });
  }
}