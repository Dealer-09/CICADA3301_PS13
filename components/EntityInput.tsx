'use client';

import React, { useState } from 'react';
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
  const [isResetting, setIsResetting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const { addNode, addEdge, nodes, clear: clearGraph } = useGraphStore();

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
    setIsResetting(true);
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
      setIsResetting(false);
      setLoading(false);
    }
  };

  return (
    <div className="w-full mt-auto relative bg-[#111827]">
      <div className="flex items-center gap-2 bg-[#1f2937] border border-gray-700 rounded-lg p-2 focus-within:border-purple-500 transition-colors">
        <div className="text-gray-400 pl-2 cursor-pointer" onClick={handleReset} title="Reset Graph">
          <svg className="w-5 h-5 hover:text-red-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleExtract();
            }
          }}
          disabled={loading || isResetting}
          placeholder="Enter your message content here..."
          className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none py-2 px-2"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExtract}
          disabled={loading || !input.trim()}
          className={`p-2 rounded-md flex items-center justify-center transition-colors ${
            loading || !input.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#6b21a8] text-white hover:bg-purple-600'
          }`}
        >
          {loading || isResetting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          )}
        </motion.button>
      </div>

      {error && (
        <div className="absolute -top-12 left-0 right-0 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm text-center">
          {error}
        </div>
      )}

      {/* Extracted Data Feedback */}
      {conflicts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 bg-orange-900/50 border border-orange-700 rounded-lg text-orange-200"
        >
          <h3 className="font-bold mb-2">⚠️ Conflicts Detected</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
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
          className="mt-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-200"
        >
          <h3 className="font-bold mb-2">💡 Expansions Suggested</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {suggestions.map((s, i) => (
              <li key={i}>
                <span className="font-semibold">{s.suggestedNode?.label || s.type}:</span> {s.description}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
};

export default EntityInput;
