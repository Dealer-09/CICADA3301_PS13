'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { useGraphStore } from '@/store/graphStore';

const NODE_COLORS: Record<string, string> = {
  Entity: '#f472b6',      // Pink
  Event: '#3b82f6',       // Blue
  Location: '#10b981',    // Green
  Object: '#fbbf24',      // Yellow
  Organization: '#8b5cf6', // Purple
  Topic: '#f97316',       // Orange
  User: '#14b8a6',        // Teal
  // Fallbacks for old data
  concept: '#3b82f6',
  definition: '#f472b6',
  entity: '#fbbf24',
  relationship: '#f97316',
};

interface ForceGraphCanvasProps {
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
}

const ForceGraphCanvas: React.FC<ForceGraphCanvasProps> = ({ onNodeSelect, onEdgeSelect }) => {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // Configure physics forces after mount so nodes spread out and are readable
  useEffect(() => {
    const fg = fgRef.current as any;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-500);
    fg.d3Force('link')?.distance(140);
  }, []);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { nodes: rawNodes, edges: rawEdges, highlightedNodeIds, highlightedEdgeIds, setHighlightedPath, clearHighlight } = useGraphStore();
  const nodes = rawNodes ?? [];
  const edges = rawEdges ?? [];

  const [searchQuery, setSearchQuery] = useState('');

  // When search query changes, highlight matching nodes + their connections
  useEffect(() => {
    if (!searchQuery.trim()) {
      clearHighlight();
      return;
    }
    const q = searchQuery.toLowerCase();
    const matched = nodes.filter(n => n.label.toLowerCase().includes(q));
    if (matched.length === 0) { clearHighlight(); return; }

    const matchedIds = new Set(matched.map(n => n.id));
    const connectedEdges = edges.filter(e => {
      const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
      return matchedIds.has(src) || matchedIds.has(tgt);
    });
    const neighborIds = new Set<string>(matchedIds);
    connectedEdges.forEach(e => {
      const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
      neighborIds.add(src); neighborIds.add(tgt);
    });
    setHighlightedPath(Array.from(neighborIds), connectedEdges.map(e => e.id));

    // Zoom to first match
    const first = matched[0] as any;
    if (first?.x !== undefined && fgRef.current) {
      fgRef.current.centerAt(first.x, first.y, 600);
      fgRef.current.zoom(2.5, 700);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, nodes, edges]);

  // Resize observer to make graph responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pre-calculate node connection degrees for sizing
  const nodeDegrees = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach(e => {
      const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
      counts[sourceId] = (counts[sourceId] || 0) + 1;
      counts[targetId] = (counts[targetId] || 0) + 1;
    });
    return counts;
  }, [edges]);

  // Format data for react-force-graph
  const graphData = useMemo(() => {
    // Create a fast lookup set for node IDs
    const nodeIds = new Set((nodes ?? []).map(n => n.id));
    
    return {
      nodes: nodes.map(n => {
        const degree = nodeDegrees[n.id] || 0;
        // Base size 6, plus 2 for every connection, max 30 for central nodes
        const size = Math.min(6 + degree * 2.5, 30);
        return {
          ...n,
          size,
          color: NODE_COLORS[n.type] || '#ffffff'
        };
      }),
      // Filter out edges that point to non-existent nodes to prevent crashes
      links: edges.filter(e => {
        const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
        const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      }).map(e => ({
        ...e,
      }))
    };
  }, [nodes, edges, nodeDegrees]);

  const handleNodeClick = useCallback((node: any) => {
    if (onNodeSelect) onNodeSelect(node.id);

    // Find all edges connected to this node
    const connectedEdges = edges.filter(e => {
      const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
      return src === node.id || tgt === node.id;
    });

    // Collect the neighbor node IDs
    const neighborIds = new Set<string>([node.id]);
    connectedEdges.forEach(e => {
      const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
      neighborIds.add(src);
      neighborIds.add(tgt);
    });

    setHighlightedPath(Array.from(neighborIds), connectedEdges.map(e => e.id));

    // Zoom to node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.5, 1000);
    }
  }, [onNodeSelect, edges, setHighlightedPath]);

  const handleLinkClick = useCallback((link: any) => {
    if (onEdgeSelect) onEdgeSelect(link.id);
  }, [onEdgeSelect]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#111827] rounded-xl overflow-hidden shadow-2xl relative">
      {/* Collapsible Legend */}
      <div className="absolute top-4 left-4 z-10 bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden shadow-lg transition-all duration-300">
        <button 
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-800 transition-colors"
        >
          <svg 
            className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isLegendExpanded ? '' : '-rotate-90'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-gray-100 text-sm font-bold">Entity Types</span>
        </button>
        
        {isLegendExpanded && (
          <div className="px-2 pb-2 space-y-1 border-t border-gray-700 pt-2 flex flex-col">
            {Object.entries(NODE_COLORS).slice(0, 7).map(([type, color]) => (
              <button 
                key={type}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedType === type ? 'bg-purple-900/40 border border-purple-500/50' : 'hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>
                <span className="text-gray-200 text-sm">{type}</span>
              </button>
            ))}

            {selectedType && (
              <button
                onClick={() => setSelectedType(null)}
                className="mt-2 text-gray-400 hover:text-white text-xs flex items-center gap-1 px-3 py-2 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Clear highlight
              </button>
            )}
          </div>
        )}
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="label"
        // ── Physics: push nodes apart so labels are readable ──
        d3VelocityDecay={0.25}
        d3AlphaDecay={0.012}
        cooldownTicks={250}
        nodeColor={(node: any) => {
          if (selectedType) return node.type === selectedType ? node.color : '#1f2937';
          if (highlightedNodeIds.size > 0) return highlightedNodeIds.has(node.id) ? node.color : '#374151';
          return node.color;
        }}
        nodeRelSize={1}
        linkColor={(link: any) => {
          if (selectedType) return 'rgba(31, 41, 55, 0.2)'; // Very dim #1f2937
          if (highlightedEdgeIds.size > 0) return highlightedEdgeIds.has(link.id) ? '#fbbf24' : '#374151';
          return 'rgba(156, 163, 175, 0.4)';
        }}
        linkWidth={(link: any) => (highlightedEdgeIds.has(link.id) ? 3 : 1)}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx, globalScale) => {
          // Do not draw text labels if a type is selected and the rest is dimmed
          if (selectedType) return;
          const start = link.source;
          const end = link.target;

          // ignore unbound links - crucially MUST be before we try to access properties on them!
          if (!start || !end || typeof start !== 'object' || typeof end !== 'object') return;

          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = (start.size || 6) * 1.5;

          // calculate label positioning
          const textPos = {
            x: start.x + (end.x - start.x) / 2,
            y: start.y + (end.y - start.y) / 2
          };

          const relLink = { x: end.x - start.x, y: end.y - start.y };
          const linkLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2));
          const maxTextLength = linkLength - LABEL_NODE_MARGIN * 2;

          // If nodes are too close, don't draw text to avoid negative font size crash
          if (maxTextLength <= 0) return;

          let textAngle = Math.atan2(relLink.y, relLink.x);
          // maintain label vertical orientation for legibility
          if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
          if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

          const label = link.label || '';
          if (!label) return;

          // estimate fontSize to fit in link length
          ctx.font = '1px Sans-Serif';
          const textWidth1px = ctx.measureText(label).width;
          const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / textWidth1px);
          
          if (fontSize < 1.5 && globalScale < 2) return; // Don't draw tiny unreadable text

          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

          // draw text label
          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(textAngle);

          ctx.fillStyle = '#111827'; // Dark background block to cut line
          ctx.fillRect(- bckgDimensions[0] / 2, - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = highlightedEdgeIds.has(link.id) ? '#fbbf24' : '#9ca3af';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        onBackgroundClick={() => { clearHighlight(); setSearchQuery(''); }}
        backgroundColor="#111827"
        onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const size = node.size || 6;
          
          const isPathHighlighted = highlightedNodeIds.size > 0 && highlightedNodeIds.has(node.id);
          
          // Helper to match Zep types with our old legacy graph data
          const isTypeMatch = (nType: string, sType: string) => {
            if (nType === sType) return true;
            if (sType === 'Event' && nType === 'concept') return true;
            if (sType === 'Entity' && nType === 'definition') return true;
            if (sType === 'Object' && nType === 'entity') return true;
            if (sType === 'Topic' && nType === 'relationship') return true;
            return false;
          };

          const isTypeHighlighted = selectedType && isTypeMatch(node.type, selectedType);
          const isHighlighted = isPathHighlighted || isTypeHighlighted;
          const isDimmed = (highlightedNodeIds.size > 0 && !isPathHighlighted) || (selectedType && !isTypeHighlighted);
          
          // Draw Highlight Halo
          if (isHighlighted) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#fbbf24'; // Gold halo
            ctx.fill();
            
            // Inner dark circle to create ring effect
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 1, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#111827'; // Dark background
            ctx.fill();
          }

          // Draw Node Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = isDimmed ? (selectedType ? '#1f2937' : '#374151') : node.color;
          ctx.fill();

          // Node Text (Below circle)
          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDimmed ? '#4b5563' : '#f3f4f6';
          
          // Only show labels when zoomed in somewhat, or if it's a huge central node, or highlighted
          if (globalScale > 1.5 || size > 15 || isHighlighted) { 
            ctx.fillText(label, node.x, node.y + size + 6);
          }
        }}
      />
      {/* Search Bar */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-2 bg-[#1f2937]/90 backdrop-blur border border-gray-700 rounded-full px-4 py-2 shadow-lg">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search graph..."
            className="bg-transparent text-gray-200 text-sm placeholder-gray-500 outline-none w-36 focus:w-48 transition-all duration-300"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); clearHighlight(); }} className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForceGraphCanvas;
