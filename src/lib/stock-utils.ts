// Stock utility functions — REAL calculations only
// NO mock data, NO generated prices, NO fake indicators

// ── Type Definitions ──────────────────────────────────────────────

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number;
  eps: number;
  dividend: number;
  high52w: number;
  low52w: number;
  dayRange: string;
  timestamp: string;
}

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSeries {
  values: number[];
  name: string;
  color: string;
}

// ── Technical Indicator Calculations ────────────────────────────────
// All indicators calculate from REAL OHLCV data only

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

  return { macd: macdLine, signal: signalLine, histogram };
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

// ── Extended Technical Indicators ──────────────────────────────────

export function calculateVWAP(data: OHLCV[]): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativeTPV += tp * data[i].volume;
    cumulativeVolume += data[i].volume;
    result.push(cumulativeVolume > 0 ? parseFloat((cumulativeTPV / cumulativeVolume).toFixed(2)) : NaN);
  }
  return result;
}

export function calculateADX(data: OHLCV[], period: number = 14): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      tr.push(data[i].high - data[i].low);
      continue;
    }

    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    tr.push(Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    ));
  }

  const smoothTR = calculateSMA(tr, period);
  const smoothPlusDM = calculateSMA(plusDM, period);
  const smoothMinusDM = calculateSMA(minusDM, period);

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const pdi = (!isNaN(smoothTR[i]) && smoothTR[i] > 0)
      ? (smoothPlusDM[i] / smoothTR[i]) * 100
      : NaN;
    const mdi = (!isNaN(smoothTR[i]) && smoothTR[i] > 0)
      ? (smoothMinusDM[i] / smoothTR[i]) * 100
      : NaN;

    plusDI.push(pdi);
    minusDI.push(mdi);

    if (!isNaN(pdi) && !isNaN(mdi) && (pdi + mdi) > 0) {
      dx.push(Math.abs(pdi - mdi) / (pdi + mdi) * 100);
    } else {
      dx.push(NaN);
    }
  }

  const validDX = dx.filter((v) => !isNaN(v)) as number[];
  const adx = calculateSMA(validDX, period);

  // Pad with NaN to align with original data length
  const nanCount = data.length - adx.length;
  const paddedADX = Array(nanCount).fill(NaN).concat(adx);

  return { adx: paddedADX, plusDI, minusDI };
}

export function calculateStochasticRSI(data: number[], rsiPeriod: number = 14, stochPeriod: number = 14, kSmooth: number = 3, dSmooth: number = 3): { k: number[]; d: number[] } {
  const rsiValues = calculateRSI(data, rsiPeriod);

  const stochRSI: number[] = [];
  for (let i = 0; i < rsiValues.length; i++) {
    if (i < stochPeriod - 1 || isNaN(rsiValues[i])) {
      stochRSI.push(NaN);
    } else {
      const slice = rsiValues.slice(i - stochPeriod + 1, i + 1).filter((v) => !isNaN(v)) as number[];
      if (slice.length < 2) {
        stochRSI.push(NaN);
      } else {
        const min = Math.min(...slice);
        const max = Math.max(...slice);
        stochRSI.push(max === min ? 50 : ((rsiValues[i] - min) / (max - min)) * 100);
      }
    }
  }

  const k = calculateSMA(stochRSI, kSmooth);
  const d = calculateSMA(k.filter((v) => !isNaN(v)) as number[], dSmooth);

  const paddedD = Array(k.length - d.length).fill(NaN).concat(d);
  return { k, d: paddedD };
}

export function calculateOBV(data: OHLCV[]): number[] {
  const result: number[] = [data[0]?.volume || 0];

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      result.push(result[i - 1] + data[i].volume);
    } else if (data[i].close < data[i - 1].close) {
      result.push(result[i - 1] - data[i].volume);
    } else {
      result.push(result[i - 1]);
    }
  }
  return result;
}

export function calculateCCI(data: OHLCV[], period: number = 20): number[] {
  const tp = data.map((d) => (d.high + d.low + d.close) / 3);
  const sma = calculateSMA(tp, period);
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || isNaN(sma[i])) {
      result.push(NaN);
    } else {
      const slice = tp.slice(i - period + 1, i + 1);
      const meanDev = slice.reduce((sum, val) => sum + Math.abs(val - sma[i]), 0) / period;
      result.push(meanDev === 0 ? 0 : (tp[i] - sma[i]) / (0.015 * meanDev));
    }
  }
  return result;
}

export function calculateIchimoku(data: OHLCV[], tenkan: number = 9, kijun: number = 26, senkou: number = 52): {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
} {
  const midHL = (arr: OHLCV[], start: number, period: number) => {
    const slice = arr.slice(Math.max(0, start - period + 1), start + 1);
    return (Math.max(...slice.map((d) => d.high)) + Math.min(...slice.map((d) => d.low))) / 2;
  };

  const tenkanLine = data.map((_, i) => i < tenkan - 1 ? NaN : midHL(data, i, tenkan));
  const kijunLine = data.map((_, i) => i < kijun - 1 ? NaN : midHL(data, i, kijun));

  const senkouA: number[] = [];
  const senkouB: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(tenkanLine[i]) || isNaN(kijunLine[i])) {
      senkouA.push(NaN);
    } else {
      senkouA.push((tenkanLine[i] + kijunLine[i]) / 2);
    }
    senkouB.push(i < senkou - 1 ? NaN : midHL(data, i, senkou));
  }

  const chikou = data.map((d, i) => d.close);

  return { tenkan: tenkanLine, kijun: kijunLine, senkouA, senkouB, chikou };
}

