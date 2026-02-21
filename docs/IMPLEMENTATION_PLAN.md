# HR App API - Implementation Plan

**Tech Stack:** Next.js API Routes (Node.js Runtime) | PostgreSQL | Prisma | Redis | DigitalOcean Managed DB | Docker  
**Architecture Principles:** Strict Indexing | Transaction-Based Approval Locking | Scalable Design | Fully Dynamic Configuration

---

## CORE SYSTEM INVARIANTS

These rules are immutable and must be enforced at all layers:

1. **No authority without permission** - Every action requires explicit permission
2. **No authority without scope** - Permissions must be bound to location scope
3. **No approval outside workflow** - All approvals must follow workflow templates
4. **Delegation never permanently modifies permission** - Delegations are temporary overlays
5. **Location hierarchy must always remain valid** - Tree integrity enforced at all times
6. **Workflow templates do not mutate running instances** - Version isolation required
7. **All state transitions must be auditable** - Complete audit trail mandatory
8. **Soft delete only for core entities** - Never hard delete user/location/permission data

### Authority Formula

```
Authority = Permission ∩ Location Scope ∩ Delegation Overlay ∩ Workflow Step Eligibility ∩ Active Status
```

All approvals must pass ALL layers.

### Workflow State Model

**Global States:** `Draft` → `Submitted` → `Under Review` → `Approved` | `Declined` | `Adjusted` | `Cancelled`

- Transitions must be explicit and validated
- No state skipping allowed
- Adjustment returns to requester, resumes at same step

---

## DYNAMIC CONFIGURATION PRINCIPLE

**CRITICAL:** All major engines are fully dynamic and configurable at runtime. No hardcoded logic.

### ✅ Confirmed Dynamic Systems

1. **Roles System** - Fully Dynamic
   - ✅ Roles can be created, updated, and removed at runtime
   - ✅ Role permissions can be assigned/removed dynamically
   - ✅ User-role assignments are runtime configurable
   - ✅ Role status (active/inactive) can be toggled
   - ✅ No hardcoded role names or permissions

2. **Workflow Engine** - Fully Dynamic
   - ✅ Workflow templates can be created/modified at runtime
   - ✅ Workflow steps can be added/removed/reordered dynamically
   - ✅ Step permissions are configurable per step
   - ✅ Workflow templates are location-specific and versioned
   - ✅ Template changes do not affect running instances (version isolation)
   - ✅ Multiple workflows can exist for same resource type per location

3. **Permission System** - Fully Dynamic
   - ✅ Permissions can be created and managed at runtime
   - ✅ Permission modules are dynamic
   - ✅ Permission assignment to roles is runtime configurable

4. **Scope Engine** - Fully Dynamic
   - ✅ User permission scopes are runtime configurable
   - ✅ Location scopes can be assigned/removed dynamically
   - ✅ Time-bound scopes (valid_from/valid_until) are runtime configurable
   - ✅ Global scopes can be toggled at runtime

5. **Delegation Engine** - Fully Dynamic
   - ✅ Delegations can be created/revoked at runtime
   - ✅ Delegation scope (location, descendants) is configurable
   - ✅ Time-bound delegations are runtime configurable
   - ✅ Delegation status can be toggled

6. **Location Engine** - Fully Dynamic
   - ✅ Location tree structure is mutable at runtime
   - ✅ Locations can be created/moved/disabled dynamically
   - ✅ Tree hierarchy can be restructured without breaking authority

### Implementation Requirements

- All configuration stored in database (not code)
- API endpoints for CRUD operations on all dynamic entities
- No business logic hardcoded in application code
- All rules and constraints enforced via database constraints and application logic
- Configuration changes take effect immediately (no deployment required)

---

## DATABASE ARCHITECTURE

### Core Tables

#### Users
- `id` (UUID, PK)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE, INDEXED)
- `password_hash` (VARCHAR)
- `status` (ENUM: active/suspended/deactivated, INDEXED)
- `primary_location_id` (UUID, FK → Locations.id, INDEXED)
- `deleted_at` (TIMESTAMP, NULLABLE, INDEXED)
- `created_at` (TIMESTAMP, INDEXED)
- `updated_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Unique: `email`
- Composite: `(status, deleted_at)` for active user queries
- Foreign: `primary_location_id`

#### Permissions
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE, INDEXED) - e.g., "leave.approve"
- `module` (VARCHAR, INDEXED)
- `description` (TEXT)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Unique: `name`
- Composite: `(module, name)` for module-based queries

#### Roles
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE, INDEXED)
- `description` (TEXT)
- `status` (ENUM: active/inactive, INDEXED)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Unique: `name`
- Status: `status` for active role filtering

#### RolePermissions
- `role_id` (UUID, FK → Roles.id, INDEXED)
- `permission_id` (UUID, FK → Permissions.id, INDEXED)
- `created_at` (TIMESTAMP)

**Indexes:**
- Composite PK: `(role_id, permission_id)`
- Reverse lookup: `permission_id` for permission-based queries

#### UserRoles
- `user_id` (UUID, FK → Users.id, INDEXED)
- `role_id` (UUID, FK → Roles.id, INDEXED)
- `created_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, NULLABLE, INDEXED)

**Indexes:**
- Composite PK: `(user_id, role_id)`
- User lookup: `user_id` with `deleted_at IS NULL` filter
- Role lookup: `role_id` with `deleted_at IS NULL` filter

