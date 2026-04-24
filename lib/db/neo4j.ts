import neo4j, { Driver } from "neo4j-driver";
import { GraphNode, GraphEdge, PathSearchResult } from "@/types/graph";

// Database connection management
let driver: Driver | null = null;

const DB_CONFIG = {
  maxConnectionPoolSize: 50,
  maxConnectionLifetime: 60 * 60 * 1000,
};

export function initializeDatabase(): Driver {
  if (driver) return driver;

  const dbUrl = requiredEnv("NEO4J_URL");
  const dbUser = requiredEnv("NEO4J_USER");
  const dbPassword = requiredEnv("NEO4J_PASSWORD");

  driver = neo4j.driver(dbUrl, neo4j.auth.basic(dbUser, dbPassword), DB_CONFIG);

  // Create indexes in the background — non-blocking, safe to call repeatedly
  createIndexes(driver).catch((err) =>
    console.warn("[Neo4j] Index creation warning (non-fatal):", err.message)
  );

  return driver;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function createIndexes(db: Driver): Promise<void> {
  const session = db.session();
  try {
    // Primary lookup index: find a node by its application-level UUID
    await session.run(
      `CREATE INDEX graphnode_id_idx IF NOT EXISTS
       FOR (n:GraphNode) ON (n.id)`
    );

    // Secondary index: fast deduplication checks by label string
    await session.run(
      `CREATE INDEX graphnode_label_idx IF NOT EXISTS
       FOR (n:GraphNode) ON (n.label)`
    );

    // Index on relationship id for fast edge lookups / deletions
    await session.run(
      `CREATE INDEX relates_to_id_idx IF NOT EXISTS
       FOR ()-[r:RELATES_TO]-() ON (r.id)`
    );

    console.log("[Neo4j] Indexes verified/created successfully");
  } finally {
    await session.close();
  }
}

export function getDatabase(): Driver {
  if (!driver) {
    return initializeDatabase();
  }
  return driver;
}

export async function closeDatabase(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// ── Serialization helpers ──────────────────────────────────────────────────
// Neo4j properties must be primitives (string, number, boolean, null, or
// arrays thereof). We JSON-stringify nested objects before storing and parse
// them back on retrieval so the application always sees plain JS objects.

function serializeMetadata(metadata: Record<string, unknown> | undefined): string {
  return JSON.stringify(metadata || {});
}

function deserializeNode(props: Record<string, unknown>): GraphNode {
  return {
    ...props,
    metadata: props.metadata
      ? JSON.parse(props.metadata as string)
      : {},
  } as GraphNode;
}

function deserializeEdge(props: Record<string, unknown>): GraphEdge {
  return {
    ...props,
    metadata: props.metadata
      ? JSON.parse(props.metadata as string)
      : {},
  } as GraphEdge;
}

export async function createNode(node: GraphNode): Promise<GraphNode> {
  const db = getDatabase();
  const session = db.session();

  try {
    await session.run(
      `CREATE (n:GraphNode {
        id: $id,
        workspaceId: $workspaceId,
        label: $label,
        type: $type,
        description: $description,
        metadata: $metadata,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        createdBy: $createdBy,
        confidence: $confidence
      })`,
      {
        id: node.id,
        workspaceId: node.workspaceId || null,
        label: node.label,
        type: node.type,
        description: node.description || null,
        metadata: serializeMetadata(node.metadata),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        createdBy: node.createdBy,
        confidence: node.confidence,
      }
    );

    return node;
  } finally {
    await session.close();
  }
}

export async function updateNode(nodeId: string, updates: Partial<GraphNode>): Promise<GraphNode | null> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(
      `MATCH (n:GraphNode {id: $id})
       SET n.label = COALESCE($label, n.label),
           n.description = COALESCE($description, n.description),
           n.metadata = COALESCE($metadata, n.metadata),
           n.updatedAt = $updatedAt,
           n.confidence = COALESCE($confidence, n.confidence)
       RETURN n`,
      {
        id: nodeId,
        label: updates.label,
        description: updates.description,
        metadata: updates.metadata !== undefined
          ? serializeMetadata(updates.metadata)
          : undefined,
        updatedAt: new Date().toISOString(),
        confidence: updates.confidence,
      }
    );

    if (result.records.length === 0) return null;

    const record = result.records[0].get("n").properties;
    return deserializeNode(record);
  } finally {
    await session.close();
  }
}

export async function deleteNode(nodeId: string): Promise<boolean> {
  const db = getDatabase();
  const session = db.session();

  try {
    await session.run(
      `MATCH (n:GraphNode {id: $id})
       DETACH DELETE n`,
      { id: nodeId }
    );
    return true;
  } finally {
    await session.close();
  }
}

