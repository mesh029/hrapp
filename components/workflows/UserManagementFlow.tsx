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
import 'reactflow/dist/style.css';

const nodeTypes = {};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'Create User Request\n(Admin)' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'check-permission',
    position: { x: 400, y: 180 },
    data: { label: 'Check Permission\n(users.create)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 310 },
    data: { label: 'Validate User Data\n(Email, Name, etc.)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'check-email',
    position: { x: 200, y: 440 },
    data: { label: 'Email Exists?' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'create-user',
    position: { x: 400, y: 440 },
    data: { label: 'Create User\nin Database' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'assign-location',
    position: { x: 200, y: 570 },
    data: { label: 'Assign Primary\nLocation' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'assign-roles',
    position: { x: 400, y: 570 },
    data: { label: 'Assign Roles\n(Optional)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'assign-scopes',
    position: { x: 600, y: 570 },
    data: { label: 'Assign Permission\nScopes (Optional)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 700 },
    data: { label: '400 Bad Request\nDuplicate Email' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'update-cache',
    position: { x: 400, y: 700 },
    data: { label: 'Update Redis Cache\n(User Permissions)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'return-user',
    position: { x: 400, y: 830 },
    data: { label: 'Return Created User\n(with Roles & Scopes)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 960 },
    data: { label: 'User Created' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 180, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'check-permission', animated: true },
  { id: 'e2', source: 'check-permission', target: 'validate', animated: true },
  { id: 'e3', source: 'validate', target: 'check-email', animated: true },
  { id: 'e4', source: 'check-email', target: 'error', label: 'Exists', animated: true },
  { id: 'e5', source: 'check-email', target: 'create-user', label: 'Unique', animated: true },
  { id: 'e6', source: 'create-user', target: 'assign-location', animated: true },
  { id: 'e7', source: 'assign-location', target: 'assign-roles', animated: true },
  { id: 'e8', source: 'assign-roles', target: 'assign-scopes', animated: true },
  { id: 'e9', source: 'assign-scopes', target: 'update-cache', animated: true },
  { id: 'e10', source: 'update-cache', target: 'return-user', animated: true },
  { id: 'e11', source: 'return-user', target: 'end', animated: true },
];

export default function UserManagementFlow() {
  console.log('[UserManagementFlow] Component rendering');
  console.log('[UserManagementFlow] initialNodes count:', initialNodes.length);
  console.log('[UserManagementFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[UserManagementFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[UserManagementFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[UserManagementFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[UserManagementFlow] Component mounted');
    console.log('[UserManagementFlow] Nodes state:', nodes.length);
    console.log('[UserManagementFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[UserManagementFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[UserManagementFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[UserManagementFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[UserManagementFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[UserManagementFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[UserManagementFlow] onEdgesChange:', changes);
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
