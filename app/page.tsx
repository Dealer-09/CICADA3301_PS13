'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { initializeWebSocket } from '@/lib/ws/client';
import EntityInput from '@/components/EntityInput';
import NodeDetails from '@/components/NodeDetails';
import PathFinder from '@/components/PathFinder';
import { motion } from 'framer-motion';

const GraphCanvas = dynamic(() => import('@/components/GraphCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-indigo-50/50 border border-indigo-100 rounded-lg animate-pulse">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🧠</span>
        </div>
      </div>
      <p className="text-indigo-800 font-bold text-lg tracking-wide">Initializing Neural Graph...</p>
      <p className="text-indigo-500 text-sm mt-2">Syncing with Neo4j database</p>
    </div>
  ),
});

export default function KnowledgeGraphPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [usersOnline, setUsersOnline] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const { nodes, edges, setGraphState, applyRemoteUpdate } = useGraphStore();
  const stats = useMemo(
    () => ({ nodeCount: nodes.length, edgeCount: edges.length }),
    [nodes.length, edges.length]
  );

  useEffect(() => {
    // Derive a stable session userId (persisted in sessionStorage)
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
          // Load initial graph state from Neo4j
          fetch('/api/graph')
            .then((res) => res.json())
            .then((data) => {
              setGraphState(data);
            })
            .catch((error) => console.error('Failed to load graph:', error));
        },
        onDisconnect: () => {
          setWsConnected(false);
        },
        // Remote user moved/edited an existing node
        onNodeUpdate: (node) => {
          applyRemoteUpdate({
            type: 'node_updated',
            payload: node,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        // Remote user extracted brand-new nodes
        onNodeAdded: (node) => {
          applyRemoteUpdate({
            type: 'node_added',
            payload: node,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        onNodeRemoved: (nodeId) => {
          applyRemoteUpdate({
            type: 'node_removed',
            payload: nodeId,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        // Remote user updated an existing edge
        onEdgeUpdate: (edge) => {
          applyRemoteUpdate({
            type: 'edge_updated',
            payload: edge,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        // Remote user added a new edge
        onEdgeAdded: (edge) => {
          applyRemoteUpdate({
            type: 'edge_added',
            payload: edge,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        onEdgeRemoved: (edgeId) => {
          applyRemoteUpdate({
            type: 'edge_removed',
            payload: edgeId,
            timestamp: new Date().toISOString(),
            userId: 'remote',
          });
        },
        onRemoteMessage: (message) => {
          applyRemoteUpdate(message);
        },
        onUsersOnline: (count) => {
          setUsersOnline(count);
        },
      },
      userId
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-indigo-500/30 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          >
            🧠 Synapse Knowledge Graph Engine
          </motion.h1>

          <div className="flex gap-3 items-center flex-wrap">
            {/* Live users badge */}
            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
              />
              <p className="text-sm text-emerald-200">
                <span className="font-bold">{usersOnline}</span>{' '}
                {usersOnline === 1 ? 'user' : 'users'} online
              </p>
            </div>

            <div className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
              <p className="text-sm text-indigo-200">
                <span className="font-bold">{stats.nodeCount}</span> Concepts
              </p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="text-sm text-purple-200">
                <span className="font-bold">{stats.edgeCount}</span> Relationships
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Input & Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6"
          >
            {/* Entity Input */}
            <EntityInput onExtracted={() => {}} />

            {/* Path Search Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-lg border border-green-200 p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4">🔍 Path Search</h3>
              <p className="text-sm text-gray-700 mb-4">
                Click on a concept node to view its details and discover connections to other concepts in your knowledge graph.
              </p>
              <p className="text-xs text-gray-600">
                The system automatically finds paths and relationships between concepts using multi-hop graph queries.
              </p>
            </motion.div>

            {selectedNodeId && (
              <NodeDetails
                nodeId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
              />
            )}

            <PathFinder />
          </motion.div>

          {/* Right Panel - Graph Canvas */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-lg shadow-2xl border border-indigo-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white">Knowledge Graph Visualization</h2>
                <p className="text-indigo-100 text-sm mt-1">Drag nodes • Click to select • Connect with edges</p>
              </div>
              <GraphCanvas onNodeSelect={setSelectedNodeId} />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-indigo-500/30 bg-slate-900/50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-indigo-300 text-sm">
          <p>Real-time collaborative knowledge graph powered by Next.js, React Flow, Neo4j &amp; Groq</p>
        </div>
      </footer>
    </div>
  );
}
