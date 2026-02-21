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
    data: { label: 'Create Workflow Template\n(Admin)' },
    style: { background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'check-permission',
    position: { x: 400, y: 180 },
    data: { label: 'Check Permission\n(workflows.create)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'validate',
    position: { x: 400, y: 310 },
    data: { label: 'Validate Template Data\n(Name, Location, Type)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'create-template',
    position: { x: 400, y: 440 },
    data: { label: 'Create Template\nin Database' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'add-step1',
    position: { x: 200, y: 570 },
    data: { label: 'Add Step 1\n(Permission, Order)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'add-step2',
    position: { x: 400, y: 570 },
    data: { label: 'Add Step 2\n(Permission, Order)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'add-step3',
    position: { x: 600, y: 570 },
    data: { label: 'Add Step 3\n(Permission, Order)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'configure-steps',
    position: { x: 400, y: 700 },
    data: { label: 'Configure Step Options\n(Allow Decline, Allow Adjust)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'validate-steps',
    position: { x: 400, y: 830 },
    data: { label: 'Validate Step Order\n(Sequential, No Gaps)' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'update-cache',
    position: { x: 400, y: 960 },
    data: { label: 'Update Redis Cache\n(Workflow Templates)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'return-template',
    position: { x: 400, y: 1090 },
    data: { label: 'Return Created Template\n(with Steps)' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1220 },
    data: { label: 'Template Created' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'check-permission', animated: true },
  { id: 'e2', source: 'check-permission', target: 'validate', animated: true },
  { id: 'e3', source: 'validate', target: 'create-template', animated: true },
  { id: 'e4', source: 'create-template', target: 'add-step1', animated: true },
  { id: 'e5', source: 'add-step1', target: 'add-step2', animated: true },
  { id: 'e6', source: 'add-step2', target: 'add-step3', animated: true },
  { id: 'e7', source: 'add-step3', target: 'configure-steps', animated: true },
  { id: 'e8', source: 'configure-steps', target: 'validate-steps', animated: true },
  { id: 'e9', source: 'validate-steps', target: 'update-cache', animated: true },
  { id: 'e10', source: 'update-cache', target: 'return-template', animated: true },
  { id: 'e11', source: 'return-template', target: 'end', animated: true },
];

export default function WorkflowTemplateFlow() {
  console.log('[WorkflowTemplateFlow] Component rendering');
  console.log('[WorkflowTemplateFlow] initialNodes count:', initialNodes.length);
  console.log('[WorkflowTemplateFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[WorkflowTemplateFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[WorkflowTemplateFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[WorkflowTemplateFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[WorkflowTemplateFlow] Component mounted');
    console.log('[WorkflowTemplateFlow] Nodes state:', nodes.length);
    console.log('[WorkflowTemplateFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[WorkflowTemplateFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[WorkflowTemplateFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[WorkflowTemplateFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[WorkflowTemplateFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[WorkflowTemplateFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[WorkflowTemplateFlow] onEdgesChange:', changes);
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
