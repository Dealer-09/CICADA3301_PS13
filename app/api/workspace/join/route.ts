import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect, { Workspace } from '@/lib/db/mongodb';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteCode } = await req.json();
    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    await dbConnect();

    const workspace = await Workspace.findOne({ inviteCode: inviteCode.toUpperCase() });

    if (!workspace) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    if (workspace.members.includes(userId)) {
      return NextResponse.json({ workspace }); // Already a member
    }

    if (workspace.members.length >= 4) {
      return NextResponse.json({ error: 'Workspace is full (max 4 members)' }, { status: 403 });
    }

    workspace.members.push(userId);
    await workspace.save();

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Error joining workspace:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
