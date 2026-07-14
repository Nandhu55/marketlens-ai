import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const items = await db.portfolioItem.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, name, quantity, buyPrice, currentPrice } = body;

  if (!symbol || !quantity || !buyPrice) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const item = await db.portfolioItem.create({
    data: {
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      quantity: parseFloat(quantity),
      buyPrice: parseFloat(buyPrice),
      currentPrice: parseFloat(currentPrice || buyPrice),
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await db.portfolioItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}