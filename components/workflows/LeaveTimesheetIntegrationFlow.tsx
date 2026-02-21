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
    data: { label: 'Leave Request Approved' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'trigger',
    position: { x: 400, y: 180 },
    data: { label: 'Integration Event Triggered' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'checkTS',
    type: 'default',
    position: { x: 400, y: 290 },
    data: { label: 'Timesheet Exists?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'getTS',
    position: { x: 200, y: 420 },
    data: { label: 'Get Existing Timesheet' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'createTS',
    position: { x: 600, y: 420 },
    data: { label: 'Create New Timesheet' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'getWorkHours',
    position: { x: 400, y: 530 },
    data: { label: 'Get Work Hours Config' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'calcHours',
    position: { x: 400, y: 640 },
    data: { label: 'Calculate Hours per Day' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'loopDays',
    type: 'default',
    position: { x: 400, y: 750 },
    data: { label: 'Loop Through Leave Days' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 200, height: 80 },
  },
  {
    id: 'checkDay',
    type: 'default',
    position: { x: 400, y: 880 },
    data: { label: 'Day of Week?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'hours85',
    position: { x: 150, y: 1010 },
    data: { label: '8.5 hours - Regular Staff (Mon-Thu)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'hours6',
    position: { x: 400, y: 1010 },
    data: { label: '6 hours - Regular Staff (Fri)' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'hours0',
    position: { x: 650, y: 1010 },
    data: { label: '0 hours - Weekend' },
    style: { background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'createEntry',
    position: { x: 400, y: 1120 },
    data: { label: 'Create Timesheet Entry' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'setLabel',
    position: { x: 400, y: 1230 },
    data: { label: 'Set Label: Leave Type Name' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'linkLeave',
    position: { x: 400, y: 1340 },
    data: { label: 'Link to Leave Request ID' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'moreDays',
    type: 'default',
    position: { x: 400, y: 1450 },
    data: { label: 'More Days?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'updateTotal',
    position: { x: 400, y: 1560 },
    data: { label: 'Update Total Hours' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'updateStatus',
    type: 'default',
    position: { x: 400, y: 1670 },
    data: { label: 'Timesheet Status?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'keepDraft',
    position: { x: 200, y: 1780 },
    data: { label: 'Keep Draft Status' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'keepStatus',
    position: { x: 600, y: 1780 },
    data: { label: 'Keep Current Status' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'notify',
    position: { x: 400, y: 1890 },
    data: { label: 'Notify Employee' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'audit',
    position: { x: 400, y: 2000 },
    data: { label: 'Log Integration Event' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 2110 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'trigger', animated: true },
  { id: 'e2', source: 'trigger', target: 'checkTS', animated: true },
  { id: 'e3', source: 'checkTS', target: 'getTS', label: 'Yes', animated: true },
  { id: 'e4', source: 'checkTS', target: 'createTS', label: 'No', type: 'smoothstep' },
  { id: 'e5', source: 'getTS', target: 'getWorkHours', animated: true },
  { id: 'e6', source: 'createTS', target: 'getWorkHours', animated: true },
  { id: 'e7', source: 'getWorkHours', target: 'calcHours', animated: true },
  { id: 'e8', source: 'calcHours', target: 'loopDays', animated: true },
  { id: 'e9', source: 'loopDays', target: 'checkDay', animated: true },
  { id: 'e10', source: 'checkDay', target: 'hours85', label: 'Mon-Thu', animated: true },
  { id: 'e11', source: 'checkDay', target: 'hours6', label: 'Fri', animated: true },
  { id: 'e12', source: 'checkDay', target: 'hours0', label: 'Weekend', type: 'smoothstep' },
  { id: 'e13', source: 'hours85', target: 'createEntry', animated: true },
  { id: 'e14', source: 'hours6', target: 'createEntry', animated: true },
  { id: 'e15', source: 'hours0', target: 'createEntry', animated: true },
  { id: 'e16', source: 'createEntry', target: 'setLabel', animated: true },
  { id: 'e17', source: 'setLabel', target: 'linkLeave', animated: true },
  { id: 'e18', source: 'linkLeave', target: 'moreDays', animated: true },
  { id: 'e19', source: 'moreDays', target: 'loopDays', label: 'Yes', type: 'smoothstep' },
  { id: 'e20', source: 'moreDays', target: 'updateTotal', label: 'No', animated: true },
  { id: 'e21', source: 'updateTotal', target: 'updateStatus', animated: true },
  { id: 'e22', source: 'updateStatus', target: 'keepDraft', label: 'Draft', animated: true },
  { id: 'e23', source: 'updateStatus', target: 'keepStatus', label: 'Submitted/Approved', animated: true },
  { id: 'e24', source: 'keepDraft', target: 'notify', animated: true },
  { id: 'e25', source: 'keepStatus', target: 'notify', animated: true },
  { id: 'e26', source: 'notify', target: 'audit', animated: true },
  { id: 'e27', source: 'audit', target: 'end', animated: true },
];

export default function LeaveTimesheetIntegrationFlow() {
  console.log('[LeaveTimesheetIntegrationFlow] Component rendering');
  console.log('[LeaveTimesheetIntegrationFlow] initialNodes count:', initialNodes.length);
  console.log('[LeaveTimesheetIntegrationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[LeaveTimesheetIntegrationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[LeaveTimesheetIntegrationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[LeaveTimesheetIntegrationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[LeaveTimesheetIntegrationFlow] Component mounted');
    console.log('[LeaveTimesheetIntegrationFlow] Nodes state:', nodes.length);
    console.log('[LeaveTimesheetIntegrationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[LeaveTimesheetIntegrationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[LeaveTimesheetIntegrationFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[LeaveTimesheetIntegrationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[LeaveTimesheetIntegrationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[LeaveTimesheetIntegrationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[LeaveTimesheetIntegrationFlow] onEdgesChange:', changes);
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