export function calculateParabolicSAR(data: OHLCV[], step: number = 0.02, maxStep: number = 0.2): number[] {
  if (data.length < 2) return data.map(() => NaN);

  const result: number[] = new Array(data.length).fill(NaN);
  let isUpTrend = data[1].close > data[0].close;
  let af = step;
  let ep = isUpTrend ? data[0].high : data[0].low;
  let sar = isUpTrend ? data[0].low : data[0].high;

  for (let i = 1; i < data.length; i++) {
    sar = sar + af * (ep - sar);

    // Check for trend reversal
    if (isUpTrend) {
      if (data[i].low < sar) {
        isUpTrend = false;
        sar = ep;
        ep = data[i].low;
        af = step;
      } else {
        if (data[i].high > ep) {
          ep = data[i].high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      if (data[i].high > sar) {
        isUpTrend = true;
        sar = ep;
        ep = data[i].high;
        af = step;
      } else {
        if (data[i].low < ep) {
          ep = data[i].low;
          af = Math.min(af + step, maxStep);
        }
      }
    }

    result[i] = parseFloat(sar.toFixed(2));
  }
  return result;
}

export function calculateMomentum(data: number[], period: number = 10): number[] {
  return data.map((_, i) => i < period ? NaN : data[i] - data[i - period]);
}

// ── Compute all indicators from real OHLCV ─────────────────────────

export function computeAllIndicators(ohlcv: OHLCV[]) {
  if (!ohlcv.length) return null;

  const closes = ohlcv.map((d) => d.close);
  const lastIdx = closes.length - 1;

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  const atr = calculateATR(ohlcv);
  const vwap = calculateVWAP(ohlcv);
  const adx = calculateADX(ohlcv);
  const stochRsi = calculateStochasticRSI(closes);
  const obv = calculateOBV(ohlcv);
  const cci = calculateCCI(ohlcv);
  const ichimoku = calculateIchimoku(ohlcv);
  const psar = calculateParabolicSAR(ohlcv);
  const momentum = calculateMomentum(closes);

  return {
    latest: {
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
      vwap: vwap[lastIdx],
      adx: adx.adx[lastIdx],
      adxPlusDI: adx.plusDI[lastIdx],
      adxMinusDI: adx.minusDI[lastIdx],
      stochK: stochRsi.k[lastIdx],
      stochD: stochRsi.d[lastIdx],
      obv: obv[lastIdx],
      cci: cci[lastIdx],
      ichimokuTenkan: ichimoku.tenkan[lastIdx],
      ichimokuKijun: ichimoku.kijun[lastIdx],
      ichimokuSenkouA: ichimoku.senkouA[lastIdx],
      ichimokuSenkouB: ichimoku.senkouB[lastIdx],
      psar: psar[lastIdx],
      momentum: momentum[lastIdx],
    },
    series: {
      sma20, sma50, ema12, ema26, rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      atr, vwap,
      adx: adx.adx,
      adxPlusDI: adx.plusDI,
      adxMinusDI: adx.minusDI,
      stochK: stochRsi.k,
      stochD: stochRsi.d,
      obv, cci,
      ichimokuTenkan: ichimoku.tenkan,
      ichimokuKijun: ichimoku.kijun,
      ichimokuSenkouA: ichimoku.senkouA,
      ichimokuSenkouB: ichimoku.senkouB,
      psar, momentum,
    },
  };
}

// ── Format Helpers ─────────────────────────────────────────────────

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

// ── Known stock symbols for search/autocomplete ────────────────────

export const KNOWN_SYMBOLS: Array<{ symbol: string; name: string; sector: string; exchange: string }> = [
  // US symbols
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors', exchange: 'NASDAQ' },
  { symbol: 'GOOG', name: 'Alphabet Inc.', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial Services', exchange: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', exchange: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', exchange: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Cyclical', exchange: 'NYSE' },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication', exchange: 'NYSE' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication', exchange: 'NASDAQ' },
  // Indian symbols (NSE)
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Conglomerate', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', sector: 'IT Services', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys Ltd.', sector: 'IT Services', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', sector: 'IT Services', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Ltd.', sector: 'FMCG', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', sector: 'Telecom', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', sector: 'FMCG', exchange: 'NSE' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', sector: 'Infrastructure', exchange: 'NSE' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', sector: 'IT Services', exchange: 'NSE' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', sector: 'Financial Services', exchange: 'NSE' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', sector: 'Automotive', exchange: 'NSE' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', sector: 'Consumer Goods', exchange: 'NSE' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', sector: 'Pharma', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', sector: 'Automotive', exchange: 'NSE' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd.', sector: 'Power', exchange: 'NSE' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', sector: 'Conglomerate', exchange: 'NSE' },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', sector: 'Consumer Goods', exchange: 'NSE' },
  { symbol: 'NIFTY', name: 'Nifty 50', sector: 'Index', exchange: 'NSE' },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank', sector: 'Index', exchange: 'NSE' },
];

export function getCompanyName(symbol: string): string {
  const found = KNOWN_SYMBOLS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
  return found?.name || symbol;
}

export function getKnownSymbol(symbol: string) {
  return KNOWN_SYMBOLS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}

/** Check whether a symbol is an Indian market symbol (NSE-listed). */
export function isIndianSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return KNOWN_SYMBOLS.some((s) => s.symbol === upper && s.exchange === 'NSE');
}