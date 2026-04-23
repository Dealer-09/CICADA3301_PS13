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
      className="bg-[#1f2937] rounded-lg shadow-xl border border-gray-700 overflow-hidden h-full flex flex-col"
    >
      <div className="bg-[#111827] px-6 py-4 flex justify-between items-center border-b border-gray-700">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <span className="text-2xl">🧠</span> {node.label}
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div>
          <span className="inline-block px-3 py-1 bg-gray-800 text-purple-400 text-xs font-bold rounded-full uppercase tracking-wider mb-2 border border-gray-700">
            {node.type}
          </span>
          <p className="text-gray-300 leading-relaxed mt-2">{node.description}</p>
        </div>

        {connectedNodes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Connections</h3>
            <div className="space-y-3">
              {connectedNodes.map((cn) => (
                <div key={cn.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="font-medium text-gray-200 text-left">{cn.label}</span>
                  <span className="text-xs text-gray-500 ml-auto">{cn.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {loadingSuggestions && (
          <p className="text-sm text-gray-500 text-center py-2">Loading suggestions...</p>
        )}
        
        {suggestions && suggestions.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">💡 Suggested Expansions</h3>
            <div className="space-y-3">
              {suggestions.slice(0, 3).map((s: SuggestionItem, idx: number) => (
                <div key={idx} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-purple-400">{s.suggestedNode?.label}</p>
                    <button
                      onClick={() => handleAcceptSuggestion(s, idx)}
                      disabled={acceptingIdx === idx}
                      className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-600 transition"
                    >
                      {acceptingIdx === idx ? 'Adding...' : '+ Add'}
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NodeDetails;
