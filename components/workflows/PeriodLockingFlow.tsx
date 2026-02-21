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
    data: { label: 'System Admin Action' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'lockPeriod',
    position: { x: 400, y: 180 },
    data: { label: 'Lock Period: January 2025' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'periodLocked',
    position: { x: 400, y: 290 },
    data: { label: 'Period Status: Locked' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'employeeAction',
    type: 'input',
    position: { x: 400, y: 400 },
    data: { label: 'Employee Attempts Action' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'checkPeriod',
    type: 'default',
    position: { x: 400, y: 530 },
    data: { label: 'Period Locked?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'blocked',
    position: { x: 200, y: 660 },
    data: { label: 'Action Blocked' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'allow',
    position: { x: 600, y: 660 },
    data: { label: 'Action Allowed' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'createTS',
    type: 'default',
    position: { x: 200, y: 770 },
    data: { label: 'Create Timesheet?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'error1',
    position: { x: 50, y: 900 },
    data: { label: 'Cannot create - Period locked' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'submitTS',
    type: 'default',
    position: { x: 200, y: 1010 },
    data: { label: 'Submit Timesheet?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'error2',
    position: { x: 50, y: 1140 },
    data: { label: 'Cannot submit - Period locked' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'updateTS',
    type: 'default',
    position: { x: 200, y: 1250 },
    data: { label: 'Update Timesheet?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'error3',
    position: { x: 50, y: 1380 },
    data: { label: 'Cannot update - Period locked' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'downloadTS',
    type: 'default',
    position: { x: 200, y: 1490 },
    data: { label: 'Download PDF?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'allowDownload',
    position: { x: 50, y: 1620 },
    data: { label: 'Allowed - Read-only access' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'unlock',
    type: 'input',
    position: { x: 600, y: 400 },
    data: { label: 'System Admin Unlocks' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'unlockPeriod',
    position: { x: 600, y: 530 },
    data: { label: 'Unlock Period' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'periodUnlocked',
    position: { x: 600, y: 640 },
    data: { label: 'Period Status: Unlocked' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 1730 },
    data: { label: 'End' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'lockPeriod', animated: true },
  { id: 'e2', source: 'lockPeriod', target: 'periodLocked', animated: true },
  { id: 'e3', source: 'employeeAction', target: 'checkPeriod', animated: true },
  { id: 'e4', source: 'checkPeriod', target: 'blocked', label: 'Yes', animated: true },
  { id: 'e5', source: 'checkPeriod', target: 'allow', label: 'No', type: 'smoothstep' },
  { id: 'e6', source: 'blocked', target: 'createTS', animated: true },
  { id: 'e7', source: 'createTS', target: 'error1', label: 'Yes', animated: true },
  { id: 'e8', source: 'createTS', target: 'submitTS', label: 'No', type: 'smoothstep' },
  { id: 'e9', source: 'submitTS', target: 'error2', label: 'Yes', animated: true },
  { id: 'e10', source: 'submitTS', target: 'updateTS', label: 'No', type: 'smoothstep' },
  { id: 'e11', source: 'updateTS', target: 'error3', label: 'Yes', animated: true },
  { id: 'e12', source: 'updateTS', target: 'downloadTS', label: 'No', type: 'smoothstep' },
  { id: 'e13', source: 'downloadTS', target: 'allowDownload', label: 'Yes', animated: true },
  { id: 'e14', source: 'error1', target: 'end', type: 'smoothstep' },
  { id: 'e15', source: 'error2', target: 'end', type: 'smoothstep' },
  { id: 'e16', source: 'error3', target: 'end', type: 'smoothstep' },
  { id: 'e17', source: 'allowDownload', target: 'end', animated: true },
  { id: 'e18', source: 'allow', target: 'end', animated: true },
  { id: 'e19', source: 'unlock', target: 'unlockPeriod', animated: true },
  { id: 'e20', source: 'unlockPeriod', target: 'periodUnlocked', animated: true },
  { id: 'e21', source: 'periodUnlocked', target: 'allow', type: 'smoothstep' },
];

export default function PeriodLockingFlow() {
  console.log('[PeriodLockingFlow] Component rendering');
  console.log('[PeriodLockingFlow] initialNodes count:', initialNodes.length);
  console.log('[PeriodLockingFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[PeriodLockingFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[PeriodLockingFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[PeriodLockingFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[PeriodLockingFlow] Component mounted');
    console.log('[PeriodLockingFlow] Nodes state:', nodes.length);
    console.log('[PeriodLockingFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[PeriodLockingFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[PeriodLockingFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[PeriodLockingFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[PeriodLockingFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[PeriodLockingFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[PeriodLockingFlow] onEdgesChange:', changes);
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
