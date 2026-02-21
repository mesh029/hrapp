'use client';

/**
 * Leave Request 1-Step Approval Flow
 * 
 * NOTE: This diagram shows an EXAMPLE workflow with 1 configurable approval step.
 * The approver role is CONFIGURABLE - it can be:
 * - Any role you create (Manager, Supervisor, Team Lead, etc.)
 * - Any permission-based approver
 * - Changed at runtime
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
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'Employee Creates Leave Request' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'draft',
    position: { x: 400, y: 180 },
    data: { label: 'Draft Status' },
    style: { background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'submit',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'Employee Submits?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'step1',
    position: { x: 400, y: 420 },
    data: { label: 'Step 1: Approver\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'check1',
    type: 'default',
    position: { x: 400, y: 530 },
    data: { label: 'Approver Has\nPermission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'approve1',
    type: 'default',
    position: { x: 400, y: 660 },
    data: { label: 'Approver Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'sign1',
    position: { x: 400, y: 790 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'approved',
    position: { x: 400, y: 920 },
    data: { label: 'Leave Request Approved' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'updateBalance',
    position: { x: 400, y: 1030 },
    data: { label: 'Update Leave Balance' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'addToTimesheet',
    position: { x: 400, y: 1140 },
    data: { label: 'Auto-Add to Timesheet' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'notify',
    position: { x: 400, y: 1250 },
    data: { label: 'Send Notifications' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1360 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'error1',
    position: { x: 200, y: 530 },
    data: { label: '403 Forbidden' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 120, height: 60 },
  },
  {
    id: 'decline1',
    position: { x: 200, y: 660 },
    data: { label: 'Declined - Workflow Terminated' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'adjust1',
    position: { x: 200, y: 790 },
    data: { label: 'Return to Employee - Draft' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'draft', animated: true },
  { id: 'e2', source: 'draft', target: 'submit', animated: true },
  { id: 'e3', source: 'submit', target: 'step1', label: 'Yes', animated: true },
  { id: 'e4', source: 'submit', target: 'draft', label: 'No', type: 'smoothstep' },
  { id: 'e5', source: 'step1', target: 'check1', animated: true },
  { id: 'e6', source: 'check1', target: 'error1', label: 'No', type: 'smoothstep' },
  { id: 'e7', source: 'check1', target: 'approve1', label: 'Yes', animated: true },
  { id: 'e8', source: 'approve1', target: 'sign1', label: 'Approve', animated: true },
  { id: 'e9', source: 'approve1', target: 'decline1', label: 'Decline', type: 'smoothstep' },
  { id: 'e10', source: 'approve1', target: 'adjust1', label: 'Adjust', type: 'smoothstep' },
  { id: 'e11', source: 'sign1', target: 'approved', animated: true },
  { id: 'e12', source: 'approved', target: 'updateBalance', animated: true },
  { id: 'e13', source: 'updateBalance', target: 'addToTimesheet', animated: true },
  { id: 'e14', source: 'addToTimesheet', target: 'notify', animated: true },
  { id: 'e15', source: 'notify', target: 'end', animated: true },
  { id: 'e16', source: 'adjust1', target: 'draft', type: 'smoothstep' },
];

export default function LeaveRequest1StepFlow() {
  console.log('[LeaveRequest1StepFlow] Component rendering');
  console.log('[LeaveRequest1StepFlow] initialNodes count:', initialNodes.length);
  console.log('[LeaveRequest1StepFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    console.log('[LeaveRequest1StepFlow] Component mounted');
    console.log('[LeaveRequest1StepFlow] Nodes state:', nodes.length);
    console.log('[LeaveRequest1StepFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[LeaveRequest1StepFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[LeaveRequest1StepFlow] Edges updated:', edges.length);
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[LeaveRequest1StepFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[LeaveRequest1StepFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[LeaveRequest1StepFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[LeaveRequest1StepFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    } else {
      console.log('[LeaveRequest1StepFlow] useEffect: reactFlowInstance is null');
    }
  }, []);

  console.log('[LeaveRequest1StepFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[LeaveRequest1StepFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[LeaveRequest1StepFlow] onEdgesChange:', changes);
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
