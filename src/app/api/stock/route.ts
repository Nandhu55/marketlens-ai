import { NextResponse } from 'next/server';
import { computeAllIndicators, getCompanyName, type StockInfo } from '@/lib/stock-utils';
import {
  isIndianSymbol,
  isUSSymbol,
  getMarketDataProviderStatus,
  isMarketDataError,
  fetchQuote,
  fetchOHLCV,
  getSymbolMarket,
  type ProviderResult,
  type MarketQuote,
  type OHLCVCandle,
  type MarketDataError,
} from '@/lib/market-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90');

  const stockKey = symbol.toUpperCase();

  try {
    // ── All symbols: use market-service for truthful metadata ──
    // Indian → Upstox, US → Twelve Data, Unknown → Twelve Data
    const market = getSymbolMarket(stockKey);
    const [quoteResult, ohlcvResult] = await Promise.all([
      fetchQuote(stockKey),
      fetchOHLCV(stockKey, days),
    ]);

    // Check for provider errors (NOT_CONFIGURED, AUTH_ERROR, etc.)
    const quoteError: MarketDataError | null = isMarketDataError(quoteResult) ? quoteResult : null;
    const ohlcvError: MarketDataError | null = isMarketDataError(ohlcvResult) ? ohlcvResult : null;

    if (quoteError && quoteError.code === 'NOT_CONFIGURED') {
      const envVar = market === 'IN' ? 'UPSTOX_ANALYTICS_TOKEN' : 'FINNHUB_API_KEY';
      return NextResponse.json({
        error: 'NOT_CONFIGURED',
        message: `${envVar} is not configured`,
        symbol: stockKey,
        dataSource: 'none',
        providerStatus: 'NOT_CONFIGURED',
      }, { status: 200 });
    }

    if (quoteError) {
      return NextResponse.json({
        error: 'No Data Available',
        message: quoteError.message,
        symbol: stockKey,
        dataSource: 'none',
        providerStatus: quoteError.code,
      }, { status: 200 });
    }

    // At this point, quoteResult is ProviderResult<MarketQuote>
    const quoteData = quoteResult as ProviderResult<MarketQuote>;
    const mq = quoteData.data;

    // Build stock info from normalized market quote
    const stock: StockInfo = {
      symbol: stockKey,
      name: getCompanyName(stockKey),
      sector: '',
      industry: '',
      exchange: mq.exchange,
      price: mq.price,
      open: mq.open || 0,
      high: mq.high || 0,
      low: mq.low || 0,
      previousClose: mq.previousClose || 0,
      change: mq.change || 0,
      changePercent: mq.changePercent || 0,
      volume: mq.volume || 0,
      avgVolume: 0,
      marketCap: 0,
      pe: 0,
      eps: 0,
      dividend: 0,
      high52w: 0,
      low52w: 0,
      dayRange: mq.open && mq.high && mq.low
        ? `${mq.open.toFixed(2)} - ${mq.high.toFixed(2)}`
        : '',
      timestamp: mq.timestamp,
    };

    // Process OHLCV
    let ohlcv: import('@/lib/stock-utils').OHLCV[] = [];
    let indicators: Record<string, number> | null = null;
    let series: Record<string, number[]> | null = null;

    if (!ohlcvError) {
      const ohlcvData = ohlcvResult as ProviderResult<OHLCVCandle[]>;
      ohlcv = ohlcvData.data.map((c: OHLCVCandle) => ({
        date: c.timestamp.split('T')[0],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      if (ohlcv.length >= 20) {
        const result = computeAllIndicators(ohlcv);
        if (result) {
          indicators = result.latest;
          series = result.series;
        }
      }
    }

    return NextResponse.json({
      stock,
      dataSource: 'real',
      source: mq.source,
      dataStatus: quoteData.dataStatus,
      marketStatus: mq.marketStatus,
      providerStatus: await getMarketDataProviderStatus().then(s =>
        market === 'IN' ? s.indian : s.us
      ).catch(() => 'UNKNOWN'),
      realQuote: {
        price: mq.price,
        change: mq.change,
        changePercent: mq.changePercent,
        source: mq.source,
        fetchedAt: mq.timestamp,
        dayHigh: mq.high,
        dayLow: mq.low,
        openPrice: mq.open,
      },
      ohlcv,
      hasOHLCV: ohlcv.length >= 20,
      ohlcvError: ohlcvError ? { code: ohlcvError.code, message: ohlcvError.message } : null,
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
