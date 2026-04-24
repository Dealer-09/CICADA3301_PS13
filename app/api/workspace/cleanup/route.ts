import { NextResponse } from 'next/server';
import { cleanupInactiveWorkspaces } from '@/lib/db/mongodb';

export async function POST() {
  try {
    const deleted = await cleanupInactiveWorkspaces();
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Workspace cleanup error:', error);
    return NextResponse.json({ deleted: 0 });
  }
}
