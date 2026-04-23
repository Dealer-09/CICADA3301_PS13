# 🧠 Synapse Knowledge Graph Engine

Synapse is a modern, AI-powered knowledge graph extraction and visualization engine. It allows users to transform unstructured natural language into structured graph data in real-time, featuring a high-performance physics-based visualization layer.

## ✨ Key Features

- **Real-time AI Extraction**: Powered by Groq/Llama-3, Synapse extracts entities, relationships, and descriptions from raw text.
- **Cross-Graph Linking**: Automatically identifies real-world connections between newly added nodes and existing graph data.
- **Interactive Visualization**: High-performance 2D force-directed graph with custom canvas rendering, halos, and interactive legend filtering.
- **Collaborative Sync**: Built-in WebSocket support via Socket.io for multi-user real-time collaboration.
- **Hybrid Input**: Support for both natural language "Threads" and raw JSON injection for power users.
- **Path Traversal**: Interactive tool to find the shortest or most relevant path between concepts.

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion.
- **Visualization**: `react-force-graph-2d` (D3-powered).
- **Database**: Neo4j (Graph storage).
- **AI**: Groq API (Llama-3-70b-8192).
- **Real-time**: Socket.io.
- **State Management**: Zustand.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ / Bun.
- A running Neo4j instance.
- A Groq API Key.

### 2. Environment Variables
Create a `.env.local` file:
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

### 3. Installation
```bash
bun install
```

### 4. Run Development Server
```bash
bun dev
```

## 🧹 Codebase Cleanup Note
This repository has been audited for dead code.
- Removed `EntityInput.tsx` (Logic integrated into main page).
- Removed legacy `components/nodes/` directory (Rendering handled by canvas layer).
- Standardized entity types across AI extraction and UI.

---
*Built for the CICADA3301 Project Challenge.*