#### Locations
- `id` (UUID, PK)
- `name` (VARCHAR, INDEXED)
- `parent_id` (UUID, FK → Locations.id, NULLABLE, INDEXED)
- `status` (ENUM: active/inactive, INDEXED)
- `path` (LTREE or VARCHAR) - Materialized path for tree queries
- `level` (INTEGER) - Depth in tree
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Parent lookup: `parent_id`
- Tree queries: `path` (GIST index if using LTREE)
- Composite: `(status, parent_id)` for active subtree queries
- **Critical:** Ensure no circular references via CHECK constraints

#### UserPermissionScopes
- `id` (UUID, PK)
- `user_id` (UUID, FK → Users.id, INDEXED)
- `permission_id` (UUID, FK → Permissions.id, INDEXED)
- `location_id` (UUID, FK → Locations.id, NULLABLE, INDEXED)
- `include_descendants` (BOOLEAN, DEFAULT false, INDEXED)
- `is_global` (BOOLEAN, DEFAULT false, INDEXED)
- `valid_from` (TIMESTAMP, INDEXED)
- `valid_until` (TIMESTAMP, NULLABLE, INDEXED)
- `status` (ENUM: active/inactive, INDEXED)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- User permission lookup: `(user_id, permission_id, status)`
- Active scope queries: `(permission_id, status, valid_from, valid_until)`
- Location scope: `(location_id, include_descendants)` where `location_id IS NOT NULL`
- Global scope: `(is_global, status)` where `is_global = true`
- Time range: `(valid_from, valid_until)` for expiry checks

#### Delegations
- `id` (UUID, PK)
- `delegator_user_id` (UUID, FK → Users.id, INDEXED)
- `delegate_user_id` (UUID, FK → Users.id, INDEXED)
- `permission_id` (UUID, FK → Permissions.id, INDEXED)
- `location_id` (UUID, FK → Locations.id, NULLABLE, INDEXED)
- `include_descendants` (BOOLEAN, DEFAULT false)
- `valid_from` (TIMESTAMP, INDEXED)
- `valid_until` (TIMESTAMP, INDEXED)
- `status` (ENUM: active/revoked/expired, INDEXED)
- `revoked_at` (TIMESTAMP, NULLABLE)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Delegate lookup: `(delegate_user_id, permission_id, status)`
- Active delegation: `(status, valid_from, valid_until)`
- Delegator audit: `delegator_user_id`
- Expiry cleanup: `(status, valid_until)` for scheduled cleanup

#### WorkflowTemplates
- `id` (UUID, PK)
- `name` (VARCHAR, INDEXED)
- `resource_type` (ENUM: leave/timesheet, INDEXED)
- `location_id` (UUID, FK → Locations.id, INDEXED)
- `version` (INTEGER)
- `status` (ENUM: active/deprecated, INDEXED)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Template lookup: `(resource_type, location_id, status)`
- Version tracking: `(id, version)`

#### WorkflowSteps
- `id` (UUID, PK)
- `workflow_template_id` (UUID, FK → WorkflowTemplates.id, INDEXED)
- `step_order` (INTEGER, INDEXED)
- `required_permission` (VARCHAR, INDEXED)
- `allow_decline` (BOOLEAN, DEFAULT true)
- `allow_adjust` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Step sequence: `(workflow_template_id, step_order)` UNIQUE
- Permission lookup: `required_permission`

#### WorkflowInstances
- `id` (UUID, PK)
- `workflow_template_id` (UUID, FK → WorkflowTemplates.id, INDEXED)
- `resource_id` (UUID, INDEXED) - Polymorphic: LeaveRequest.id or Timesheet.id
- `resource_type` (ENUM: leave/timesheet, INDEXED)
- `current_step_order` (INTEGER, INDEXED)
- `status` (ENUM: Draft/Submitted/Under Review/Approved/Declined/Adjusted/Cancelled, INDEXED)
- `created_by` (UUID, FK → Users.id, INDEXED)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `locked_at` (TIMESTAMP, NULLABLE) - Transaction lock timestamp

**Indexes:**
- Primary: `id`
- Resource lookup: `(resource_type, resource_id)`
- Active workflows: `(status, current_step_order)`
- User workflows: `created_by`
- Lock status: `(id, locked_at)` for transaction locking

#### WorkflowStepInstances
- `id` (UUID, PK)
- `workflow_instance_id` (UUID, FK → WorkflowInstances.id, INDEXED)
- `step_order` (INTEGER, INDEXED)
- `status` (ENUM: pending/approved/declined/adjusted, INDEXED)
- `acted_by` (UUID, FK → Users.id, INDEXED)
- `delegated_from` (UUID, FK → Users.id, NULLABLE) - For delegation audit
- `acted_at` (TIMESTAMP, INDEXED)
- `comment` (TEXT)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Instance steps: `(workflow_instance_id, step_order)`
- Actor audit: `acted_by`
- Status tracking: `(workflow_instance_id, status)`

#### LeaveTypes
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE, INDEXED)
- `description` (TEXT)
- `is_paid` (BOOLEAN, DEFAULT true)
- `max_days_per_year` (INTEGER)
- `status` (ENUM: active/inactive, INDEXED)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Unique: `name`
- Active types: `status`

