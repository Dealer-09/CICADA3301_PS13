// server.js — Custom Next.js server with Socket.io for real-time graph sync
// Run with: node server.js  (replaces `next dev` / `next start`)

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

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
    connectedUsers.set(socket.id, { userId, connectedAt: new Date().toISOString() });

    console.log(`[Socket.io] Connected: ${userId} (${socket.id}) — ${connectedUsers.size} users online`);

    // Broadcast updated user count to all clients
    io.emit('users_online', connectedUsers.size);

    // ── Node events ─────────────────────────────────────────────────────────
    socket.on('node_update', (node) => {
      // Broadcast to all OTHER connected clients
      socket.broadcast.emit('node_update', node);
      console.log(`[Socket.io] node_update broadcast from ${userId}: ${node?.label}`);
    });

    socket.on('node_added', (node) => {
      socket.broadcast.emit('node_added', node);
      console.log(`[Socket.io] node_added broadcast from ${userId}: ${node?.label}`);
    });

    socket.on('node_removed', (nodeId) => {
      socket.broadcast.emit('node_removed', nodeId);
      console.log(`[Socket.io] node_removed broadcast from ${userId}: ${nodeId}`);
    });

    // ── Edge events ─────────────────────────────────────────────────────────
    socket.on('edge_update', (edge) => {
      socket.broadcast.emit('edge_update', edge);
      console.log(`[Socket.io] edge_update broadcast from ${userId}: ${edge?.id}`);
    });

    socket.on('edge_added', (edge) => {
      socket.broadcast.emit('edge_added', edge);
      console.log(`[Socket.io] edge_added broadcast from ${userId}: ${edge?.id}`);
    });

    socket.on('edge_removed', (edgeId) => {
      socket.broadcast.emit('edge_removed', edgeId);
      console.log(`[Socket.io] edge_removed broadcast from ${userId}: ${edgeId}`);
    });

    // ── Generic sync message (for conflict_detected, etc.) ──────────────────
    socket.on('sync_message', (message) => {
      socket.broadcast.emit('sync_message', message);
      console.log(`[Socket.io] sync_message broadcast: ${message?.type}`);
    });

    // ── Cursor / presence (bonus: show who is online) ───────────────────────
    socket.on('cursor_move', (data) => {
      socket.broadcast.emit('cursor_move', { ...data, userId });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      io.emit('users_online', connectedUsers.size);
      console.log(`[Socket.io] Disconnected: ${userId} — ${connectedUsers.size} users online`);
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
