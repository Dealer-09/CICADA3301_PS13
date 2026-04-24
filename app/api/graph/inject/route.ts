import { createNode, createEdge } from '@/lib/db/neo4j';
import { rateLimit } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/graph/inject
 * Persists raw JSON nodes/edges to Neo4j. Used by the JSON injection tab
 * on the dashboard to make manually-added data durable.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 10 injections per 60 seconds per user
  const limited = rateLimit(request, { name: 'inject', maxRequests: 10, windowSeconds: 60 });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { nodes = [], edges = [], workspaceId } = body;

    if (nodes.length === 0 && edges.length === 0) {
      return NextResponse.json(
        { error: 'At least one node or edge is required' },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    for (const node of nodes) {
      if (workspaceId) node.workspaceId = workspaceId;
      try {
        await createNode(node);
      } catch (err: any) {
        errors.push(`Node "${node.label}": ${err.message}`);
      }
    }

    for (const edge of edges) {
      if (workspaceId) edge.workspaceId = workspaceId;
      try {
        await createEdge(edge);
      } catch (err: any) {
        errors.push(`Edge "${edge.label}": ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      persisted: { nodes: nodes.length, edges: edges.length },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Graph inject error:', error);
    return NextResponse.json(
      { error: 'Failed to inject graph data' },
      { status: 500 }
    );
  }
}