#### LeaveBalances
- `id` (UUID, PK)
- `user_id` (UUID, FK → Users.id, INDEXED)
- `leave_type_id` (UUID, FK → LeaveTypes.id, INDEXED)
- `year` (INTEGER, INDEXED)
- `allocated` (DECIMAL(10,2))
- `used` (DECIMAL(10,2))
- `pending` (DECIMAL(10,2))
- `updated_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- User balance: `(user_id, leave_type_id, year)` UNIQUE
- Year queries: `(year, leave_type_id)`

#### LeaveRequests
- `id` (UUID, PK)
- `user_id` (UUID, FK → Users.id, INDEXED)
- `leave_type_id` (UUID, FK → LeaveTypes.id, INDEXED)
- `start_date` (DATE, INDEXED)
- `end_date` (DATE, INDEXED)
- `days_requested` (DECIMAL(10,2))
- `reason` (TEXT)
- `status` (ENUM: Draft/Submitted/Under Review/Approved/Declined/Adjusted/Cancelled, INDEXED)
- `workflow_instance_id` (UUID, FK → WorkflowInstances.id, NULLABLE, INDEXED)
- `location_id` (UUID, FK → Locations.id, INDEXED)
- `created_at` (TIMESTAMP, INDEXED)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, NULLABLE, INDEXED)

**Indexes:**
- Primary: `id`
- User requests: `(user_id, status, deleted_at)`
- Date range: `(start_date, end_date)`
- Location scope: `location_id`
- Workflow link: `workflow_instance_id`
- Status filtering: `(status, deleted_at)`

#### Timesheets
- `id` (UUID, PK)
- `user_id` (UUID, FK → Users.id, INDEXED)
- `period_start` (DATE, INDEXED)
- `period_end` (DATE, INDEXED)
- `status` (ENUM: Draft/Submitted/Under Review/Approved/Declined/Locked, INDEXED)
- `workflow_instance_id` (UUID, FK → WorkflowInstances.id, NULLABLE, INDEXED)
- `location_id` (UUID, FK → Locations.id, INDEXED)
- `total_hours` (DECIMAL(10,2))
- `is_locked` (BOOLEAN, DEFAULT false, INDEXED)
- `locked_at` (TIMESTAMP, NULLABLE)
- `created_at` (TIMESTAMP, INDEXED)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, NULLABLE, INDEXED)

**Indexes:**
- Primary: `id`
- User timesheets: `(user_id, period_start, period_end)`
- Period lookup: `(period_start, period_end, status)`
- Location scope: `location_id`
- Lock status: `(is_locked, locked_at)`
- Workflow link: `workflow_instance_id`

#### TimesheetEntries
- `id` (UUID, PK)
- `timesheet_id` (UUID, FK → Timesheets.id, INDEXED)
- `date` (DATE, INDEXED)
- `hours` (DECIMAL(10,2))
- `description` (TEXT)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Timesheet entries: `timesheet_id`
- Date queries: `(timesheet_id, date)`

#### TimesheetPeriods
- `id` (UUID, PK)
- `period_start` (DATE, INDEXED)
- `period_end` (DATE, INDEXED)
- `is_locked` (BOOLEAN, DEFAULT false, INDEXED)
- `locked_at` (TIMESTAMP, NULLABLE)
- `locked_by` (UUID, FK → Users.id, NULLABLE)
- `created_at` (TIMESTAMP)

**Indexes:**
- Primary: `id`
- Period lookup: `(period_start, period_end)`
- Lock status: `(is_locked, locked_at)`

#### AuditLogs
- `id` (UUID, PK)
- `actor_id` (UUID, FK → Users.id, INDEXED)
- `action` (VARCHAR, INDEXED) - e.g., "leave.approve", "user.create"
- `resource_type` (VARCHAR, INDEXED)
- `resource_id` (UUID, INDEXED)
- `before_state` (JSONB)
- `after_state` (JSONB)
- `metadata` (JSONB) - Additional context (delegation info, IP, etc.)
- `ip_address` (INET, INDEXED)
- `timestamp` (TIMESTAMP, INDEXED)

**Indexes:**
- Primary: `id`
- Actor audit: `actor_id`
- Resource audit: `(resource_type, resource_id)`
- Action audit: `action`
- Time-based queries: `timestamp` (partitioned by month recommended)
- Composite: `(resource_type, resource_id, timestamp)` for resource history
- **Critical:** Use GIN index on JSONB columns for efficient queries

---

## REDIS ARCHITECTURE

### Caching Strategy

#### Session Management
- **Key Pattern:** `session:{user_id}:{token_hash}`
- **TTL:** 15 minutes (access token lifetime)
- **Value:** `{ user_id, email, roles[], permissions[], scopes[] }`

#### Permission Cache
- **Key Pattern:** `perms:{user_id}:{location_id}`
- **TTL:** 5 minutes
- **Value:** `{ permissions[], delegations[], effective_scopes[] }`
- **Invalidation:** On permission/role/scope/delegation changes

#### Workflow Lock Cache
- **Key Pattern:** `workflow:lock:{workflow_instance_id}`
- **TTL:** 30 seconds (transaction timeout)
- **Value:** `{ user_id, timestamp, action }`
- **Purpose:** Prevent concurrent approval attempts

#### Location Tree Cache
- **Key Pattern:** `location:tree:{location_id}`
- **TTL:** 1 hour
- **Value:** `{ ancestors[], descendants[], path }`
- **Invalidation:** On location tree mutations

#### Active Delegations Cache
- **Key Pattern:** `delegations:active:{delegate_user_id}`
- **TTL:** 1 minute
- **Value:** `{ delegations[] }`
- **Invalidation:** On delegation create/revoke/expire

---

## TRANSACTION-BASED APPROVAL LOCKING

### Implementation Strategy

**Goal:** Prevent race conditions in concurrent approval scenarios.

#### Database-Level Locking

```sql
-- Pseudo-code for approval transaction
BEGIN TRANSACTION;

