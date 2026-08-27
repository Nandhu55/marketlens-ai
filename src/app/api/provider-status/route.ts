import { NextResponse } from 'next/server';
import { getMarketDataProviderStatus, getIndianMarketStatus } from '@/lib/market-data';

export async function GET() {
  try {
    const [providerStatus, indianMarketStatus] = await Promise.all([
      getMarketDataProviderStatus(),
      Promise.resolve(getIndianMarketStatus()),
    ]);

    return NextResponse.json({
      provider: providerStatus,
      indianMarketStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Provider status error:', error);
    return NextResponse.json({
      provider: { indian: 'UNKNOWN' as const, provider: 'upstox' },
      indianMarketStatus: 'UNKNOWN',
      timestamp: new Date().toISOString(),
    });
  }
}
