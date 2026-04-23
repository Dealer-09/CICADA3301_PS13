import { create } from "zustand";
import { GraphNode, GraphEdge, GraphState, RealtimeSyncMessage } from "@/types/graph";

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  syncId: string;
  version: number;

  // Actions
  addNode: (node: GraphNode) => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  setGraphState: (state: GraphState) => void;
  applyRemoteUpdate: (message: RealtimeSyncMessage) => void;
  getConnectedNodes: (nodeId: string) => GraphNode[];
  getNodePath: (sourceId: string, targetId: string) => GraphNode[] | null;
  clear: () => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  syncId: "",
  version: 0,

  addNode: (node: GraphNode) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      version: state.version + 1,
    }));
  },

  updateNode: (id: string, updates: Partial<GraphNode>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : node
      ),
      version: state.version + 1,
    }));
  },

  removeNode: (id: string) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      version: state.version + 1,
    }));
  },

  addEdge: (edge: GraphEdge) => {
    set((state) => ({
      edges: [...state.edges, edge],
      version: state.version + 1,
    }));
  },

  removeEdge: (id: string) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
      version: state.version + 1,
    }));
  },

  selectNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  setGraphState: (state: GraphState) => {
    set({
      nodes: state.nodes,
      edges: state.edges,
      syncId: state.lastSyncId,
      version: state.version,
    });
  },

  applyRemoteUpdate: (message: RealtimeSyncMessage) => {
    const state = get();
    
    if (message.type === "node_added") {
      const node = message.payload as GraphNode;
      if (!state.nodes.find((n) => n.id === node.id)) {
        state.addNode(node);
      }
    } else if (message.type === "node_updated") {
      const node = message.payload as GraphNode;
      state.updateNode(node.id, node);
    } else if (message.type === "edge_added") {
      const edge = message.payload as GraphEdge;
      if (!state.edges.find((e) => e.id === edge.id)) {
        state.addEdge(edge);
      }
    } else if (message.type === "edge_updated") {
      const edge = message.payload as GraphEdge;
      set((s) => ({
        edges: s.edges.map((e) => (e.id === edge.id ? edge : e)),
        version: s.version + 1,
      }));
    }
  },

  getConnectedNodes: (nodeId: string) => {
    const state = get();
    const connectedIds = new Set<string>();

    state.edges.forEach((edge) => {
      if (edge.source === nodeId) {
        connectedIds.add(edge.target);
      } else if (edge.target === nodeId) {
        connectedIds.add(edge.source);
      }
    });

    return state.nodes.filter((node) => connectedIds.has(node.id));
  },

  getNodePath: (sourceId: string, targetId: string) => {
    const state = get();
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [
      { id: sourceId, path: [sourceId] },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (current.id === targetId) {
        return state.nodes.filter((n) => current.path.includes(n.id));
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const connectedIds = new Set<string>();
      state.edges.forEach((edge) => {
        if (edge.source === current.id) {
          connectedIds.add(edge.target);
        } else if (edge.target === current.id) {
          connectedIds.add(edge.source);
        }
      });

      connectedIds.forEach((id) => {
        if (!visited.has(id)) {
          queue.push({ id, path: [...current.path, id] });
        }
      });
    }

    return null;
  },

  clear: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      syncId: "",
      version: 0,
    });
  },
}));