-- 1. Acquire row-level lock on workflow instance
SELECT * FROM WorkflowInstances 
WHERE id = :instance_id 
FOR UPDATE NOWAIT;

-- 2. Verify lock status (check Redis for active locks)
-- 3. Set Redis lock with TTL
-- 4. Validate authority (permission + scope + delegation)
-- 5. Update workflow step instance
-- 6. Advance workflow state
-- 7. Update resource status if fully approved
-- 8. Create audit log entry
-- 9. Release Redis lock

COMMIT;
```

#### Redis Lock Pattern

```typescript
// Pseudo-code
const lockKey = `workflow:lock:${workflowInstanceId}`;
const lockValue = JSON.stringify({ userId, timestamp: Date.now(), action: 'approve' });

// Try to acquire lock (atomic operation)
const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');

if (!acquired) {
  throw new Error('Workflow instance is currently being processed by another user');
}

try {
  // Perform approval in database transaction
  await db.$transaction(async (tx) => {
    // ... approval logic
  });
} finally {
  // Always release lock
  await redis.del(lockKey);
}
```

#### Lock Validation Rules

1. **Database Row Lock:** `FOR UPDATE NOWAIT` prevents concurrent DB transactions
2. **Redis Distributed Lock:** Prevents concurrent API requests across instances
3. **Lock Timeout:** 30 seconds maximum (prevents deadlocks)
4. **Lock Owner:** Must match current user (prevents lock hijacking)
5. **Status Check:** Workflow must be in valid state for approval

---

## NEXT.JS API ARCHITECTURE

### Project Structure

```
hrapp/
├── app/
│   ├── api/                    # Next.js API Routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── refresh/
│   │   │   │   └── route.ts
│   │   │   └── logout/
│   │   │       └── route.ts
│   │   ├── users/
│   │   │   ├── route.ts         # GET, POST
│   │   │   └── [id]/
│   │   │       ├── route.ts     # GET, PATCH, DELETE
│   │   │       ├── roles/
│   │   │       │   └── route.ts
│   │   │       └── scopes/
│   │   │           └── route.ts
│   │   ├── roles/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── permissions/
│   │   │           └── route.ts
│   │   ├── workflows/
│   │   │   ├── templates/
│   │   │   │   └── route.ts
│   │   │   └── instances/
│   │   │       └── [id]/
│   │   │           ├── approve/
│   │   │           │   └── route.ts
│   │   │           ├── decline/
│   │   │           │   └── route.ts
│   │   │           └── adjust/
│   │   │               └── route.ts
│   │   └── ...
│   ├── lib/
│   │   ├── db/                  # Prisma client
│   │   │   └── index.ts
│   │   ├── redis/               # Redis client
│   │   │   └── index.ts
│   │   ├── auth/                # JWT utilities
│   │   │   └── index.ts
│   │   ├── middleware/          # Auth, permission, scope middleware
│   │   │   ├── auth.ts
│   │   │   ├── permissions.ts
│   │   │   └── scopes.ts
│   │   ├── services/            # Business logic
│   │   │   ├── authority.ts     # Authority resolution
│   │   │   ├── workflow.ts      # Workflow execution
│   │   │   ├── location.ts      # Location tree operations
│   │   │   └── audit.ts         # Audit logging
│   │   └── utils/
│   │       ├── errors.ts        # Error handling
│   │       └── validation.ts
│   ├── types/                   # TypeScript types
│   │   └── index.ts
│   └── prisma/
│       ├── schema.prisma        # Prisma schema
│       └── migrations/
├── Dockerfile
├── docker-compose.yml           # Local development
├── .env.example
├── package.json
└── tsconfig.json
```

### Next.js API Route Pattern

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const user = await authenticate(request);
    
    // 2. Check permission
    await requirePermission(user, 'users.read');
    
    // 3. Apply scope filtering
    const scopedUsers = await getScopedUsers(user.id);
    
    // 4. Return response
    return NextResponse.json({ data: scopedUsers });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    await requirePermission(user, 'users.create');
    
    const body = await request.json();
    const newUser = await prisma.user.create({
      data: { ...body }
    });
    
    return NextResponse.json({ data: newUser }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
```

### Next.js Configuration

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // API routes only (no pages)
  output: 'standalone', // For Docker optimization
  
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  
  // Experimental features
  experimental: {
    serverActions: false, // Use API routes only
  },
};

