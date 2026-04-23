'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { initializeWebSocket } from '@/lib/ws/client';
import EntityInput from '@/components/EntityInput';
import { motion } from 'framer-motion';

const GraphCanvas = dynamic(() => import('@/components/GraphCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Loading graph canvas...</p>
    </div>
  ),
});

export default function KnowledgeGraphPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [stats, setStats] = useState({ nodeCount: 0, edgeCount: 0 });
  const { nodes, edges, setGraphState } = useGraphStore();

  useEffect(() => {
    // Initialize WebSocket for real-time sync
    initializeWebSocket(typeof window !== 'undefined' ? window.location.origin : '', {
      onConnect: () => {
        console.log('Connected to WebSocket');
        // Load initial graph state
        fetch('/api/graph')
          .then((res) => res.json())
          .then((data) => {
            setGraphState(data);
          })
          .catch((error) => console.error('Failed to load graph:', error));
      },
      onRemoteMessage: (message) => {
        console.log('Remote update:', message);
      },
    });
  }, [setGraphState]);

  // Update stats
  useEffect(() => {
    setStats({
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });
  }, [nodes, edges]);

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

          <div className="flex gap-4 items-center">
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
            <EntityInput onExtracted={() => console.log('Concepts extracted')} />

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
          <p>Real-time collaborative knowledge graph powered by Next.js, React Flow, Neo4j & OpenAI</p>
        </div>
      </footer>
    </div>
  );
}

