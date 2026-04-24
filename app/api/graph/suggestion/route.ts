import { createNode, createEdge } from '@/lib/db/neo4j';
import { NextRequest, NextResponse } from 'next/server';
import { GraphNode, GraphEdge, SuggestionItem } from '@/types/graph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestion, workspaceId } = body as { suggestion: SuggestionItem; workspaceId?: string };

    if (!suggestion || !suggestion.suggestedNode || !suggestion.suggestedNode.label) {
      return NextResponse.json(
        { error: 'Invalid suggestion data' },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id') || 'anonymous';
    
    // Create new node
    const newNodeId = crypto.randomUUID();
    const newNode: GraphNode = {
      id: newNodeId,
      workspaceId,
      label: suggestion.suggestedNode.label,
      type: (suggestion.suggestedNode.type as any) || 'concept',
      description: suggestion.description,
      confidence: suggestion.suggestedNode.confidence || 0.7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      metadata: {},
    };

    // Create edge connecting source to new node
    const newEdge: GraphEdge = {
      id: crypto.randomUUID(),
      workspaceId,
      source: suggestion.source,
      target: newNodeId,
      label: 'relates_to',
      type: 'relates_to',
      confidence: 0.8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      metadata: {},
    };

    await createNode(newNode);
    await createEdge(newEdge);

    return NextResponse.json({
      success: true,
      node: newNode,
      edge: newEdge,
    });
  } catch (error) {
    console.error('Accept suggestion error:', error);
    return NextResponse.json(
      { error: 'Failed to accept suggestion' },
      { status: 500 }
    );
  }
}
