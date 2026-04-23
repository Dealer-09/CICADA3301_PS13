import { driver } from '@/lib/db/neo4j';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const session = driver.session();
  
  try {
    // Delete edge by ID (stored in the 'id' property of the relationship)
    await session.run(
      'MATCH ()-[r:RELATES_TO {id: $id}]->() DELETE r',
      { id }
    );
    
    return NextResponse.json({ success: true, message: 'Edge deleted successfully' });
  } catch (error) {
    console.error('Failed to delete edge:', error);
    return NextResponse.json(
      { error: 'Failed to delete edge' },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
