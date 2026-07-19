import { NextResponse } from 'next/server';
import { fetchRealStockQuote, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators, getCompanyName, type StockInfo, type OHLCV } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90');

  const stockKey = symbol.toUpperCase();

  try {
    // Fetch real quote and historical data in parallel
    const [quote, ohlcv] = await Promise.all([
      fetchRealStockQuote(stockKey),
      fetchHistoricalOHLCV(stockKey, days),
    ]);

    if (!quote || quote.price <= 0) {
      return NextResponse.json({
        error: 'No Live Data Available',
        message: `Could not fetch real-time data for ${stockKey}. The stock may not exist or the data source may be temporarily unavailable.`,
        symbol: stockKey,
        dataSource: 'none',
      }, { status: 200 });
    }

    // Build stock info from real quote
    const stock: StockInfo = {
      symbol: stockKey,
      name: quote.name || getCompanyName(stockKey),
      sector: quote.sector || '',
      industry: quote.industry || '',
      exchange: quote.exchange || '',
      price: quote.price,
      open: quote.openPrice,
      high: quote.dayHigh,
      low: quote.dayLow,
      previousClose: quote.previousClose,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      avgVolume: quote.avgVolume,
      marketCap: quote.marketCap,
      pe: quote.pe,
      eps: quote.eps,
      dividend: quote.dividend,
      high52w: quote.high52w,
      low52w: quote.low52w,
      dayRange: quote.dayRange,
      timestamp: quote.fetchedAt,
    };

    // Compute technical indicators from real OHLCV data (or empty if no historical data)
    let indicators = null;
    let series = null;

    if (ohlcv && ohlcv.length >= 20) {
      const result = computeAllIndicators(ohlcv);
      if (result) {
        indicators = result.latest;
        series = result.series;
      }
    }

    return NextResponse.json({
      stock,
      dataSource: 'real',
      realQuote: {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        source: quote.source,
        fetchedAt: quote.fetchedAt,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        openPrice: quote.openPrice,
      },
      ohlcv: ohlcv || [],
      hasOHLCV: !!(ohlcv && ohlcv.length >= 20),
      indicators,
      series,
    });
  } catch (error) {
    console.error(`Stock API error for ${stockKey}:`, error);
    return NextResponse.json({
      error: 'No Live Data Available',
      message: `Failed to fetch data for ${stockKey}. Please try again.`,
      symbol: stockKey,
      dataSource: 'none',
    }, { status: 200 });
  }
}