'use client';

import React, { useState, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { ExtractionResult, ConflictItem, SuggestionItem } from '@/types/graph';
import { emitNodeAdded, emitEdgeAdded } from '@/lib/ws/client';
import { motion } from 'framer-motion';

interface EntityInputProps {
  onExtracted?: () => void;
}

const EntityInput: React.FC<EntityInputProps> = ({ onExtracted }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const { addNode, addEdge, nodes, clear: clearGraph } = useGraphStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleExtract = async () => {
    if (!input.trim()) {
      setError('Please enter some text to extract concepts from');
      return;
    }

    setLoading(true);
    setError(null);
    setConflicts([]);
    setSuggestions([]);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          existingNodes: nodes.slice(0, 10),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract entities');
      }

      const result = (await response.json()) as ExtractionResult;

      // Add extracted nodes and broadcast each as a new addition
      result.nodes.forEach((node) => {
        addNode(node);
        emitNodeAdded(node);
      });

      // Add extracted edges and broadcast each as a new addition
      result.edges.forEach((edge) => {
        addEdge(edge);
        emitEdgeAdded(edge);
      });

      setInput('');
      onExtracted?.();

      if ((result.conflicts?.length ?? 0) > 0) {
        setConflicts(result.conflicts!);
      }

      if ((result.suggestions?.length ?? 0) > 0) {
        setSuggestions(result.suggestions!);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to completely wipe the graph? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/graph/reset', { method: 'POST' });
      if (response.ok) {
        clearGraph();
        setInput('');
        setConflicts([]);
        setSuggestions([]);
      } else {
        alert('Failed to reset graph');
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg border border-indigo-200"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4">🧠 Input Your Knowledge</h2>
      
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste your notes, article, or concept description here. The AI will automatically extract concepts and relationships..."
        className="w-full h-32 p-4 border-2 border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none"
        disabled={loading}
      />

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-600 text-sm mt-2"
        >
          ❌ {error}
        </motion.p>
      )}

      <div className="flex gap-4 mt-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExtract}
          disabled={loading || !input.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {loading ? '⏳ Extracting...' : '✨ Extract Concepts'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setInput('');
            setConflicts([]);
            setSuggestions([]);
          }}
          disabled={loading}
          className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 disabled:bg-gray-200 transition"
        >
          Clear
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleReset}
          disabled={loading}
          className="px-6 py-2 bg-red-100 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-200 disabled:opacity-50 transition ml-auto"
        >
          🗑️ Reset Graph
        </motion.button>
      </div>

      <p className="text-gray-600 text-sm mt-4">
        💡 Tip: The more detailed and structured your input, the better the concept extraction.
      </p>

      {/* Extracted Data Feedback */}
      {conflicts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 bg-orange-50 border border-orange-300 rounded-lg"
        >
          <h3 className="font-bold text-orange-800 mb-2">⚠️ Conflicts Detected</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-orange-700">
            {conflicts.map((c, i) => (
              <li key={i}>{c.description}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-lg"
        >
          <h3 className="font-bold text-blue-800 mb-2">💡 Expansions Suggested</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
            {suggestions.map((s, i) => (
              <li key={i}>
                <span className="font-semibold">{s.suggestedNode?.label || s.type}:</span> {s.description}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EntityInput;
