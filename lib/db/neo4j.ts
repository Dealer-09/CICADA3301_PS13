import neo4j, { Driver } from "neo4j-driver";
import { GraphNode, GraphEdge, PathSearchResult } from "@/types/graph";

// Database connection management
let driver: Driver | null = null;

const DB_CONFIG = {
  maxConnectionPoolSize: 50,
  maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
};

export function initializeDatabase(): Driver {
  if (driver) return driver;

  const dbUrl = requiredEnv("NEO4J_URL");
  const dbUser = requiredEnv("NEO4J_USER");
  const dbPassword = requiredEnv("NEO4J_PASSWORD");

  driver = neo4j.driver(dbUrl, neo4j.auth.basic(dbUser, dbPassword), DB_CONFIG);

  return driver;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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

export async function createNode(node: GraphNode): Promise<GraphNode> {
  const db = getDatabase();
  const session = db.session();

  try {
    await session.run(
      `CREATE (n:GraphNode {
        id: $id,
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
        label: node.label,
        type: node.type,
        description: node.description || null,
        metadata: node.metadata || {},
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
        metadata: updates.metadata,
        updatedAt: new Date().toISOString(),
        confidence: updates.confidence,
      }
    );

    if (result.records.length === 0) return null;

    const record = result.records[0].get("n").properties;
    return record as GraphNode;
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
    return result.records[0].get("n").properties as GraphNode;
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
        sourceId: edge.source,
        targetId: edge.target,
        label: edge.label,
        type: edge.type,
        weight: edge.weight || 1,
        metadata: edge.metadata || {},
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
  maxDepth: number = 5
): Promise<PathSearchResult | null> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(
      `MATCH path = shortestPath(
        (source:GraphNode {id: $sourceId})-[*1..$maxDepth]->(target:GraphNode {id: $targetId})
      )
      RETURN path, 
             length(path) as distance,
             [node in nodes(path) | node.id] as nodeIds,
             avg([rel in relationships(path) | rel.confidence]) as confidence`,
      { sourceId, targetId, maxDepth }
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

    return result.records.map((record) => record.get("r").properties as GraphEdge);
  } finally {
    await session.close();
  }
}

export async function getAllNodes(): Promise<GraphNode[]> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(`MATCH (n:GraphNode) RETURN n`);
    return result.records.map((record) => record.get("n").properties as GraphNode);
  } finally {
    await session.close();
  }
}

export async function getAllEdges(): Promise<GraphEdge[]> {
  const db = getDatabase();
  const session = db.session();

  try {
    const result = await session.run(`MATCH ()-[r:RELATES_TO]->() RETURN r`);
    return result.records.map((record) => record.get("r").properties as GraphEdge);
  } finally {
    await session.close();
  }
}
