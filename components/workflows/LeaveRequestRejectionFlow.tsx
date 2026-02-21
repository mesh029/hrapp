'use client';

/**
 * Leave Request Rejection Flow with Routing Options
 * 
 * NOTE: This diagram shows an EXAMPLE rejection flow with configurable routing.
 * The approver roles and routing options are CONFIGURABLE:
 * - Any approver at any step can reject
 * - Can route back to any step or to employee
 * - Steps can be reordered, added, or removed
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
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'Leave Request in Step 2' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'current',
    position: { x: 400, y: 180 },
    data: { label: 'Step 2: Program Officer' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'reject',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'Program Officer Rejects' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'routingChoice',
    type: 'default',
    position: { x: 400, y: 420 },
    data: { label: 'Choose Routing Destination' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 220, height: 80 },
  },
  {
    id: 'employee',
    position: { x: 150, y: 550 },
    data: { label: 'Route to Employee - Draft' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'step1',
    position: { x: 400, y: 550 },
    data: { label: 'Route to Step 1\n(Configurable)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'terminate',
    position: { x: 650, y: 550 },
    data: { label: 'Final Rejection - Terminate' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'draftStatus',
    position: { x: 150, y: 660 },
    data: { label: 'Draft - Editable' },
    style: { background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'modify',
    type: 'default',
    position: { x: 150, y: 770 },
    data: { label: 'Employee Modifies?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'resubmit',
    position: { x: 150, y: 900 },
    data: { label: 'Resubmit Request' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'reReview',
    position: { x: 400, y: 660 },
    data: { label: 'Step 1 Needs Re-Review' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'managerAction',
    type: 'default',
    position: { x: 400, y: 770 },
    data: { label: 'Approver 1 Action\n(Configurable)' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'continue',
    position: { x: 300, y: 900 },
    data: { label: 'Continue to Step 2' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 650, y: 660 },
    data: { label: 'Workflow Terminated' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'current', animated: true },
  { id: 'e2', source: 'current', target: 'reject', animated: true },
  { id: 'e3', source: 'reject', target: 'routingChoice', label: 'Yes', animated: true },
  { id: 'e4', source: 'routingChoice', target: 'employee', label: 'Option 1', animated: true },
  { id: 'e5', source: 'routingChoice', target: 'step1', label: 'Option 2', animated: true },
  { id: 'e6', source: 'routingChoice', target: 'terminate', label: 'Option 3', animated: true },
  { id: 'e7', source: 'employee', target: 'draftStatus', animated: true },
  { id: 'e8', source: 'draftStatus', target: 'modify', animated: true },
  { id: 'e9', source: 'modify', target: 'resubmit', label: 'Yes', animated: true },
  { id: 'e10', source: 'resubmit', target: 'step1', type: 'smoothstep' },
  { id: 'e11', source: 'step1', target: 'reReview', animated: true },
  { id: 'e12', source: 'reReview', target: 'managerAction', animated: true },
  { id: 'e13', source: 'managerAction', target: 'continue', label: 'Approve', animated: true },
  { id: 'e14', source: 'managerAction', target: 'terminate', label: 'Reject', type: 'smoothstep' },
  { id: 'e15', source: 'continue', target: 'current', type: 'smoothstep' },
  { id: 'e16', source: 'terminate', target: 'end', animated: true },
];

export default function LeaveRequestRejectionFlow() {
  console.log('[LeaveRequestRejectionFlow] Component rendering');
  console.log('[LeaveRequestRejectionFlow] initialNodes count:', initialNodes.length);
  console.log('[LeaveRequestRejectionFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[LeaveRequestRejectionFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[LeaveRequestRejectionFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[LeaveRequestRejectionFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[LeaveRequestRejectionFlow] Component mounted');
    console.log('[LeaveRequestRejectionFlow] Nodes state:', nodes.length);
    console.log('[LeaveRequestRejectionFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[LeaveRequestRejectionFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[LeaveRequestRejectionFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[LeaveRequestRejectionFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[LeaveRequestRejectionFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[LeaveRequestRejectionFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[LeaveRequestRejectionFlow] onEdgesChange:', changes);
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
