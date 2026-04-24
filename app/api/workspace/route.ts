import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect, { Workspace } from '@/lib/db/mongodb';

// Generate 6-char alphanumeric code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const workspaces = await Workspace.find({ members: userId });

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await dbConnect();

    const workspaceId = crypto.randomUUID();
    let inviteCode = generateInviteCode();

    // Ensure unique invite code (unlikely to collide, but good practice)
    while (await Workspace.findOne({ inviteCode })) {
      inviteCode = generateInviteCode();
    }

    const newWorkspace = await Workspace.create({
      workspaceId,
      name,
      inviteCode,
      members: [userId],
    });

    return NextResponse.json({ workspace: newWorkspace });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
