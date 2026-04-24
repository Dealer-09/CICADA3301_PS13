'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGraphStore } from '@/store/graphStore';
import { PathSearchResult } from '@/types/graph';
import { motion } from 'framer-motion';

const PathFinder: React.FC = () => {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const { nodes, setHighlightedPath, clearHighlight } = useGraphStore();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [result, setResult] = useState<PathSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      clearHighlight();
    };
  }, [clearHighlight]);

  const handleSearch = async () => {
    if (!sourceId || !targetId) {
      setError('Please select both source and target concepts');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/graph/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId, maxDepth: 5, workspaceId: workspaceId || undefined }),
      });

      if (!response.ok) {
        throw new Error(response.status === 404 ? 'No path found' : 'Path search failed');
      }

      const data = await response.json();
      setResult(data);
      setHighlightedPath(
        data.path,
        data.edges.map((e: any) => e.id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      clearHighlight();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-4"
    >
      <h3 className="text-sm font-bold text-white/30 uppercase tracking-wider mb-2">Graph Path Traversal</h3>
      {/* Source Selector */}
      <div>
        <label className="block text-xs font-bold text-white/30 mb-1">From:</label>
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 bg-[#0a0a0a] border border-white/[0.08] text-white/70 rounded-lg focus:outline-none focus:border-white/20"
        >
          <option value="">Select source concept</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id} disabled={node.id === targetId}>
              {node.label} ({node.type})
            </option>
          ))}
        </select>
      </div>

      {/* Target Selector */}
      <div>
        <label className="block text-xs font-bold text-white/30 mb-1">To:</label>
        <select
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 bg-[#0a0a0a] border border-white/[0.08] text-white/70 rounded-lg focus:outline-none focus:border-white/20"
        >
          <option value="">Select target concept</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id} disabled={node.id === sourceId}>
              {node.label} ({node.type})
            </option>
          ))}
        </select>
      </div>

      {/* Search Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSearch}
        disabled={loading || !sourceId || !targetId}
        className={`w-full px-4 py-2 rounded-lg font-semibold transition ${
          loading || !sourceId || !targetId 
            ? 'bg-white/[0.03] text-white/15 cursor-not-allowed' 
            : 'bg-white text-[#050505] hover:bg-white/90'
        }`}
      >
        {loading ? '⏳ Searching...' : '🔍 Find Path'}
      </motion.button>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[#0a0a0a] border border-white/[0.1] rounded-lg"
        >
          <h4 className="font-bold text-white mb-3">Path Found! 🎯</h4>
          
          <div className="flex gap-4 text-xs text-white/30 mb-3">
            <p><span className="font-bold text-white/60">Distance:</span> {result?.distance} hops</p>
            <p><span className="font-bold text-white/60">Confidence:</span> {((result?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>

          <div className="bg-[#050505] p-3 rounded-lg border border-white/[0.06] max-h-40 overflow-y-auto">
            <div className="space-y-3">
              {result?.path.map((nodeId, idx) => {
                const node = nodes.find((n) => n.id === nodeId);
                return (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <span className="bg-white/[0.05] text-white/50 border border-white/[0.08] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white/70">{node?.label}</span>
                    {idx < (result?.path.length ?? 0) - 1 && <span className="text-white/20">→</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PathFinder;
