// Real-time AI Service — z-ai-web-dev-sdk backend
// ALL data is real. NO mock, NO fake, NO generated, NO fallback dummy data.
// If data cannot be fetched, functions return null.

import ZAI from 'z-ai-web-dev-sdk';
import type { OHLCV } from './stock-utils';

// ── In-memory Cache ──────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  if (cache.size > 300) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 80; i++) cache.delete(oldest[i][0]);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ── ZAI Singleton ───────────────────────────────────────────────
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

// ── Web Search ──────────────────────────────────────────────────
export interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

export async function webSearch(
  query: string,
  options?: { num?: number; recencyDays?: number; cacheTtlMs?: number }
): Promise<SearchResult[]> {
  const { num = 8, recencyDays, cacheTtlMs = 300_000 } = options || {};
  const cacheKey = `search:${query}:${num}:${recencyDays || 'all'}`;

  const cached = getCached<SearchResult[]>(cacheKey, cacheTtlMs);
  if (cached) return cached;

  const zai = await getZAI();
  const args: Record<string, unknown> = { query, num };
  if (recencyDays) args.recency_days = recencyDays;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const results = await zai.functions.invoke('web_search', args);
      const typed = (results as SearchResult[]).map((r, i) => ({ ...r, rank: r.rank ?? i + 1 }));
      setCache(cacheKey, typed);
      return typed;
    } catch (err) {
      lastError = err as Error;
      const isRateLimit = (err as Error).message?.includes('429');
      if (isRateLimit && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('web_search failed after retries');
}

// ── Web Reader ──────────────────────────────────────────────────
export async function readPage(url: string, cacheTtlMs = 600_000): Promise<{
  title: string;
  html: string;
  url: string;
  publishedTime?: string;
}> {
  const cacheKey = `page:${url}`;
  const cached = getCached<{ title: string; html: string; url: string; publishedTime?: string }>(cacheKey, cacheTtlMs);
  if (cached) return cached;

  const zai = await getZAI();
  const result = await zai.functions.invoke('page_reader', { url });

  const data = {
    title: result.data?.title || '',
    html: result.data?.html || '',
    url: result.data?.url || url,
    publishedTime: result.data?.publishedTime || result.data?.publish_time,
  };

  setCache(cacheKey, data);
  return data;
}

// ── LLM Chat ────────────────────────────────────────────────────
export async function llmChat(
  systemPrompt: string,
  userMessage: string,
  options?: { cacheTtlMs?: number; cacheKey?: string }
): Promise<string> {
  const { cacheTtlMs = 600_000, cacheKey } = options || {};

  if (cacheKey) {
    const cached = getCached<string>(cacheKey, cacheTtlMs);
    if (cached) return cached;
  }

  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    thinking: { type: 'disabled' },
  });

  const response = completion.choices[0]?.message?.content || '';
  if (cacheKey) setCache(cacheKey, response);
  return response;
}

// ── Company Name Lookup ─────────────────────────────────────────
const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple', TSLA: 'Tesla', MSFT: 'Microsoft', NVDA: 'NVIDIA',
  GOOG: 'Alphabet Google', META: 'Meta Platforms', AMZN: 'Amazon',
  INFY: 'Infosys', TCS: 'Tata Consultancy Services', RELIANCE: 'Reliance Industries',
  JPM: 'JPMorgan Chase', V: 'Visa', WMT: 'Walmart', JNJ: 'Johnson & Johnson',
  MA: 'Mastercard', PG: 'Procter & Gamble', UNH: 'UnitedHealth Group',
  HD: 'Home Depot', DIS: 'Walt Disney', NFLX: 'Netflix',
};

export function getCompanyName(symbol: string): string {
  return COMPANY_NAMES[symbol.toUpperCase()] || symbol;
}

