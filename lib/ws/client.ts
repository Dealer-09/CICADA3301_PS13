import { io, Socket } from "socket.io-client";
import { RealtimeSyncMessage, GraphNode, GraphEdge } from "@/types/graph";

let socket: Socket | null = null;

interface SyncHandler {
  onNodeUpdate: (node: GraphNode) => void;
  onNodeAdded: (node: GraphNode) => void;
  onEdgeUpdate: (edge: GraphEdge) => void;
  onEdgeAdded: (edge: GraphEdge) => void;
  onRemoteMessage: (message: RealtimeSyncMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onUsersOnline: (count: number) => void;
}

export function initializeWebSocket(
  url?: string,
  handlers: Partial<SyncHandler> = {},
  userId?: string
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
    reconnectionAttempts: 10,
    transports: ["websocket", "polling"],
    // Pass userId so the server can identify and log this client
    query: { userId: userId || "anonymous" },
  });

  socket.on("connect", () => {
    console.log("WebSocket connected", { endpoint });
    handlers.onConnect?.();
  });

  socket.on("disconnect", () => {
    console.log("WebSocket disconnected");
    handlers.onDisconnect?.();
  });

  // node_update — a remote user moved/edited an existing node
  socket.on("node_update", (node: GraphNode) => {
    handlers.onNodeUpdate?.(node);
  });

  // node_added — a remote user extracted new nodes
  socket.on("node_added", (node: GraphNode) => {
    handlers.onNodeAdded?.(node);
  });

  // edge_update — a remote user updated an existing edge
  socket.on("edge_update", (edge: GraphEdge) => {
    handlers.onEdgeUpdate?.(edge);
  });

  // edge_added — a remote user created a new edge
  socket.on("edge_added", (edge: GraphEdge) => {
    handlers.onEdgeAdded?.(edge);
  });

  socket.on("sync_message", (message: RealtimeSyncMessage) => {
    handlers.onRemoteMessage?.(message);
  });

  // Online user count badge
  socket.on("users_online", (count: number) => {
    handlers.onUsersOnline?.(count);
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

/** Use this when broadcasting a brand-new node (extraction result) */
export function emitNodeAdded(node: GraphNode): void {
  if (socket && socket.connected) {
    socket.emit("node_added", node);
  }
}

export function emitEdgeUpdate(edge: GraphEdge): void {
  if (socket && socket.connected) {
    socket.emit("edge_update", edge);
  }
}

/** Use this when broadcasting a brand-new edge (extraction result or manual connect) */
export function emitEdgeAdded(edge: GraphEdge): void {
  if (socket && socket.connected) {
    socket.emit("edge_added", edge);
  }
}

export function emitSyncMessage(message: RealtimeSyncMessage): void {
  if (socket && socket.connected) {
    socket.emit("sync_message", message);
  }
}

