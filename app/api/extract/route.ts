import { extractEntitiesAndRelationships, resolveConflict } from '@/lib/ai/extractor';
import { createNode, createEdge } from '@/lib/db/neo4j';
import { rateLimit } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Rate limit: 8 extractions per 60 seconds per user
  const limited = rateLimit(request, { name: 'extract', maxRequests: 8, windowSeconds: 60 });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { input, existingNodes = [], workspaceId } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input: text is required' },
        { status: 400 }
      );
    }

    // Extract entities and relationships using AI
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const result = await extractEntitiesAndRelationships(
      input,
      existingNodes,
      userId
    );

    let resolvedConflicts = result.conflicts;
    if (result.conflicts && result.conflicts.length > 0) {
      const resolutions = await Promise.all(
        result.conflicts.map((conflict) => {
          const affectedNodes = result.nodes.filter((n) => conflict.nodeIds.includes(n.id));
          return resolveConflict(conflict, affectedNodes, userId);
        })
      );
      
      resolvedConflicts = resolutions.map(r => r.conflict);
      
      // Inject the newly branched conflict resolution nodes/edges into the extraction result
      for (const res of resolutions) {
        result.nodes.push(...res.newNodes);
        result.edges.push(...res.newEdges);
      }
    }

    // Persist to database
    for (const node of result.nodes) {
      if (workspaceId) node.workspaceId = workspaceId;
      try {
        await createNode(node);
      } catch (error) {
        console.error('Error creating node:', error);
        // Continue with other nodes
      }
    }

    for (const edge of result.edges) {
      if (workspaceId) edge.workspaceId = workspaceId;
      try {
        await createEdge(edge);
      } catch (error) {
        console.error('Error creating edge:', error);
        // Continue with other edges
      }
    }

    return NextResponse.json({
      success: true,
      nodes: result.nodes,
      edges: result.edges,
      conflicts: resolvedConflicts,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: 'Failed to extract entities' },
      { status: 500 }
    );
  }
}