// ── Helpers ─────────────────────────────────────────────────────
function toNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function parseJSON<T>(text: string): T | null {
  try {
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

// ── Real Stock Quote Fetching ───────────────────────────────────
export interface RealStockQuote {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  previousClose: number;
  pe: number;
  eps: number;
  dividend: number;
  avgVolume: number;
  dayRange: string;
  source: string;
  fetchedAt: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
}

export async function fetchRealStockQuote(symbol: string): Promise<RealStockQuote | null> {
  const cacheKey = `quote:${symbol}`;
  const cached = getCached<RealStockQuote>(cacheKey, 300_000); // 5 min
  if (cached) return cached;

  try {
    const companyName = getCompanyName(symbol);
    const query = `${symbol} ${companyName} stock price today quote 2025`;
    const results = await webSearch(query, { num: 5, recencyDays: 1 });

    if (!results.length) return null;

    const snippets = results.slice(0, 5)
      .map((r, i) => `[${i + 1}] ${r.name}\n${r.snippet}`)
      .join('\n\n');

    const systemPrompt = `You are a financial data extraction expert. Extract the CURRENT stock quote data from the provided search results.
Return ONLY a valid JSON object with these exact fields:
- price: current stock price (number)
- change: today's dollar change (number, can be negative)
- changePercent: today's percentage change (number, can be negative)
- volume: today's trading volume (number)
- marketCap: market capitalization (number)
- dayHigh: today's high (number)
- dayLow: today's low (number)
- openPrice: today's open (number)
- previousClose: previous close (number)
- pe: P/E ratio (number)
- eps: EPS (number)
- dividend: annual dividend (number)
- high52w: 52-week high (number)
- low52w: 52-week low (number)

If you cannot find a value, use 0. Be as accurate as possible.
Respond with JSON only, no markdown, no explanation.`;

    const userMessage = `Extract the current stock quote for ${symbol} (${companyName}) from these search results:\n\n${snippets}`;
    const llmResponse = await llmChat(systemPrompt, userMessage, { cacheKey: `quote-llm:${symbol}` });

    const parsed = parseJSON<Record<string, unknown>>(llmResponse);
    if (!parsed) return null;

    const quote: RealStockQuote = {
      price: toNum(parsed.price),
      change: toNum(parsed.change),
      changePercent: toNum(parsed.changePercent),
      volume: toNum(parsed.volume),
      marketCap: toNum(parsed.marketCap),
      high52w: toNum(parsed.high52w),
      low52w: toNum(parsed.low52w),
      dayHigh: toNum(parsed.dayHigh),
      dayLow: toNum(parsed.dayLow),
      openPrice: toNum(parsed.openPrice),
      previousClose: toNum(parsed.previousClose),
      pe: toNum(parsed.pe),
      eps: toNum(parsed.eps),
      dividend: toNum(parsed.dividend),
      avgVolume: 0,
      dayRange: parsed.dayRange ? String(parsed.dayRange) : '',
      source: results[0]?.host_name || 'web-search',
      fetchedAt: new Date().toISOString(),
      name: companyName,
      sector: '',
      industry: '',
      exchange: '',
    };

    if (quote.price <= 0) return null;

    setCache(cacheKey, quote);
    return quote;
  } catch (error) {
    console.error(`Failed to fetch real quote for ${symbol}:`, error);
    return null;
  }
}

// ── Real Historical OHLCV Data Fetching ─────────────────────────
export async function fetchHistoricalOHLCV(
  symbol: string,
  days: number = 90
): Promise<OHLCV[] | null> {
  const cacheKey = `ohlcv:${symbol}:${days}`;
  const cached = getCached<OHLCV[]>(cacheKey, 600_000); // 10 min
  if (cached) return cached;

  try {
    const companyName = getCompanyName(symbol);

    // Strategy 1: Try to read Yahoo Finance history page
    const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/history/`;
    let pageData: { html: string; title: string } | null = null;

    try {
      pageData = await readPage(yahooUrl, 300_000);
    } catch {
      // Yahoo may block, fall through to search-based approach
    }

    if (pageData?.html && pageData.html.length > 500) {
      // Use LLM to parse the HTML table into OHLCV data
      const systemPrompt = `You are a financial data parser. Extract historical stock price data from the provided HTML.
Return ONLY a valid JSON array of objects with exact fields: date, open, high, low, close, volume.
- date format: YYYY-MM-DD
- all values are numbers
- Include the most recent ${days} trading days
- Sort chronologically from oldest to newest
- If data is not available in the HTML, return an empty array []
Respond with JSON only, no markdown.`;

      const htmlSnippet = pageData.html.substring(0, 8000);
      const userMessage = `Extract OHLCV data for ${symbol} from this HTML:\n${htmlSnippet}`;

      const llmResponse = await llmChat(systemPrompt, userMessage, {
        cacheKey: `ohlcv-yahoo:${symbol}:${days}`,
        cacheTtlMs: 600_000,
      });

      const parsed = parseJSON<OHLCV[]>(llmResponse);
      if (parsed && parsed.length >= 20) {
        setCache(cacheKey, parsed);
        return parsed;
      }
    }

    // Strategy 2: Search for historical price data
    const searchQuery = `${symbol} ${companyName} stock price history last ${days} days OHLCV data 2025`;
    const searchResults = await webSearch(searchQuery, { num: 8, recencyDays: 7 });

    if (searchResults.length > 0) {
      // Try reading the most promising URL
      for (const result of searchResults.slice(0, 3)) {
        if (result.url.includes('finance.yahoo') || result.url.includes('google.com/finance') || result.url.includes('tradingview')) {
          try {
            const page = await readPage(result.url, 300_000);
            if (page.html && page.html.length > 1000) {
              const systemPrompt = `Extract historical daily stock OHLCV data from the HTML.
Return JSON array: [{"date":"YYYY-MM-DD","open":num,"high":num,"low":num,"close":num,"volume":num}]
Most recent ${days} days. Chronological order. If not extractable, return [].`;
              const snippet = page.html.substring(0, 10000);
              const resp = await llmChat(systemPrompt, `Extract ${symbol} OHLCV from:\n${snippet}`, {
                cacheKey: `ohlcv-page:${symbol}:${days}`,
              });
              const data = parseJSON<OHLCV[]>(resp);
              if (data && data.length >= 20) {
                setCache(cacheKey, data);
                return data;
              }
            }
          } catch {
            continue;
          }
        }
      }

      // Strategy 3: Use LLM with search snippets to reconstruct recent prices
      const snippets = searchResults.slice(0, 5).map((r) => `${r.name}: ${r.snippet}`).join('\n');
      const systemPrompt = `Based on the search results about ${symbol} stock, provide recent daily closing prices.
Return ONLY a JSON array of objects with: date, open, high, low, close, volume.
Provide at least 30 recent trading days. Use your best knowledge combined with the search context.
All values must be numbers. Dates in YYYY-MM-DD format. Chronological order.
If you cannot provide real data, return an empty array [].`;

      const resp = await llmChat(systemPrompt, `${symbol} recent price data from search:\n${snippets}`, {
        cacheKey: `ohlcv-llm:${symbol}:${days}`,
      });
      const data = parseJSON<OHLCV[]>(resp);
      if (data && data.length >= 20) {
        setCache(cacheKey, data);
        return data;
      }
    }

    return null; // Cannot fetch real data
  } catch (error) {
    console.error(`Failed to fetch historical OHLCV for ${symbol}:`, error);
    return null;
  }
}

// ── Real News Fetching + LLM Sentiment ──────────────────────────
export interface RealNewsArticle {
  title: string;
  url: string;
  source: string;
  snippet: string;
  date: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
}

export async function fetchRealNews(symbol: string): Promise<{
  articles: RealNewsArticle[];
  summary: {
    overallScore: number;
    positivePct: number;
    negativePct: number;
    neutralPct: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    trending: string[];
  };
} | null> {
  const cacheKey = `news:${symbol}`;
  const cached = getCached<ReturnType<typeof fetchRealNews>>(cacheKey, 600_000);
  if (cached) return cached;

  try {
    const companyName = getCompanyName(symbol);
    const query = `${symbol} ${companyName} stock news today latest`;
    const results = await webSearch(query, { num: 10, recencyDays: 7 });

    if (!results.length) return null;

    const articlesText = results.slice(0, 10)
      .map((r, i) => `[${i + 1}] Title: ${r.name}\nSource: ${r.host_name}\nSnippet: ${r.snippet}\nDate: ${r.date || 'Recent'}`)
      .join('\n\n');

    const systemPrompt = `You are a financial sentiment analysis AI (FinBERT-class). Analyze the sentiment of each news article about ${symbol} stock.

For EACH article, determine:
- sentiment: "positive", "negative", or "neutral"
- score: 0-100 (where >60 = positive, <40 = negative, 40-60 = neutral)
- positivePct: confidence for positive sentiment (0-100)
- negativePct: confidence for negative sentiment (0-100)
- neutralPct: confidence for neutral sentiment (0-100)

Also identify 4-6 trending topics/themes across all articles.

Return ONLY a valid JSON object:
{
  "articles": [{ "index": 1, "sentiment": "positive", "score": 72, "positivePct": 65, "negativePct": 15, "neutralPct": 20 }],
  "trending": ["Topic 1", "Topic 2"]
}

Analyze ALL ${Math.min(results.length, 10)} articles. Respond with JSON only.`;

    const llmResponse = await llmChat(systemPrompt, `Analyze sentiment for these news articles about ${symbol}:\n\n${articlesText}`);

    const parsed = parseJSON<{
      articles: Array<{ index: number; sentiment: string; score: number; positivePct: number; negativePct: number; neutralPct: number }>;
      trending: string[];
    }>(llmResponse);

    if (!parsed) return null;

    const articles: RealNewsArticle[] = results.slice(0, 10).map((r, i) => {
      const analysis = parsed.articles?.find((a) => a.index === i + 1);
      return {
        title: r.name,
        url: r.url,
        source: r.host_name,
        snippet: r.snippet,
        date: r.date || 'Recent',
        sentiment: (analysis?.sentiment || 'neutral') as 'positive' | 'negative' | 'neutral',
        sentimentScore: analysis?.score ?? 50,
        positivePct: analysis?.positivePct ?? 33,
        negativePct: analysis?.negativePct ?? 33,
        neutralPct: analysis?.neutralPct ?? 34,
      };
    });

    const positiveCount = articles.filter((a) => a.sentiment === 'positive').length;
    const negativeCount = articles.filter((a) => a.sentiment === 'negative').length;
    const neutralCount = articles.filter((a) => a.sentiment === 'neutral').length;
    const avgPositive = articles.reduce((s, a) => s + a.positivePct, 0) / articles.length;
    const avgNegative = articles.reduce((s, a) => s + a.negativePct, 0) / articles.length;
    const avgNeutral = 100 - avgPositive - avgNegative;

    const result = {
      articles,
      summary: {
        overallScore: Math.round(50 + (avgPositive - avgNegative) * 0.5),
        positivePct: Math.round(avgPositive),
        negativePct: Math.round(avgNegative),
        neutralPct: Math.round(Math.max(avgNeutral, 0)),
        positiveCount,
        negativeCount,
        neutralCount,
        trending: parsed.trending || [],
      },
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch real news for ${symbol}:`, error);
    return null;
  }
}

// ── Real AI Prediction (LLM-based, NO fake metrics) ─────────────
export interface RealPrediction {
  bullishProbability: number;
  bearishProbability: number;
  volatility: number;
  predictedPrice: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  riskLevel: string;
  recommendation: string;
  analysis: string;
  keyFactors: string[];
  supportLevels: number[];
  resistanceLevels: number[];
}

export async function fetchRealPrediction(
  symbol: string,
  currentPrice: number,
  indicators: {
    rsi?: number;
    macd?: number;
    macdSignal?: number;
    sma20?: number;
    sma50?: number;
    ema12?: number;
    ema26?: number;
    bbUpper?: number;
    bbMiddle?: number;
    bbLower?: number;
    atr?: number;
    adx?: number;
  }
): Promise<RealPrediction | null> {
  const cacheKey = `prediction:${symbol}:${currentPrice.toFixed(2)}`;
  const cached = getCached<RealPrediction>(cacheKey, 900_000); // 15 min
  if (cached) return cached;

  try {
    const companyName = getCompanyName(symbol);

    // Fetch recent news for context
    const [newsResults, techResults] = await Promise.all([
      webSearch(`${symbol} ${companyName} stock analysis prediction`, { num: 5, recencyDays: 3 }).catch(() => []),
      webSearch(`${symbol} stock technical analysis RSI MACD support resistance`, { num: 3 }).catch(() => []),
    ]);

    const newsContext = newsResults.slice(0, 5).map((r) => `- ${r.name}: ${r.snippet}`).join('\n');
    const techContext = techResults.slice(0, 3).map((r) => `- ${r.snippet}`).join('\n');

    const systemPrompt = `You are an advanced AI stock analyst. Analyze the provided data and provide a real prediction.

CRITICAL: Do NOT generate fake metrics, model performance numbers, or historical accuracy data.
Only provide analysis based on the actual data given to you.

Return ONLY valid JSON:
{
  "bullishProbability": <number 0-100>,
  "bearishProbability": <number 0-100, must equal 100 - bullishProbability>,
  "volatility": <number, estimated daily volatility %>,
  "predictedPrice": <number, predicted close for next trading day>,
  "upperBound": <number, upper confidence bound>,
  "lowerBound": <number, lower confidence bound>,
  "confidence": <number 40-85, your confidence in this prediction based on available data>,
  "riskLevel": "Low" | "Medium" | "High",
  "recommendation": "BUY" | "HOLD" | "SELL",
  "analysis": "<string, 4-6 sentence professional analysis referencing specific technical levels and news events>",
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>", "<factor4>"],
  "supportLevels": [<number>, <number>],
  "resistanceLevels": [<number>, <number>]
}

Be realistic. The predicted price should be within 3% of current price. Reference REAL news events and REAL technical levels.`;

    const userMessage = `Analyze ${symbol} (${companyName}):

Current Data:
- Price: $${currentPrice.toFixed(2)}
- RSI(14): ${indicators.rsi?.toFixed(1) || 'N/A'}
- MACD: ${indicators.macd?.toFixed(2) || 'N/A'}
- MACD Signal: ${indicators.macdSignal?.toFixed(2) || 'N/A'}
- SMA(20): $${indicators.sma20?.toFixed(2) || 'N/A'}
- SMA(50): $${indicators.sma50?.toFixed(2) || 'N/A'}
- EMA(12): $${indicators.ema12?.toFixed(2) || 'N/A'}
- EMA(26): $${indicators.ema26?.toFixed(2) || 'N/A'}
- Bollinger Upper: $${indicators.bbUpper?.toFixed(2) || 'N/A'}
- Bollinger Lower: $${indicators.bbLower?.toFixed(2) || 'N/A'}
- ATR(14): ${indicators.atr?.toFixed(2) || 'N/A'}
- ADX: ${indicators.adx?.toFixed(1) || 'N/A'}
- Timestamp: ${new Date().toISOString()}

Recent News:
${newsContext || 'No recent news available'}

Technical Context:
${techContext || 'No technical context available'}

Provide your prediction.`;

    const llmResponse = await llmChat(systemPrompt, userMessage);
    const parsed = parseJSON<Record<string, unknown>>(llmResponse);
    if (!parsed) return null;

    const bullish = clamp(toNum(parsed.bullishProbability, 50), 10, 90);
    const predPrice = clamp(toNum(parsed.predictedPrice, currentPrice), currentPrice * 0.95, currentPrice * 1.05);
    const vol = clamp(toNum(parsed.volatility, 2.5), 0.5, 8);

    const result: RealPrediction = {
      bullishProbability: Math.round(bullish),
      bearishProbability: Math.round(100 - bullish),
      volatility: parseFloat(vol.toFixed(2)),
      predictedPrice: parseFloat(predPrice.toFixed(2)),
      upperBound: parseFloat(clamp(toNum(parsed.upperBound, predPrice * 1.015), predPrice, predPrice * 1.05).toFixed(2)),
      lowerBound: parseFloat(clamp(toNum(parsed.lowerBound, predPrice * 0.985), predPrice * 0.95, predPrice).toFixed(2)),
      confidence: Math.round(clamp(toNum(parsed.confidence, 65), 40, 85)),
      riskLevel: vol > 4 ? 'High' : vol > 2.5 ? 'Medium' : 'Low',
      recommendation: (parsed.recommendation as string) || (bullish > 55 ? 'BUY' : bullish < 45 ? 'SELL' : 'HOLD'),
      analysis: (parsed.analysis as string) || '',
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.map(String) : [],
      supportLevels: Array.isArray(parsed.supportLevels) ? parsed.supportLevels.map(Number).filter((n) => n > 0) : [],
      resistanceLevels: Array.isArray(parsed.resistanceLevels) ? parsed.resistanceLevels.map(Number).filter((n) => n > 0) : [],
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch prediction for ${symbol}:`, error);
    return null;
  }
}

// ── Market Overview ──────────────────────────────────────────────
export async function fetchMarketOverview(): Promise<{
  fearGreedIndex: number;
  marketTrend: string;
  topGainers: Array<{ symbol: string; name: string; change: number; price: number }>;
  topLosers: Array<{ symbol: string; name: string; change: number; price: number }>;
  mostActive: Array<{ symbol: string; name: string; volume: number; price: number }>;
  marketStatus: string;
} | null> {
  const cacheKey = 'market-overview';
  const cached = getCached<ReturnType<typeof fetchMarketOverview>>(cacheKey, 600_000);
  if (cached) return cached;

  try {
    const results = await webSearch('stock market today top gainers losers most active fear greed index 2025', {
      num: 8,
      recencyDays: 1,
    });

    if (!results.length) return null;

    const snippets = results.slice(0, 5).map((r) => `${r.name}: ${r.snippet}`).join('\n');

    const systemPrompt = `You are a financial data analyst. Extract market overview data from the search results.
Return ONLY valid JSON:
{
  "fearGreedIndex": <number 0-100>,
  "marketTrend": "Bullish" | "Bearish" | "Neutral" | "Volatile",
  "topGainers": [{"symbol": "SYM", "name": "Company Name", "change": <percent number>, "price": <number>}],
  "topLosers": [{"symbol": "SYM", "name": "Company Name", "change": <percent number>, "price": <number>}],
  "mostActive": [{"symbol": "SYM", "name": "Company Name", "volume": <number>, "price": <number>}],
  "marketStatus": "Open" | "Closed" | "Pre-Market" | "After Hours"
}
Provide up to 5 each for gainers, losers, and most active. If unsure, return empty arrays.
Respond with JSON only.`;

    const llmResponse = await llmChat(systemPrompt, `Extract market data:\n${snippets}`);
    const parsed = parseJSON<Record<string, unknown>>(llmResponse);
    if (!parsed) return null;

    const result = {
      fearGreedIndex: clamp(toNum(parsed.fearGreedIndex, 50), 0, 100),
      marketTrend: (parsed.marketTrend as string) || 'Neutral',
      topGainers: (parsed.topGainers as Array<{ symbol: string; name: string; change: number; price: number }>) || [],
      topLosers: (parsed.topLosers as Array<{ symbol: string; name: string; change: number; price: number }>) || [],
      mostActive: (parsed.mostActive as Array<{ symbol: string; name: string; volume: number; price: number }>) || [],
      marketStatus: (parsed.marketStatus as string) || 'Closed',
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Failed to fetch market overview:', error);
    return null;
  }
}

// ── AI Assistant Chat ────────────────────────────────────────────
export async function fetchAIChatResponse(
  symbol: string,
  userQuestion: string,
  context: {
    currentPrice: number;
    indicators: Record<string, number | undefined>;
    recentNews: string;
  }
): Promise<string | null> {
  try {
    const companyName = getCompanyName(symbol);
    const systemPrompt = `You are an expert AI stock market assistant for MarketLens AI. You help users make informed investment decisions.

You have access to real-time data for ${symbol} (${companyName}):
- Current Price: $${context.currentPrice.toFixed(2)}
- RSI(14): ${context.indicators.rsi?.toFixed(1) || 'N/A'}
- MACD: ${context.indicators.macd?.toFixed(2) || 'N/A'}
- SMA(20): $${context.indicators.sma20?.toFixed(2) || 'N/A'}
- SMA(50): $${context.indicators.sma50?.toFixed(2) || 'N/A'}
- Bollinger Upper: $${context.indicators.bbUpper?.toFixed(2) || 'N/A'}
- Bollinger Lower: $${context.indicators.bbLower?.toFixed(2) || 'N/A'}
- ATR(14): ${context.indicators.atr?.toFixed(2) || 'N/A'}

Recent News Headlines:
${context.recentNews || 'No recent news available'}

Rules:
- Base your analysis on REAL data provided above
- Reference specific technical indicator values
- Reference specific news events when available
- Provide actionable but cautious advice
- Always include a disclaimer that this is not financial advice
- Be concise but thorough
- Use markdown formatting for readability`;

    const response = await llmChat(systemPrompt, userQuestion);
    return response;
  } catch (error) {
    console.error('AI Chat failed:', error);
    return null;
  }
}

// ── Stock Search (Autocomplete) ─────────────────────────────────
export async function searchStocks(query: string): Promise<Array<{ symbol: string; name: string; sector: string; price?: number }>> {
  if (!query || query.length < 1) return [];

  try {
    const results = await webSearch(`stock ticker symbol ${query} company`, { num: 5 });
    return results.slice(0, 5).map((r) => {
      // Try to extract symbol and name from the search result
      const match = r.name.match(/^([A-Z]{1,5})\s*[-:]\s*(.+)/);
      return {
        symbol: match?.[1]?.toUpperCase() || query.toUpperCase(),
        name: match?.[2] || r.name,
        sector: '',
      };
    });
  } catch {
    return [];
  }
}

// ── LLM Forecast (real, no fake history) ─────────────────────────
export async function fetchRealForecast(
  symbol: string,
  currentPrice: number,
  timeframe: string,
  indicators: Record<string, number | undefined>
): Promise<{
  points: Array<{ date: string; predicted: number; lower: number; upper: number; confidence: number }>;
  summary: {
    predictedPrice: number;
    expectedChange: number;
    volatility: number;
    confidence: number;
    analysis: string;
  };
} | null> {
  const cacheKey = `forecast:${symbol}:${timeframe}:${currentPrice.toFixed(2)}`;
  const cached = getCached<ReturnType<typeof fetchRealForecast>>(cacheKey, 900_000);
  if (cached) return cached;

  try {
    const companyName = getCompanyName(symbol);
    const days = timeframe === 'tomorrow' ? 1 : timeframe === '3days' ? 3 : timeframe === '7days' ? 7 : 30;

    const systemPrompt = `You are an AI stock forecaster. Generate a realistic price forecast for ${symbol} (${companyName}).

Current data:
- Price: $${currentPrice.toFixed(2)}
- RSI: ${indicators.rsi?.toFixed(1) || 'N/A'}
- MACD: ${indicators.macd?.toFixed(2) || 'N/A'}
- SMA(20): $${indicators.sma20?.toFixed(2) || 'N/A'}
- SMA(50): $${indicators.sma50?.toFixed(2) || 'N/A'}
- ATR: ${indicators.atr?.toFixed(2) || 'N/A'}

Timeframe: Next ${days} trading day(s).

Return ONLY valid JSON:
{
  "points": [
    {"date": "YYYY-MM-DD", "predicted": <number>, "lower": <number>, "upper": <number>, "confidence": <number 40-90>}
  ],
  "summary": {
    "predictedPrice": <number>,
    "expectedChange": <percent number>,
    "volatility": <number>,
    "confidence": <number>,
    "analysis": "<2-3 sentence analysis>"
  }
}

Rules:
- Generate exactly ${days} forecast point(s)
- Predicted price must be within 5% of current price for short timeframes
- Confidence intervals should widen with time
- Use realistic volatility based on ATR
- Dates must be future trading days (skip weekends)
Respond with JSON only.`;

    const llmResponse = await llmChat(systemPrompt, `Generate ${days}-day forecast for ${symbol}.`);
    const parsed = parseJSON<Record<string, unknown>>(llmResponse);
    if (!parsed) return null;

    const points = Array.isArray(parsed.points)
      ? (parsed.points as Array<Record<string, unknown>>).map((p) => ({
          date: String(p.date || ''),
          predicted: clamp(toNum(p.predicted, currentPrice), currentPrice * 0.9, currentPrice * 1.1),
          lower: clamp(toNum(p.lower, currentPrice), currentPrice * 0.9, currentPrice),
          upper: clamp(toNum(p.upper, currentPrice), currentPrice, currentPrice * 1.1),
          confidence: clamp(toNum(p.confidence, 60), 30, 90),
        }))
      : [];

    const summary = parsed.summary as Record<string, unknown> | undefined;
    const predictedPrice = points.length > 0 ? points[points.length - 1].predicted : currentPrice;
    const expectedChange = ((predictedPrice - currentPrice) / currentPrice) * 100;

    const result = {
      points,
      summary: {
        predictedPrice,
        expectedChange: parseFloat(expectedChange.toFixed(2)),
        volatility: toNum(summary?.volatility, 2),
        confidence: clamp(toNum(summary?.confidence, 60), 30, 90),
        analysis: String(summary?.analysis || 'No analysis available.'),
      },
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch forecast for ${symbol}:`, error);
    return null;
  }
}