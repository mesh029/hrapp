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
    data: { label: 'Create Location Request\n(Admin)' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'check-permission',
    position: { x: 400, y: 180 },
    data: { label: 'Check Permission\n(locations.create)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 310 },
    data: { label: 'Validate Location Data\n(Name, Code, Parent)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'check-parent',
    position: { x: 200, y: 440 },
    data: { label: 'Parent Location\nExists?' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'check-duplicate',
    position: { x: 400, y: 440 },
    data: { label: 'Location Name\nDuplicate?' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'create-location',
    position: { x: 400, y: 570 },
    data: { label: 'Create Location\nin Database' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'update-tree',
    position: { x: 400, y: 700 },
    data: { label: 'Update Location Tree\n(Recalculate Paths)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'update-cache',
    position: { x: 400, y: 830 },
    data: { label: 'Update Redis Cache\n(Location Tree)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 700 },
    data: { label: '400 Bad Request\nInvalid Parent/Duplicate' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'return-location',
    position: { x: 400, y: 960 },
    data: { label: 'Return Created Location\n(with Hierarchy)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1090 },
    data: { label: 'Location Created' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'check-permission', animated: true },
  { id: 'e2', source: 'check-permission', target: 'validate', animated: true },
  { id: 'e3', source: 'validate', target: 'check-parent', animated: true },
  { id: 'e4', source: 'check-parent', target: 'check-duplicate', animated: true },
  { id: 'e5', source: 'check-duplicate', target: 'error', label: 'Yes', animated: true },
  { id: 'e6', source: 'check-duplicate', target: 'create-location', label: 'No', animated: true },
  { id: 'e7', source: 'create-location', target: 'update-tree', animated: true },
  { id: 'e8', source: 'update-tree', target: 'update-cache', animated: true },
  { id: 'e9', source: 'update-cache', target: 'return-location', animated: true },
  { id: 'e10', source: 'return-location', target: 'end', animated: true },
];

export default function LocationManagementFlow() {
  console.log('[LocationManagementFlow] Component rendering');
  console.log('[LocationManagementFlow] initialNodes count:', initialNodes.length);
  console.log('[LocationManagementFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[LocationManagementFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[LocationManagementFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[LocationManagementFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[LocationManagementFlow] Component mounted');
    console.log('[LocationManagementFlow] Nodes state:', nodes.length);
    console.log('[LocationManagementFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[LocationManagementFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[LocationManagementFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[LocationManagementFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[LocationManagementFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[LocationManagementFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[LocationManagementFlow] onEdgesChange:', changes);
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
