// Type definitions for the Knowledge Graph Engine

export interface GraphNode {
  id: string;
  workspaceId?: string;
  label: string;
  type: "Entity" | "Event" | "Location" | "Object" | "Organization" | "Topic" | "User" | "concept" | "definition" | "entity" | "relationship";
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  confidence: number; // 0-1, confidence score from AI
}

export interface GraphEdge {
  id: string;
  workspaceId?: string;
  source: string;
  target: string;
  label: string;
  type: string; // e.g., "relates_to", "is_a", "depends_on"
  weight?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  confidence: number;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lastSyncId: string;
  version: number;
}

export interface ExtractionResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  conflicts?: ConflictItem[];
  suggestions?: SuggestionItem[];
}

export interface ConflictItem {
  type: "contradiction" | "ambiguity";
  nodeIds: string[];
  description: string;
  resolution?: "merge" | "branch" | "manual";
  branchedNodeId?: string;
}

export interface SuggestionItem {
  type: "missing_link" | "related_concept" | "refine_entity";
  source: string;
  target?: string;
  description: string;
  suggestedNode?: Partial<GraphNode>;
}

export interface RealtimeSyncMessage {
  type: "node_added" | "node_updated" | "node_removed" | "edge_added" | "edge_updated" | "edge_removed" | "conflict_detected";
  payload: GraphNode | GraphEdge | ConflictItem | string;
  timestamp: string;
  userId: string;
}

export interface PathSearchResult {
  path: string[]; // node IDs in order
  edges: GraphEdge[];
  distance: number;
  confidence: number;
}
