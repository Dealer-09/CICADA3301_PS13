import { NextResponse } from 'next/server';

// App Router route handlers cannot host a Socket.io server directly.
// This endpoint exposes runtime guidance and keeps build/type checks green.
export async function GET() {
  return NextResponse.json({
    realtime: {
      enabled: false,
      reason: 'Socket.io server must run as a separate process or custom Next server in production.',
      expectedUrlEnv: 'NEXT_PUBLIC_WS_URL',
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Socket server is not hosted in App Router route handlers. Configure NEXT_PUBLIC_WS_URL to an external Socket.io service.',
    },
    { status: 501 }
  );
}
