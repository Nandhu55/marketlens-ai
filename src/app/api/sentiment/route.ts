import { NextResponse } from 'next/server';
import { fetchRealNews } from '@/lib/ai-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  try {
    const realData = await fetchRealNews(symbol.toUpperCase());

    if (!realData) {
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        dataSource: 'none',
        error: 'No Live Data Available',
        message: `Could not fetch real news for ${symbol.toUpperCase()}. Try again later.`,
        articles: [],
        summary: null,
      });
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      dataSource: 'real',
      articles: realData.articles.map((a) => ({
        headline: a.title,
        source: a.source,
        url: a.url,
        time: a.date,
        sentiment: a.sentiment,
        positivePct: a.positivePct,
        negativePct: a.negativePct,
        neutralPct: a.neutralPct,
        snippet: a.snippet,
      })),
      summary: realData.summary,
    });
  } catch (error) {
    console.error(`Sentiment API error for ${symbol}:`, error);
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      dataSource: 'none',
      error: 'No Live Data Available',
      message: 'Failed to fetch news data.',
      articles: [],
      summary: null,
    });
  }
}