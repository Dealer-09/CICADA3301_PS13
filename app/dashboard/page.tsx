'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useGraphStore } from '@/store/graphStore';
import { initializeWebSocket } from '@/lib/ws/client';
import NodeDetails from '@/components/NodeDetails';
import PathFinder from '@/components/PathFinder';
import { motion, AnimatePresence } from 'framer-motion';
import { emitSyncMessage, closeWebSocket } from '@/lib/ws/client';
import { ExtractionResult } from '@/types/graph';
import WorkspaceModal from '@/components/WorkspaceModal';

const ForceGraphCanvas = dynamic(() => import('@/components/ForceGraphCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#050505] animate-pulse">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-white/60 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🧠</span>
        </div>
      </div>
      <p className="text-white/70 font-bold text-lg tracking-wide">Initializing Neural Graph...</p>
      <p className="text-white/30 text-sm mt-2">Syncing with Neo4j database</p>
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const { user } = useUser();

  const [workspaceInfo, setWorkspaceInfo] = useState<{name: string, inviteCode: string} | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{id: string; source: string; target: string; label: string; type: string; confidence: number} | null>(null);
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
    () => ({ nodeCount: nodes?.length || 0, edgeCount: edges?.length || 0 }),
    [nodes?.length, edges?.length]
  );

  // Auto-scroll threads to bottom
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  useEffect(() => {
    if (!workspaceId) {
      // No workspace selected — open modal automatically
      setShowWorkspaceModal(true);
      return;
    }
    setShowWorkspaceModal(false);
    // Fetch workspace details (name, invite code)
    fetch('/api/workspace')
      .then(res => res.json())
      .then(data => {
        if (data.workspaces) {
          const ws = data.workspaces.find((w: any) => w.workspaceId === workspaceId);
          if (ws) setWorkspaceInfo(ws);
        }
      });
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    const userId = user?.id || `user-${Math.random().toString(36).slice(2, 8)}`;

    // Force-close any existing socket so the singleton re-initializes with the new workspaceId
    closeWebSocket();

    const fetchGraph = () => {
      fetch(`/api/graph?workspaceId=${workspaceId}`)
        .then((res) => res.json())
        .then((data) => { setGraphState(data); })
        .catch((error) => console.error('Failed to load graph:', error));
    };

    initializeWebSocket(
      undefined,
      {
        onConnect: () => {
          setWsConnected(true);
          fetchGraph();
        },
        onDisconnect: () => { setWsConnected(false); },
        onNodeUpdate: (node) => { applyRemoteUpdate({ type: 'node_updated', payload: node, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onNodeAdded: (node) => { applyRemoteUpdate({ type: 'node_added', payload: node, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onNodeRemoved: (nodeId) => { applyRemoteUpdate({ type: 'node_removed', payload: nodeId, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeUpdate: (edge) => { applyRemoteUpdate({ type: 'edge_updated', payload: edge, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeAdded: (edge) => { applyRemoteUpdate({ type: 'edge_added', payload: edge, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onEdgeRemoved: (edgeId) => { applyRemoteUpdate({ type: 'edge_removed', payload: edgeId, timestamp: new Date().toISOString(), userId: 'remote' }); },
        onRemoteMessage: (message) => {
          if ((message as any).type === 'graph_refresh') {
            // A peer extracted new data — re-fetch full ground truth from Neo4j
            fetchGraph();
          } else {
            applyRemoteUpdate(message);
          }
        },
        onUsersOnline: (count) => { setUsersOnline(count); },
      },
      userId,
      workspaceId
    );

    return () => {
      closeWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user]);

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
        body: JSON.stringify({ input: userText, existingNodes: nodes, workspaceId }),
      });

      if (!response.ok) throw new Error('Extraction failed');
      const result = (await response.json()) as ExtractionResult;
      const added = result.nodes.length > 0 || result.edges.length > 0;

      // Update local store immediately for the extracting user
      result.nodes.forEach((n) => { addNode(n); });
      result.edges.forEach((e) => { addEdge(e); });

      // Tell ALL peers (including this client via onRemoteMessage) to re-fetch from Neo4j
      // This is the single source of truth sync — eliminates count divergence
      if (added) {
        emitSyncMessage({ type: 'graph_refresh', payload: workspaceId || '', timestamp: new Date().toISOString(), userId: user?.id || 'unknown' });
      };

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

  // JSON: Parse raw JSON, persist to Neo4j, and sync via graph_refresh
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

      // Ensure each node/edge has required fields and stamp with workspaceId
      const now = new Date().toISOString();
      const userId = user?.id || 'anonymous';
      const stampedNodes = nodesIn.map((n: any) => ({
        id: n.id || crypto.randomUUID(),
        label: n.label || 'Untitled',
        type: n.type || 'Entity',
        description: n.description || '',
        confidence: n.confidence ?? 0.8,
        createdAt: n.createdAt || now,
        updatedAt: now,
        createdBy: n.createdBy || userId,
        metadata: n.metadata || {},
        workspaceId: workspaceId || undefined,
      }));
      const stampedEdges = edgesIn.map((e: any) => ({
        id: e.id || crypto.randomUUID(),
        source: e.source,
        target: e.target,
        label: e.label || 'relates_to',
        type: e.type || 'relates_to',
        confidence: e.confidence ?? 0.8,
        createdAt: e.createdAt || now,
        updatedAt: now,
        createdBy: e.createdBy || userId,
        metadata: e.metadata || {},
        workspaceId: workspaceId || undefined,
      }));

      // Persist to Neo4j via internal API
      const res = await fetch('/api/graph/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: stampedNodes, edges: stampedEdges, workspaceId }),
      });
      if (!res.ok) throw new Error('Failed to persist JSON to database');

      // Update local store
      stampedNodes.forEach((n: any) => addNode(n));
      stampedEdges.forEach((e: any) => addEdge(e));

      // Sync all peers
      emitSyncMessage({ type: 'graph_refresh', payload: workspaceId || '', timestamp: now, userId });

      setJsonInput('');
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON');
    } finally {
      setJsonLoading(false);
    }
  };

  const handleResetGraph = async () => {
    if (!confirm('Wipe entire graph? Cannot be undone.')) return;
    await fetch('/api/graph/reset', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId })
    });
    clearGraph();
    setThreadMessages([]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#050505] text-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-none border-b border-white/[0.08] bg-[#0a0a0a]">
        <div className="px-6 py-3 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-white tracking-tight"
          >
            Graphy
          </motion.h1>

          <div className="flex gap-3 items-center">
            {workspaceInfo && (
              <span className="text-sm font-semibold text-white/60 border-r border-white/10 pr-4">{workspaceInfo.name}</span>
            )}
            <button
              onClick={() => setShowWorkspaceModal(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/[0.05] text-white/60 hover:bg-white/[0.1] border border-white/[0.08] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4H4a4 4 0 00-4 4v2h5m6-10a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              Workspaces
            </button>
            {/* Workspace Modal */}
            <WorkspaceModal
              open={showWorkspaceModal}
              onClose={() => setShowWorkspaceModal(false)}
              currentWorkspaceId={workspaceId}
            />
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <p className="text-sm text-white/50">
                <span className="font-bold text-white/80">{usersOnline}</span> {usersOnline === 1 ? 'user' : 'users'} online
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 hidden md:block">
              <span className="font-bold text-white/80">{stats.nodeCount}</span> Concepts
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 hidden md:block">
              <span className="font-bold text-white/80">{stats.edgeCount}</span> Relationships
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Graph Canvas (left, takes 2.5x space) */}
        <div className="flex-[2.5] relative border-r border-white/[0.08]">
          <ForceGraphCanvas
            onNodeSelect={(id) => { setSelectedNodeId(id); setSelectedEdge(null); }}
            onEdgeSelect={(edgeId) => {
              const edge = edges.find(e => e.id === edgeId);
              if (edge) {
                setSelectedEdge({
                  id: edge.id,
                  source: typeof edge.source === 'object' ? (edge.source as any).id : edge.source,
                  target: typeof edge.target === 'object' ? (edge.target as any).id : edge.target,
                  label: edge.label,
                  type: edge.type,
                  confidence: edge.confidence,
                });
                setSelectedNodeId(null);
              }
            }}
          />
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
          {selectedEdge ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="bg-white/[0.03] rounded-lg border border-white/[0.08] overflow-hidden">
                <div className="bg-[#0a0a0a] px-5 py-4 flex justify-between items-center border-b border-white/[0.08]">
                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Relationship</p>
                    <h3 className="text-white font-bold text-sm">
                      {nodes.find(n => n.id === selectedEdge.source)?.label || selectedEdge.source}
                      <span className="mx-2 text-gray-500">→</span>
                      {nodes.find(n => n.id === selectedEdge.target)?.label || selectedEdge.target}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedEdge(null)} className="p-1 hover:bg-white/[0.05] rounded-full transition-colors text-white/30 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/[0.08] text-white/70 border border-white/[0.1] uppercase tracking-wide">
                      {selectedEdge.label}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/[0.03] text-white/40 border border-white/[0.06]">
                      {selectedEdge.type}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/30 uppercase tracking-wide">Confidence</span>
                      <span className="text-sm font-bold text-white">{(selectedEdge.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                      <div className="bg-white/60 h-1.5 rounded-full" style={{width: `${selectedEdge.confidence * 100}%`}} />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-white/30">Source</span>
                      <span className="text-xs text-white/50 font-mono">{nodes.find(n => n.id === selectedEdge.source)?.label || selectedEdge.source.slice(0,8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-white/30">Target</span>
                      <span className="text-xs text-white/50 font-mono">{nodes.find(n => n.id === selectedEdge.target)?.label || selectedEdge.target.slice(0,8)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNodeId ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <NodeDetails nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} workspaceId={workspaceId} />
            </div>
          ) : (
            <>
              {/* Tab Bar */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/[0.06] flex-shrink-0">
                <button
                  onClick={() => setActiveTab('threads')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'threads'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/30 hover:text-white/60'
                    }`}
                >
                  Threads
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'json'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/30 hover:text-white/60'
                    }`}
                >
                  JSON
                </button>
                <div className="ml-auto mb-1">
                  <button
                    onClick={handleResetGraph}
                    title="Clear Graph"
                    className="text-white/20 hover:text-red-400 transition p-1"
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
                      <div className="text-center text-white/20 text-sm mt-12">
                        <p className="text-2xl mb-3">💬</p>
                        <p className="font-medium text-white/30">Start a conversation</p>
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
                            <span className="text-xs text-white/20 mb-1 ml-1">Assistant</span>
                          )}
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-white text-[#050505] rounded-br-sm'
                                : 'bg-white/[0.04] text-white/60 rounded-bl-sm'
                              }`}
                          >
                            {msg.content}
                          </div>
                          {msg.role === 'user' && (
                            <span className={`text-xs mt-1 mr-1 ${msg.addedToGraph ? 'text-emerald-400' : 'text-white/20'}`}>
                              {msg.addedToGraph ? '✓ Added to graph' : '— Skipped'}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {threadLoading && (
                      <div className="flex justify-start pl-1">
                        <div className="bg-white/[0.04] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={threadEndRef} />
                  </div>

                  {/* Thread Input Bar */}
                  <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-white/20 transition-colors">
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
                        className="flex-1 bg-transparent text-white placeholder-white/20 focus:outline-none text-sm py-1"
                      />
                      <button
                        onClick={handleThreadSubmit}
                        disabled={threadLoading || !threadInput.trim()}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${threadLoading || !threadInput.trim()
                            ? 'text-white/10 cursor-not-allowed'
                            : 'bg-white text-[#050505] hover:bg-white/90'
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
                <div className="flex flex-col flex-1 overflow-hidden p-4 space-y-4">
                  <p className="text-xs text-white/30">Paste a JSON object with <code className="bg-white/[0.05] px-1.5 py-0.5 rounded">nodes</code> and/or <code className="bg-white/[0.05] px-1.5 py-0.5 rounded">edges</code> arrays.</p>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => { setJsonInput(e.target.value); setJsonError(null); }}
                    placeholder='{"nodes": [{"label": "...", "type": "Entity"}], "edges": []}'
                    className="w-full h-48 bg-white/[0.02] border border-white/[0.08] rounded-lg p-3 text-sm text-white/70 font-mono resize-none focus:outline-none focus:border-white/20 placeholder-white/15 transition-colors"
                  />
                  {jsonError && (
                    <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-800/30">{jsonError}</p>
                  )}
                  <button
                    onClick={handleJsonSubmit}
                    disabled={jsonLoading || !jsonInput.trim()}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${jsonLoading || !jsonInput.trim()
                        ? 'bg-white/[0.03] text-white/15 cursor-not-allowed'
                        : 'bg-white text-[#050505] hover:bg-white/90'
                      }`}
                  >
                    {jsonLoading ? 'Injecting...' : 'Inject into Graph'}
                  </button>

                  {/* Path Traversal lives in JSON tab */}
                  <div className="border-t border-white/[0.06] px-4 py-4">
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

export default function KnowledgeGraphPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center bg-[#050505] text-white">
        <div className="w-8 h-8 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
