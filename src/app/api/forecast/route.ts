import { NextResponse } from 'next/server';
import { fetchRealForecast, fetchRealStockQuote, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const timeframe = searchParams.get('timeframe') || '7days';

  const stockKey = symbol.toUpperCase();

  try {
    const [quote, ohlcv] = await Promise.all([
      fetchRealStockQuote(stockKey),
      fetchHistoricalOHLCV(stockKey, 45),
    ]);

    if (!quote || quote.price <= 0) {
      return NextResponse.json({
        error: 'No Live Data Available',
        message: `Could not fetch data for ${stockKey}.`,
        symbol: stockKey,
        dataSource: 'none',
      });
    }

    let indicators: Record<string, number | undefined> = {};
    if (ohlcv && ohlcv.length >= 30) {
      const computed = computeAllIndicators(ohlcv);
      if (computed) indicators = {
        rsi: computed.latest.rsi, macd: computed.latest.macd,
        sma20: computed.latest.sma20, sma50: computed.latest.sma50,
        ema12: computed.latest.ema12, ema26: computed.latest.ema26,
        bbUpper: computed.latest.bbUpper, bbLower: computed.latest.bbLower,
        atr: computed.latest.atr,
      };
    }

    const forecast = await fetchRealForecast(stockKey, quote.price, timeframe, indicators);

    if (!forecast) {
      return NextResponse.json({
        error: 'No Live Data Available',
        message: `Forecast unavailable for ${stockKey}.`,
        symbol: stockKey,
        dataSource: 'none',
      });
    }

    const historical = (ohlcv || []).slice(-30).map((d) => ({ date: d.date, price: d.close }));

    return NextResponse.json({
      symbol: stockKey,
      stockName: quote.name || stockKey,
      currentPrice: quote.price,
      timeframe,
      dataSource: 'real',
      historical,
      forecast: forecast.points,
      summary: forecast.summary,
    });
  } catch (error) {
    console.error(`Forecast API error:`, error);
    return NextResponse.json({ error: 'No Live Data Available', symbol: stockKey, dataSource: 'none' });
  }
}