import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();
  return NextResponse.json({
    serverTime: now,
    timestamp: new Date(now).toISOString(),
  });
}
