'use client';

import React, { useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { PathSearchResult } from '@/types/graph';
import { motion } from 'framer-motion';

const PathFinder: React.FC = () => {
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
        body: JSON.stringify({ sourceId, targetId, maxDepth: 5 }),
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
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Graph Path Traversal</h3>
      {/* Source Selector */}
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">From:</label>
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 bg-[#1f2937] border border-gray-700 text-gray-200 rounded-lg focus:outline-none focus:border-purple-500"
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
        <label className="block text-xs font-bold text-gray-500 mb-1">To:</label>
        <select
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 bg-[#1f2937] border border-gray-700 text-gray-200 rounded-lg focus:outline-none focus:border-purple-500"
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
            ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
            : 'bg-purple-600 text-white hover:bg-purple-500'
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
          className="p-4 bg-[#1f2937] border border-purple-500/30 rounded-lg"
        >
          <h4 className="font-bold text-purple-400 mb-3">Path Found! 🎯</h4>
          
          <div className="flex gap-4 text-xs text-gray-400 mb-3">
            <p><span className="font-bold text-gray-300">Distance:</span> {result?.distance} hops</p>
            <p><span className="font-bold text-gray-300">Confidence:</span> {((result?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>

          <div className="bg-[#111827] p-3 rounded-lg border border-gray-800 max-h-40 overflow-y-auto">
            <div className="space-y-3">
              {result?.path.map((nodeId, idx) => {
                const node = nodes.find((n) => n.id === nodeId);
                return (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <span className="bg-purple-900/50 text-purple-400 border border-purple-700/50 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-200">{node?.label}</span>
                    {idx < (result?.path.length ?? 0) - 1 && <span className="text-gray-600">→</span>}
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
