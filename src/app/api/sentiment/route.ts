import { NextResponse } from 'next/server';

// Deterministic sentiment analysis based on stock symbol
function getSentimentForSymbol(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash + symbol.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);

  const articles = [
    { headline: `${symbol} Reports Strong Quarterly Earnings, Beating Analyst Estimates`, source: 'Bloomberg', sentiment: 'positive' as const },
    { headline: `${symbol} Announces Major Strategic Partnership in AI Sector`, source: 'Reuters', sentiment: 'positive' as const },
    { headline: `Analysts Upgrade ${symbol} Price Target Amid Growth Momentum`, source: 'CNBC', sentiment: 'positive' as const },
    { headline: `${symbol} Faces Regulatory Scrutiny Over Data Privacy Concerns`, source: 'WSJ', sentiment: 'negative' as const },
    { headline: `${symbol} Expands Market Share in Key International Markets`, source: 'Financial Times', sentiment: 'positive' as const },
    { headline: `Supply Chain Disruptions Could Impact ${symbol} Revenue Forecast`, source: 'Bloomberg', sentiment: 'negative' as const },
    { headline: `${symbol} Launches Next-Generation Product Line, Consumer Response Positive`, source: 'Reuters', sentiment: 'positive' as const },
    { headline: `${symbol} CEO Discusses Long-Term Vision at Investor Conference`, source: 'CNBC', sentiment: 'neutral' as const },
    { headline: `Institutional Investors Increase Holdings in ${symbol} Stock`, source: 'WSJ', sentiment: 'positive' as const },
    { headline: `${symbol} Competitor Gains Ground with New Technology Offering`, source: 'Financial Times', sentiment: 'negative' as const },
    { headline: `Federal Reserve Policy May Create Headwinds for ${symbol} Sector`, source: 'Bloomberg', sentiment: 'neutral' as const },
    { headline: `${symbol} R&D Investment Reaches Record High, Innovation Pipeline Strong`, source: 'Reuters', sentiment: 'positive' as const },
  ];

  return articles.map((article, i) => {
    const s = (seed + i * 137) % 100;
    const positive = article.sentiment === 'positive' ? 55 + (s % 30) : 10 + (s % 25);
    const negative = article.sentiment === 'negative' ? 50 + (s % 35) : 5 + (s % 20);
    const neutral = 100 - positive - negative;

    return {
      ...article,
      time: `${(i * 2 + 1) % 24}h ago`,
      positivePct: positive,
      negativePct: negative,
      neutralPct: Math.max(neutral, 0),
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  const articles = getSentimentForSymbol(symbol);
  const totalPositive = articles.reduce((sum, a) => sum + a.positivePct, 0) / articles.length;
  const totalNegative = articles.reduce((sum, a) => sum + a.negativePct, 0) / articles.length;
  const totalNeutral = 100 - totalPositive - totalNegative;

  const positiveCount = articles.filter((a) => a.sentiment === 'positive').length;
  const negativeCount = articles.filter((a) => a.sentiment === 'negative').length;
  const neutralCount = articles.filter((a) => a.sentiment === 'neutral').length;

  return NextResponse.json({
    symbol,
    articles,
    summary: {
      overallScore: Math.round(50 + (totalPositive - totalNegative) * 0.5),
      positivePct: Math.round(totalPositive),
      negativePct: Math.round(totalNegative),
      neutralPct: Math.round(totalNeutral),
      positiveCount,
      negativeCount,
      neutralCount,
      trending: ['AI Integration', 'Earnings Growth', 'Market Expansion', 'Innovation Pipeline'],
    },
  });
}