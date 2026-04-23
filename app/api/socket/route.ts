import { Server } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';

let io: Server;

// Socket.io server initialization - handles WebSocket connections
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only initialize once
    if (!res.socket.server.io) {
      console.log('Initializing Socket.io server...');

      const io = new Server(res.socket.server as any, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
      });

      // Handle client connections
      io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Subscribe to session updates
        socket.on('subscribe_session', (data) => {
          socket.join(`session:${data.sessionId}`);
          console.log(`Client ${socket.id} subscribed to session ${data.sessionId}`);
        });

        // Handle node updates
        socket.on('node_update', (node) => {
          // Broadcast to all clients in the session
          io.emit('node_update', node);
          console.log('Node update broadcasted:', node.id);
        });

        // Handle edge updates
        socket.on('edge_update', (edge) => {
          io.emit('edge_update', edge);
          console.log('Edge update broadcasted:', edge.id);
        });

        // Handle sync messages
        socket.on('sync_message', (message) => {
          io.emit('sync_message', message);
          console.log('Sync message broadcasted:', message.type);
        });

        // Handle request sync
        socket.on('request_sync', async (data) => {
          try {
            // Fetch latest graph state from database
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/graph`);
            const graphState = await response.json();
            socket.emit('graph_sync', graphState);
          } catch (error) {
            console.error('Error fetching graph state:', error);
          }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
          console.log(`Client disconnected: ${socket.id}`);
        });

        socket.on('error', (error) => {
          console.error(`Socket error for ${socket.id}:`, error);
        });
      });

      res.socket.server.io = io;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('WebSocket server error:', error);
    res.status(500).json({ error: 'WebSocket server initialization failed' });
  }
}
