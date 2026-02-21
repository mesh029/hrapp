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
    data: { label: 'Admin Creates\nEmployee Type' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'check-permission',
    position: { x: 400, y: 180 },
    data: { label: 'Check Permission\n(employee_types.create)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 310 },
    data: { label: 'Validate Employee Type\n(Code, Name, Required Fields)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'check-unique',
    position: { x: 200, y: 440 },
    data: { label: 'Check Code\nUniqueness' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'create-type',
    position: { x: 400, y: 570 },
    data: { label: 'Create Employee Type\nin Database' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'configure-hours',
    position: { x: 200, y: 700 },
    data: { label: 'Configure Work Hours\n(Optional but Recommended)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'create-workflow',
    position: { x: 400, y: 700 },
    data: { label: 'Create Workflow Templates\n(Optional)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'assign-users',
    position: { x: 600, y: 700 },
    data: { label: 'Assign Users\n(Individual or Bulk)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'activate',
    position: { x: 400, y: 830 },
    data: { label: 'Employee Type\nActive & Ready' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'error',
    position: { x: 200, y: 570 },
    data: { label: 'Error:\nCode Already Exists' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 960 },
    data: { label: 'Employee Type\nCreated Successfully' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'check-permission', animated: true },
  { id: 'e2', source: 'check-permission', target: 'validate', animated: true },
  { id: 'e3', source: 'validate', target: 'check-unique', animated: true },
  { id: 'e4', source: 'check-unique', target: 'create-type', label: 'Unique', animated: true },
  { id: 'e5', source: 'check-unique', target: 'error', label: 'Exists', type: 'smoothstep' },
  { id: 'e6', source: 'error', target: 'end', type: 'smoothstep' },
  { id: 'e7', source: 'create-type', target: 'configure-hours', animated: true },
  { id: 'e8', source: 'create-type', target: 'create-workflow', animated: true },
  { id: 'e9', source: 'create-type', target: 'assign-users', animated: true },
  { id: 'e10', source: 'configure-hours', target: 'activate', animated: true },
  { id: 'e11', source: 'create-workflow', target: 'activate', animated: true },
  { id: 'e12', source: 'assign-users', target: 'activate', animated: true },
  { id: 'e13', source: 'activate', target: 'end', animated: true },
];

export default function EmployeeTypeCreationFlow() {
  console.log('[EmployeeTypeCreationFlow] Component rendering');
  console.log('[EmployeeTypeCreationFlow] initialNodes count:', initialNodes.length);
  console.log('[EmployeeTypeCreationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    console.log('[EmployeeTypeCreationFlow] Component mounted');
    console.log('[EmployeeTypeCreationFlow] Nodes state:', nodes.length);
    console.log('[EmployeeTypeCreationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[EmployeeTypeCreationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[EmployeeTypeCreationFlow] Edges updated:', edges.length);
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[EmployeeTypeCreationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[EmployeeTypeCreationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[EmployeeTypeCreationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[EmployeeTypeCreationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    } else {
      console.log('[EmployeeTypeCreationFlow] useEffect: reactFlowInstance is null');
    }
  }, []);

  console.log('[EmployeeTypeCreationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[EmployeeTypeCreationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[EmployeeTypeCreationFlow] onEdgesChange:', changes);
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
