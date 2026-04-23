'use client';

import { Handle, Position } from 'reactflow';
import React from 'react';

interface NodeData {
  label: string;
  type: string;
  description?: string;
  confidence?: number;
}

export const ConceptNode: React.FC<{ data: NodeData }> = ({ data }) => {
  return (
    <div style={{ padding: '10px', borderRadius: '8px' }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
        {data.label}
      </div>
      {data.description && (
        <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
          {data.description.substring(0, 50)}...
        </div>
      )}
      {data.confidence !== undefined && (
        <div style={{ fontSize: '10px', opacity: 0.7 }}>
          Confidence: {(data.confidence * 100).toFixed(0)}%
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default ConceptNode;
