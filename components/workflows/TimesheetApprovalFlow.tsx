'use client';

/**
 * Timesheet Approval Flow
 * 
 * NOTE: This diagram shows an EXAMPLE workflow with 3 configurable approval steps.
 * The roles shown (Approver 1, Approver 2, Approver 3) are CONFIGURABLE - they can be:
 * - Any role you create (Supervisor, Manager, Finance Officer, HR Manager, CEO, etc.)
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
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

const nodeTypes = {};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    position: { x: 400, y: 50 },
    data: { label: 'Employee Creates Timesheet' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'draft',
    position: { x: 400, y: 180 },
    data: { label: 'Draft Status' },
    style: { background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'checkLeaves',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'Approved Leaves Exist?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'autoAdd',
    position: { x: 200, y: 420 },
    data: { label: 'Auto-Add Leave Entries' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'manualEntry',
    position: { x: 400, y: 420 },
    data: { label: 'Manual Entry' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'calculate',
    position: { x: 400, y: 530 },
    data: { label: 'Calculate Total Hours' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'submit',
    type: 'default',
    position: { x: 400, y: 640 },
    data: { label: 'Employee Submits?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'step1',
    position: { x: 400, y: 770 },
    data: { label: 'Step 1: Approver 1\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'check1',
    type: 'default',
    position: { x: 400, y: 880 },
    data: { label: 'Approver 1 Has\nPermission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'verify1',
    type: 'default',
    position: { x: 400, y: 1010 },
    data: { label: 'Verify Hours Match?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'approve1',
    type: 'default',
    position: { x: 400, y: 1140 },
    data: { label: 'Approver 1 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'sign1',
    position: { x: 400, y: 1270 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 220, height: 80 },
  },
  {
    id: 'step2',
    position: { x: 400, y: 1380 },
    data: { label: 'Step 2: Approver 2\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'approve2',
    type: 'default',
    position: { x: 400, y: 1490 },
    data: { label: 'Approver 2 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'sign2',
    position: { x: 400, y: 1620 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 220, height: 80 },
  },
  {
    id: 'step3',
    position: { x: 400, y: 1730 },
    data: { label: 'Step 3: Approver 3\n(Configurable Role)' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'approve3',
    type: 'default',
    position: { x: 400, y: 1840 },
    data: { label: 'Approver 3 Action' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'sign3',
    position: { x: 400, y: 1970 },
    data: { label: 'Generate Digital Signature + Timestamp' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 220, height: 80 },
  },
  {
    id: 'approved',
    position: { x: 400, y: 2080 },
    data: { label: 'Timesheet Approved' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'lock',
    position: { x: 400, y: 2190 },
    data: { label: 'Lock Timesheet' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'generatePDF',
    position: { x: 400, y: 2300 },
    data: { label: 'Generate PDF with Signatures' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'payroll',
    position: { x: 400, y: 2410 },
    data: { label: 'Ready for Payroll' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'notify',
    position: { x: 400, y: 2520 },
    data: { label: 'Send Notifications' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 2630 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'draft', animated: true },
  { id: 'e2', source: 'draft', target: 'checkLeaves', animated: true },
  { id: 'e3', source: 'checkLeaves', target: 'autoAdd', label: 'Yes', animated: true },
  { id: 'e4', source: 'checkLeaves', target: 'manualEntry', label: 'No', type: 'smoothstep' },
  { id: 'e5', source: 'autoAdd', target: 'manualEntry', animated: true },
  { id: 'e6', source: 'manualEntry', target: 'calculate', animated: true },
  { id: 'e7', source: 'calculate', target: 'submit', animated: true },
  { id: 'e8', source: 'submit', target: 'step1', label: 'Yes', animated: true },
  { id: 'e9', source: 'submit', target: 'draft', label: 'No', type: 'smoothstep' },
  { id: 'e10', source: 'step1', target: 'check1', animated: true },
  { id: 'e11', source: 'check1', target: 'verify1', label: 'Yes', animated: true },
  { id: 'e12', source: 'verify1', target: 'approve1', label: 'Yes', animated: true },
  { id: 'e13', source: 'approve1', target: 'sign1', label: 'Approve', animated: true },
  { id: 'e14', source: 'sign1', target: 'step2', animated: true },
  { id: 'e15', source: 'step2', target: 'approve2', animated: true },
  { id: 'e16', source: 'approve2', target: 'sign2', label: 'Approve', animated: true },
  { id: 'e17', source: 'sign2', target: 'step3', animated: true },
  { id: 'e18', source: 'step3', target: 'approve3', animated: true },
  { id: 'e19', source: 'approve3', target: 'sign3', label: 'Approve', animated: true },
  { id: 'e20', source: 'sign3', target: 'approved', animated: true },
  { id: 'e21', source: 'approved', target: 'lock', animated: true },
  { id: 'e22', source: 'lock', target: 'generatePDF', animated: true },
  { id: 'e23', source: 'generatePDF', target: 'payroll', animated: true },
  { id: 'e24', source: 'payroll', target: 'notify', animated: true },
  { id: 'e25', source: 'notify', target: 'end', animated: true },
];

export default function TimesheetApprovalFlow() {
  console.log('[TimesheetApprovalFlow] Component rendering');
  console.log('[TimesheetApprovalFlow] initialNodes count:', initialNodes.length);
  console.log('[TimesheetApprovalFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[TimesheetApprovalFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  
  console.log('[TimesheetApprovalFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[TimesheetApprovalFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[TimesheetApprovalFlow] onEdgesChange:', changes);
          onEdgesChange(changes);
        }}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-left"
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
