'use client';

import { Handle, Position } from 'reactflow';
import React from 'react';

interface NodeData {
  label: string;
  type: string;
  description?: string;
  confidence?: number;
}

export const DefinitionNode: React.FC<{ data: NodeData }> = ({ data }) => {
  return (
    <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fce7f3' }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#be123c' }}>
        📖 {data.label}
      </div>
      {data.description && (
        <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', color: '#333' }}>
          {data.description.substring(0, 50)}...
        </div>
      )}
      {data.confidence !== undefined && (
        <div style={{ fontSize: '10px', opacity: 0.7, color: '#666' }}>
          Confidence: {(data.confidence * 100).toFixed(0)}%
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default DefinitionNode;
