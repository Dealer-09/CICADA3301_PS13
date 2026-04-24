# 🧠 Graphy: Knowledge Evolved

Graphy is a state-of-the-art **AI-powered Knowledge Graph Engine** designed to transform unstructured natural language into structured, persistent, and navigable graph data. Built for the **CICADA3301 Project Challenge**, it combines high-performance visualization with industrial-grade persistence and real-time collaboration.

---

## 🌟 Purpose & Benefits

The core purpose of Graphy is to bridge the gap between human language and structured knowledge. In an era of information overload, Graphy provides:

-   **Structured Intelligence**: Automatically distill entities and complex relationships from raw text, creating a digital twin of information.
-   **Collaborative Synthesis**: Enable teams to co-create and explore knowledge graphs in real-time, synchronizing research efforts across globally distributed users.
-   **Deep Contextualization**: Beyond simple notes, Graphy visualizes the *connections* between concepts, revealing insights that are often lost in linear documents.
-   **High Fidelity Persistence**: Leveraging Neo4j, every relationship is stored with mathematical precision, ensuring data integrity and queryable intelligence at scale.

---

## 🛠 Key Implementations & Work Done

Our team has executed a comprehensive overhaul of the platform, focusing on performance, scalability, and user experience:

### 1. Neural Extraction Pipeline
We integrated the **Groq API with Llama-3-70b** to create a robust extraction engine. It identifies nodes (concepts) and edges (relationships) with high semantic accuracy, even from complex or ambiguous inputs.

### 2. High-Performance Visualization
Implemented a custom 2D force-directed graph layer using `react-force-graph-2d`. Key enhancements include:
-   **Custom Canvas Rendering**: Optimized for smooth performance even with hundreds of nodes.
-   **Interactive UI States**: Node highlighting, edge detail panels, and confidence visualization.
-   **Dynamic Halos**: Visual cues to indicate newly added or high-importance entities.

### 3. Real-Time Sync Engine
Built a "Single Source of Truth" synchronization system using **Socket.io**.
-   **Graph Refresh Events**: Ensures all connected peers see the same data state immediately after an extraction.
-   **User Presence**: Live tracking of active collaborators within the workspace.

### 4. Enterprise-Grade Architecture
-   **Authentication**: Secure gatekeeping via **Clerk**.
-   **Multi-Tenancy**: A workspace-based system managed through **MongoDB**, allowing users to create, join, and isolate distinct projects.
-   **Data Isolation**: Implemented `workspaceId` tagging across the **Neo4j** backend to ensure strict data separation between different teams.

### 5. Advanced Exploration Tools
-   **Path Traversal**: Algorithms to find the shortest or most relevant path between any two concepts in the graph.
-   **Hybrid Input**: Support for both natural language "Threads" (conversational) and raw JSON injection (programmatic).

---

## ✨ Core Features

-   **Real-time AI Extraction**: Powered by Llama-3 to extract entities and relationships.
-   **Cross-Graph Linking**: Automatically connects new insights to existing graph structures.
-   **Interactive Legend**: Filter and explore nodes by their specific entity types.
-   **Persistent Workspaces**: Save your research and return to it anytime.

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| **Visualization** | D3-powered Force Graph (`react-force-graph-2d`) |
| **Persistence** | Neo4j (Graph), MongoDB (Workspace Metadata) |
| **Auth** | Clerk |
| **AI/LLM** | Groq API (Llama-3-70b) |
| **Real-time** | Socket.io |
| **State** | Zustand |

---

## 🏁 Getting Started

### 1. Prerequisites
-   Node.js 18+ or Bun.
-   A running Neo4j instance.
-   A MongoDB instance.
-   API Keys for Groq and Clerk.

### 2. Environment Variables
Create a `.env.local` file with the following:
```env
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# AI
GROQ_API_KEY=gsk_...

# Real-time
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Database (MongoDB)
MONGODB_URI=mongodb+srv://...
```

### 3. Installation & Development
```bash
# Install dependencies
bun install

# Run development server
bun dev
```

---

## 🧹 Codebase Optimization
This repository has been audited for production readiness:
-   Removed legacy `EntityInput` components.
-   Standardized entity types across AI extraction and UI.
-   Migrated from builder-pattern components to a unified canvas rendering layer.

---
*Built for DevWrap2.0*