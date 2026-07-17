import { NextResponse } from 'next/server';
import { fetchRealNews } from '@/lib/ai-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  // Try to fetch real news with AI sentiment analysis
  const realData = await fetchRealNews(symbol.toUpperCase());

  if (realData) {
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
  }

  // Fallback to static data if real fetch fails
  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    dataSource: 'fallback',
    articles: [
      {
        headline: `${symbol} Reports Strong Quarterly Earnings, Beating Analyst Estimates`,
        source: 'Bloomberg',
        url: '#',
        time: '2h ago',
        sentiment: 'positive' as const,
        positivePct: 72,
        negativePct: 12,
        neutralPct: 16,
        snippet: 'The company exceeded Wall Street expectations...',
      },
      {
        headline: `${symbol} Announces Major Strategic Partnership in AI Sector`,
        source: 'Reuters',
        url: '#',
        time: '5h ago',
        sentiment: 'positive' as const,
        positivePct: 68,
        negativePct: 14,
        neutralPct: 18,
        snippet: 'A new partnership aims to accelerate AI adoption...',
      },
      {
        headline: `${symbol} Faces Regulatory Scrutiny Over Market Practices`,
        source: 'WSJ',
        url: '#',
        time: '8h ago',
        sentiment: 'negative' as const,
        positivePct: 18,
        negativePct: 65,
        neutralPct: 17,
        snippet: 'Regulators are examining recent trading patterns...',
      },
      {
        headline: `Analysts Maintain Hold Rating on ${symbol} Amid Market Uncertainty`,
        source: 'CNBC',
        url: '#',
        time: '12h ago',
        sentiment: 'neutral' as const,
        positivePct: 35,
        negativePct: 30,
        neutralPct: 35,
        snippet: 'Market conditions warrant a cautious approach...',
      },
      {
        headline: `${symbol} Expands Market Share in Key Growth Segments`,
        source: 'Financial Times',
        url: '#',
        time: '1d ago',
        sentiment: 'positive' as const,
        positivePct: 70,
        negativePct: 10,
        neutralPct: 20,
        snippet: 'Strong quarterly results highlight growth trajectory...',
      },
    ],
    summary: {
      overallScore: 58,
      positivePct: 53,
      negativePct: 26,
      neutralPct: 21,
      positiveCount: 3,
      negativeCount: 1,
      neutralCount: 1,
      trending: ['Earnings', 'AI Partnership', 'Regulation', 'Market Expansion'],
    },
  });
}