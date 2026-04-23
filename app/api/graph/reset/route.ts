import { initializeDatabase } from '@/lib/db/neo4j';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const driver = initializeDatabase();
  const session = driver.session();
  
  try {
    // Delete all nodes and relationships
    await session.run('MATCH (n) DETACH DELETE n');
    
    return NextResponse.json({ success: true, message: 'Graph cleared successfully' });
  } catch (error) {
    console.error('Failed to reset graph:', error);
    return NextResponse.json(
      { error: 'Failed to reset graph' },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
