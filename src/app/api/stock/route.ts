import { NextResponse } from 'next/server';
import { STOCKS, generateStockData, calculateSMA, calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR } from '@/lib/stock-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const days = parseInt(searchParams.get('days') || '90');

  const stock = STOCKS[symbol.toUpperCase()];
  if (!stock) {
    return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
  }

  const ohlcv = generateStockData(symbol.toUpperCase(), days);
  const closes = ohlcv.map((d) => d.close);

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