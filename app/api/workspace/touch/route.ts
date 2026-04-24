import { NextRequest, NextResponse } from 'next/server';
import { touchWorkspaceActivity } from '@/lib/db/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await request.json();
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }
    await touchWorkspaceActivity(workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Touch workspace error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