export default function DevWrapLanding() {
  const [phase, setPhase] = useState<Phase>("black");
  const timers = useRef<NodeJS.Timeout[]>([]);

  const addTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timers.current.push(t);
  };

  useEffect(() => {
    addTimer(() => setPhase("sc-ece-reveal"), 400);
    addTimer(() => setPhase("sc-ece-hold"), 2500);
    addTimer(() => setPhase("transition"), 4200);
    addTimer(() => setPhase("devwrap-reveal"), 5200);
    addTimer(() => setPhase("welcome"), 6500);
    addTimer(() => setPhase("complete"), 8500);

    return () => timers.current.forEach(clearTimeout);
  }, []);

  const showDevWrap =
    phase === "devwrap-reveal" || phase === "welcome" || phase === "complete";

  const showLoader = !showDevWrap;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes pixelBlink {
          0%,100% { opacity:.3; transform:scale(.85); }
          50% { opacity:1; transform:scale(1); }
        }

        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes fadeUp {
          from{opacity:0; transform:translateY(30px)}
          to{opacity:1; transform:translateY(0)}
        }

        @keyframes marqueeScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes scEceReveal {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes glowPulse {
          0%, 100% { text-shadow: 0 0 15px rgba(0, 232, 168, 0.3), 0 0 25px rgba(0, 200, 150, 0.15); }
          50% { text-shadow: 0 0 20px rgba(0, 232, 168, 0.5), 0 0 35px rgba(0, 200, 150, 0.25); }
        }

        @keyframes devwrapGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(0, 200, 150, 0.3); }
          50% { text-shadow: 0 0 40px rgba(0, 232, 168, 0.6), 0 0 60px rgba(0, 200, 150, 0.4); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          background: showDevWrap ? "#0A0A0A" : "#000",
          transition: "background 0.8s ease",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {/* ───────────── LOADER TEXT ───────────── */}
        {showLoader && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#00C896",
              fontFamily: "'Syne', sans-serif",
              textAlign: "center",
              animation: "scEceReveal 0.8s ease forwards",
            }}
          >
            {/* Main Text */}
            <div
              style={{
                fontSize: "clamp(50px, 9vw, 100px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: 30,
                animation:
                  "scEceReveal 1s ease forwards, glowPulse 3s ease-in-out infinite",
                textShadow:
                  "0 0 15px rgba(0, 232, 168, 0.3), 0 0 25px rgba(0, 200, 150, 0.15)",
              }}
            >
              SC-ECE
              <br />
              PRESENTS
            </div>

            {/* Decorative Line */}
            <div
              style={{
                width: "clamp(100px, 20vw, 300px)",
                height: 3,
                background:
                  "linear-gradient(90deg, #00C896 0%, #00E8A8 50%, #00C896 100%)",
                marginBottom: 40,
                borderRadius: 2,
                animation: "slideIn 0.8s ease 0.3s forwards",
                opacity: 0,
              }}
            />

            {/* Subtitle */}
            <div
              style={{
                fontSize: 14,
                letterSpacing: "0.2em",
                color: "#999",
                fontFamily: "'Space Mono', monospace",
                textTransform: "uppercase",
                animation: "slideIn 1s ease 0.4s forwards",
                opacity: 0,
              }}
            >
              INNOVATION × DESIGN × ENGINEERING
            </div>

            {/* Hackathon Participant Guide */}
            <div
              style={{
                marginTop: 80,
                padding: "20px 30px",
                background: "rgba(0, 200, 150, 0.1)",
                border: "1px solid rgba(0, 232, 168, 0.3)",
                borderRadius: 8,
                fontSize: 12,
                letterSpacing: "0.1em",
                color: "#00E8A8",
                fontFamily: "'Space Mono', monospace",
                textAlign: "center",
                animation: "slideIn 1.2s ease 0.6s forwards",
                opacity: 0,
                maxWidth: "90%",
              }}
            >
              💡 <strong>Ready to build?</strong>
              <br />
              Start editing{" "}
              <code style={{ color: "#00F5BB" }}>app/page.tsx</code> to
              customize this page
            </div>
          </div>
        )}

        {/* ───────────── DEVWRAP SECTION ───────────── */}
        {showDevWrap && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#F5F5F0",
              animation: "fadeIn .8s ease forwards",
            }}
          >
            {/* TOP MARQUEE BAR */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 36,
                background: "#00C896",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  whiteSpace: "nowrap",
                  animation: "marqueeScroll 12s linear infinite",
                }}
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#000",
                      letterSpacing: "0.2em",
                      padding: "0 32px",
                    }}
                  >
                    SC-ECE PRESENTS · DEVWRAP · FROM SKETCH TO SOLUTION ·
                  </span>
                ))}
              </div>
            </div>

            <PixelGrid />

            <div
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(60px, 10vw, 130px)",
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                animation: "devwrapGlow 3s ease-in-out infinite",
                textShadow: "0 0 20px rgba(0, 200, 150, 0.3)",
              }}
            >
              devwrap
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                letterSpacing: "0.4em",
                color: "#00C896",
                textTransform: "uppercase",
                animation: "fadeUp .8s ease forwards",
              }}
            >
              From Sketch to Solution
            </div>

            {(phase === "welcome" || phase === "complete") && (
              <div
                style={{
                  marginTop: 40,
                  textAlign: "center",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 20,
                  opacity: 0.75,
                  animation: "fadeUp 1s ease forwards",
                }}
              >
                Welcome, Builders. 🚀
                <br />
                <span style={{ opacity: 0.6, fontSize: 16 }}>
                  Turn your ideas into interfaces.
                </span>
              </div>
            )}

            {/* Hackathon Participant Guide */}
            <div
              style={{
                position: "absolute",
                bottom: 40,
                padding: "16px 28px",
                background: "rgba(0, 200, 150, 0.08)",
                border: "1px solid rgba(0, 232, 168, 0.25)",
                borderRadius: 8,
                fontSize: 12,
                letterSpacing: "0.1em",
                color: "#00E8A8",
                fontFamily: "'Space Mono', monospace",
                textAlign: "center",
                animation: "slideIn 1.2s ease 0.6s forwards",
                opacity: 0,
              }}
            >
              💡 <strong>Ready to customize?</strong>
              <br />
              Start editing{" "}
              <code style={{ color: "#00F5BB" }}>app/page.tsx</code> to make
              changes
            </div>
          </div>
        )}
      </div>
    </>
  );
}
