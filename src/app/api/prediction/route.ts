import { NextResponse } from 'next/server';
import { STOCKS, generateStockData, calculateRSI, calculateMACD } from '@/lib/stock-utils';

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  const stock = STOCKS[symbol.toUpperCase()];
  if (!stock) {
    return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
  }

  // Deterministic values based on symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash + symbol.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);

  const data = generateStockData(symbol, 60);
  const closes = data.map((d) => d.close);
  const rsi = calculateRSI(closes, 14);
  const lastRSI = rsi[rsi.length - 1] || 50;

  const bullishProb = Math.round(40 + seededRandom(seed + 1) * 45);
  const bearishProb = 100 - bullishProb;
  const confidence = Math.round(72 + seededRandom(seed + 2) * 18);
  const volatility = parseFloat((1.5 + seededRandom(seed + 3) * 4).toFixed(2));

  const isBullish = bullishProb > 55;
  const isBearish = bearishProb > 55;
  const recommendation = isBullish ? 'BUY' : isBearish ? 'SELL' : 'HOLD';

  const priceRange = stock.price * 0.03;
  const predictedPrice = parseFloat((stock.price * (isBullish ? 1.02 : isBearish ? 0.98 : 1.0)).toFixed(2));
  const upperBound = parseFloat((predictedPrice + priceRange).toFixed(2));
  const lowerBound = parseFloat((predictedPrice - priceRange).toFixed(2));

  const riskLevel = volatility > 4 ? 'High' : volatility > 2.5 ? 'Medium' : 'Low';

  // Historical accuracy simulation
  const predictedHistory: number[] = [];
  const actualHistory: number[] = [];
  for (let i = 0; i < 30; i++) {
    const base = stock.price * (0.9 + seededRandom(seed + 10 + i) * 0.15);
    actualHistory.push(parseFloat(base.toFixed(2)));
    predictedHistory.push(parseFloat((base * (0.98 + seededRandom(seed + 40 + i) * 0.04)).toFixed(2)));
  }

  const analysis = isBullish
    ? `Technical indicators suggest ${symbol} is in a bullish phase. The RSI at ${lastRSI.toFixed(1)} indicates ${lastRSI > 70 ? 'overbought conditions, suggesting potential short-term consolidation' : 'room for further upside momentum'}. Moving averages show a bullish alignment with the shorter-term MA trading above the longer-term MA. Volume trends support the current upward move, and MACD histogram shows increasing positive momentum. Key resistance level at $${(stock.price * 1.05).toFixed(2)} and support at $${(stock.price * 0.97).toFixed(2)}.`
    : isBearish
    ? `Technical analysis indicates ${symbol} is showing bearish signals. RSI at ${lastRSI.toFixed(1)} suggests ${lastRSI < 30 ? 'oversold conditions, which could present a buying opportunity' : 'weakening momentum with potential for further decline'}. The MACD has crossed below the signal line, confirming bearish momentum. Support levels to watch at $${(stock.price * 0.95).toFixed(2)} and $${(stock.price * 0.92).toFixed(2)}. Risk-reward ratio favors caution at current levels.`
    : `${symbol} is currently in a consolidation phase with mixed technical signals. RSI at ${lastRSI.toFixed(1)} is in neutral territory. Both bullish and bearish forces are balanced, suggesting a breakout in either direction is possible. Key levels to watch: resistance at $${(stock.price * 1.03).toFixed(2)} and support at $${(stock.price * 0.97).toFixed(2)}. Recommend waiting for clearer directional signals before taking position.`;

  return NextResponse.json({
    symbol,
    stock,
    prediction: {
      bullishProbability: bullishProb,
      bearishProbability: bearishProb,
      volatility,
      predictedPrice,
      upperBound,
      lowerBound,
      confidence,
      riskLevel,
      recommendation,
    },
    modelPerformance: {
      accuracy: (85 + seededRandom(seed + 5) * 8).toFixed(1),
      precision: (83 + seededRandom(seed + 6) * 8).toFixed(1),
      recall: (86 + seededRandom(seed + 7) * 8).toFixed(1),
      f1Score: (84 + seededRandom(seed + 8) * 8).toFixed(1),
      rmse: (1.5 + seededRandom(seed + 9) * 2).toFixed(2),
      mae: (1.2 + seededRandom(seed + 10) * 1.5).toFixed(2),
    },
    analysis,
    predictedHistory,
    actualHistory,
  });
}