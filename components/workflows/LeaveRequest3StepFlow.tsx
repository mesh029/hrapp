'use client';

/**
 * Leave Request 3-Step Approval Flow
 * 
 * NOTE: This diagram shows an EXAMPLE workflow with 3 configurable approval steps.
 * The roles shown (Approver 1, Approver 2, Approver 3) are CONFIGURABLE - they can be:
 * - Any role you create (Manager, Supervisor, Finance Officer, CEO, etc.)
 * - Any permission-based approver
 * - Reordered, added, or removed at runtime
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
  MarkerType,
  ReactFlowInstance,
} from 'reactflow';

const nodeTypes = {};

const initialNodes: Node[] = [
  // Start
  {
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'Employee Creates Leave Request' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  // Draft
  {
    id: 'draft',
    position: { x: 400, y: 180 },
    data: { label: 'Draft Status' },
    style: { background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', width: 150, height: 60 },
  },
  // Submit Decision
  {
    id: 'submit',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'Employee Submits?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  // Step 1: First Approver (Configurable - Example: Manager)
  {
    id: 'step1',
    position: { x: 200, y: 420 },
    data: { label: 'Step 1: Approver 1\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  // Check Permission 1
  {
    id: 'check1',
    type: 'default',
    position: { x: 200, y: 530 },
    data: { label: 'Approver 1 Has\nPermission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  // Approver 1 Action
  {
    id: 'approve1',
    type: 'default',
    position: { x: 200, y: 660 },
    data: { label: 'Approver 1 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  // Sign 1
  {
    id: 'sign1',
    position: { x: 50, y: 790 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  // Step 2: Second Approver (Configurable - Example: Program Officer)
  {
    id: 'step2',
    position: { x: 400, y: 920 },
    data: { label: 'Step 2: Approver 2\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  // Check Permission 2
  {
    id: 'check2',
    type: 'default',
    position: { x: 400, y: 1030 },
    data: { label: 'Approver 2 Has\nPermission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  // Approver 2 Action
  {
    id: 'approve2',
    type: 'default',
    position: { x: 400, y: 1160 },
    data: { label: 'Approver 2 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  // Sign 2
  {
    id: 'sign2',
    position: { x: 250, y: 1290 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  // Step 3: Third Approver (Configurable - Example: HR Manager)
  {
    id: 'step3',
    position: { x: 600, y: 1410 },
    data: { label: 'Step 3: Approver 3\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  // Check Permission 3
  {
    id: 'check3',
    type: 'default',
    position: { x: 600, y: 1520 },
    data: { label: 'Approver 3 Has\nPermission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  // Approver 3 Action
  {
    id: 'approve3',
    type: 'default',
    position: { x: 600, y: 1650 },
    data: { label: 'Approver 3 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  // Sign 3
  {
    id: 'sign3',
    position: { x: 450, y: 1780 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 80 },
  },
  // Approved
  {
    id: 'approved',
    position: { x: 400, y: 1910 },
    data: { label: 'Leave Request Approved' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  // Update Balance
  {
    id: 'updateBalance',
    position: { x: 400, y: 2020 },
    data: { label: 'Update Leave Balance' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  // Add to Timesheet
  {
    id: 'addToTimesheet',
    position: { x: 400, y: 2130 },
    data: { label: 'Auto-Add to Timesheet' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  // Notify
  {
    id: 'notify',
    position: { x: 400, y: 2240 },
    data: { label: 'Send Notifications' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  // End
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 2350 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  // Error/Decline nodes
  {
    id: 'error1',
    position: { x: 50, y: 530 },
    data: { label: '403 Forbidden' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 120, height: 60 },
  },
  {
    id: 'decline1',
    position: { x: 50, y: 660 },
    data: { label: 'Declined - Workflow Terminated' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'adjust1',
    position: { x: 50, y: 790 },
    data: { label: 'Return to Employee - Draft' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'route2',
    type: 'default',
    position: { x: 250, y: 1160 },
    data: { label: 'Choose Routing' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'route3',
    type: 'default',
    position: { x: 450, y: 1650 },
    data: { label: 'Choose Routing' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
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
  { id: 'e11', source: 'sign1', target: 'step2', animated: true },
  { id: 'e12', source: 'step2', target: 'check2', animated: true },
  { id: 'e13', source: 'check2', target: 'approve2', label: 'Yes', animated: true },
  { id: 'e14', source: 'approve2', target: 'sign2', label: 'Approve', animated: true },
  { id: 'e15', source: 'approve2', target: 'route2', label: 'Decline/Adjust', type: 'smoothstep' },
  { id: 'e16', source: 'route2', target: 'adjust1', label: 'Employee', type: 'smoothstep' },
  { id: 'e17', source: 'route2', target: 'step1', label: 'Step 1', type: 'smoothstep' },
  { id: 'e18', source: 'sign2', target: 'step3', animated: true },
  { id: 'e19', source: 'step3', target: 'check3', animated: true },
  { id: 'e20', source: 'check3', target: 'approve3', label: 'Yes', animated: true },
  { id: 'e21', source: 'approve3', target: 'sign3', label: 'Approve', animated: true },
  { id: 'e22', source: 'approve3', target: 'route3', label: 'Decline/Adjust', type: 'smoothstep' },
  { id: 'e23', source: 'route3', target: 'adjust1', label: 'Employee', type: 'smoothstep' },
  { id: 'e24', source: 'route3', target: 'step1', label: 'Step 1', type: 'smoothstep' },
  { id: 'e25', source: 'route3', target: 'step2', label: 'Step 2', type: 'smoothstep' },
  { id: 'e26', source: 'sign3', target: 'approved', animated: true },
  { id: 'e27', source: 'approved', target: 'updateBalance', animated: true },
  { id: 'e28', source: 'updateBalance', target: 'addToTimesheet', animated: true },
  { id: 'e29', source: 'addToTimesheet', target: 'notify', animated: true },
  { id: 'e30', source: 'notify', target: 'end', animated: true },
  { id: 'e31', source: 'adjust1', target: 'draft', type: 'smoothstep' },
];

export default function LeaveRequest3StepFlow() {
  console.log('[LeaveRequest3StepFlow] Component rendering');
  console.log('[LeaveRequest3StepFlow] initialNodes count:', initialNodes.length);
  console.log('[LeaveRequest3StepFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    console.log('[LeaveRequest3StepFlow] Component mounted');
    console.log('[LeaveRequest3StepFlow] Nodes state:', nodes.length);
    console.log('[LeaveRequest3StepFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[LeaveRequest3StepFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[LeaveRequest3StepFlow] Edges updated:', edges.length);
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[LeaveRequest3StepFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[LeaveRequest3StepFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    // Fit view after a short delay to ensure DOM is ready
    setTimeout(() => {
      console.log('[LeaveRequest3StepFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);

  useEffect(() => {
    // Ensure fitView is called when component mounts
    if (reactFlowInstance.current) {
      console.log('[LeaveRequest3StepFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    } else {
      console.log('[LeaveRequest3StepFlow] useEffect: reactFlowInstance is null');
    }
  }, []);

  console.log('[LeaveRequest3StepFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[LeaveRequest3StepFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[LeaveRequest3StepFlow] onEdgesChange:', changes);
          onEdgesChange(changes);
        }}
        onConnect={onConnect}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
          <Background 
            color="#cbd5e1" 
            gap={24} 
            size={1}
          />
          <Controls 
            showInteractive={true}
            showFitView={true}
            showZoom={true}
            className="bg-white border-2 border-slate-200 rounded-xl shadow-lg"
          />
          <MiniMap 
            nodeColor={(node) => {
              const bg = String(node.style?.background || '');
              if (node.type === 'input' || node.type === 'output') return '#667eea';
              if (bg.includes('green') || bg.includes('#d4edda')) return '#10b981';
              if (bg.includes('red') || bg.includes('#f8d7da')) return '#ef4444';
              if (bg.includes('yellow') || bg.includes('#fff3cd') || bg.includes('#fef3c7')) return '#f59e0b';
              if (bg.includes('blue') || bg.includes('#dbeafe')) return '#3b82f6';
              if (bg.includes('purple') || bg.includes('#667eea')) return '#8b5cf6';
              return '#6b7280';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            pannable
            zoomable
            className="h-[150px] bg-white border-2 border-slate-200 rounded-xl shadow-lg"
          />
        </ReactFlow>
      </div>
  );
}
