import { GraphNode, GraphEdge, ExtractionResult, ConflictItem, SuggestionItem } from "@/types/graph";

const aiApiKey = process.env.GROQ_API_KEY || "";
const aiBaseUrl = "https://api.groq.com/openai/v1";
const aiModel = "llama-3.3-70b-versatile";

async function createGroqChatCompletion(
  prompt: string,
  temperature: number,
  topP?: number
): Promise<string> {
  if (!aiApiKey) {
    throw new Error("Missing required environment variable: GROQ_API_KEY");
  }

  const response = await fetch(`${aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [{ role: "user", content: prompt }],
      temperature,
      ...(topP !== undefined ? { top_p: topP } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

export async function extractEntitiesAndRelationships(
  input: string,
  existingNodes: GraphNode[] = [],
  userId: string
): Promise<ExtractionResult> {
  const existingContext = existingNodes
    .slice(0, 10)
    .map((n) => `- ${n.label} (${n.type}): ${n.description}`)
    .join("\n");

  const prompt = `You are an expert knowledge graph engine. Extract concepts, definitions, and relationships from the following input text.

Input: "${input}"

${existingContext ? `Existing concepts in graph:\n${existingContext}\n` : ""}

Respond in JSON format with the following structure:
{
  "nodes": [
    {
      "label": "concept name",
      "type": "concept|definition|entity",
      "description": "brief description",
      "confidence": 0.0-1.0
    }
  ],
  "edges": [
    {
      "source": "concept 1",
      "target": "concept 2",
      "label": "relationship type",
      "type": "relates_to|is_a|depends_on|similar_to",
      "confidence": 0.0-1.0
    }
  ],
  "conflicts": [
    {
      "type": "contradiction|ambiguity",
      "description": "description of the conflict",
      "nodeLabels": ["concept 1", "concept 2"]
    }
  ],
  "suggestions": [
    {
      "type": "missing_link|related_concept|refine_entity",
      "description": "suggestion for expansion",
      "suggestedLabel": "optional suggested concept"
    }
  ]
}

Be comprehensive but avoid redundancy. Focus on actionable, interconnected concepts.`;

  try {
    const content = await createGroqChatCompletion(prompt, 0.7, 0.9);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Create nodes with UUIDs
    const nodeMap = new Map<string, string>();
    const nodes: GraphNode[] = parsed.nodes.map((n: unknown) => {
      const node = n as {
        label: string;
        type: string;
        description?: string;
        confidence?: number;
      };
      const id = crypto.randomUUID();
      nodeMap.set(node.label, id);
      return {
        id,
        label: node.label,
        type: node.type as "concept" | "definition" | "entity" | "relationship",
        description: node.description,
        confidence: node.confidence || 0.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        metadata: {},
      };
    });

    // Create edges using node map
    const edges: GraphEdge[] = (parsed.edges || []).map((e: unknown) => {
      const edge = e as {
        source: string;
        target: string;
        label: string;
        type: string;
        confidence?: number;
      };
      return {
        id: crypto.randomUUID(),
        source: nodeMap.get(edge.source) || edge.source,
        target: nodeMap.get(edge.target) || edge.target,
        label: edge.label,
        type: edge.type || "relates_to",
        confidence: edge.confidence || 0.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        metadata: {},
      };
    });

    // Process conflicts
    const conflicts: ConflictItem[] = (parsed.conflicts || []).map((c: unknown) => {
      const conflict = c as {
        type: string;
        description: string;
        nodeLabels?: string[];
      };
      return {
        type: conflict.type as "contradiction" | "ambiguity",
        nodeIds: conflict.nodeLabels?.map((label) => nodeMap.get(label) || label) || [],
        description: conflict.description,
        resolution: "manual",
      };
    });

    // Process suggestions
    const suggestions: SuggestionItem[] = (parsed.suggestions || []).map((s: unknown) => {
      const suggestion = s as {
        type: string;
        description: string;
        suggestedLabel?: string;
      };
      return {
        type: suggestion.type as "missing_link" | "related_concept" | "refine_entity",
        source: nodes[0]?.id || "",
        description: suggestion.description,
        suggestedNode: suggestion.suggestedLabel
          ? {
              label: suggestion.suggestedLabel,
              type: "concept",
              confidence: 0.6,
            }
          : undefined,
      };
    });

    return {
      nodes,
      edges,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  } catch (error) {
    console.error("Entity extraction error:", error);
    return {
      nodes: [],
      edges: [],
      conflicts: [
        {
          type: "ambiguity",
          nodeIds: [],
          description: `Failed to extract from input: "${input.substring(0, 50)}..."`,
          resolution: "manual",
        },
      ],
    };
  }
}

export async function suggestNodeExpansion(
  nodeId: string,
  nodeLabel: string,
  currentGraph: { nodes: GraphNode[]; edges: GraphEdge[] }
): Promise<SuggestionItem[]> {
  const relatedNodes = currentGraph.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const node = currentGraph.nodes.find((n) => n.id === (e.source === nodeId ? e.target : e.source));
      return node?.label || "";
    })
    .filter(Boolean);

  const prompt = `You are a knowledge graph enhancement AI. A user is exploring the concept: "${nodeLabel}"

Related concepts in their graph: ${relatedNodes.join(", ") || "none yet"}

Suggest 3-5 missing related concepts, deeper definitions, or alternative perspectives that would enrich this concept node. Return as JSON array:
[
  { "label": "suggested concept", "description": "why it's related", "type": "concept|definition|entity" },
  ...
]

Focus on practical, valuable connections.`;

  try {
    const content = await createGroqChatCompletion(prompt, 0.7);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]);

    return suggestions.map((s: unknown) => {
      const suggestion = s as {
        label: string;
        description?: string;
        type?: string;
      };
      return {
        type: "related_concept" as const,
        source: nodeId,
        description: suggestion.description || "",
        suggestedNode: {
          label: suggestion.label,
          type: (suggestion.type || "concept") as "concept" | "definition" | "entity",
          confidence: 0.7,
        },
      };
    });
  } catch (error) {
    console.error("Node expansion suggestion error:", error);
    return [];
  }
}

export async function resolveConflict(
  conflict: ConflictItem,
  affectedNodes: GraphNode[]
): Promise<ConflictItem> {
  if (conflict.type === "contradiction") {
    // Create branched nodes for contradictory concepts
    const branchedId = crypto.randomUUID();
    conflict.branchedNodeId = branchedId;
    conflict.resolution = "branch";
  } else if (conflict.type === "ambiguity") {
    // Try to clarify through AI
    const prompt = `The following concepts in a knowledge graph are ambiguous:
${affectedNodes.map((n) => `- ${n.label}: ${n.description}`).join("\n")}

Provide a brief clarification or distinguish between them.`;

    try {
      const clarification = await createGroqChatCompletion(prompt, 0.5);
      conflict.description = clarification || conflict.description;
      conflict.resolution = "manual"; // User reviews the clarification
    } catch (error) {
      console.error("Conflict resolution error:", error);
    }
  }

  return conflict;
}
