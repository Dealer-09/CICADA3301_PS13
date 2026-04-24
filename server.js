// server.js — Custom Next.js server with Socket.io for real-time graph sync
// Run with: node server.js  (replaces `next dev` / `next start`)

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3001', 10);
console.log(port)

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track connected users: socketId -> { userId, connectedAt }
const connectedUsers = new Map();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Allow both WebSocket and polling as transports
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || `user-${socket.id.slice(0, 6)}`;
    const workspaceId = socket.handshake.query.workspaceId;

    if (!workspaceId) {
      console.log(`[Socket.io] Rejected connection without workspaceId from ${userId}`);
      socket.disconnect();
      return;
    }

    // Check room size
    const room = io.sockets.adapter.rooms.get(workspaceId);
    if (room && room.size >= 4) {
      console.log(`[Socket.io] Workspace ${workspaceId} is full. Rejected ${userId}`);
      socket.emit('error', 'Workspace is full (max 4 users)');
      socket.disconnect();
      return;
    }

    socket.join(workspaceId);
    connectedUsers.set(socket.id, { userId, workspaceId, connectedAt: new Date().toISOString() });

    console.log(`[Socket.io] ${userId} joined workspace ${workspaceId}.`);

    // Broadcast updated user count to all clients in the room
    const currentRoom = io.sockets.adapter.rooms.get(workspaceId);
    io.to(workspaceId).emit('users_online', currentRoom ? currentRoom.size : 0);

    // ── Node events ─────────────────────────────────────────────────────────
    socket.on('node_update', (node) => {
      socket.to(workspaceId).emit('node_update', node);
      console.log(`[Socket.io] node_update in ${workspaceId} by ${userId}: ${node?.label}`);
    });

    socket.on('node_added', (node) => {
      socket.to(workspaceId).emit('node_added', node);
      console.log(`[Socket.io] node_added in ${workspaceId} by ${userId}: ${node?.label}`);
    });

    socket.on('node_removed', (nodeId) => {
      socket.to(workspaceId).emit('node_removed', nodeId);
      console.log(`[Socket.io] node_removed in ${workspaceId} by ${userId}: ${nodeId}`);
    });

    // ── Edge events ─────────────────────────────────────────────────────────
    socket.on('edge_update', (edge) => {
      socket.to(workspaceId).emit('edge_update', edge);
      console.log(`[Socket.io] edge_update in ${workspaceId} by ${userId}: ${edge?.id}`);
    });

    socket.on('edge_added', (edge) => {
      socket.to(workspaceId).emit('edge_added', edge);
      console.log(`[Socket.io] edge_added in ${workspaceId} by ${userId}: ${edge?.id}`);
    });

    socket.on('edge_removed', (edgeId) => {
      socket.to(workspaceId).emit('edge_removed', edgeId);
      console.log(`[Socket.io] edge_removed in ${workspaceId} by ${userId}: ${edgeId}`);
    });

    // ── Generic sync message (for conflict_detected, etc.) ──────────────────
    socket.on('sync_message', (message) => {
      socket.to(workspaceId).emit('sync_message', message);
      console.log(`[Socket.io] sync_message in ${workspaceId}: ${message?.type}`);
    });

    // ── Cursor / presence (bonus: show who is online) ───────────────────────
    socket.on('cursor_move', (data) => {
      socket.to(workspaceId).emit('cursor_move', { ...data, userId });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      const currentRoom = io.sockets.adapter.rooms.get(workspaceId);
      io.to(workspaceId).emit('users_online', currentRoom ? currentRoom.size : 0);
      console.log(`[Socket.io] Disconnected: ${userId} from ${workspaceId}`);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error('HTTP server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`\n🚀 Synapse Knowledge Graph Server ready`);
      console.log(`   → Next.js  : http://${hostname}:${port}`);
      console.log(`   → Socket.io: ws://${hostname}:${port}`);
      console.log(`   → Mode     : ${dev ? 'development' : 'production'}\n`);
    });
});
