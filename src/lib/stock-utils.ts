// Stock data definitions and generation utilities

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  avgVolume: number;
  pe: number;
  eps: number;
  dividend: number;
}

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const STOCKS: Record<string, StockInfo> = {
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    price: 198.45,
    change: 2.34,
    changePercent: 1.19,
    volume: 54234567,
    marketCap: 3050000000000,
    high52w: 210.0,
    low52w: 152.5,
    avgVolume: 52000000,
    pe: 31.2,
    eps: 6.36,
    dividend: 0.96,
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    sector: 'Automotive',
    price: 248.32,
    change: -5.67,
    changePercent: -2.23,
    volume: 98765432,
    marketCap: 792000000000,
    high52w: 299.29,
    low52w: 152.37,
    avgVolume: 95000000,
    pe: 62.5,
    eps: 3.97,
    dividend: 0,
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    sector: 'Technology',
    price: 445.78,
    change: 3.45,
    changePercent: 0.78,
    volume: 23456789,
    marketCap: 3310000000000,
    high52w: 468.35,
    low52w: 362.9,
    avgVolume: 22000000,
    pe: 37.1,
    eps: 12.02,
    dividend: 3.0,
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    sector: 'Semiconductors',
    price: 135.26,
    change: 4.89,
    changePercent: 3.75,
    volume: 345678901,
    marketCap: 3320000000000,
    high52w: 140.76,
    low52w: 47.32,
    avgVolume: 320000000,
    pe: 67.8,
    eps: 1.99,
    dividend: 0.16,
  },
  GOOG: {
    symbol: 'GOOG',
    name: 'Alphabet Inc.',
    sector: 'Technology',
    price: 178.92,
    change: 1.23,
    changePercent: 0.69,
    volume: 18765432,
    marketCap: 2200000000000,
    high52w: 191.75,
    low52w: 130.66,
    avgVolume: 18000000,
    pe: 25.8,
    eps: 6.93,
    dividend: 0,
  },
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    sector: 'Technology',
    price: 578.34,
    change: -3.21,
    changePercent: -0.55,
    volume: 15678901,
    marketCap: 1470000000000,
    high52w: 602.95,
    low52w: 350.68,
    avgVolume: 15000000,
    pe: 28.4,
    eps: 20.36,
    dividend: 2.0,
  },
  AMZN: {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    sector: 'Consumer Cyclical',
    price: 201.45,
    change: 2.67,
    changePercent: 1.34,
    volume: 45678901,
    marketCap: 2090000000000,
    high52w: 212.68,
    low52w: 144.05,
    avgVolume: 43000000,
    pe: 58.3,
    eps: 3.45,
    dividend: 0,
  },
  INFY: {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'IT Services',
    price: 18.92,
    change: 0.34,
    changePercent: 1.83,
    volume: 12345678,
    marketCap: 79000000000,
    high52w: 20.35,
    low52w: 14.28,
    avgVolume: 11000000,
    pe: 28.1,
    eps: 0.67,
    dividend: 0.37,
  },
  TCS: {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'IT Services',
    price: 41.23,
    change: -0.45,
    changePercent: -1.08,
    volume: 8765432,
    marketCap: 151000000000,
    high52w: 44.5,
    low52w: 33.12,
    avgVolume: 8000000,
    pe: 32.5,
    eps: 1.27,
    dividend: 0.52,
  },
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Conglomerate',
    price: 29.45,
    change: 0.78,
    changePercent: 2.72,
    volume: 15678901,
    marketCap: 200000000000,
    high52w: 32.15,
    low52w: 22.1,
    avgVolume: 14000000,
    pe: 27.8,
    eps: 1.06,
    dividend: 0.28,
  },
  JPM: {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    sector: 'Financial Services',
    price: 248.76,
    change: 1.89,
    changePercent: 0.76,
    volume: 9876543,
    marketCap: 712000000000,
    high52w: 270.5,
    low52w: 182.47,
    avgVolume: 9500000,
    pe: 12.3,
    eps: 20.22,
    dividend: 4.6,
  },
  V: {
    symbol: 'V',
    name: 'Visa Inc.',
    sector: 'Financial Services',
    price: 315.42,
    change: 2.15,
    changePercent: 0.69,
    volume: 6789012,
    marketCap: 645000000000,
    high52w: 325.0,
    low52w: 248.42,
    avgVolume: 6500000,
    pe: 30.5,
    eps: 10.34,
    dividend: 2.08,
  },
};

// Generate realistic OHLCV data using geometric Brownian motion
export function generateStockData(
  symbol: string,
  days: number = 180
): OHLCV[] {
  const stock = STOCKS[symbol];
  if (!stock) return generateGenericData(days);

  const data: OHLCV[] = [];
  let currentPrice = stock.price * (0.85 + Math.random() * 0.1);
  const volatility = 0.02 + Math.random() * 0.01;
  const drift = 0.0003;
  const baseVolume = stock.avgVolume;

  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = drift + volatility * (Math.random() * 2 - 1);
    const open = currentPrice;
    const intraVolatility = volatility * (0.5 + Math.random());
    const high = open * (1 + Math.abs(dailyReturn) + intraVolatility * Math.random() * 0.5);
    const low = open * (1 - Math.abs(dailyReturn) - intraVolatility * Math.random() * 0.5);
    const close = open * (1 + dailyReturn);
    const volumeFactor = 0.6 + Math.random() * 0.8;
    const volume = Math.round(baseVolume * volumeFactor);

    data.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(Math.max(low, open * 0.95).toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  // Adjust last close to match current price
  if (data.length > 0) {
    const ratio = stock.price / data[data.length - 1].close;
    data.forEach((d) => {
      d.open *= ratio;
      d.high *= ratio;
      d.low *= ratio;
      d.close *= ratio;
      d.open = parseFloat(d.open.toFixed(2));
      d.high = parseFloat(d.high.toFixed(2));
      d.low = parseFloat(d.low.toFixed(2));
      d.close = parseFloat(d.close.toFixed(2));
    });
  }

  return data;
}

function generateGenericData(days: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = 100 + Math.random() * 200;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 0.04;
    const open = price;
    const high = open * (1 + Math.random() * 0.02);
    const low = open * (1 - Math.random() * 0.02);
    const close = open * (1 + change);

    data.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.round(10000000 + Math.random() * 50000000),
    });

    price = close;
  }

  return data;
}

// Technical indicator calculations
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(sma);
    } else {
      const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  return result;
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(NaN);
      continue;
    }

    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);

    if (i < period) {
      result.push(NaN);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const prevAvgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function calculateMACD(
  data: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(data, fast);
  const slowEMA = calculateEMA(data, slow);

  const macdLine = fastEMA.map((f, i) => (isNaN(f) || isNaN(slowEMA[i]) ? NaN : f - slowEMA[i]));
  const validMACD = macdLine.filter((v) => !isNaN(v)) as number[];
  const signalLine = calculateEMA(validMACD, signal);

  const histogram = macdLine.map((m, i) => {
    if (isNaN(m)) return NaN;
    const si = i - (macdLine.length - signalLine.length);
    if (si < 0 || isNaN(signalLine[si])) return NaN;
    return m - signalLine[si];
  });

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
  };
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(parseFloat((mean + stdDev * std).toFixed(2)));
      lower.push(parseFloat((mean - stdDev * std).toFixed(2)));
    }
  }

  return { upper, middle, lower };
}

export function calculateATR(data: OHLCV[], period: number = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
    } else {
      const trVal = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      tr.push(trVal);
    }
  }
  return calculateSMA(tr, period);
}

// Format helpers
export function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}