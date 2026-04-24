import mongoose from 'mongoose';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Validate at runtime (not module-evaluation time) so `next build` succeeds
  // without env vars present in the Docker build layer.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

// Workspace Schema
const workspaceSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true },
  members: [{ type: String }], // Clerk User IDs
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
});

// Avoid OverwriteModelError
export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);

/**
 * Delete workspaces that haven't been active for more than 7 days.
 * Called on server startup to auto-purge stale workspaces.
 */
export async function cleanupInactiveWorkspaces(): Promise<number> {
  await dbConnect();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await Workspace.deleteMany({ lastActiveAt: { $lt: cutoff } });
  return result.deletedCount || 0;
}

/**
 * Touch the lastActiveAt timestamp for a workspace.
 * Called when a user joins a workspace via socket.
 */
export async function touchWorkspaceActivity(workspaceId: string): Promise<void> {
  await dbConnect();
  await Workspace.updateOne(
    { workspaceId },
    { $set: { lastActiveAt: new Date() } }
  );
}
