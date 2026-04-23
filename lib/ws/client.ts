import { io, Socket } from "socket.io-client";
import { RealtimeSyncMessage, GraphNode, GraphEdge } from "@/types/graph";

let socket: Socket | null = null;

interface SyncHandler {
  onNodeUpdate: (node: GraphNode) => void;
  onEdgeUpdate: (edge: GraphEdge) => void;
  onRemoteMessage: (message: RealtimeSyncMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function initializeWebSocket(
  url?: string,
  handlers: Partial<SyncHandler> = {}
): Socket {
  if (socket) {
    return socket;
  }

  const endpoint =
    url ||
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_WS_URL || window.location.origin
      : process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000");

  socket = io(endpoint, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("WebSocket connected", { endpoint });
    handlers.onConnect?.();
  });

  socket.on("disconnect", () => {
    console.log("WebSocket disconnected");
    handlers.onDisconnect?.();
  });

  socket.on("node_update", (node: GraphNode) => {
    console.log("Node update received:", node);
    handlers.onNodeUpdate?.(node);
  });

  socket.on("edge_update", (edge: GraphEdge) => {
    console.log("Edge update received:", edge);
    handlers.onEdgeUpdate?.(edge);
  });

  socket.on("sync_message", (message: RealtimeSyncMessage) => {
    console.log("Sync message received:", message);
    handlers.onRemoteMessage?.(message);
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  return socket;
}

export function getWebSocket(): Socket | null {
  return socket;
}

export function closeWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitNodeUpdate(node: GraphNode): void {
  if (socket && socket.connected) {
    socket.emit("node_update", node);
  }
}

export function emitEdgeUpdate(edge: GraphEdge): void {
  if (socket && socket.connected) {
    socket.emit("edge_update", edge);
  }
}

export function emitSyncMessage(message: RealtimeSyncMessage): void {
  if (socket && socket.connected) {
    socket.emit("sync_message", message);
  }
}
