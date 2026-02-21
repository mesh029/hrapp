'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  ReactFlowInstance,
} from 'reactflow';

const nodeTypes = {};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'User Login Request' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 180 },
    data: { label: 'Validate Credentials\n(Email + Password)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'check-user',
    position: { x: 200, y: 310 },
    data: { label: 'User Exists?\nActive?' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'generate-tokens',
    position: { x: 400, y: 310 },
    data: { label: 'Generate JWT Tokens\n(Access + Refresh)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'store-session',
    position: { x: 400, y: 440 },
    data: { label: 'Store Session in Redis\n(Refresh Token)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'return-tokens',
    position: { x: 400, y: 570 },
    data: { label: 'Return Tokens to Client' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 440 },
    data: { label: '401 Unauthorized\nInvalid Credentials' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'refresh',
    position: { x: 650, y: 180 },
    data: { label: 'Token Refresh Request' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'validate-refresh',
    position: { x: 650, y: 310 },
    data: { label: 'Validate Refresh Token\n(Check Redis)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'new-tokens',
    position: { x: 650, y: 440 },
    data: { label: 'Generate New Tokens' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'logout',
    position: { x: 900, y: 180 },
    data: { label: 'Logout Request' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'invalidate',
    position: { x: 900, y: 310 },
    data: { label: 'Invalidate Tokens\n(Remove from Redis)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 700 },
    data: { label: 'Login Complete' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 180, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'validate', animated: true },
  { id: 'e2', source: 'validate', target: 'check-user', animated: true },
  { id: 'e3', source: 'check-user', target: 'error', label: 'No/Inactive', animated: true },
  { id: 'e4', source: 'check-user', target: 'generate-tokens', label: 'Yes', animated: true },
  { id: 'e5', source: 'generate-tokens', target: 'store-session', animated: true },
  { id: 'e6', source: 'store-session', target: 'return-tokens', animated: true },
  { id: 'e7', source: 'return-tokens', target: 'end', animated: true },
  { id: 'e8', source: 'refresh', target: 'validate-refresh', animated: true },
  { id: 'e9', source: 'validate-refresh', target: 'new-tokens', animated: true },
  { id: 'e10', source: 'logout', target: 'invalidate', animated: true },
];

export default function AuthenticationFlow() {
  console.log('[AuthenticationFlow] Component rendering');
  console.log('[AuthenticationFlow] initialNodes count:', initialNodes.length);
  console.log('[AuthenticationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[AuthenticationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[AuthenticationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[AuthenticationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[AuthenticationFlow] Component mounted');
    console.log('[AuthenticationFlow] Nodes state:', nodes.length);
    console.log('[AuthenticationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[AuthenticationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[AuthenticationFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[AuthenticationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[AuthenticationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[AuthenticationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[AuthenticationFlow] onEdgesChange:', changes);
          onEdgesChange(changes);
        }}
        onConnect={onConnect}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f9fafb" gap={20} size={1} />
        <Controls showInteractive={false} className="bg-white border-2 border-slate-200 rounded-xl shadow-lg" />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'input' || node.type === 'output') return '#0284c7';
            if (node.style?.background === '#d4edda') return '#28a745';
            if (node.style?.background === '#f8d7da') return '#dc3545';
            if (node.style?.background === '#fff3cd') return '#ffc107';
            return '#6b7280';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable
          zoomable
          className="h-[120px] bg-white border-2 border-slate-200 rounded-xl shadow-lg"
        />
      </ReactFlow>
    </div>
  );
}
