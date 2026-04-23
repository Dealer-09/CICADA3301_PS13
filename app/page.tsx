'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { initializeWebSocket } from '@/lib/ws/client';
import NodeDetails from '@/components/NodeDetails';
import PathFinder from '@/components/PathFinder';
import { motion, AnimatePresence } from 'framer-motion';
import { emitNodeAdded, emitEdgeAdded } from '@/lib/ws/client';
import { ExtractionResult } from '@/types/graph';

const ForceGraphCanvas = dynamic(() => import('@/components/ForceGraphCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#111827] animate-pulse">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🧠</span>
        </div>
      </div>
      <p className="text-indigo-300 font-bold text-lg tracking-wide">Initializing Neural Graph...</p>
      <p className="text-indigo-500 text-sm mt-2">Syncing with Neo4j database</p>
    </div>
  ),
});

interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  addedToGraph: boolean;
  timestamp: Date;
}

export default function KnowledgeGraphPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [usersOnline, setUsersOnline] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'threads' | 'json'>('threads');

  // Threads tab state
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadInput, setThreadInput] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // JSON tab state
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonLoading, setJsonLoading] = useState(false);

  const { nodes, edges, setGraphState, applyRemoteUpdate, addNode, addEdge, clear: clearGraph } = useGraphStore();
  const stats = useMemo(
    () => ({ nodeCount: nodes.length, edgeCount: edges.length }),
    [nodes.length, edges.length]
  );

  // Auto-scroll threads to bottom
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  useEffect(() => {
    const userId =
      (typeof window !== 'undefined' && sessionStorage.getItem('knowledgeUserId')) ||
      `user-${Math.random().toString(36).slice(2, 8)}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('knowledgeUserId', userId);
    }

    initializeWebSocket(
      undefined,
      {
        onConnect: () => {
          setWsConnected(true);
          fetch('/api/graph')
            .then((res) => res.json())
            .then((data) => { setGraphState(data); })
            .catch((error) => console.error('Failed to load graph:', error));
        },
        onDisconnect: () => { setWsConnected(false); },
        onNodeUpdate: (node) => { applyRemoteUpdate({ type: 'node_updated', payload: node, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onNodeAdded: (node) => { applyRemoteUpdate({ type: 'node_added', payload: node, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onNodeRemoved: (nodeId) => { applyRemoteUpdate({ type: 'node_removed', payload: nodeId, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeUpdate: (edge) => { applyRemoteUpdate({ type: 'edge_updated', payload: edge, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeAdded: (edge) => { applyRemoteUpdate({ type: 'edge_added', payload: edge, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeRemoved: (edgeId) => { applyRemoteUpdate({ type: 'edge_removed', payload: edgeId, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onRemoteMessage: (message) => { applyRemoteUpdate(message); },
        onUsersOnline: (count) => { setUsersOnline(count); },
      },
      userId
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // THREADS: Extract from natural language → show as chat bubbles
  const handleThreadSubmit = async () => {
    if (!threadInput.trim() || threadLoading) return;
    const userText = threadInput.trim();
    setThreadInput('');
    setThreadLoading(true);

    const userMsg: ThreadMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      addedToGraph: false,
      timestamp: new Date(),
    };
    setThreadMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: userText, existingNodes: nodes }),
      });

      if (!response.ok) throw new Error('Extraction failed');
      const result = (await response.json()) as ExtractionResult;
      const added = result.nodes.length > 0 || result.edges.length > 0;

      result.nodes.forEach((n) => { addNode(n); emitNodeAdded(n); });
      result.edges.forEach((e) => { addEdge(e); emitEdgeAdded(e); });

      setThreadMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, addedToGraph: added } : m))
      );

      if (!added) {
        setThreadMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'No new entities found in this message.',
          addedToGraph: false,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setThreadMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to extract entities. Please try again.',
        addedToGraph: false,
        timestamp: new Date(),
      }]);
    } finally {
      setThreadLoading(false);
    }
  };

  // JSON: Parse raw JSON and inject directly into graph
  const handleJsonSubmit = async () => {
    setJsonError(null);
    setJsonLoading(true);
    try {
      const parsed = JSON.parse(jsonInput);
      const nodesIn = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const edgesIn = Array.isArray(parsed.edges) ? parsed.edges : [];
      if (nodesIn.length === 0 && edgesIn.length === 0) {
        throw new Error('JSON must contain "nodes" or "edges" arrays.');
      }
      nodesIn.forEach((n: any) => { addNode(n); emitNodeAdded(n); });
      edgesIn.forEach((e: any) => { addEdge(e); emitEdgeAdded(e); });
      setJsonInput('');
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON');
    } finally {
      setJsonLoading(false);
    }
  };

  const handleResetGraph = async () => {
    if (!confirm('Wipe entire graph? Cannot be undone.')) return;
    await fetch('/api/graph/reset', { method: 'POST' });
    clearGraph();
    setThreadMessages([]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b101e] text-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-none border-b border-gray-800 bg-[#111827]">
        <div className="px-6 py-3 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          >
            🧠 Synapse Knowledge Graph Engine
          </motion.h1>

          <div className="flex gap-3 items-center">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <p className="text-sm text-emerald-200">
                <span className="font-bold">{usersOnline}</span> {usersOnline === 1 ? 'user' : 'users'} online
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
              <span className="font-bold text-white">{stats.nodeCount}</span> Concepts
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
              <span className="font-bold text-white">{stats.edgeCount}</span> Relationships
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Graph Canvas (left, takes 2.5x space) */}
        <div className="flex-[2.5] relative border-r border-gray-800">
          <ForceGraphCanvas onNodeSelect={setSelectedNodeId} />
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col bg-[#111827] min-w-0">
          {selectedNodeId ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <NodeDetails nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
            </div>
          ) : (
            <>
              {/* Tab Bar */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-800 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('threads')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === 'threads'
                      ? 'text-white border-b-2 border-purple-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Threads
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === 'json'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  JSON
                </button>
                <div className="ml-auto mb-1">
                  <button
                    onClick={handleResetGraph}
                    title="Clear Graph"
                    className="text-gray-600 hover:text-red-400 transition p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── THREADS TAB ── */}
              {activeTab === 'threads' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Message Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {threadMessages.length === 0 && (
                      <div className="text-center text-gray-600 text-sm mt-12">
                        <p className="text-2xl mb-3">💬</p>
                        <p className="font-medium text-gray-500">Start a conversation</p>
                        <p className="mt-1">Type natural language below — entities and relationships will be extracted into the graph automatically.</p>
                      </div>
                    )}
                    <AnimatePresence>
                      {threadMessages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <span className="text-xs text-gray-500 mb-1 ml-1">Assistant</span>
                          )}
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-purple-600 text-white rounded-br-sm'
                                : 'bg-[#1f2937] text-gray-300 rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                          {msg.role === 'user' && (
                            <span className={`text-xs mt-1 mr-1 ${msg.addedToGraph ? 'text-emerald-400' : 'text-gray-600'}`}>
                              {msg.addedToGraph ? '✓ Added to graph' : '— Skipped adding to graph'}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {threadLoading && (
                      <div className="flex justify-start pl-1">
                        <div className="bg-[#1f2937] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={threadEndRef} />
                  </div>

                  {/* Thread Input Bar */}
                  <div className="p-3 border-t border-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-[#1f2937] border border-gray-700 rounded-xl px-3 py-2 focus-within:border-purple-500 transition-colors">
                      <input
                        type="text"
                        value={threadInput}
                        onChange={(e) => setThreadInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleThreadSubmit();
                          }
                        }}
                        disabled={threadLoading}
                        placeholder="Enter your message content here..."
                        className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none text-sm py-1"
                      />
                      <button
                        onClick={handleThreadSubmit}
                        disabled={threadLoading || !threadInput.trim()}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                          threadLoading || !threadInput.trim()
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── JSON TAB ── */}
              {activeTab === 'json' && (
                <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
                  <p className="text-xs text-gray-500 flex-shrink-0">
                    Paste raw JSON with{' '}
                    <code className="text-purple-400">nodes</code> and{' '}
                    <code className="text-purple-400">edges</code> arrays to inject directly into the graph.
                  </p>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => { setJsonInput(e.target.value); setJsonError(null); }}
                    placeholder={`{\n  "nodes": [\n    { "id": "1", "label": "Sun", "type": "Object", "description": "A star" }\n  ],\n  "edges": [\n    { "source": "1", "target": "2", "label": "ORBITS", "type": "relates_to" }\n  ]\n}`}
                    className="flex-1 bg-[#1f2937] border border-gray-700 text-gray-200 text-xs font-mono rounded-lg p-3 focus:outline-none focus:border-purple-500 resize-none placeholder-gray-600 min-h-0"
                    spellCheck={false}
                  />
                  {jsonError && (
                    <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded p-2 flex-shrink-0">
                      {jsonError}
                    </p>
                  )}
                  <button
                    onClick={handleJsonSubmit}
                    disabled={jsonLoading || !jsonInput.trim()}
                    className={`py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                      jsonLoading || !jsonInput.trim()
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}
                  >
                    {jsonLoading ? 'Injecting...' : 'Inject JSON into Graph'}
                  </button>

                  {/* Path Traversal lives in JSON tab */}
                  <div className="border-t border-gray-800 pt-3 overflow-y-auto">
                    <PathFinder />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
