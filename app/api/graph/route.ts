import { getAllNodes, getAllEdges } from '@/lib/db/neo4j';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;

    const nodes = await getAllNodes(workspaceId);
    const edges = await getAllEdges(workspaceId);

    return NextResponse.json({
      nodes,
      edges,
      lastSyncId: Date.now().toString(),
      version: 1,
    });
  } catch (error) {
    console.error('GET /api/graph error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve graph' },
      { status: 500 }
    );
  }
}