module.exports = nextConfig;
```

### Runtime Configuration

- **Node.js Version:** 18.x or 20.x (LTS)
- **Package Manager:** npm or pnpm
- **TypeScript:** Strict mode enabled
- **API Routes:** All routes in `app/api/` directory
- **Route Handlers:** Use Next.js 13+ App Router route handlers

---

## API ENDPOINT STRUCTURE

### Phase 1: Core Infrastructure

#### Authentication
- `POST /api/auth/login` - JWT access + refresh tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate tokens

#### Users
- `GET /api/users` - List (scope-filtered)
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Soft delete
- `PATCH /api/users/:id/location` - Assign primary location
- `POST /api/users/:id/roles` - Assign role
- `DELETE /api/users/:id/roles/:roleId` - Remove role

#### Permissions
- `GET /api/permissions` - List all permissions
- `GET /api/permissions/:id` - Get permission

#### Roles
- `GET /api/roles` - List roles
- `GET /api/roles/:id` - Get role
- `POST /api/roles` - Create role
- `PATCH /api/roles/:id` - Update role
- `POST /api/roles/:id/permissions` - Assign permission
- `DELETE /api/roles/:id/permissions/:permissionId` - Remove permission

#### Locations
- `GET /api/locations` - List (tree structure)
- `GET /api/locations/:id` - Get location
- `POST /api/locations` - Create location
- `PATCH /api/locations/:id` - Update location
- `PATCH /api/locations/:id/move` - Move location in tree
- `DELETE /api/locations/:id` - Disable location
- `GET /api/locations/:id/ancestors` - Get ancestors
- `GET /api/locations/:id/descendants` - Get descendants

### Phase 2: Scope Engine

#### User Permission Scopes
- `GET /api/users/:id/scopes` - Get user scopes
- `POST /api/users/:id/scopes` - Create scope
- `PATCH /api/users/:id/scopes/:scopeId` - Update scope
- `DELETE /api/users/:id/scopes/:scopeId` - Remove scope

### Phase 3: Delegation Engine

#### Delegations
- `GET /api/delegations` - List (filtered by delegator/delegate)
- `GET /api/delegations/:id` - Get delegation
- `POST /api/delegations` - Create delegation
- `PATCH /api/delegations/:id/revoke` - Revoke delegation
- `DELETE /api/delegations/:id` - Delete delegation

### Phase 4: Workflow Engine

#### Workflow Templates
- `GET /api/workflows/templates` - List templates
- `GET /api/workflows/templates/:id` - Get template
- `POST /api/workflows/templates` - Create template
- `PATCH /api/workflows/templates/:id` - Update template
- `POST /api/workflows/templates/:id/steps` - Add step
- `PATCH /api/workflows/templates/:id/steps/:stepId` - Update step
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove step

#### Workflow Instances
- `GET /api/workflows/instances` - List instances (scope-filtered)
- `GET /api/workflows/instances/:id` - Get instance
- `POST /api/workflows/instances` - Create instance
- `POST /api/workflows/instances/:id/approve` - Approve step (LOCKED)
- `POST /api/workflows/instances/:id/decline` - Decline step (LOCKED)
- `POST /api/workflows/instances/:id/adjust` - Request adjustment (LOCKED)
- `GET /api/workflows/instances/:id/history` - Get approval history

### Phase 5: Leave Module

#### Leave Types
- `GET /api/leave/types` - List leave types
- `GET /api/leave/types/:id` - Get leave type
- `POST /api/leave/types` - Create leave type
- `PATCH /api/leave/types/:id` - Update leave type

#### Leave Balances
- `GET /api/leave/balances` - List balances (scope-filtered)
- `GET /api/leave/balances/:id` - Get balance
- `PATCH /api/leave/balances/:id` - Update balance (admin only)

#### Leave Requests
- `GET /api/leave/requests` - List requests (scope-filtered)
- `GET /api/leave/requests/:id` - Get request
- `POST /api/leave/requests` - Create request (triggers workflow)
- `PATCH /api/leave/requests/:id` - Update request (only if Draft/Adjusted)
- `DELETE /api/leave/requests/:id` - Cancel request
- `GET /api/leave/requests/:id/workflow` - Get workflow status

### Phase 6: Timesheet Module

#### Timesheet Periods
- `GET /api/timesheets/periods` - List periods
- `GET /api/timesheets/periods/:id` - Get period
- `POST /api/timesheets/periods/:id/lock` - Lock period
- `POST /api/timesheets/periods/:id/unlock` - Unlock period

#### Timesheets
- `GET /api/timesheets` - List timesheets (scope-filtered)
- `GET /api/timesheets/:id` - Get timesheet
- `POST /api/timesheets` - Create timesheet
- `PATCH /api/timesheets/:id` - Update timesheet (only if Draft/Adjusted)
- `POST /api/timesheets/:id/submit` - Submit timesheet (triggers workflow)
- `GET /api/timesheets/:id/workflow` - Get workflow status
- `GET /api/timesheets/:id/pdf` - Generate PDF (only if Approved)

#### Timesheet Entries
- `GET /api/timesheets/:id/entries` - List entries
- `POST /api/timesheets/:id/entries` - Add entry
- `PATCH /api/timesheets/:id/entries/:entryId` - Update entry
- `DELETE /api/timesheets/:id/entries/:entryId` - Delete entry

### Phase 7: Reporting & Audit

#### Audit Logs
- `GET /api/audit/logs` - List logs (scope-filtered, paginated)
- `GET /api/audit/logs/:id` - Get log entry
- `GET /api/audit/resources/:type/:id` - Get resource audit history

#### Reports
- `GET /api/reports/leave/summary` - Leave summary (scope-filtered)
- `GET /api/reports/timesheets/summary` - Timesheet summary (scope-filtered)
- `GET /api/reports/approvals/pending` - Pending approvals (scope-filtered)

---

## MIDDLEWARE LAYER

### Authentication Middleware
```typescript
authenticate() {
  // 1. Extract JWT from Authorization header
  // 2. Verify token signature
  // 3. Check token expiration
  // 4. Load user from cache/DB
  // 5. Verify user status (active)
  // 6. Attach user to request context
}
```

### Permission Middleware
```typescript
requirePermission(permission: string) {
  // 1. Get user from request context
  // 2. Resolve effective permissions (roles + scopes + delegations)
  // 3. Check if permission exists in effective set
  // 4. If not, return 403 Forbidden
}
```

### Scope Middleware
```typescript
requireScope(locationId: string, permission: string) {
  // 1. Get user from request context
  // 2. Resolve scopes for permission
  // 3. Check if locationId matches scope (direct, descendant, or global)
  // 4. Check time validity (valid_from, valid_until)
  // 5. If not authorized, return 403 Forbidden
}
```

### Active User Middleware
```typescript
requireActiveUser() {
  // 1. Get user from request context
  // 2. Verify status === 'active'
  // 3. Verify deleted_at IS NULL
  // 4. If not active, return 403 Forbidden
}
```

---

## AUTHORITY RESOLUTION ALGORITHM

### Step-by-Step Resolution

```typescript
async function resolveAuthority(
  userId: string,
  permission: string,
  locationId: string
): Promise<boolean> {
  // 1. Check user is active
  const user = await getUser(userId);
  if (user.status !== 'active' || user.deleted_at) {
    return false;
  }

  // 2. Get user roles (cached)
  const roles = await getUserRoles(userId);
  const rolePermissions = await getRolePermissions(roles.map(r => r.id));
  
  // 3. Check if permission exists in role permissions
  if (!rolePermissions.includes(permission)) {
    return false; // No permission at all
  }

  // 4. Get active scopes for permission
  const scopes = await getUserPermissionScopes(userId, permission);
  const activeScopes = scopes.filter(s => 
    s.status === 'active' &&
    (!s.valid_from || s.valid_from <= now) &&
    (!s.valid_until || s.valid_until >= now)
  );

  // 5. Check location scope match
  const locationMatch = activeScopes.some(scope => {
    if (scope.is_global) return true;
    if (!scope.location_id) return false;
    if (scope.location_id === locationId) return true;
    if (scope.include_descendants) {
      return isDescendantOf(locationId, scope.location_id);
    }
    return false;
  });

  if (!locationMatch) {
    return false; // No scope match
  }

  // 6. Check active delegations (overlay)
  const delegations = await getActiveDelegations(userId, permission);
  const delegationMatch = delegations.some(del => {
    if (!del.location_id) return true; // Global delegation
    if (del.location_id === locationId) return true;
    if (del.include_descendants) {
      return isDescendantOf(locationId, del.location_id);
    }
    return false;
  });

  // Final authority = permission ∩ scope ∩ (delegation OR direct)
  return locationMatch || delegationMatch;
}
```

---

## WORKFLOW EXECUTION LOGIC

### Workflow Instance Creation

```typescript
async function createWorkflowInstance(
  resourceType: 'leave' | 'timesheet',
  resourceId: string,
  locationId: string
) {
  // 1. Find active workflow template for resource type + location
  const template = await findWorkflowTemplate(resourceType, locationId);
  if (!template) {
    throw new Error('No workflow template found for resource type and location');
  }

  // 2. Create workflow instance
  const instance = await db.workflowInstance.create({
    data: {
      workflow_template_id: template.id,
      resource_id: resourceId,
      resource_type: resourceType,
      current_step_order: 1,
      status: 'Draft',
      created_by: userId
    }
  });

  // 3. Create step instances for all steps
  const steps = await getWorkflowSteps(template.id);
  await Promise.all(steps.map(step => 
    db.workflowStepInstance.create({
      data: {
        workflow_instance_id: instance.id,
        step_order: step.step_order,
        status: step.step_order === 1 ? 'pending' : 'pending',
        acted_by: null,
        acted_at: null
      }
    })
  ));

  return instance;
}
```

### Approval Logic (Transaction-Locked)

```typescript
async function approveWorkflowStep(
  workflowInstanceId: string,
  userId: string,
  comment?: string
) {
  // 1. Acquire Redis lock
  const lockKey = `workflow:lock:${workflowInstanceId}`;
  const lockAcquired = await redis.set(lockKey, userId, 'EX', 30, 'NX');
  if (!lockAcquired) {
    throw new Error('Workflow instance is currently being processed');
  }

  try {
    // 2. Database transaction
    return await db.$transaction(async (tx) => {
      // 2a. Lock workflow instance row
      const instance = await tx.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
        include: { template: { include: { steps: true } } }
      });

      if (!instance || instance.status !== 'Under Review') {
        throw new Error('Invalid workflow state');
      }

      // 2b. Get current step
      const currentStep = instance.template.steps.find(
        s => s.step_order === instance.current_step_order
      );

      // 2c. Verify authority
      const hasAuthority = await resolveAuthority(
        userId,
        currentStep.required_permission,
        instance.resource.location_id
      );

      if (!hasAuthority) {
        throw new Error('Insufficient authority to approve this step');
      }

      // 2d. Update step instance
      await tx.workflowStepInstance.update({
        where: {
          workflow_instance_id_step_order: {
            workflow_instance_id: workflowInstanceId,
            step_order: instance.current_step_order
          }
        },
        data: {
          status: 'approved',
          acted_by: userId,
          acted_at: new Date(),
          comment: comment || null
        }
      });

      // 2e. Check if more steps
      const nextStep = instance.template.steps.find(
        s => s.step_order === instance.current_step_order + 1
      );

      if (nextStep) {
        // Move to next step
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            current_step_order: nextStep.step_order,
            status: 'Under Review'
          }
        });
      } else {
        // Workflow complete - approve resource
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            status: 'Approved'
          }
        });

        // Update resource status
        if (instance.resource_type === 'leave') {
          await tx.leaveRequest.update({
            where: { id: instance.resource_id },
            data: { status: 'Approved' }
          });
          // Update leave balance
          await updateLeaveBalance(instance.resource_id, tx);
        } else if (instance.resource_type === 'timesheet') {
          await tx.timesheet.update({
            where: { id: instance.resource_id },
            data: { status: 'Approved', is_locked: true, locked_at: new Date() }
          });
        }
      }

      // 2f. Create audit log
      await tx.auditLog.create({
        data: {
          actor_id: userId,
          action: 'workflow.approve',
          resource_type: 'workflow_instance',
          resource_id: workflowInstanceId,
          before_state: { status: instance.status, step: instance.current_step_order },
          after_state: { status: 'Approved', step: nextStep?.step_order },
          timestamp: new Date()
        }
      });

      return instance;
    });
  } finally {
    // 3. Release Redis lock
    await redis.del(lockKey);
  }
}
```

---

## LOCATION TREE MANAGEMENT

### Tree Integrity Rules

1. **No Circular References:** Enforced via CHECK constraint or application logic
2. **Parent Deletion:** Must handle children (reassign or prevent deletion)
3. **Path Materialization:** Use LTREE or materialized path for efficient queries
4. **Tree Validation:** Validate on every create/update/move operation

### Tree Operations

```typescript
// Move location in tree
async function moveLocation(locationId: string, newParentId: string | null) {
  return await db.$transaction(async (tx) => {
    // 1. Validate no circular reference
    if (newParentId) {
      const wouldCreateCycle = await isAncestorOf(newParentId, locationId);
      if (wouldCreateCycle) {
        throw new Error('Cannot move location: would create circular reference');
      }
    }

    // 2. Update parent
    await tx.location.update({
      where: { id: locationId },
      data: { parent_id: newParentId }
    });

    // 3. Recalculate paths for subtree (if using materialized path)
    await recalculatePaths(locationId, tx);

    // 4. Invalidate cache
    await invalidateLocationCache(locationId);
  });
}
```

---

## AUDIT LOGGING STRATEGY

### Audit Requirements

1. **All state transitions** must be logged
2. **All approvals** must record actor + delegation info
3. **All permission changes** must be logged
4. **All location tree mutations** must be logged
5. **Immutable logs** - never update or delete

### Audit Log Structure

```typescript
{
  actor_id: UUID,
  action: string, // e.g., "leave.approve", "user.create"
  resource_type: string, // e.g., "leave_request", "user"
  resource_id: UUID,
  before_state: JSONB, // Previous state snapshot
  after_state: JSONB, // New state snapshot
  metadata: JSONB, // Additional context:
  //   - delegation_info: { delegated_from: UUID }
  //   - ip_address: string
  //   - user_agent: string
  //   - location_id: UUID
  timestamp: TIMESTAMP
}
```

---

## PERFORMANCE OPTIMIZATION

### Database Indexing Strategy

1. **Primary Keys:** All tables use UUID primary keys
2. **Foreign Keys:** All FKs indexed for join performance
3. **Composite Indexes:** For common query patterns
4. **Partial Indexes:** For soft-delete filtering (`WHERE deleted_at IS NULL`)
5. **GIN Indexes:** For JSONB columns (audit logs, metadata)
6. **GIST Indexes:** For LTREE path columns (if using PostgreSQL LTREE)

### Query Optimization

1. **Eager Loading:** Use Prisma `include` to prevent N+1 queries
2. **Pagination:** All list endpoints support cursor/offset pagination
3. **Scope Filtering:** Apply location scope filters at database level
4. **Caching:** Cache permission/scope resolutions in Redis
5. **Connection Pooling:** Configure Prisma connection pool for DigitalOcean

### Redis Optimization

1. **Key Expiration:** Set appropriate TTLs for all cached data
2. **Cache Invalidation:** Invalidate on mutations (permission, role, scope changes)
3. **Pipeline Operations:** Batch Redis operations where possible
4. **Memory Management:** Monitor Redis memory usage

---

## ERROR HANDLING

### Error Categories

1. **Authentication Errors:** 401 Unauthorized
2. **Authorization Errors:** 403 Forbidden
3. **Validation Errors:** 400 Bad Request
4. **Not Found Errors:** 404 Not Found
5. **Conflict Errors:** 409 Conflict (e.g., concurrent approval)
6. **Server Errors:** 500 Internal Server Error

### Error Response Format

```json
{
  "error": {
    "code": "WORKFLOW_LOCKED",
    "message": "Workflow instance is currently being processed by another user",
    "details": {
      "workflow_instance_id": "uuid",
      "locked_by": "user_id",
      "retry_after": 30
    }
  }
}
```

---

## TESTING STRATEGY

### Unit Tests
- Authority resolution logic
- Workflow state transitions
- Location tree operations
- Permission/scope calculations

### Integration Tests
- API endpoint authorization
- Workflow execution flows
- Transaction locking behavior
- Cache invalidation

### Stress Tests
- Concurrent approval attempts
- Location tree mutations during active workflows
- Workflow template changes with running instances
- Delegation expiry during approval
- Massive scope overlap scenarios

---

## DOCKER CONTAINERIZATION

### Dockerfile

```dockerfile
# Multi-stage build for optimized production image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose (Local Development)

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

