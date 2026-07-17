import { NextResponse } from 'next/server';
import { STOCKS, generateStockData, calculateSMA, calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR } from '@/lib/stock-utils';
import { fetchRealStockQuote } from '@/lib/ai-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90');

  const stockKey = symbol.toUpperCase();
  const baseStock = STOCKS[stockKey];
  if (!baseStock) {
    return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
  }

  // Try fetching real-time data from web search + LLM
  let realQuote = await fetchRealStockQuote(stockKey);
  let stock = { ...baseStock };
  let dataSource: 'real' | 'static' = 'static';

  if (realQuote) {
    dataSource = 'real';
    // Update stock with real data where available
    if (realQuote.price > 0) {
      const ratio = realQuote.price / stock.price;
      stock.price = realQuote.price;
      stock.change = realQuote.change || stock.change;
      stock.changePercent = realQuote.changePercent || stock.changePercent;
      if (realQuote.volume > 0) stock.volume = realQuote.volume;
      if (realQuote.marketCap > 0) stock.marketCap = realQuote.marketCap;
      if (realQuote.high52w > 0) stock.high52w = realQuote.high52w;
      if (realQuote.low52w > 0) stock.low52w = realQuote.low52w;
      if (realQuote.pe > 0) stock.pe = realQuote.pe;
    }
  }

  // Generate OHLCV data (historical is simulated but ends at real current price)
  const ohlcv = generateStockData(stockKey, days);
  const closes = ohlcv.map((d) => d.close);

  // If we have real data, adjust the last few candles to converge on real price
  if (realQuote && realQuote.price > 0) {
    const lastClose = ohlcv[ohlcv.length - 1]?.close || stock.price;
    const ratio = realQuote.price / lastClose;
    // Smoothly adjust last 5 candles
    for (let i = Math.max(0, ohlcv.length - 5); i < ohlcv.length; i++) {
      const blend = 0.2 + (i - (ohlcv.length - 5)) * 0.2;
      const adj = 1 + (ratio - 1) * blend;
      ohlcv[i] = {
        ...ohlcv[i],
        open: parseFloat((ohlcv[i].open * adj).toFixed(2)),
        high: parseFloat((ohlcv[i].high * adj).toFixed(2)),
        low: parseFloat((ohlcv[i].low * adj).toFixed(2)),
        close: parseFloat((ohlcv[i].close * adj).toFixed(2)),
      };
    }
    // Recalculate closes after adjustment
    const adjustedCloses = ohlcv.map((d) => d.close);
    const sma20 = calculateSMA(adjustedCloses, 20);
    const sma50 = calculateSMA(adjustedCloses, 50);
    const ema12 = calculateEMA(adjustedCloses, 12);
    const ema26 = calculateEMA(adjustedCloses, 26);
    const rsi = calculateRSI(adjustedCloses, 14);
    const macd = calculateMACD(adjustedCloses);
    const bb = calculateBollingerBands(adjustedCloses);
    const atr = calculateATR(ohlcv);
    const lastIdx = adjustedCloses.length - 1;

    return NextResponse.json({
      stock,
      dataSource,
      realQuote: realQuote ? {
        price: realQuote.price,
        change: realQuote.change,
        changePercent: realQuote.changePercent,
        source: realQuote.source,
        fetchedAt: realQuote.fetchedAt,
        dayHigh: realQuote.dayHigh,
        dayLow: realQuote.dayLow,
        openPrice: realQuote.openPrice,
      } : null,
      ohlcv,
      indicators: {
        sma20: sma20[lastIdx],
        sma50: sma50[lastIdx],
        ema12: ema12[lastIdx],
        ema26: ema26[lastIdx],
        rsi: rsi[lastIdx],
        macd: macd.macd[lastIdx],
        macdSignal: macd.signal[macd.signal.length - 1],
        macdHistogram: macd.histogram[lastIdx],
        bbUpper: bb.upper[lastIdx],
        bbMiddle: bb.middle[lastIdx],
        bbLower: bb.lower[lastIdx],
        atr: atr[lastIdx],
      },
      series: {
        sma20, sma50, ema12, ema26, rsi,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        bbUpper: bb.upper,
        bbMiddle: bb.middle,
        bbLower: bb.lower,
        atr,
      },
    });
  }

  // Fallback: use original static data with indicators
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  const atr = calculateATR(ohlcv);
  const lastIdx = closes.length - 1;

  return NextResponse.json({
    stock,
    dataSource,
    realQuote: null,
    ohlcv,
    indicators: {
      sma20: sma20[lastIdx],
      sma50: sma50[lastIdx],
      ema12: ema12[lastIdx],
      ema26: ema26[lastIdx],
      rsi: rsi[lastIdx],
      macd: macd.macd[lastIdx],
      macdSignal: macd.signal[macd.signal.length - 1],
      macdHistogram: macd.histogram[lastIdx],
      bbUpper: bb.upper[lastIdx],
      bbMiddle: bb.middle[lastIdx],
      bbLower: bb.lower[lastIdx],
      atr: atr[lastIdx],
    },
    series: {
      sma20, sma50, ema12, ema26, rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      atr,
    },
  });
}