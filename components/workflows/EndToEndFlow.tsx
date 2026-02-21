'use client';

/**
 * End-to-End Leave & Timesheet Flow
 * 
 * NOTE: This diagram shows an EXAMPLE end-to-end workflow.
 * The approval steps are CONFIGURABLE - they can be:
 * - Any roles you create in any order
 * - Any number of steps (1, 2, 3, 5, 10+)
 * - Different per location or employee type
 * 
 * This is NOT hardcoded - all workflows are database-driven and fully configurable.
 */

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
    id: 'a',
    type: 'input',
    position: { x: 100, y: 50 },
    data: { label: 'Employee Creates Leave Request' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'b',
    position: { x: 100, y: 180 },
    data: { label: 'Submit for Approval' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'c',
    position: { x: 100, y: 290 },
    data: { label: 'Workflow: Configurable Steps\n(Example: Approver 1 → 2 → 3)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 300, height: 60 },
  },
  {
    id: 'd',
    position: { x: 100, y: 400 },
    data: { label: 'All Approvals with Signatures' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'e',
    position: { x: 100, y: 510 },
    data: { label: 'Leave Approved' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'f',
    position: { x: 100, y: 620 },
    data: { label: 'Update Leave Balance' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'g',
    position: { x: 100, y: 730 },
    data: { label: 'Auto-Add to Timesheet' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'h',
    position: { x: 100, y: 840 },
    data: { label: 'Employee Completes Timesheet' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'i',
    position: { x: 100, y: 950 },
    data: { label: 'Submit Timesheet for Approval' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'j',
    position: { x: 100, y: 1060 },
    data: { label: 'Workflow: Supervisor → Manager → HR Manager' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 300, height: 60 },
  },
  {
    id: 'k',
    position: { x: 100, y: 1170 },
    data: { label: 'All Approvals with Signatures' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'l',
    position: { x: 100, y: 1280 },
    data: { label: 'Timesheet Approved & Locked' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'm',
    position: { x: 100, y: 1390 },
    data: { label: 'Generate PDF with Signatures' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'n',
    position: { x: 100, y: 1500 },
    data: { label: 'Ready for Payroll' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'o',
    type: 'output',
    position: { x: 100, y: 1610 },
    data: { label: 'Payroll Processing' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'a', target: 'b', animated: true },
  { id: 'e2', source: 'b', target: 'c', animated: true },
  { id: 'e3', source: 'c', target: 'd', animated: true },
  { id: 'e4', source: 'd', target: 'e', animated: true },
  { id: 'e5', source: 'e', target: 'f', animated: true },
  { id: 'e6', source: 'f', target: 'g', animated: true },
  { id: 'e7', source: 'g', target: 'h', animated: true },
  { id: 'e8', source: 'h', target: 'i', animated: true },
  { id: 'e9', source: 'i', target: 'j', animated: true },
  { id: 'e10', source: 'j', target: 'k', animated: true },
  { id: 'e11', source: 'k', target: 'l', animated: true },
  { id: 'e12', source: 'l', target: 'm', animated: true },
  { id: 'e13', source: 'm', target: 'n', animated: true },
  { id: 'e14', source: 'n', target: 'o', animated: true },
];

export default function EndToEndFlow() {
  console.log('[EndToEndFlow] Component rendering');
  console.log('[EndToEndFlow] initialNodes count:', initialNodes.length);
  console.log('[EndToEndFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[EndToEndFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[EndToEndFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[EndToEndFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[EndToEndFlow] Component mounted');
    console.log('[EndToEndFlow] Nodes state:', nodes.length);
    console.log('[EndToEndFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[EndToEndFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[EndToEndFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[EndToEndFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[EndToEndFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[EndToEndFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[EndToEndFlow] onEdgesChange:', changes);
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
