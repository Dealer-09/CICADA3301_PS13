import { extractEntitiesAndRelationships } from '@/lib/ai/extractor';
import { createNode, createEdge } from '@/lib/db/neo4j';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, existingNodes = [] } = body;

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

    // Persist to database
    for (const node of result.nodes) {
      try {
        await createNode(node);
      } catch (error) {
        console.error('Error creating node:', error);
        // Continue with other nodes
      }
    }

    for (const edge of result.edges) {
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
      conflicts: result.conflicts,
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