### .dockerignore

```
node_modules
.next
.git
.gitignore
.env*.local
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
README.md
.dockerignore
Dockerfile
docker-compose.yml
```

### Docker Build & Run

```bash
# Build image
docker build -t hrapp-api:latest .

# Run container
docker run -d \
  --name hrapp-api \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  hrapp-api:latest

# Or use docker-compose
docker-compose up -d
```

### Production Deployment

#### DigitalOcean App Platform

1. **Connect Repository:** Link GitHub/GitLab repository
2. **Build Settings:**
   - Build Command: `npm run build`
   - Run Command: `node server.js`
   - Dockerfile: Use provided Dockerfile
3. **Environment Variables:** Set all required env vars
4. **Database:** Connect DigitalOcean Managed PostgreSQL
5. **Redis:** Use DigitalOcean Managed Redis or external Redis service
6. **Scaling:** Configure horizontal scaling based on load

#### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hrapp-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hrapp-api
  template:
    metadata:
      labels:
        app: hrapp-api
    spec:
      containers:
      - name: api
        image: hrapp-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hrapp-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: hrapp-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Container Optimization

1. **Multi-stage Build:** Reduces final image size
2. **Alpine Base:** Minimal base image for smaller footprint
3. **Standalone Output:** Next.js standalone mode for optimal Docker deployment
4. **Layer Caching:** Optimize Dockerfile layer order for better caching
5. **Health Checks:** Built-in health check endpoints
6. **Non-root User:** Run container as non-root user for security

