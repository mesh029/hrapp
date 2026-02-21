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
    data: { label: 'Approval Request' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'checkUser',
    type: 'default',
    position: { x: 400, y: 180 },
    data: { label: 'User Active?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'deny1',
    position: { x: 200, y: 180 },
    data: { label: 'Deny - User Inactive' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'getRoles',
    position: { x: 400, y: 310 },
    data: { label: 'Get User Roles' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'getPerms',
    position: { x: 400, y: 420 },
    data: { label: 'Get Role Permissions' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'hasPerm',
    type: 'default',
    position: { x: 400, y: 530 },
    data: { label: 'Permission Exists?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'deny2',
    position: { x: 200, y: 530 },
    data: { label: 'Deny - No Permission' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'getScopes',
    position: { x: 400, y: 660 },
    data: { label: 'Get User Scopes' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'checkScope',
    type: 'default',
    position: { x: 400, y: 770 },
    data: { label: 'Scope Match?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'checkDel',
    type: 'default',
    position: { x: 400, y: 880 },
    data: { label: 'Check Delegations' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'activeDel',
    type: 'default',
    position: { x: 200, y: 1010 },
    data: { label: 'Active Delegation?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'validDel',
    type: 'default',
    position: { x: 200, y: 1140 },
    data: { label: 'Valid Time & Scope?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'authorizedDel',
    position: { x: 50, y: 1270 },
    data: { label: 'Authorized via Delegation' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'checkWorkflow',
    type: 'default',
    position: { x: 400, y: 1010 },
    data: { label: 'Workflow Step Eligible?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'deny3',
    position: { x: 600, y: 1010 },
    data: { label: 'Deny - Wrong Step' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'finalAuth',
    type: 'default',
    position: { x: 400, y: 1140 },
    data: { label: 'All Checks Pass?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'authorized',
    position: { x: 200, y: 1270 },
    data: { label: 'Authorized - Proceed' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'deny4',
    position: { x: 600, y: 1270 },
    data: { label: 'Deny - Authority Check Failed' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1380 },
    data: { label: 'Approval Allowed' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'checkUser', animated: true },
  { id: 'e2', source: 'checkUser', target: 'deny1', label: 'No', type: 'smoothstep' },
  { id: 'e3', source: 'checkUser', target: 'getRoles', label: 'Yes', animated: true },
  { id: 'e4', source: 'getRoles', target: 'getPerms', animated: true },
  { id: 'e5', source: 'getPerms', target: 'hasPerm', animated: true },
  { id: 'e6', source: 'hasPerm', target: 'deny2', label: 'No', type: 'smoothstep' },
  { id: 'e7', source: 'hasPerm', target: 'getScopes', label: 'Yes', animated: true },
  { id: 'e8', source: 'getScopes', target: 'checkScope', animated: true },
  { id: 'e9', source: 'checkScope', target: 'checkDel', animated: true },
  { id: 'e10', source: 'checkDel', target: 'activeDel', animated: true },
  { id: 'e11', source: 'activeDel', target: 'validDel', label: 'Yes', animated: true },
  { id: 'e12', source: 'activeDel', target: 'checkWorkflow', label: 'No', type: 'smoothstep' },
  { id: 'e13', source: 'validDel', target: 'authorizedDel', label: 'Yes', animated: true },
  { id: 'e14', source: 'validDel', target: 'checkWorkflow', label: 'No', type: 'smoothstep' },
  { id: 'e15', source: 'checkWorkflow', target: 'deny3', label: 'No', type: 'smoothstep' },
  { id: 'e16', source: 'checkWorkflow', target: 'finalAuth', label: 'Yes', animated: true },
  { id: 'e17', source: 'finalAuth', target: 'authorized', label: 'Yes', animated: true },
  { id: 'e18', source: 'finalAuth', target: 'deny4', label: 'No', type: 'smoothstep' },
  { id: 'e19', source: 'authorized', target: 'end', animated: true },
  { id: 'e20', source: 'authorizedDel', target: 'end', animated: true },
  { id: 'e21', source: 'deny1', target: 'end', type: 'smoothstep' },
  { id: 'e22', source: 'deny2', target: 'end', type: 'smoothstep' },
  { id: 'e23', source: 'deny3', target: 'end', type: 'smoothstep' },
  { id: 'e24', source: 'deny4', target: 'end', type: 'smoothstep' },
];

export default function AuthorityResolutionFlow() {
  console.log('[AuthorityResolutionFlow] Component rendering');
  console.log('[AuthorityResolutionFlow] initialNodes count:', initialNodes.length);
  console.log('[AuthorityResolutionFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[AuthorityResolutionFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[AuthorityResolutionFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[AuthorityResolutionFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[AuthorityResolutionFlow] Component mounted');
    console.log('[AuthorityResolutionFlow] Nodes state:', nodes.length);
    console.log('[AuthorityResolutionFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[AuthorityResolutionFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[AuthorityResolutionFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[AuthorityResolutionFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[AuthorityResolutionFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[AuthorityResolutionFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[AuthorityResolutionFlow] onEdgesChange:', changes);
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
