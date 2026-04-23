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
      className="mt-4 space-y-4"
    >
      {/* Source Selector */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">From:</label>
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
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
        <label className="block text-sm font-bold text-gray-800 mb-2">To:</label>
        <select
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            clearHighlight();
            setResult(null);
          }}
          className="w-full p-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSearch}
        disabled={loading || !sourceId || !targetId}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
      >
        {loading ? '⏳ Searching...' : '🔍 Find Path'}
      </motion.button>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm"
        >
          ❌ {error}
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border-2 border-green-300 rounded-lg"
        >
          <h4 className="font-bold text-green-800 mb-3">Path Found! 🎯</h4>
          
          <p className="text-sm text-gray-700 mb-3">
            <span className="font-bold">Distance:</span> {result.distance} hops
          </p>
          
          <p className="text-sm text-gray-700 mb-3">
            <span className="font-bold">Confidence:</span> {(result.confidence * 100).toFixed(0)}%
          </p>

          <div className="bg-white p-3 rounded border border-green-200 max-h-40 overflow-y-auto">
            <p className="font-bold text-gray-800 mb-2">Path Flow:</p>
            <div className="space-y-2">
              {result.path.map((nodeId, idx) => {
                const node = nodes.find((n) => n.id === nodeId);
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-800">{node?.label}</span>
                    {idx < result.path.length - 1 && <span className="text-gray-400">→</span>}
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
