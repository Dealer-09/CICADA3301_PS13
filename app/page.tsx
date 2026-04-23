'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { initializeWebSocket } from '@/lib/ws/client';
import EntityInput from '@/components/EntityInput';
import NodeDetails from '@/components/NodeDetails';
import PathFinder from '@/components/PathFinder';
import { motion } from 'framer-motion';

const ForceGraphCanvas = dynamic(() => import('@/components/ForceGraphCanvas'), {
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
    <div className="h-screen flex flex-col bg-[#0b101e] text-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-none border-b border-gray-800 bg-[#111827]">
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

            <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700">
              <p className="text-sm text-gray-300">
                <span className="font-bold text-white">{stats.nodeCount}</span> Concepts
              </p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700">
              <p className="text-sm text-gray-300">
                <span className="font-bold text-white">{stats.edgeCount}</span> Relationships
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Graph Canvas (takes most space like Zep) */}
        <div className="flex-[2.5] relative border-r border-gray-800">
          <ForceGraphCanvas onNodeSelect={setSelectedNodeId} />
        </div>

        {/* Right Panel - Input & Details */}
        <div className="flex-1 flex flex-col bg-[#111827] overflow-y-auto">
          {selectedNodeId ? (
            <div className="p-6">
              <NodeDetails
                nodeId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          ) : (
            <div className="p-6 flex flex-col h-full space-y-6">
              {/* Tab Header mock */}
              <div className="flex gap-4 border-b border-gray-800 pb-2">
                <button className="text-sm font-semibold text-gray-400 hover:text-white">Threads</button>
                <button className="text-sm font-semibold text-purple-400 border-b-2 border-purple-400 pb-2">JSON</button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {/* List of recent extractions or paths */}
                <div className="mb-4">
                  <PathFinder />
                </div>
              </div>

              {/* Entity Input handles the extraction */}
              <div className="pt-4 border-t border-gray-800">
                <EntityInput onExtracted={() => {}} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
