import { findPath } from '@/lib/db/neo4j';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, targetId, maxDepth = 5, workspaceId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'sourceId and targetId are required' },
        { status: 400 }
      );
    }

    const result = await findPath(sourceId, targetId, maxDepth, workspaceId);

    if (!result) {
      return NextResponse.json(
        { error: 'No path found between the specified nodes' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Path search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for path' },
      { status: 500 }
    );
  }
}