export async function getNode(nodeId: string): Promise<GraphNode | null> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(
      `MATCH (n:GraphNode {id: $id}) RETURN n`,
      { id: nodeId }
    );

    if (result.records.length === 0) return null;
    return deserializeNode(result.records[0].get("n").properties);
  } finally {
    await session.close();
  }
}

export async function createEdge(edge: GraphEdge): Promise<GraphEdge> {
  const db = getDatabase();
  const session = db.session();

  try {
    await session.run(
      `MATCH (source:GraphNode {id: $sourceId})
       MATCH (target:GraphNode {id: $targetId})
       CREATE (source)-[r:RELATES_TO {
         id: $id,
         workspaceId: $workspaceId,
         label: $label,
         type: $type,
         weight: $weight,
         metadata: $metadata,
         createdAt: $createdAt,
         updatedAt: $updatedAt,
         createdBy: $createdBy,
         confidence: $confidence
       }]->(target)`,
      {
        id: edge.id,
        workspaceId: edge.workspaceId || null,
        sourceId: edge.source,
        targetId: edge.target,
        label: edge.label,
        type: edge.type,
        weight: edge.weight || 1,
        metadata: serializeMetadata(edge.metadata),
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
        createdBy: edge.createdBy,
        confidence: edge.confidence,
      }
    );

    return edge;
  } finally {
    await session.close();
  }
}

export async function deleteEdge(edgeId: string): Promise<boolean> {
  const db = getDatabase();
  const session = db.session();

  try {
    await session.run(
      `MATCH ()-[r {id: $id}]->() DELETE r`,
      { id: edgeId }
    );
    return true;
  } finally {
    await session.close();
  }
}

export async function findPath(
  sourceId: string,
  targetId: string,
  maxDepth: number = 5,
  workspaceId?: string
): Promise<PathSearchResult | null> {
  const db = getDatabase();
  const session = db.session();

  try {
    const workspaceFilter = workspaceId ? 'AND source.workspaceId = $workspaceId AND target.workspaceId = $workspaceId' : '';
    const result = await session.run(
      `MATCH path = shortestPath(
        (source:GraphNode {id: $sourceId})-[*1..$maxDepth]->(target:GraphNode {id: $targetId})
      )
      WHERE 1=1 ${workspaceFilter}
      RETURN path, 
             length(path) as distance,
             [node in nodes(path) | node.id] as nodeIds,
             avg([rel in relationships(path) | rel.confidence]) as confidence`,
      { sourceId, targetId, maxDepth, workspaceId }
    );

    if (result.records.length === 0) return null;

    const record = result.records[0];
    const nodeIds = record.get("nodeIds");
    const distance = record.get("distance").toNumber();
    const confidence = record.get("confidence") || 0.5;

    const edges = await getEdgesForPath(nodeIds);

    return {
      path: nodeIds,
      edges,
      distance,
      confidence,
    };
  } finally {
    await session.close();
  }
}

async function getEdgesForPath(nodeIds: string[]): Promise<GraphEdge[]> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(
      `MATCH (source:GraphNode)-[r:RELATES_TO]->(target:GraphNode)
       WHERE source.id IN $nodeIds AND target.id IN $nodeIds
       RETURN r`,
      { nodeIds }
    );

    return result.records.map((record) => deserializeEdge(record.get("r").properties));
  } finally {
    await session.close();
  }
}

export async function getAllNodes(workspaceId?: string): Promise<GraphNode[]> {
  const db = getDatabase();
  const session = db.session();

  try {
    const query = workspaceId 
      ? `MATCH (n:GraphNode {workspaceId: $workspaceId}) RETURN n`
      : `MATCH (n:GraphNode) RETURN n`;
    const result = await session.run(query, { workspaceId });
    return result.records.map((record) =>
      deserializeNode(record.get("n").properties)
    );
  } finally {
    await session.close();
  }
}

export async function getAllEdges(workspaceId?: string): Promise<GraphEdge[]> {
  const db = getDatabase();
  const session = db.session();

  try {
    const query = workspaceId 
      ? `MATCH ()-[r:RELATES_TO {workspaceId: $workspaceId}]->() RETURN r`
      : `MATCH ()-[r:RELATES_TO]->() RETURN r`;
    const result = await session.run(query, { workspaceId });
    return result.records.map((record) =>
      deserializeEdge(record.get("r").properties)
    );
  } finally {
    await session.close();
  }
}
