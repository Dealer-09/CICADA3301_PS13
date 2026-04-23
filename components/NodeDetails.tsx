'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { GraphNode, SuggestionItem } from '@/types/graph';
import { motion } from 'framer-motion';
import { emitNodeAdded, emitEdgeAdded } from '@/lib/ws/client';

interface NodeDetailsProps {
  nodeId: string;
  onClose?: () => void;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ nodeId, onClose }) => {
  const { nodes, getConnectedNodes, addNode, addEdge } = useGraphStore();
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId) ?? null, [nodes, nodeId]);
  const connectedNodes = useMemo(() => getConnectedNodes(nodeId), [getConnectedNodes, nodeId]);

  const loadSuggestions = useCallback(async (selectedNode: GraphNode) => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/graph/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          nodeLabel: selectedNode.label,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleAcceptSuggestion = async (suggestion: SuggestionItem, index: number) => {
    setAcceptingIdx(index);
    try {
      const response = await fetch('/api/graph/suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept suggestion');
      }

      const { node, edge } = await response.json();

      // Add to local state
      addNode(node);
      addEdge(edge);

      // Broadcast to others
      emitNodeAdded(node);
      emitEdgeAdded(edge);

      // Remove the suggestion from the list
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      alert('Failed to add suggestion to graph. See console for details.');
    } finally {
      setAcceptingIdx(null);
    }
  };

  useEffect(() => {
    if (node) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSuggestions(node);
    }
  }, [node, loadSuggestions]);

  if (!node) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg shadow-lg border border-orange-200 p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">📝 Node Details</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>
      </div>

      {/* Node Info */}
      <div className="mb-4 pb-4 border-b border-orange-200">
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-bold">Label:</span> {node.label}
        </p>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-bold">Type:</span> {node.type}
        </p>
        {node.description && (
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-bold">Description:</span> {node.description}
          </p>
        )}
        <p className="text-sm text-gray-600">
          <span className="font-bold">Confidence:</span> {(node.confidence * 100).toFixed(0)}%
        </p>
      </div>

      {/* Connected Nodes */}
      {connectedNodes.length > 0 && (
        <div className="mb-4">
          <h4 className="font-bold text-gray-800 mb-2">🔗 Connected Concepts</h4>
          <div className="space-y-2">
            {connectedNodes.map((cn) => (
              <div key={cn.id} className="text-sm bg-white rounded px-3 py-2 border border-orange-100">
                <p className="font-semibold text-orange-700">{cn.label}</p>
                <p className="text-gray-600 text-xs">{cn.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {loadingSuggestions && (
        <p className="text-sm text-gray-600 text-center py-2">Loading suggestions...</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-800 mb-2">💡 Suggested Expansions</h4>
          <div className="space-y-3">
            {suggestions.slice(0, 3).map((s: SuggestionItem, idx: number) => (
              <div key={idx} className="bg-white rounded p-3 border border-green-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-green-700">{s.suggestedNode?.label}</p>
                  <button
                    onClick={() => handleAcceptSuggestion(s, idx)}
                    disabled={acceptingIdx === idx}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition"
                  >
                    {acceptingIdx === idx ? 'Adding...' : '+ Add to Graph'}
                  </button>
                </div>
                <p className="text-gray-600 text-xs">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default NodeDetails;
