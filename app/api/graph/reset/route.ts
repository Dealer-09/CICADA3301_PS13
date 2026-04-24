import { initializeDatabase } from '@/lib/db/neo4j';
import { rateLimit } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Rate limit: 2 resets per 60 seconds per user
  const limited = rateLimit(request, { name: 'reset', maxRequests: 2, windowSeconds: 60 });
  if (limited) return limited;

  const driver = initializeDatabase();
  const session = driver.session();
  
  try {
    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required to reset graph' }, { status: 400 });
    }

    // Delete all nodes and relationships for this workspace
    await session.run('MATCH (n:GraphNode {workspaceId: $workspaceId}) DETACH DELETE n', { workspaceId });
    
    return NextResponse.json({ success: true, message: 'Workspace graph cleared successfully' });
  } catch (error) {
    console.error('Failed to reset workspace graph:', error);
    return NextResponse.json(
      { error: 'Failed to reset graph' },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
