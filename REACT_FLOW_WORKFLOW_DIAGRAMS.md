# PATH HR System - React Flow Workflow Diagrams

**Document Purpose:** This document provides reference information for the interactive React Flow workflow diagrams implemented in the PATH HR System. These visual diagrams help developers, stakeholders, and users understand the complex approval flows and system interactions.

**Based On:** PATH_COMPREHENSIVE_API_DESIGN.md  
**Implementation:** Interactive React Flow components in `app/workflows/page.tsx` and `components/workflows/`

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [React Flow Implementation](#react-flow-implementation)
3. [Leave Request Workflow Diagrams](#leave-request-workflow-diagrams)
4. [Timesheet Approval Workflow Diagrams](#timesheet-approval-workflow-diagrams)
5. [Delegation Flow Diagrams](#delegation-flow-diagrams)
6. [System Architecture Diagrams](#system-architecture-diagrams)
7. [Integration Flow Diagrams](#integration-flow-diagrams)
8. [Component Reference](#component-reference)

---

## OVERVIEW

All workflow diagrams have been implemented as interactive React Flow components. These components are accessible via the `/workflows` route in the Next.js application.

### Accessing the Visualizations

1. **Development:** Navigate to `http://localhost:3000/workflows`
2. **Production:** Navigate to `https://your-domain.com/workflows`

### Features

- **Interactive Navigation:** Sidebar with all available workflows
- **Zoom & Pan:** Mouse wheel to zoom, drag to pan
- **Mini Map:** Bottom-left corner shows overview
- **Controls:** Zoom in/out, fit view, lock/unlock
- **Node Highlighting:** Hover over nodes to see details
- **Edge Animations:** Animated edges show flow direction

---

## REACT FLOW IMPLEMENTATION

### Technology Stack

- **React Flow:** `reactflow` library for interactive flow diagrams
- **Next.js 14+:** App Router with client components
- **TypeScript:** Full type safety
- **Tailwind CSS:** Styling (optional, for page layout)

### Component Structure

```
app/workflows/
└── page.tsx                    # Main visualization page with navigation

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

### Color Scheme (Implemented)

The workflows use a consistent color scheme:

- **Blue (#e1f5ff):** Start/End nodes (circular, `type: 'input'` or `type: 'output'`)
- **Gray (#f3f4f6):** Draft/Inactive states
- **Yellow (#fef3c7):** Decision points and pending states (`type: 'default'`)
- **Light Blue (#dbeafe):** Process steps
- **Cyan (#d1ecf1):** Information/Integration steps
- **Green (#d4edda):** Approved/Completed states
- **Red (#f8d7da):** Rejected/Declined states
- **Gold (#fff3cd):** Digital signature generation

### Node Types

- **`type: 'input'`:** Start nodes (circular)
- **`type: 'output'`:** End nodes (circular)
- **`type: 'default'`:** Decision/process nodes (diamond/rectangle)
- **No type:** Regular process nodes (rectangle)

---

## LEAVE REQUEST WORKFLOW DIAGRAMS

### Diagram 1: Standard Multi-Level Leave Approval Flow

**Component:** `LeaveRequest3StepFlow.tsx`  
**Route ID:** `leave-3step`  
**Description:** Shows the complete flow of a leave request through 3 approval levels: Manager → Program Officer → HR Manager

**Key Features:**
- Authority checks at each step
- Digital signature generation
- Routing options for adjustments
- Automatic timesheet integration
- Notification triggers

**Node Count:** 25 nodes  
**Edge Count:** 31 edges

**Mermaid Reference (Original Design):**
```mermaid
flowchart TD
    Start([Employee Creates Leave Request]) --> Draft[Draft Status]
    Draft --> Submit{Employee Submits?}
    Submit -->|Yes| Step1[Step 1: Manager Approval]
    Submit -->|No| Draft
    
    Step1 --> Check1{Manager Has Permission?}
    Check1 -->|No| Error1[403 Forbidden]
    Check1 -->|Yes| Approve1{Manager Action}
    
    Approve1 -->|Approve| Sign1[Generate Digital Signature + Timestamp]
    Approve1 -->|Decline| Decline1[Declined - Workflow Terminated]
    Approve1 -->|Adjust| Adjust1[Return to Employee - Draft]
    
    Sign1 --> Step2[Step 2: Program Officer Approval]
    Step2 --> Check2{Program Officer Has Permission?}
    Check2 -->|No| Error2[403 Forbidden]
    Check2 -->|Yes| Approve2{Program Officer Action}
    
    Approve2 -->|Approve| Sign2[Generate Digital Signature + Timestamp]
    Approve2 -->|Decline| Decline2[Declined - Workflow Terminated]
    Approve2 -->|Adjust| Route2{Choose Routing}
    Route2 -->|Employee| Adjust1
    Route2 -->|Step 1| Step1
    
    Sign2 --> Step3[Step 3: HR Manager Approval]
    Step3 --> Check3{HR Manager Has Permission?}
    Check3 -->|No| Error3[403 Forbidden]
    Check3 -->|Yes| Approve3{HR Manager Action}
    
    Approve3 -->|Approve| Sign3[Generate Digital Signature + Timestamp]
    Approve3 -->|Decline| Decline3[Declined - Workflow Terminated]
    Approve3 -->|Adjust| Route3{Choose Routing}
    Route3 -->|Employee| Adjust1
    Route3 -->|Step 1| Step1
    Route3 -->|Step 2| Step2
    
    Sign3 --> Approved[Leave Request Approved]
    Approved --> UpdateBalance[Update Leave Balance]
    UpdateBalance --> AddToTimesheet[Auto-Add to Timesheet]
    AddToTimesheet --> Notify[Send Notifications]
    Notify --> End([Complete])
```

---

### Diagram 2: Simple Single Approver Flow

**Component:** `LeaveRequest1StepFlow.tsx`  
**Route ID:** `leave-1step`  
**Description:** Simplified workflow with only one approver (Manager)

**Key Features:**
- Single approval step
- Same signature generation
- Simplified flow

**Node Count:** 14 nodes  
**Edge Count:** 16 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Employee Creates Leave Request]) --> Draft[Draft Status]
    Draft --> Submit{Employee Submits?}
    Submit -->|Yes| Step1[Step 1: Manager Approval]
    Submit -->|No| Draft
    
    Step1 --> Check1{Manager Has Permission?}
    Check1 -->|No| Error1[403 Forbidden]
    Check1 -->|Yes| Approve1{Manager Action}
    
    Approve1 -->|Approve| Sign1[Generate Digital Signature + Timestamp]
    Approve1 -->|Decline| Decline1[Declined - Workflow Terminated]
    Approve1 -->|Adjust| Adjust1[Return to Employee - Draft]
    
    Sign1 --> Approved[Leave Request Approved]
    Approved --> UpdateBalance[Update Leave Balance]
    UpdateBalance --> AddToTimesheet[Auto-Add to Timesheet]
    AddToTimesheet --> Notify[Send Notifications]
    Notify --> End([Complete])
```

---

### Diagram 3: Rejection with Routing Choice

**Component:** `LeaveRequestRejectionFlow.tsx`  
**Route ID:** `leave-rejection`  
**Description:** Shows how a rejector can choose where the request goes back to in the workflow

**Key Features:**
- Rejector chooses routing
- Multiple routing options
- Workflow can restart or terminate

**Node Count:** 13 nodes  
**Edge Count:** 16 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Leave Request in Step 2]) --> Current[Step 2: Program Officer]
    Current --> Reject{Program Officer Rejects}
    Reject -->|Yes| RoutingChoice{Choose Routing Destination}
    
    RoutingChoice -->|Option 1| Employee[Route to Employee - Draft]
    RoutingChoice -->|Option 2| Step1[Route to Step 1 - Manager]
    RoutingChoice -->|Option 3| Terminate[Final Rejection - Terminate]
    
    Employee --> DraftStatus[Draft - Editable]
    DraftStatus --> Modify{Employee Modifies?}
    Modify -->|Yes| Resubmit[Resubmit Request]
    Resubmit --> Step1
    
    Step1 --> ReReview[Step 1 Needs Re-Review]
    ReReview --> ManagerAction{Manager Action}
    ManagerAction -->|Approve| Continue[Continue to Step 2]
    ManagerAction -->|Reject| Terminate
    
    Terminate --> End([Workflow Terminated])
    Continue --> Current
```

---

## TIMESHEET APPROVAL WORKFLOW DIAGRAMS

### Diagram 4: Timesheet Approval with Leave Integration

**Component:** `TimesheetApprovalFlow.tsx`  
**Route ID:** `timesheet-approval`  
**Description:** Complete timesheet approval flow showing how approved leaves are automatically integrated

**Key Features:**
- Auto-addition of approved leaves
- Hours verification
- PDF generation with signatures
- Period locking check

**Node Count:** 20 nodes  
**Edge Count:** 25 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Employee Creates Timesheet]) --> Draft[Draft Status]
    Draft --> CheckLeaves{Approved Leaves Exist?}
    CheckLeaves -->|Yes| AutoAdd[Auto-Add Leave Entries]
    CheckLeaves -->|No| ManualEntry[Manual Entry]
    AutoAdd --> ManualEntry
    ManualEntry --> Calculate[Calculate Total Hours]
    Calculate --> Submit{Employee Submits?}
    Submit -->|Yes| Step1[Step 1: Supervisor Approval]
    Submit -->|No| Draft
    
    Step1 --> Check1{Supervisor Has Permission?}
    Check1 -->|No| Error1[403 Forbidden]
    Check1 -->|Yes| Verify1{Verify Hours Match?}
    Verify1 -->|No| Reject1{Reject with Routing}
    Verify1 -->|Yes| Approve1{Supervisor Action}
    
    Approve1 -->|Approve| Sign1[Generate Digital Signature + Timestamp]
    Approve1 -->|Decline| Reject1
    Approve1 -->|Adjust| Route1{Choose Routing}
    
    Reject1 -->|Employee| Draft
    Reject1 -->|Step 1| Step1
    Route1 -->|Employee| Draft
    Route1 -->|Step 1| Step1
    
    Sign1 --> Step2[Step 2: Manager Approval]
    Step2 --> Check2{Manager Has Permission?}
    Check2 -->|No| Error2[403 Forbidden]
    Check2 -->|Yes| Approve2{Manager Action}
    
    Approve2 -->|Approve| Sign2[Generate Digital Signature + Timestamp]
    Approve2 -->|Decline| Reject2{Reject with Routing}
    Approve2 -->|Adjust| Route2{Choose Routing}
    
    Reject2 -->|Employee| Draft
    Reject2 -->|Step 1| Step1
    Route2 -->|Employee| Draft
    Route2 -->|Step 1| Step1
    
    Sign2 --> Step3[Step 3: HR Manager Approval]
    Step3 --> Check3{HR Manager Has Permission?}
    Check3 -->|No| Error3[403 Forbidden]
    Check3 -->|Yes| Approve3{HR Manager Action}
    
    Approve3 -->|Approve| Sign3[Generate Digital Signature + Timestamp]
    Approve3 -->|Decline| Reject3[Declined]
    Approve3 -->|Adjust| Route3{Choose Routing}
    
    Reject3 --> Draft
    Route3 -->|Employee| Draft
    Route3 -->|Step 1| Step1
    Route3 -->|Step 2| Step2
    
    Sign3 --> Approved[Timesheet Approved]
    Approved --> Lock[Lock Timesheet]
    Lock --> GeneratePDF[Generate PDF with Signatures]
    GeneratePDF --> Payroll[Ready for Payroll]
    Payroll --> Notify[Send Notifications]
    Notify --> End([Complete])
```

---

### Diagram 5: Period Locking Flow

**Component:** `PeriodLockingFlow.tsx`  
**Route ID:** `period-locking`  
**Description:** Shows how period locking prevents new submissions

**Node Count:** 18 nodes  
**Edge Count:** 21 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([System Admin Action]) --> LockPeriod[Lock Period: January 2025]
    LockPeriod --> PeriodLocked[Period Status: Locked]
    
    EmployeeAction([Employee Attempts Action]) --> CheckPeriod{Period Locked?}
    CheckPeriod -->|Yes| Blocked[Action Blocked]
    CheckPeriod -->|No| Allow[Action Allowed]
    
    Blocked --> CreateTS{Create Timesheet?}
    CreateTS -->|Yes| Error1[Cannot create - Period locked]
    CreateTS -->|No| SubmitTS{Submit Timesheet?}
    
    SubmitTS -->|Yes| Error2[Cannot submit - Period locked]
    SubmitTS -->|No| UpdateTS{Update Timesheet?}
    
    UpdateTS -->|Yes| Error3[Cannot update - Period locked]
    UpdateTS -->|No| DownloadTS{Download PDF?}
    
    DownloadTS -->|Yes| AllowDownload[Allowed - Read-only access]
    DownloadTS -->|No| End([End])
    
    Error1 --> End
    Error2 --> End
    Error3 --> End
    AllowDownload --> End
    Allow --> End
    
    Unlock([System Admin Unlocks]) --> UnlockPeriod[Unlock Period]
    UnlockPeriod --> PeriodUnlocked[Period Status: Unlocked]
    PeriodUnlocked --> Allow
```

---

## DELEGATION FLOW DIAGRAMS

### Diagram 6: Delegation During Vacation

**Component:** `DelegationVacationFlow.tsx`  
**Route ID:** `delegation-vacation`  
**Description:** Shows how delegation works when an approver is unavailable

**Key Features:**
- Delegation authority resolution
- Time-bound validity
- Scope matching
- Delegation context in signatures

**Node Count:** 20 nodes  
**Edge Count:** 28 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Manager Going on Vacation]) --> CreateDel[Create Delegation]
    CreateDel --> DelConfig[Configure Delegation]
    DelConfig --> Delegate[Delegate: Tom Supervisor]
    Delegate --> Permission[Permission: leave.approve]
    Permission --> Location[Location: Nairobi Office]
    Location --> Duration[Duration: 2025-02-10 to 2025-02-20]
    Duration --> Active[Delegation Active]
    
    LeaveRequest([Leave Request Submitted]) --> CheckAuth{Authority Check}
    CheckAuth --> DirectPerm{Direct Permission?}
    DirectPerm -->|No| CheckDel{Delegation Check}
    DirectPerm -->|Yes| Authorized[Authorized]
    
    CheckDel --> ValidTime{Within Valid Period?}
    ValidTime -->|No| NotAuthorized[Not Authorized]
    ValidTime -->|Yes| ValidScope{Valid Scope?}
    ValidScope -->|No| NotAuthorized
    ValidScope -->|Yes| AuthorizedDel[Authorized via Delegation]
    
    Authorized --> Approve[Approve Request]
    AuthorizedDel --> ApproveDel[Approve Request via Delegation]
    
    Approve --> Sign[Generate Signature]
    ApproveDel --> SignDel[Generate Signature with Delegation Context]
    
    Sign --> Audit[Audit Log: Direct Approval]
    SignDel --> AuditDel[Audit Log: Delegated Approval]
    
    Audit --> End([Complete])
    AuditDel --> End
    NotAuthorized --> End
    
    Expire([Delegation Expires]) --> Expired[Delegation Status: Expired]
    Expired --> CheckAuth
```

---

### Diagram 7: System Admin Delegation

**Component:** `AdminDelegationFlow.tsx`  
**Route ID:** `admin-delegation`  
**Description:** Shows how System Admin can delegate on behalf of unavailable users

**Node Count:** 15 nodes  
**Edge Count:** 22 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([User Unavailable]) --> AdminAction[System Admin Action]
    AdminAction --> CheckAdmin{System Admin Has Permission?}
    CheckAdmin -->|No| Error[403 Forbidden]
    CheckAdmin -->|Yes| CreateDel[Create Delegation on Behalf]
    
    CreateDel --> SelectUser[Select Unavailable User]
    SelectUser --> SelectDelegate[Select Delegate]
    SelectDelegate --> ConfigDel[Configure Delegation]
    ConfigDel --> SaveDel[Save Delegation]
    SaveDel --> NotifyDel[Notify Delegate]
    NotifyDel --> Active[Delegation Active]
    
    Request([Approval Request]) --> CheckAuth{Authority Check}
    CheckAuth --> CheckDel{Active Delegation?}
    CheckDel -->|Yes| Authorized[Authorized via Delegation]
    CheckDel -->|No| NotAuthorized[Not Authorized]
    
    Authorized --> Approve[Approve Request]
    Approve --> Sign[Generate Signature with Admin Delegation Context]
    Sign --> Audit[Audit Log: Admin-created Delegation]
    Audit --> End([Complete])
    
    Error --> End
    NotAuthorized --> End
```

---

## SYSTEM ARCHITECTURE DIAGRAMS

### Diagram 8: Authority Resolution Flow

**Component:** `AuthorityResolutionFlow.tsx`  
**Route ID:** `authority-resolution`  
**Description:** Shows how authority is resolved through multiple layers

**Key Features:**
- Multi-layer checks
- Permission + Scope + Delegation
- Workflow step eligibility

**Node Count:** 15 nodes  
**Edge Count:** 24 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Approval Request]) --> CheckUser{User Active?}
    CheckUser -->|No| Deny1[Deny - User Inactive]
    CheckUser -->|Yes| GetRoles[Get User Roles]
    
    GetRoles --> GetPerms[Get Role Permissions]
    GetPerms --> HasPerm{Permission Exists?}
    HasPerm -->|No| Deny2[Deny - No Permission]
    HasPerm -->|Yes| GetScopes[Get User Scopes]
    
    GetScopes --> CheckScope{Scope Match?}
    CheckScope -->|No| CheckDel{Check Delegations}
    CheckScope -->|Yes| CheckDel
    
    CheckDel --> ActiveDel{Active Delegation?}
    ActiveDel -->|Yes| ValidDel{Valid Time & Scope?}
    ActiveDel -->|No| CheckWorkflow
    
    ValidDel -->|Yes| AuthorizedDel[Authorized via Delegation]
    ValidDel -->|No| CheckWorkflow
    
    CheckWorkflow{Workflow Step Eligible?} -->|No| Deny3[Deny - Wrong Step]
    CheckWorkflow -->|Yes| FinalAuth{All Checks Pass?}
    
    FinalAuth -->|Yes| Authorized[Authorized - Proceed]
    FinalAuth -->|No| Deny4[Deny - Authority Check Failed]
    
    Authorized --> End([Approval Allowed])
    AuthorizedDel --> End
    Deny1 --> End
    Deny2 --> End
    Deny3 --> End
    Deny4 --> End
```

---

## INTEGRATION FLOW DIAGRAMS

### Diagram 9: Leave → Timesheet Integration Flow

**Component:** `LeaveTimesheetIntegrationFlow.tsx`  
**Route ID:** `leave-integration`  
**Description:** Shows how approved leaves are automatically added to timesheets

**Node Count:** 20 nodes  
**Edge Count:** 27 edges

**Mermaid Reference:**
```mermaid
flowchart TD
    Start([Leave Request Approved]) --> Trigger[Integration Event Triggered]
    Trigger --> CheckTS{Timesheet Exists?}
    
    CheckTS -->|Yes| GetTS[Get Existing Timesheet]
    CheckTS -->|No| CreateTS[Create New Timesheet]
    
    GetTS --> GetWorkHours[Get Work Hours Config]
    CreateTS --> GetWorkHours
    
    GetWorkHours --> CalcHours[Calculate Hours per Day]
    CalcHours --> LoopDays{Loop Through Leave Days}
    
    LoopDays --> CheckDay{Day of Week?}
    CheckDay -->|Monday-Thursday| Hours85[8.5 hours - Regular Staff]
    CheckDay -->|Friday| Hours6[6 hours - Regular Staff]
    CheckDay -->|Saturday| Hours0[0 hours - Weekend]
    CheckDay -->|Sunday| Hours0
    
    Hours85 --> CreateEntry[Create Timesheet Entry]
    Hours6 --> CreateEntry
    Hours0 --> CreateEntry
    
    CreateEntry --> SetLabel[Set Label: Leave Type Name]
    SetLabel --> LinkLeave[Link to Leave Request ID]
    LinkLeave --> MoreDays{More Days?}
    
    MoreDays -->|Yes| LoopDays
    MoreDays -->|No| UpdateTotal[Update Total Hours]
    
    UpdateTotal --> UpdateStatus{Timesheet Status?}
    UpdateStatus -->|Draft| KeepDraft[Keep Draft Status]
    UpdateStatus -->|Submitted/Approved| KeepStatus[Keep Current Status]
    
    KeepDraft --> Notify[Notify Employee]
    KeepStatus --> Notify
    Notify --> Audit[Log Integration Event]
    Audit --> End([Complete])
```

---

### Diagram 10: End-to-End Flow

**Component:** `EndToEndFlow.tsx`  
**Route ID:** `end-to-end`  
**Description:** Complete flow from leave request creation to payroll processing

**Node Count:** 15 nodes  
**Edge Count:** 14 edges

**Mermaid Reference:**
```mermaid
flowchart LR
    A([Employee Creates Leave Request]) --> B[Submit for Approval]
    B --> C[Workflow: Manager → Program Officer → HR Manager]
    C --> D[All Approvals with Signatures]
    D --> E[Leave Approved]
    E --> F[Update Leave Balance]
    F --> G[Auto-Add to Timesheet]
    G --> H[Employee Completes Timesheet]
    H --> I[Submit Timesheet for Approval]
    I --> J[Workflow: Supervisor → Manager → HR Manager]
    J --> K[All Approvals with Signatures]
    K --> L[Timesheet Approved & Locked]
    L --> M[Generate PDF with Signatures]
    M --> N[Ready for Payroll]
    N --> O([Payroll Processing])
```

---

## COMPONENT REFERENCE

### Implementation Details

Each React Flow component follows this structure:

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
  // Node definitions with positions, labels, and styles
];

const initialEdges: Edge[] = [
  // Edge definitions with source, target, labels, and types
];

export default function YourFlowComponent() {
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

### Node Styling

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

### Edge Types

- **`animated: true`** - Animated edges for forward flow
- **`type: 'smoothstep'`** - Curved edges for alternative paths
- **`label: 'Yes'`** - Edge labels for decision outcomes

---

## DIAGRAM SPECIFICATIONS SUMMARY

| Diagram # | Component Name | Route ID | Type | Complexity | Nodes | Edges |
|-----------|----------------|----------|------|------------|-------|-------|
| 1 | LeaveRequest3StepFlow | `leave-3step` | Workflow | High | 25 | 31 |
| 2 | LeaveRequest1StepFlow | `leave-1step` | Workflow | Low | 14 | 16 |
| 3 | LeaveRequestRejectionFlow | `leave-rejection` | Workflow | Medium | 13 | 16 |
| 4 | TimesheetApprovalFlow | `timesheet-approval` | Workflow | High | 20 | 25 |
| 5 | PeriodLockingFlow | `period-locking` | System | Medium | 18 | 21 |
| 6 | DelegationVacationFlow | `delegation-vacation` | Authority | Medium | 20 | 28 |
| 7 | AdminDelegationFlow | `admin-delegation` | Authority | Medium | 15 | 22 |
| 8 | AuthorityResolutionFlow | `authority-resolution` | System | High | 15 | 24 |
| 9 | LeaveTimesheetIntegrationFlow | `leave-integration` | Integration | Medium | 20 | 27 |
| 10 | EndToEndFlow | `end-to-end` | System | High | 15 | 14 |

---

## SETUP INSTRUCTIONS

See `WORKFLOW_VISUALIZATION_SETUP.md` for detailed setup and usage instructions.

### Quick Start

1. Install React Flow:
   ```bash
   npm install reactflow
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Navigate to:
   ```
   http://localhost:3000/workflows
   ```

---

**Document Version:** 2.0  
**Created:** 2025-01-27  
**Updated:** 2025-01-27 (React Flow Implementation)  
**Purpose:** Reference documentation for React Flow workflow visualizations  
**Status:** ✅ Implemented and Ready
