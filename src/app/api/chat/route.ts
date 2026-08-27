import { NextResponse } from 'next/server';
import { fetchAIChatResponse, fetchRealStockQuote, fetchRealNews, fetchHistoricalOHLCV } from '@/lib/ai-service';
import { computeAllIndicators } from '@/lib/stock-utils';

export async function POST(request: Request) {
  try {
    const { symbol, question } = await request.json();

    if (!symbol || !question) {
      return NextResponse.json({ error: 'Symbol and question are required' }, { status: 400 });
    }

    const stockKey = symbol.toUpperCase();

    const [quote, newsResult, ohlcv] = await Promise.all([
      fetchRealStockQuote(stockKey).catch(() => null),
      fetchRealNews(stockKey).catch(() => null),
      fetchHistoricalOHLCV(stockKey, 30).catch(() => null),
    ]);

    let indicators: Record<string, number | undefined> = {};
    if (ohlcv && ohlcv.length >= 30) {
      const computed = computeAllIndicators(ohlcv);
      if (computed) indicators = {
        rsi: computed.latest.rsi, macd: computed.latest.macd, macdSignal: computed.latest.macdSignal,
        sma20: computed.latest.sma20, sma50: computed.latest.sma50,
        ema12: computed.latest.ema12, ema26: computed.latest.ema26,
        bbUpper: computed.latest.bbUpper, bbMiddle: computed.latest.bbMiddle, bbLower: computed.latest.bbLower,
        atr: computed.latest.atr, adx: computed.latest.adx,
      };
    }

    const recentNews = newsResult?.articles.slice(0, 5).map((a) => `• ${a.title} (${a.sentiment})`).join('\n') || '';

    const response = await fetchAIChatResponse(stockKey, question, {
      currentPrice: quote?.price || 0,
      indicators,
      recentNews,
    });

    if (!response) {
      return NextResponse.json({ error: 'AI service unavailable. Try again.' }, { status: 503 });
    }

    return NextResponse.json({
      symbol: stockKey,
      question,
      answer: response,
      dataSource: quote ? 'real' : 'limited',
      hasRealData: !!quote,
      hasOHLCV: !!(ohlcv && ohlcv.length >= 30),
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}