---

## DEPLOYMENT CONSIDERATIONS

### DigitalOcean Managed DB

1. **Connection String:** Use connection pooling
2. **Read Replicas:** Configure for read-heavy operations (reports, audits)
3. **Backup Strategy:** Automated daily backups
4. **Monitoring:** Set up alerts for connection pool exhaustion, slow queries

### Environment Variables

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=production
LOG_LEVEL=info
```

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity
- `GET /health/redis` - Redis connectivity

---

## PHASE IMPLEMENTATION ORDER

1. **Phase 0:** Define invariants (documentation)
2. **Phase 1:** Core infrastructure (auth, users, permissions, roles, locations)
3. **Phase 2:** Scope engine (user permission scopes)
4. **Phase 3:** Delegation engine
5. **Phase 4:** Workflow engine
6. **Phase 5:** Leave module
7. **Phase 6:** Timesheet module
8. **Phase 7:** Reporting & audit
9. **Phase 8:** Stress testing & edge case validation

---

## SUCCESS CRITERIA

### Phase 1
- ✅ Login/authentication works
- ✅ Roles assignable to users
- ✅ Permissions dynamic (not hardcoded)
- ✅ Location tree mutable with integrity
- ✅ Permission middleware blocks unauthorized access

### Phase 2
- ✅ Multi-region authority works
- ✅ Subtree inheritance works
- ✅ Expired scope blocks access
- ✅ Multiple scopes merge correctly

### Phase 3
- ✅ Temporary delegation works
- ✅ Resource-specific delegation works
- ✅ Expiry works automatically
- ✅ Revocation works immediately

### Phase 4
- ✅ Ordered approval enforced
- ✅ No step skipping
- ✅ Workflow version isolation
- ✅ Adjustment loop works

### Phase 5
- ✅ Balance validation
- ✅ Cross-region approval
- ✅ Adjustment preserves audit
- ✅ Reporting respects scope

### Phase 6
- ✅ Period locking works
- ✅ Cross-region approval works
- ✅ Document locking enforced

### Phase 7
- ✅ Scope-filtered reports
- ✅ Immutable audit
- ✅ Approval timeline reconstructable

### Phase 8
- ✅ Race condition safe (concurrent approvals)
- ✅ Location moved mid-workflow → authority recalculated
- ✅ Workflow template changed → old instances unaffected
- ✅ Delegation expires mid-approval → next action blocked
- ✅ Massive scope overlap → correct union behavior

---

## FINAL DEFINITION OF DONE

System is production-ready when:

1. ✅ No approval can bypass workflow
2. ✅ No user can act outside scoped regions
3. ✅ Delegations auto-expire safely
4. ✅ Location restructuring does not break authority
5. ✅ All transitions auditable
6. ✅ No hardcoded logic anywhere
7. ✅ All indexes optimized for query patterns
8. ✅ Transaction locking prevents race conditions
9. ✅ Redis caching improves performance
10. ✅ All edge cases tested and handled

---

**Document Version:** 1.1  
**Last Updated:** 2025-01-27  
**Maintained By:** Development Team  
**Changes:** Added Next.js API architecture, Docker containerization, and confirmed dynamic configuration principles
