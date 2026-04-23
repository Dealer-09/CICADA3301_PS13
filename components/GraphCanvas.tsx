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
import { emitNodeUpdate, emitEdgeUpdate } from '@/lib/ws/client';
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
  const { nodes: graphNodes, edges: graphEdges, addEdge: addGraphEdge, updateNode } = useGraphStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Convert graph store nodes to React Flow nodes
  useEffect(() => {
    const flowNodes: Node[] = graphNodes.map((node, index) => ({
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
        border: selectedNode === node.id ? '3px solid #ff6b6b' : '2px solid #333',
        borderRadius: '8px',
        padding: '10px',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        maxWidth: '150px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      },
      selectable: true,
      draggable: mode === 'edit',
    }));

    setNodes(flowNodes);
  }, [graphNodes, selectedNode, setNodes, mode]);

  // Convert graph store edges to React Flow edges
  useEffect(() => {
    const flowEdges: Edge[] = graphEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'default',
      animated: edge.confidence > 0.8,
      style: {
        stroke: getEdgeColor(edge.type),
        strokeWidth: Math.max(1, edge.confidence * 3),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getEdgeColor(edge.type),
      },
    }));

    setEdges(flowEdges);
  }, [graphEdges, setEdges]);

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
