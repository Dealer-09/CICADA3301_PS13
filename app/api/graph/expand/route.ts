import { suggestNodeExpansion } from '@/lib/ai/extractor';
import { getAllNodes, getAllEdges } from '@/lib/db/neo4j';
import { rateLimit } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Rate limit: 6 expansion requests per 60 seconds per user
  const limited = rateLimit(request, { name: 'expand', maxRequests: 6, windowSeconds: 60 });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { nodeId, nodeLabel, workspaceId } = body;

    if (!nodeId || !nodeLabel) {
      return NextResponse.json(
        { error: 'nodeId and nodeLabel are required' },
        { status: 400 }
      );
    }

    const nodes = await getAllNodes(workspaceId);
    const edges = await getAllEdges(workspaceId);

    const suggestions = await suggestNodeExpansion(nodeId, nodeLabel, { nodes, edges });

    return NextResponse.json({
      suggestions,
      nodeId,
    });
  } catch (error) {
    console.error('Node expansion error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
