# PATH HR System - Workflow Visualization Setup

This document provides instructions for setting up and running the React Flow workflow visualizations in development.

## Overview

The workflow visualizations are interactive React Flow diagrams that show all the key workflows from the PATH HR System API design. These visualizations help developers, stakeholders, and users understand the complex approval flows and system interactions.

## Prerequisites

- Node.js 18.x or 20.x (LTS)
- npm or pnpm package manager
- Next.js 14+ project setup

## Installation

### 1. Install React Flow

```bash
npm install reactflow
# or
pnpm add reactflow
```

### 2. Verify Installation

The workflow visualization components are located in:
- `app/workflows/page.tsx` - Main visualization page
- `components/workflows/*.tsx` - Individual flow components

## Available Workflows

The visualization includes 10 interactive workflow diagrams:

1. **Leave Request - 3-Step Approval** (`leave-3step`)
   - Standard multi-level leave approval flow
   - Manager → Program Officer → HR Manager

2. **Leave Request - 1-Step Approval** (`leave-1step`)
   - Simplified single approver workflow

3. **Leave Request - Rejection Routing** (`leave-rejection`)
   - Shows how rejector chooses routing destination

4. **Timesheet Approval - With Leave Integration** (`timesheet-approval`)
   - Complete timesheet approval flow with auto-added leaves

5. **Period Locking Flow** (`period-locking`)
   - Shows how period locking prevents new submissions

6. **Delegation During Vacation** (`delegation-vacation`)
   - Delegation authority flow when approver is unavailable

7. **Admin Delegation** (`admin-delegation`)
   - System Admin delegates on behalf of unavailable user

8. **Authority Resolution Flow** (`authority-resolution`)
   - Multi-layer authority resolution (Permission + Scope + Delegation)

9. **Leave → Timesheet Integration** (`leave-integration`)
   - Automatic leave integration to timesheet flow

10. **End-to-End Flow** (`end-to-end`)
    - Complete flow from leave request to payroll processing

## Running the Visualizations

### Development Mode

```bash
# Start the Next.js development server
npm run dev
# or
pnpm dev
```

Then navigate to:
```
http://localhost:3000/workflows
```

### Features

- **Interactive Navigation**: Sidebar with all available workflows
- **Zoom & Pan**: Use mouse wheel to zoom, drag to pan
- **Mini Map**: Bottom-left corner shows overview of the flow
- **Controls**: Zoom in/out, fit view, and lock/unlock controls
- **Node Highlighting**: Hover over nodes to see details
- **Edge Animations**: Animated edges show flow direction

## Color Scheme

The workflows use a consistent color scheme:

- **Blue (#e1f5ff)**: Start/End nodes (circular)
- **Gray (#f3f4f6)**: Draft/Inactive states
- **Yellow (#fef3c7)**: Decision points and pending states
- **Light Blue (#dbeafe)**: Process steps
- **Cyan (#d1ecf1)**: Information/Integration steps
- **Green (#d4edda)**: Approved/Completed states
- **Red (#f8d7da)**: Rejected/Declined states
- **Gold (#fff3cd)**: Digital signature generation

## Component Structure

```
components/workflows/
├── LeaveRequest3StepFlow.tsx
├── LeaveRequest1StepFlow.tsx
├── LeaveRequestRejectionFlow.tsx
├── TimesheetApprovalFlow.tsx
├── PeriodLockingFlow.tsx
├── DelegationVacationFlow.tsx
├── AdminDelegationFlow.tsx
├── AuthorityResolutionFlow.tsx
├── LeaveTimesheetIntegrationFlow.tsx
└── EndToEndFlow.tsx
```

Each component:
- Uses React Flow hooks (`useNodesState`, `useEdgesState`)
- Defines nodes with positions, labels, and styles
- Defines edges with connections and labels
- Includes Background, Controls, and MiniMap

## Customization

### Adding a New Workflow

1. Create a new component in `components/workflows/`:

```typescript
'use client';

import React, { useCallback } from 'react';
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
} from 'reactflow';

const nodeTypes = {};

const initialNodes: Node[] = [
  // Define your nodes here
];

const initialEdges: Edge[] = [
  // Define your edges here
];

export default function YourNewFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

2. Import and add to `app/workflows/page.tsx`:

```typescript
import YourNewFlow from '@/components/workflows/YourNewFlow';

// Add to flows array
{
  id: 'your-flow-id',
  name: 'Your Flow Name',
  description: 'Description of your flow',
}

// Add to switch statement
case 'your-flow-id':
  return <YourNewFlow />;
```

### Styling Nodes

Nodes use inline styles with the color scheme:

```typescript
{
  id: 'node-id',
  position: { x: 400, y: 200 },
  data: { label: 'Node Label' },
  style: {
    background: '#d4edda',      // Green for approved
    border: '2px solid #28a745',
    borderRadius: '8px',
    width: 200,
    height: 60,
  },
}
```

### Node Types

- `type: 'input'` - Start nodes (circular)
- `type: 'output'` - End nodes (circular)
- `type: 'default'` - Decision/process nodes (diamond/rectangle)
- No type - Regular process nodes (rectangle)

## Troubleshooting

### React Flow Not Rendering

1. Ensure React Flow is installed:
   ```bash
   npm list reactflow
   ```

2. Check that CSS is imported:
   ```typescript
   import 'reactflow/dist/style.css';
   ```

3. Verify the component is client-side:
   ```typescript
   'use client';
   ```

### SSR Issues

If you encounter SSR (Server-Side Rendering) issues, use dynamic imports:

```typescript
const ReactFlow = dynamic(() => import('reactflow').then((mod) => mod.ReactFlow), {
  ssr: false,
});
```

### Node Positioning

If nodes appear off-screen:
- Use `fitView` prop in ReactFlow component
- Adjust node positions in `initialNodes` array
- Use Controls to zoom out and find nodes

## Production Build

The workflows are included in the production build:

```bash
npm run build
npm start
```

Navigate to `/workflows` in production to view the visualizations.

## Next Steps

- Add interactive features (click nodes to see details)
- Add animations for workflow progression
- Add tooltips with more information
- Export workflows as images
- Add search/filter functionality

---

**Created:** 2025-01-27  
**Version:** 1.0  
**Status:** Ready for Development
