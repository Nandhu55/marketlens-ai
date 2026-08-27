import { NextResponse } from 'next/server';
import { fetchRealStockQuote, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators, getCompanyName, type StockInfo } from '@/lib/stock-utils';
import { isIndianSymbol, getMarketDataProviderStatus, isMarketDataError, fetchQuote, fetchOHLCV } from '@/lib/market-data';
import type { OHLCVCandle } from '@/lib/market-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90');

  const stockKey = symbol.toUpperCase();

  try {
    // ── Indian symbols: use market-service directly for truthful metadata ──
    if (isIndianSymbol(stockKey)) {
      const [quoteResult, ohlcvResult] = await Promise.all([
        fetchQuote(stockKey),
        fetchOHLCV(stockKey, days),
      ]);

      // Check for provider errors (NOT_CONFIGURED, AUTH_ERROR, etc.)
      const quoteError = isMarketDataError(quoteResult) ? quoteResult : null;
      const ohlcvError = isMarketDataError(ohlcvResult) ? ohlcvResult : null;

      if (quoteError && quoteError.code === 'NOT_CONFIGURED') {
        return NextResponse.json({
          error: 'NOT_CONFIGURED',
          message: 'UPSTOX_ANALYTICS_TOKEN is not configured',
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

      const mq = quoteResult.data;

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
      let indicators = null;
      let series = null;

      if (!ohlcvError) {
        ohlcv = ohlcvResult.data.map((c: OHLCVCandle) => ({
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
        source: 'upstox',
        dataStatus: quoteResult.dataStatus,
        marketStatus: mq.marketStatus,
        providerStatus: await getMarketDataProviderStatus().then(s => s.indian).catch(() => 'UNKNOWN'),
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
    }

    // ── US symbols: existing path (unchanged) ──
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
