'use client';

/**
 * Delegation Flow (When Approver on Vacation)
 * 
 * NOTE: This diagram shows an EXAMPLE delegation scenario.
 * The roles shown (e.g., "Manager", "Supervisor") are CONFIGURABLE examples.
 * Any approver in any workflow step can delegate to any other user.
 * 
 * This is NOT hardcoded - all workflows and delegations are database-driven and fully configurable.
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
    data: { label: 'Approver Going on Vacation\n(Example: Manager)' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'createDel',
    position: { x: 400, y: 180 },
    data: { label: 'Create Delegation' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'delConfig',
    position: { x: 400, y: 290 },
    data: { label: 'Configure Delegation' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'delegate',
    position: { x: 200, y: 400 },
    data: { label: 'Delegate: Tom Supervisor' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'permission',
    position: { x: 400, y: 400 },
    data: { label: 'Permission: leave.approve' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'location',
    position: { x: 600, y: 400 },
    data: { label: 'Location: Nairobi Office' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'duration',
    position: { x: 400, y: 510 },
    data: { label: 'Duration: 2025-02-10 to 2025-02-20' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'active',
    position: { x: 400, y: 620 },
    data: { label: 'Delegation Active' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 180, height: 60 },
  },
  {
    id: 'leaveRequest',
    type: 'input',
    position: { x: 400, y: 750 },
    data: { label: 'Leave Request Submitted' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'checkAuth',
    type: 'default',
    position: { x: 400, y: 880 },
    data: { label: 'Authority Check' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'directPerm',
    type: 'default',
    position: { x: 400, y: 1010 },
    data: { label: 'Direct Permission?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'checkDel',
    type: 'default',
    position: { x: 200, y: 1140 },
    data: { label: 'Delegation Check' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'authorized',
    position: { x: 600, y: 1140 },
    data: { label: 'Authorized' },
    style: { background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', width: 120, height: 60 },
  },
  {
    id: 'validTime',
    type: 'default',
    position: { x: 200, y: 1250 },
    data: { label: 'Within Valid Period?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 180, height: 80 },
  },
  {
    id: 'notAuthorized',
    position: { x: 50, y: 1380 },
    data: { label: 'Not Authorized' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'validScope',
    type: 'default',
    position: { x: 200, y: 1380 },
    data: { label: 'Valid Scope?' },
    style: { background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', width: 150, height: 80 },
  },
  {
    id: 'authorizedDel',
    position: { x: 200, y: 1490 },
    data: { label: 'Authorized via Delegation' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'approve',
    position: { x: 600, y: 1250 },
    data: { label: 'Approve Request' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'approveDel',
    position: { x: 200, y: 1600 },
    data: { label: 'Approve Request via Delegation' },
    style: { background: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'sign',
    position: { x: 600, y: 1380 },
    data: { label: 'Generate Signature' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 150, height: 60 },
  },
  {
    id: 'signDel',
    position: { x: 200, y: 1710 },
    data: { label: 'Generate Signature with Delegation Context' },
    style: { background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', width: 250, height: 60 },
  },
  {
    id: 'audit',
    position: { x: 600, y: 1510 },
    data: { label: 'Audit Log: Direct Approval' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 200, height: 60 },
  },
  {
    id: 'auditDel',
    position: { x: 200, y: 1820 },
    data: { label: 'Audit Log: Delegated Approval' },
    style: { background: '#d1ecf1', border: '2px solid #17a2b8', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'expire',
    type: 'input',
    position: { x: 400, y: 1930 },
    data: { label: 'Delegation Expires' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
  {
    id: 'expired',
    position: { x: 400, y: 2060 },
    data: { label: 'Delegation Status: Expired' },
    style: { background: '#f8d7da', border: '2px solid #dc3545', borderRadius: '8px', width: 220, height: 60 },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 400, y: 2170 },
    data: { label: 'Complete' },
    style: { background: '#e1f5ff', border: '2px solid #0284c7', borderRadius: '50%', width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'createDel', animated: true },
  { id: 'e2', source: 'createDel', target: 'delConfig', animated: true },
  { id: 'e3', source: 'delConfig', target: 'delegate', animated: true },
  { id: 'e4', source: 'delConfig', target: 'permission', animated: true },
  { id: 'e5', source: 'delConfig', target: 'location', animated: true },
  { id: 'e6', source: 'delegate', target: 'duration', animated: true },
  { id: 'e7', source: 'permission', target: 'duration', animated: true },
  { id: 'e8', source: 'location', target: 'duration', animated: true },
  { id: 'e9', source: 'duration', target: 'active', animated: true },
  { id: 'e10', source: 'leaveRequest', target: 'checkAuth', animated: true },
  { id: 'e11', source: 'checkAuth', target: 'directPerm', animated: true },
  { id: 'e12', source: 'directPerm', target: 'checkDel', label: 'No', type: 'smoothstep' },
  { id: 'e13', source: 'directPerm', target: 'authorized', label: 'Yes', animated: true },
  { id: 'e14', source: 'checkDel', target: 'validTime', animated: true },
  { id: 'e15', source: 'validTime', target: 'notAuthorized', label: 'No', type: 'smoothstep' },
  { id: 'e16', source: 'validTime', target: 'validScope', label: 'Yes', animated: true },
  { id: 'e17', source: 'validScope', target: 'notAuthorized', label: 'No', type: 'smoothstep' },
  { id: 'e18', source: 'validScope', target: 'authorizedDel', label: 'Yes', animated: true },
  { id: 'e19', source: 'authorized', target: 'approve', animated: true },
  { id: 'e20', source: 'authorizedDel', target: 'approveDel', animated: true },
  { id: 'e21', source: 'approve', target: 'sign', animated: true },
  { id: 'e22', source: 'approveDel', target: 'signDel', animated: true },
  { id: 'e23', source: 'sign', target: 'audit', animated: true },
  { id: 'e24', source: 'signDel', target: 'auditDel', animated: true },
  { id: 'e25', source: 'audit', target: 'end', animated: true },
  { id: 'e26', source: 'auditDel', target: 'end', animated: true },
  { id: 'e27', source: 'expire', target: 'expired', animated: true },
  { id: 'e28', source: 'expired', target: 'checkAuth', type: 'smoothstep' },
];

export default function DelegationVacationFlow() {
  console.log('[DelegationVacationFlow] Component rendering');
  console.log('[DelegationVacationFlow] initialNodes count:', initialNodes.length);
  console.log('[DelegationVacationFlow] initialEdges count:', initialEdges.length);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[DelegationVacationFlow] onConnect called:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[DelegationVacationFlow] onInit called, instance:', instance);
    reactFlowInstance.current = instance;
    setTimeout(() => {
      console.log('[DelegationVacationFlow] Calling fitView');
      instance.fitView({ padding: 0.2, maxZoom: 1.5 });
    }, 100);
  }, []);
  useEffect(() => {
    console.log('[DelegationVacationFlow] Component mounted');
    console.log('[DelegationVacationFlow] Nodes state:', nodes.length);
    console.log('[DelegationVacationFlow] Edges state:', edges.length);
  }, []);

  useEffect(() => {
    console.log('[DelegationVacationFlow] Nodes updated:', nodes.length);
  }, [nodes]);

  useEffect(() => {
    console.log('[DelegationVacationFlow] Edges updated:', edges.length);
  }, [edges]);

  useEffect(() => {
    if (reactFlowInstance.current) {
      console.log('[DelegationVacationFlow] useEffect: reactFlowInstance exists, calling fitView');
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, maxZoom: 1.5 });
      }, 200);
    }
  }, []);

  
  console.log('[DelegationVacationFlow] Rendering ReactFlow with', nodes.length, 'nodes and', edges.length, 'edges');

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          console.log('[DelegationVacationFlow] onNodesChange:', changes);
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          console.log('[DelegationVacationFlow] onEdgesChange:', changes);
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
