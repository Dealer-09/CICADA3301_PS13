'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { GraphNode, SuggestionItem } from '@/types/graph';
import { motion } from 'framer-motion';
import { emitSyncMessage } from '@/lib/ws/client';

interface NodeDetailsProps {
  nodeId: string;
  onClose?: () => void;
  workspaceId?: string | null;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ nodeId, onClose, workspaceId }) => {
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
          workspaceId: workspaceId || undefined,
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
        body: JSON.stringify({ suggestion, workspaceId: workspaceId || undefined }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept suggestion');
      }

      const { node, edge } = await response.json();

      // Add to local state
      addNode(node);
      addEdge(edge);

      // Broadcast via graph_refresh so all peers re-fetch
      emitSyncMessage({ type: 'graph_refresh', payload: workspaceId || '', timestamp: new Date().toISOString(), userId: 'local' });

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
      className="bg-[#0a0a0a] rounded-lg shadow-xl border border-white/[0.08] overflow-hidden h-full flex flex-col"
    >
      <div className="bg-[#050505] px-6 py-4 flex justify-between items-center border-b border-white/[0.08]">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {node.label}
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/[0.05] rounded-full transition-colors text-white/30 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div>
          <span className="inline-block px-3 py-1 bg-white/[0.05] text-white/60 text-xs font-bold rounded-full uppercase tracking-wider mb-2 border border-white/[0.08]">
            {node.type}
          </span>
          <p className="text-white/40 leading-relaxed mt-2">{node.description}</p>
        </div>

        {connectedNodes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-white/30 uppercase tracking-wider mb-3">Connections</h3>
            <div className="space-y-3">
              {connectedNodes.map((cn) => (
                <div key={cn.id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="w-2 h-2 rounded-full bg-white/40"></div>
                  <span className="font-medium text-white/70 text-left">{cn.label}</span>
                  <span className="text-xs text-white/30 ml-auto">{cn.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {loadingSuggestions && (
          <p className="text-sm text-white/20 text-center py-2">Loading suggestions...</p>
        )}
        
        {suggestions && suggestions.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-white/30 uppercase tracking-wider mb-3">💡 Suggested Expansions</h3>
            <div className="space-y-3">
              {suggestions.slice(0, 3).map((s: SuggestionItem, idx: number) => (
                <div key={idx} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-white/70">{s.suggestedNode?.label}</p>
                    <button
                      onClick={() => handleAcceptSuggestion(s, idx)}
                      disabled={acceptingIdx === idx}
                      className="text-xs px-2 py-1 bg-white text-[#050505] rounded hover:bg-white/80 disabled:bg-white/10 disabled:text-white/20 transition"
                    >
                      {acceptingIdx === idx ? 'Adding...' : '+ Add'}
                    </button>
                  </div>
                  <p className="text-white/30 text-xs">{s.description}</p>
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
