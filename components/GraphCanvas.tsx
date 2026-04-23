'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  NodeTypes,
  OnNodesChange,
  OnConnect,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphStore } from '@/store/graphStore';
import { GraphEdge } from '@/types/graph';
import { emitNodeUpdate, emitEdgeUpdate, emitEdgeRemoved } from '@/lib/ws/client';
import ConceptNode from './nodes/ConceptNode';
import DefinitionNode from './nodes/DefinitionNode';

interface GraphCanvasProps {
  mode?: 'view' | 'edit';
  onNodeSelect?: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  definition: DefinitionNode,
};

const GraphCanvas: React.FC<GraphCanvasProps> = ({ 
  mode = 'edit', 
  onNodeSelect 
}) => {
  const { nodes: graphNodes, edges: graphEdges, addEdge: addGraphEdge, updateNode, highlightedNodeIds, highlightedEdgeIds } = useGraphStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Convert graph store nodes to React Flow nodes
  useEffect(() => {
    const isHighlighting = highlightedNodeIds.size > 0;

    const flowNodes: Node[] = graphNodes.map((node, index) => {
      const isSelected = selectedNode === node.id;
      const isHighlighted = highlightedNodeIds.has(node.id);
      
      let borderStyle = '2px solid #333';
      let opacity = 1;
      let boxShadow = 'none';

      if (isHighlighting) {
        if (isHighlighted) {
          borderStyle = '3px solid #10b981'; // emerald green
          boxShadow = '0 0 15px rgba(16, 185, 129, 0.6)';
        } else {
          opacity = 0.3; // dim non-path nodes
        }
      } else if (isSelected) {
        borderStyle = '3px solid #ff6b6b';
        boxShadow = '0 0 10px rgba(255, 107, 107, 0.4)';
      }

      return {
        id: node.id,
        data: { 
          label: node.label,
          type: node.type,
          description: node.description,
          confidence: node.confidence,
        },
        position: getNodePosition(node.id, node.metadata?.position, index),
        type: node.type,
        style: {
          background: getNodeColor(node.type),
          border: borderStyle,
          borderRadius: '8px',
          padding: '10px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold',
          maxWidth: '150px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease-in-out',
          opacity,
          boxShadow,
        },
        selectable: true,
        draggable: mode === 'edit',
      };
    });

    setNodes(flowNodes);
  }, [graphNodes, selectedNode, setNodes, mode, highlightedNodeIds]);

  // Convert graph store edges to React Flow edges
  useEffect(() => {
    const isHighlighting = highlightedEdgeIds.size > 0;

    const flowEdges: Edge[] = graphEdges.map((edge) => {
      const isHighlighted = highlightedEdgeIds.has(edge.id);
      
      let strokeColor = getEdgeColor(edge.type);
      let opacity = 1;
      let strokeWidth = Math.max(1, edge.confidence * 3);

      if (isHighlighting) {
        if (isHighlighted) {
          strokeColor = '#10b981'; // emerald green
          strokeWidth = 4;
        } else {
          opacity = 0.2;
        }
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'default',
        animated: isHighlighted || (!isHighlighting && edge.confidence > 0.8),
        style: {
          stroke: strokeColor,
          strokeWidth,
          opacity,
          transition: 'all 0.3s ease-in-out',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });

    setEdges(flowEdges);
  }, [graphEdges, setEdges, highlightedEdgeIds]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);

    // Emit position updates to WebSocket
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        const graphNode = graphNodes.find((n) => n.id === change.id);
        if (graphNode) {
          const updated = {
            ...graphNode,
            metadata: {
              ...graphNode.metadata,
              position: change.position,
            },
          };
          updateNode(graphNode.id, updated);
          emitNodeUpdate(updated);
        }
      }
    });
  }, [onNodesChange, graphNodes, updateNode]);

  const handleEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      try {
        const response = await fetch(`/api/graph/edge/${edge.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          emitEdgeRemoved(edge.id);
        }
      } catch (error) {
        console.error('Failed to delete edge:', error);
      }
    }
  }, []);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const newEdge: GraphEdge = {
          id: `edge-${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          label: 'relates to',
          type: 'relates_to',
          confidence: 0.8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user',
          metadata: {},
        };
        addGraphEdge(newEdge);
        emitEdgeUpdate(newEdge);
      }
    },
    [addGraphEdge]
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={handleEdgesDelete}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    concept: '#6366f1',
    definition: '#ec4899',
    entity: '#8b5cf6',
    relationship: '#f59e0b',
  };
  return colors[type] || '#6366f1';
}

function getEdgeColor(type: string): string {
  const colors: Record<string, string> = {
    relates_to: '#64748b',
    is_a: '#3b82f6',
    depends_on: '#ef4444',
    similar_to: '#10b981',
  };
  return colors[type] || '#64748b';
}

function getNodePosition(
  id: string,
  metadataPosition: unknown,
  index: number
): { x: number; y: number } {
  if (
    typeof metadataPosition === 'object' &&
    metadataPosition !== null &&
    'x' in metadataPosition &&
    'y' in metadataPosition
  ) {
    const p = metadataPosition as { x: number; y: number };
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      return { x: p.x, y: p.y };
    }
  }

  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const col = hash % 6;
  const row = Math.floor(index / 6);
  return {
    x: 120 + col * 180,
    y: 80 + row * 140,
  };
}

export default GraphCanvas;
