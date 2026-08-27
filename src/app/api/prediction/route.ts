import { NextResponse } from 'next/server';
import { fetchRealPrediction, fetchRealStockQuote, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  const stockKey = symbol.toUpperCase();

  try {
    // Fetch quote + historical data in parallel
    const [quote, ohlcv] = await Promise.all([
      fetchRealStockQuote(stockKey),
      fetchHistoricalOHLCV(stockKey, 60),
    ]);

    if (!quote || quote.price <= 0) {
      return NextResponse.json({
        error: 'No Live Data Available',
        message: `Could not fetch data for ${stockKey}.`,
        symbol: stockKey,
        dataSource: 'none',
      });
    }

    // Calculate real technical indicators from OHLCV
    let indicators: Record<string, number | undefined> = {};
    if (ohlcv && ohlcv.length >= 30) {
      const computed = computeAllIndicators(ohlcv);
      if (computed) {
        indicators = {
          rsi: computed.latest.rsi,
          macd: computed.latest.macd,
          macdSignal: computed.latest.macdSignal,
          sma20: computed.latest.sma20,
          sma50: computed.latest.sma50,
          ema12: computed.latest.ema12,
          ema26: computed.latest.ema26,
          bbUpper: computed.latest.bbUpper,
          bbMiddle: computed.latest.bbMiddle,
          bbLower: computed.latest.bbLower,
          atr: computed.latest.atr,
          adx: computed.latest.adx,
        };
      }
    }

    // Get real AI prediction
    const prediction = await fetchRealPrediction(stockKey, quote.price, indicators);

    if (!prediction) {
      return NextResponse.json({
        error: 'No Live Data Available',
        message: `AI prediction service unavailable for ${stockKey}.`,
        symbol: stockKey,
        stock: {
          symbol: stockKey,
          name: quote.name || stockKey,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        },
        dataSource: 'partial',
        indicators,
        prediction: null,
      });
    }

    return NextResponse.json({
      symbol: stockKey,
      stock: {
        symbol: stockKey,
        name: quote.name || stockKey,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
      },
      dataSource: 'real',
      indicators,
      prediction,
    });
  } catch (error) {
    console.error(`Prediction API error for ${stockKey}:`, error);
    return NextResponse.json({
      error: 'No Live Data Available',
      message: `Failed to generate prediction for ${stockKey}.`,
      symbol: stockKey,
      dataSource: 'none',
    });
  }
}