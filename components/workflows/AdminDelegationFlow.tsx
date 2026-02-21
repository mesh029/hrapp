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
    data: { label: 'User Unavailable' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'adminAction',
    position: { x: 400, y: 180 },
    data: { label: 'System Admin Action' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'checkAdmin',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'System Admin Has Permission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 220, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 290 },
    data: { label: '403 Forbidden' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 120, height: 60 },
  },
  {
    id: 'createDel',
    position: { x: 400, y: 420 },
    data: { label: 'Create Delegation on Behalf' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'selectUser',
    position: { x: 200, y: 530 },
    data: { label: 'Select Unavailable User' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'selectDelegate',
    position: { x: 400, y: 530 },
    data: { label: 'Select Delegate' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'configDel',
    position: { x: 600, y: 530 },
    data: { label: 'Configure Delegation' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'saveDel',
    position: { x: 400, y: 640 },
    data: { label: 'Save Delegation' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'notifyDel',
    position: { x: 400, y: 750 },
    data: { label: 'Notify Delegate' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'active',
    position: { x: 400, y: 860 },
    data: { label: 'Delegation Active' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'request',
    type: 'input',
    position: { x: 400, y: 990 },
    data: { label: 'Approval Request' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'checkAuth',
    type: 'default',
    position: { x: 400, y: 1120 },
    data: { label: 'Authority Check' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'checkDel',
    type: 'default',
    position: { x: 400, y: 1250 },
    data: { label: 'Active Delegation?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'authorized',
    position: { x: 200, y: 1380 },
    data: { label: 'Authorized via Delegation' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'notAuthorized',
    position: { x: 600, y: 1380 },
    data: { label: 'Not Authorized' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'approve',
    position: { x: 200, y: 1490 },
    data: { label: 'Approve Request' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'sign',
    position: { x: 200, y: 1600 },
    data: { label: 'Generate Signature with Admin Delegation Context' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 280, height: 60 },
  },
  {
    id: 'audit',
    position: { x: 200, y: 1710 },
    data: { label: 'Audit Log: Admin-created Delegation' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 280, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1820 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'adminAction', animated: true },
  { id: 'e2', source: 'adminAction', target: 'checkAdmin', animated: true },
  { id: 'e3', source: 'checkAdmin', target: 'error', label: 'No', type: 'smoothstep' },
  { id: 'e4', source: 'checkAdmin', target: 'createDel', label: 'Yes', animated: true },
  { id: 'e5', source: 'createDel', target: 'selectUser', animated: true },
  { id: 'e6', source: 'createDel', target: 'selectDelegate', animated: true },
  { id: 'e7', source: 'createDel', target: 'configDel', animated: true },
  { id: 'e8', source: 'selectUser', target: 'saveDel', animated: true },
  { id: 'e9', source: 'selectDelegate', target: 'saveDel', animated: true },
  { id: 'e10', source: 'configDel', target: 'saveDel', animated: true },
  { id: 'e11', source: 'saveDel', target: 'notifyDel', animated: true },
  { id: 'e12', source: 'notifyDel', target: 'active', animated: true },
  { id: 'e13', source: 'request', target: 'checkAuth', animated: true },
  { id: 'e14', source: 'checkAuth', target: 'checkDel', animated: true },
  { id: 'e15', source: 'checkDel', target: 'authorized', label: 'Yes', animated: true },
  { id: 'e16', source: 'checkDel', target: 'notAuthorized', label: 'No', type: 'smoothstep' },
  { id: 'e17', source: 'authorized', target: 'approve', animated: true },
  { id: 'e18', source: 'approve', target: 'sign', animated: true },
  { id: 'e19', source: 'sign', target: 'audit', animated: true },
  { id: 'e20', source: 'audit', target: 'end', animated: true },
  { id: 'e21', source: 'error', target: 'end', type: 'smoothstep' },
  { id: 'e22', source: 'notAuthorized', target: 'end', type: 'smoothstep' },
];

export default function AdminDelegationFlow() {
  console.log('[AdminDelegationFlow] Component rendering');
  console.log('[AdminDelegationFlow] initialNodes count:', initialNodes.length);
  console.log('[AdminDelegationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[AdminDelegationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[AdminDelegationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[AdminDelegationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[AdminDelegationFlow] Component mounted');
    console.log('[AdminDelegationFlow] Nodes state:', nodes.length);
    console.log('[AdminDelegationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[AdminDelegationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[AdminDelegationFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[AdminDelegationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[AdminDelegationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[AdminDelegationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[AdminDelegationFlow] onEdgesChange:', changes);
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
