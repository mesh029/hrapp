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
    data: { label: 'Create Role Request\n(Admin)' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'check-permission',
    position: { x: 400, y: 180 },
    data: { label: 'Check Permission\n(roles.create)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 310 },
    data: { label: 'Validate Role Data\n(Name, Description)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'check-duplicate',
    position: { x: 200, y: 440 },
    data: { label: 'Check Duplicate\nRole Name?' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'create-role',
    position: { x: 400, y: 440 },
    data: { label: 'Create Role\nin Database' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'assign-permissions',
    position: { x: 400, y: 570 },
    data: { label: 'Assign Permissions\n(Optional at creation)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 570 },
    data: { label: '400 Bad Request\nDuplicate/Invalid' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'update-cache',
    position: { x: 400, y: 700 },
    data: { label: 'Update Redis Cache\n(Role List)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'return-role',
    position: { x: 400, y: 830 },
    data: { label: 'Return Created Role\n(with Permissions)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 960 },
    data: { label: 'Role Created' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 180, height: 80 },
  },
  {
    id: 'permission-flow',
    position: { x: 650, y: 570 },
    data: { label: 'Permission Assignment\nFlow' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'list-perms',
    position: { x: 650, y: 700 },
    data: { label: 'List Available\nPermissions' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 70 },
  },
  {
    id: 'assign',
    position: { x: 650, y: 830 },
    data: { label: 'POST /api/roles/:id/permissions\nAssign to Role' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'check-permission', animated: true },
  { id: 'e2', source: 'check-permission', target: 'validate', animated: true },
  { id: 'e3', source: 'validate', target: 'check-duplicate', animated: true },
  { id: 'e4', source: 'check-duplicate', target: 'error', label: 'Exists', animated: true },
  { id: 'e5', source: 'check-duplicate', target: 'create-role', label: 'Unique', animated: true },
  { id: 'e6', source: 'create-role', target: 'assign-permissions', animated: true },
  { id: 'e7', source: 'assign-permissions', target: 'update-cache', animated: true },
  { id: 'e8', source: 'update-cache', target: 'return-role', animated: true },
  { id: 'e9', source: 'return-role', target: 'end', animated: true },
  { id: 'e10', source: 'assign-permissions', target: 'permission-flow', label: 'Optional', animated: true },
  { id: 'e11', source: 'permission-flow', target: 'list-perms', animated: true },
  { id: 'e12', source: 'list-perms', target: 'assign', animated: true },
];

export default function RoleCreationFlow() {
  console.log('[RoleCreationFlow] Component rendering');
  console.log('[RoleCreationFlow] initialNodes count:', initialNodes.length);
  console.log('[RoleCreationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[RoleCreationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[RoleCreationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[RoleCreationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[RoleCreationFlow] Component mounted');
    console.log('[RoleCreationFlow] Nodes state:', nodes.length);
    console.log('[RoleCreationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[RoleCreationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[RoleCreationFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[RoleCreationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[RoleCreationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[RoleCreationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[RoleCreationFlow] onEdgesChange:', changes);
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
