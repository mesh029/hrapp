# PATH HR System - Comprehensive Implementation Guide

**Purpose:** Step-by-step implementation guide covering code structure, Docker setup, business logic, and testing strategy.

**Based On:** PATH_COMPREHENSIVE_API_DESIGN.md and IMPLEMENTATION_PLAN.md

---

## TABLE OF CONTENTS

1. [Phased Implementation Plan](#phased-implementation-plan) ⭐ **START HERE**
2. [Project Setup & Structure](#project-setup--structure)
3. [Docker Configuration](#docker-configuration)
4. [Database Setup & Migrations](#database-setup--migrations)
5. [Core Business Logic Implementation](#core-business-logic-implementation)
6. [API Endpoint Implementation](#api-endpoint-implementation)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Guide](#deployment-guide)

---

## 🧭 QUICK REFERENCE

**Before starting any phase, check:** `SYSTEM_COMPASS.md` - Your implementation compass with critical principles, dynamic elements, and enforcement rules.

---

---

## PHASED IMPLEMENTATION PLAN

**Purpose:** Strategic implementation guide serving as a rulebook for building the PATH HR System API. Reference this document for direction and flow.

**Core Principles:**
- ✅ **Build Incrementally:** Complete and test each phase before proceeding
- ✅ **Dynamic First:** All configurations must be database-driven, zero hardcoded logic
- ✅ **Test Continuously:** Verify functionality after each implementation
- ✅ **Document As You Go:** Keep API documentation updated

---

### Phase 0: Foundation & Infrastructure

**Goal:** Establish development environment and project foundation

**Flow:**
1. Initialize Next.js project with TypeScript
2. Install core dependencies (Prisma, Redis, JWT, bcrypt, zod)
3. Set up Docker environment (PostgreSQL + Redis containers)
4. Initialize Prisma and configure database connection
5. Establish project structure (services, middleware, API routes)
6. Configure TypeScript paths and development tools

**Key Decisions:**
- Use Next.js API Routes (not Server Actions) for explicit control
- Prisma for database ORM with PostgreSQL
- Redis for caching and session management
- JWT for authentication (access + refresh tokens)

**Validation:**
- Database connection successful
- Redis connection successful
- Project structure established
- TypeScript compilation works

---

### Phase 1: Database Schema & Authentication

**Goal:** Establish data foundation and secure access layer

**Flow:**
1. Design Prisma schema for core entities (users, roles, permissions, locations, staff_types)
2. Implement database connection service (singleton pattern)
3. Implement Redis connection service (with reconnection handling)
4. Build authentication middleware (JWT verification, user validation)
5. Create auth endpoints (login, refresh, logout)
6. Develop seed script (admin user, default roles/permissions, PATH locations)

**Critical Schema Decisions:**
- Use UUIDs for all primary keys
- Implement soft deletes (deleted_at timestamps)
- Add indexes on foreign keys and frequently queried fields
- Use hierarchical path pattern for locations (materialized path)
- Store password hashes (bcrypt) not plaintext

**Authentication Strategy:**
- Access tokens (short-lived, 15-30 min)
- Refresh tokens (long-lived, 7 days, stored in Redis)
- Token invalidation on logout
- User status validation (active/inactive)

**Validation:**
- Login returns valid JWT tokens
- Protected routes require valid token
- Token refresh works correctly
- Seed data creates usable admin account

---

### Phase 2: Core Entity Management

**Goal:** Build foundation for users, roles, permissions, and locations

**Flow:**
1. Implement permission middleware (check user permissions + location scope)
2. Build user management endpoints (CRUD + role assignment + scope management)
3. Build role management endpoints (CRUD + permission assignment)
4. Build permission endpoints (read-only, permissions are predefined)
5. Build location management endpoints (CRUD + tree operations)
6. Create location service (tree building, hierarchy validation, path resolution)

**Permission Model:**
- Permissions are atomic actions (e.g., `leave.approve`, `users.create`)
- Roles are collections of permissions
- Users can have multiple roles (union of permissions)
- User scopes define location boundaries for permissions
- Permission checks: User has permission + permission scope includes location

**Location Hierarchy:**
- Materialized path pattern for efficient queries
- Support for moving locations in tree
- Ancestor/descendant queries for scope resolution
- Validate tree integrity on create/update/move

**Key Endpoints:**
- Users: CRUD, role assignment, scope management
- Roles: CRUD, permission assignment
- Permissions: List and read (no create/update - predefined)
- Locations: CRUD, tree operations, hierarchy queries

**Validation:**
- Can create user and assign roles
- Permission checks enforce location scope
- Location tree operations work correctly
- All endpoints respect permission requirements

---

### Phase 3: Dynamic Configuration

**Goal:** Enable runtime configuration of staff types, leave types, and work hours

**Flow:**
1. Extend Prisma schema (staff_types, leave_types, work_hours_configurations tables)
2. Build staff type management endpoints (CRUD operations)
3. Build leave type management endpoints (CRUD with parameters: is_paid, accrual_rate, max_balance)
4. Build work hours configuration endpoints (support per staff type and per location)
5. Create work hours calculation service
6. Create leave type validation service

**Key Design Decisions:**
- Staff types are fully dynamic (can create any type at runtime)
- Leave types support configurable parameters (paid/unpaid, accrual rates, max balances)
- Work hours can be configured per staff type OR per location (priority: location > staff type)
- All configurations stored in database, zero hardcoded values

**Validation:**
- Can create/modify/delete all configuration types
- Work hours calculation uses correct configuration
- Leave type parameters enforced correctly
- No hardcoded business rules

---

### Phase 4: Workflow Engine

**Goal:** Build fully dynamic workflow system with zero hardcoded sequences

**Flow:**
1. Extend Prisma schema (workflow_templates, workflow_template_steps, workflow_instances, workflow_approvals)
2. Build authority resolution service (multi-layer: Permission ∩ Location Scope ∩ Delegation ∩ Workflow Step)
3. Build workflow template management endpoints (CRUD + step management + reordering)
4. Build workflow execution service (instance creation, approver resolution, state transitions)
5. Build workflow instance endpoints (approve, decline, adjust with routing options)
6. Implement digital signature generation (JWT-based with timestamps, IP, user agent)
7. Create seed data for default templates (examples only, fully modifiable)

**Critical Requirements:**
- **NO hardcoded workflows** - All sequences must be database-driven
- **NO fixed starting points** - First step can be any role/permission
- **Complete flexibility** - Add/remove/reorder steps at runtime
- **Version isolation** - Template changes don't affect running instances
- **Dynamic approver resolution** - Based on permissions, roles, and location scope

**Workflow State Model:**
- Draft → Submitted → Under Review → Approved | Declined | Adjusted | Cancelled
- Adjust can route back to any step or to employee
- Each approval generates digital signature with timestamp

**Validation:**
- Can create template with any roles in any order
- Can modify/delete any step including first step
- Approvers resolved dynamically (not hardcoded)
- Digital signatures generated for all approvals
- State transitions follow defined model

---

### Phase 5: Leave Management

**Goal:** Implement leave request system integrated with workflow engine

**Flow:**
1. Extend Prisma schema (leave_requests, leave_balances, leave_balance_transactions)
2. Build leave balance service (calculation, accrual logic, balance updates)
3. Build leave request endpoints (CRUD, submit for approval)
4. Build leave balance endpoints (view, manual adjustments)
5. Integrate with workflow engine (create instance on submit, update balance on approval)
6. Implement balance calculation logic (accrual rates, max limits, used vs. available)

**Integration Points:**
- Submit creates workflow instance using location-specific template
- Each approval step validates balance availability
- Final approval updates leave balance and marks request approved
- Approved requests trigger timesheet integration (Phase 6)

**Balance Logic:**
- Calculate based on leave type accrual rate
- Enforce max balance limits per leave type
- Track transaction history for audit
- Support manual adjustments (admin only)

**Validation:**
- Leave requests follow workflow correctly
- Balance calculations accurate
- Balance updates on approval
- Integration with workflow engine works

---

### Phase 6: Timesheet Management

**Goal:** Build timesheet system with leave integration and PDF generation

**Flow:**
1. Extend Prisma schema (timesheet_periods, timesheets, timesheet_entries)
2. Build timesheet period service (period creation, locking/unlocking)
3. Build timesheet period endpoints (CRUD, lock/unlock operations)
4. Build timesheet endpoints (CRUD, entry management, submit, download PDF)
5. Implement leave-to-timesheet integration (auto-add approved leaves)
6. Build timesheet calculation service (total hours, validation, PDF generation)
7. Integrate with workflow engine (create instance on submit, signatures on approval)

**Leave Integration Logic:**
- When leave request approved, automatically create timesheet entry
- Entry labeled with leave type name
- Hours calculated from work hours configuration
- Entry linked to leave request for traceability

**Timesheet Calculation:**
- Sum all entries (work + leave + holidays)
- Validate against work hours configuration
- Calculate expected vs. actual hours
- Generate PDF with all entries and approval signatures

**Period Management:**
- Monthly periods created automatically or manually
- Locked periods prevent further edits
- Unlock requires admin permission

**Validation:**
- Approved leaves appear in timesheets automatically
- Total hours calculated correctly
- PDF includes all signatures
- Period locking prevents unauthorized edits

---

### Phase 7: Delegation System

**Goal:** Enable temporary authority transfer for unavailable approvers

**Flow:**
1. Extend Prisma schema (delegations table)
2. Build delegation service (validation, time checks, scope validation)
3. Build delegation endpoints (CRUD, revoke operations)
4. Update authority resolution service to include delegation checks
5. Implement admin delegation (system admin can delegate on behalf of users)

**Delegation Model:**
- Time-bound (valid_from, valid_until)
- Permission-specific (e.g., leave.approve, timesheet.approve)
- Location-scoped (can include descendants)
- Status tracking (active, revoked, expired)
- Self-delegation or admin delegation

**Authority Integration:**
- Delegations act as temporary overlays on permissions
- Authority check: Direct Permission OR Active Delegation
- Delegation must be valid (time, scope, status)
- Delegated approvals logged with delegation context

**Validation:**
- Delegation grants temporary authority correctly
- Delegation expires automatically after valid_until
- Scope validation works (location hierarchy)
- Authority resolution includes delegations

---

### Phase 8: Notifications & Audit

**Goal:** Implement notification system and comprehensive audit logging

**Flow:**
1. Extend Prisma schema (notifications, audit_logs tables)
2. Build notification service (create, send email, mark as read)
3. Build notification endpoints (list, read, delete operations)
4. Build audit log service (log all state changes, support filtering)
5. Build audit log endpoints (list with filters, view details)
6. Integrate notifications into workflow events
7. Integrate audit logging into all state-changing operations

**Notification Triggers:**
- Workflow step assignment (notify approver)
- Approval/decline actions (notify requester and next approver)
- Leave/timesheet approval (notify all stakeholders)
- Critical system events (email notifications)

**Audit Logging Requirements:**
- Log all workflow actions (approve, decline, adjust)
- Log all leave/timesheet state changes
- Log all user/role/permission changes
- Log all configuration changes
- Support filtering by user, action, resource, date range

**Validation:**
- Notifications created for all relevant events
- Email notifications sent (if SMTP configured)
- Audit logs capture all state changes
- Audit trail is complete and searchable

---

### Phase 9: Reporting & Dashboards

**Goal:** Build reporting and analytics system for insights

**Flow:**
1. Build reporting service (calculations, aggregations, filtering)
2. Build reporting endpoints (leave utilization, balance reports, timesheet summaries)
3. Build dashboard data aggregation (by location, staff type, time period)
4. Implement caching strategy (Redis for dashboard data)
5. Build export functionality (CSV, PDF exports)

**Report Types:**
- Leave utilization (by location, staff type, time period)
- Leave balance summaries
- Timesheet summaries and statistics
- Pending approvals dashboard
- Regional dashboard data (aggregated metrics)

**Performance Considerations:**
- Cache dashboard data in Redis (TTL-based)
- Use database aggregations for calculations
- Support pagination for large datasets
- Optimize queries with proper indexes

**Validation:**
- Reports return accurate data
- Dashboard aggregations correct
- Export functionality works
- Caching improves performance

---

### Phase 10: Testing, Optimization & Documentation

**Goal:** Ensure system quality, performance, and maintainability

**Flow:**
1. Write integration tests (complete workflows, edge cases, error scenarios)
2. Performance optimization (database indexes, query optimization, Redis caching)
3. Error handling standardization (consistent error responses, proper codes)
4. API documentation (endpoints, examples, error codes)
5. Security review (auth/authorization, input validation, XSS prevention)
6. Load testing (concurrent requests, performance bottlenecks)
7. Final validation checklist

**Testing Strategy:**
- Integration tests for complete workflows
- Test leave → approval → timesheet flow end-to-end
- Test delegation scenarios
- Test error handling and edge cases
- Test all dynamic configuration scenarios

**Optimization Areas:**
- Database indexes on foreign keys and frequently queried fields
- Prisma select to limit data fetched
- Redis caching for permissions, dashboard data
- Connection pooling for database
- Query optimization (avoid N+1 queries)

**Documentation Requirements:**
- All endpoints documented with request/response examples
- Error codes and meanings documented
- Postman collection for easy testing
- Architecture decisions documented

**Final Validation:**
- All endpoints functional
- Zero hardcoded workflows or business logic
- All configurations database-driven
- Digital signatures working
- Notifications and audit logs complete
- Performance acceptable
- Security reviewed

---

## Implementation Summary

**Phase Sequence:**
0. Foundation → 1. Auth & Schema → 2. Core Entities → 3. Dynamic Config → 4. Workflow Engine → 5. Leave Management → 6. Timesheet Management → 7. Delegation → 8. Notifications & Audit → 9. Reporting → 10. Testing & Optimization

**Critical Success Factors:**
1. ✅ **No Hardcoded Workflows** - All workflows must be database-driven, zero assumptions about sequences
2. ✅ **Dynamic Configuration** - All configs must be changeable at runtime (staff types, leave types, work hours, workflows)
3. ✅ **Test Continuously** - Validate functionality after each phase before proceeding
4. ✅ **Document As You Go** - Keep API documentation updated during development
5. ✅ **Incremental Development** - Build and test incrementally, don't skip phases

**Key Architectural Principles:**
- **Authority Formula:** Permission ∩ Location Scope ∩ Delegation ∩ Workflow Step Eligibility ∩ Active Status
- **Workflow Flexibility:** Any role can be first step, any number of steps, fully configurable
- **Version Isolation:** Template changes don't affect running workflow instances
- **Audit Trail:** All state changes must be logged
- **Soft Deletes:** Never hard delete core entities (users, locations, permissions)

---

## PROJECT SETUP & STRUCTURE

### Initial Project Setup

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest hrapp --typescript --tailwind --app --no-src-dir --import-alias "@/*"

cd hrapp

# Install core dependencies
npm install @prisma/client prisma
npm install redis ioredis
npm install jsonwebtoken bcryptjs
npm install zod date-fns
npm install @types/jsonwebtoken @types/bcryptjs --save-dev

# Install development dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next
npm install -D prettier
```

### Project Directory Structure

```
hrapp/
├── app/
│   ├── api/                          # Next.js API Routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── refresh/
│   │   │   │   └── route.ts
│   │   │   └── logout/
│   │   │       └── route.ts
│   │   ├── users/
│   │   │   ├── route.ts              # GET, POST
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET, PATCH, DELETE
│   │   │       ├── roles/
│   │   │       │   └── route.ts
│   │   │       └── scopes/
│   │   │           └── route.ts
│   │   ├── roles/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── permissions/
│   │   │           └── route.ts
│   │   ├── locations/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── move/
│   │   │           └── route.ts
│   │   ├── workflows/
│   │   │   ├── templates/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   └── instances/
│   │   │       └── [id]/
│   │   │           ├── approve/
│   │   │           │   └── route.ts
│   │   │           ├── decline/
│   │   │           │   └── route.ts
│   │   │           └── adjust/
│   │   │               └── route.ts
│   │   ├── leave/
│   │   │   ├── types/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── requests/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── submit/
│   │   │   │           └── route.ts
│   │   │   └── balances/
│   │   │       └── route.ts
│   │   ├── timesheets/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── submit/
│   │   │   │   │   └── route.ts
│   │   │   │   └── pdf/
│   │   │   │       └── route.ts
│   │   │   └── periods/
│   │   │       └── [id]/
│   │   │           ├── lock/
│   │   │           │   └── route.ts
│   │   │           └── unlock/
│   │   │               └── route.ts
│   │   ├── delegations/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   └── config/
│   │       └── work-hours/
│   │           ├── route.ts
│   │           └── [id]/
│   │               └── route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   └── index.ts              # Prisma client singleton
│   │   ├── redis/
│   │   │   └── index.ts              # Redis client singleton
│   │   ├── auth/
│   │   │   ├── jwt.ts                # JWT utilities
│   │   │   └── password.ts           # Password hashing
│   │   ├── middleware/
│   │   │   ├── auth.ts               # Authentication middleware
│   │   │   ├── permissions.ts        # Permission checking
│   │   │   └── scopes.ts             # Scope filtering
│   │   ├── services/
│   │   │   ├── authority.ts          # Authority resolution engine
│   │   │   ├── workflow.ts           # Workflow execution engine
│   │   │   ├── location.ts           # Location tree operations
│   │   │   ├── delegation.ts         # Delegation resolution
│   │   │   ├── leave.ts              # Leave management logic
│   │   │   ├── timesheet.ts          # Timesheet management logic
│   │   │   └── audit.ts              # Audit logging
│   │   └── utils/
│   │       ├── errors.ts             # Error handling utilities
│   │       ├── validation.ts         # Zod schemas
│   │       └── responses.ts          # Standardized API responses
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### Package.json Configuration

```json
{
  "name": "hrapp",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@prisma/client": "^5.7.0",
    "prisma": "^5.7.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.22.4",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "eslint-config-next": "^14.0.0",
    "prettier": "^3.1.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Next.js Configuration

```javascript
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
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  },
  
  // Experimental features
  experimental: {
    serverActions: false, // Use API routes only
  },
};

module.exports = nextConfig;
```

---

## DOCKER CONFIGURATION

### Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set permissions
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: hrapp-postgres
    environment:
      POSTGRES_USER: hrapp_user
      POSTGRES_PASSWORD: hrapp_password
      POSTGRES_DB: hrapp_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hrapp_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: hrapp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Next.js API Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hrapp-api
    environment:
      DATABASE_URL: postgresql://hrapp_user:hrapp_password@postgres:5432/hrapp_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-change-me-in-production}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./prisma:/app/prisma
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### .env.example

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hrapp_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (generate strong secrets in production)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"

# JWT Expiration (in seconds)
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800

# Application
NODE_ENV="development"
PORT=3000

# Email (for notifications)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="noreply@example.com"
SMTP_PASSWORD="smtp-password"
SMTP_FROM="PATH HR System <noreply@example.com>"
```

### Docker Build & Run Commands

```bash
# Build Docker image
docker build -t hrapp-api .

# Run with docker-compose (development)
docker-compose up -d

# Run migrations in container
docker-compose exec app npx prisma migrate deploy

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## DATABASE SETUP & MIGRATIONS

### Prisma Schema Setup

Create `app/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum UserStatus {
  active
  suspended
  deactivated
}

enum RoleStatus {
  active
  inactive
}

enum LocationStatus {
  active
  inactive
}

enum ScopeStatus {
  active
  inactive
}

enum DelegationStatus {
  active
  revoked
  expired
}

enum WorkflowTemplateStatus {
  active
  deprecated
}

enum WorkflowStatus {
  Draft
  Submitted
  UnderReview
  Approved
  Declined
  Adjusted
  Cancelled
}

enum WorkflowStepStatus {
  pending
  approved
  declined
  adjusted
}

enum ResourceType {
  leave
  timesheet
}

enum LeaveTypeStatus {
  active
  inactive
}

enum TimesheetStatus {
  Draft
  Submitted
  UnderReview
  Approved
  Declined
  Locked
}

// Core Models
model User {
  id                String       @id @default(uuid())
  name              String
  email             String       @unique
  password_hash     String
  status            UserStatus   @default(active)
  primary_location_id String?    @db.Uuid
  primary_location  Location?    @relation("UserPrimaryLocation", fields: [primary_location_id], references: [id])
  deleted_at        DateTime?
  created_at        DateTime     @default(now())
  updated_at        DateTime     @updatedAt

  // Relations
  user_roles        UserRole[]
  user_scopes       UserPermissionScope[]
  delegations_as_delegator Delegation[] @relation("Delegator")
  delegations_as_delegate Delegation[] @relation("Delegate")
  workflow_instances_created WorkflowInstance[]
  workflow_step_instances_acted WorkflowStepInstance[]
  leave_requests    LeaveRequest[]
  leave_balances    LeaveBalance[]
  timesheets        Timesheet[]
  audit_logs        AuditLog[]

  @@index([status, deleted_at])
  @@index([primary_location_id])
  @@index([email])
  @@map("users")
}

model Permission {
  id          String   @id @default(uuid())
  name        String   @unique // e.g., "leave.approve"
  module      String
  description String?
  created_at  DateTime @default(now())

  role_permissions RolePermission[]
  user_scopes      UserPermissionScope[]
  delegations      Delegation[]

  @@index([module, name])
  @@map("permissions")
}

model Role {
  id          String     @id @default(uuid())
  name        String     @unique
  description String?
  status      RoleStatus @default(active)
  created_at  DateTime   @default(now())
  updated_at  DateTime   @updatedAt

  role_permissions RolePermission[]
  user_roles       UserRole[]

  @@index([status])
  @@map("roles")
}

model RolePermission {
  role_id       String     @id
  permission_id String     @id
  created_at    DateTime   @default(now())

  role       Role       @relation(fields: [role_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)

  @@map("role_permissions")
}

model UserRole {
  user_id    String    @id
  role_id    String    @id
  created_at DateTime  @default(now())
  deleted_at DateTime?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@index([user_id], where: { deleted_at: null })
  @@index([role_id], where: { deleted_at: null })
  @@map("user_roles")
}

model Location {
  id        String         @id @default(uuid())
  name      String
  parent_id String?        @db.Uuid
  parent    Location?       @relation("LocationTree", fields: [parent_id], references: [id])
  children  Location[]      @relation("LocationTree")
  status    LocationStatus @default(active)
  path      String         // Materialized path: "1.2.3"
  level     Int            @default(0)
  created_at DateTime     @default(now())
  updated_at DateTime      @updatedAt

  // Relations
  users_primary User[]      @relation("UserPrimaryLocation")
  user_scopes  UserPermissionScope[]
  delegations  Delegation[]
  workflow_templates WorkflowTemplate[]
  leave_requests LeaveRequest[]
  timesheets     Timesheet[]
  work_hours_configs WorkHoursConfig[]

  @@index([parent_id])
  @@index([status, parent_id])
  @@index([path])
  @@map("locations")
}

model UserPermissionScope {
  id                 String      @id @default(uuid())
  user_id            String
  permission_id      String
  location_id        String?     @db.Uuid
  include_descendants Boolean    @default(false)
  is_global          Boolean     @default(false)
  valid_from         DateTime
  valid_until        DateTime?
  status             ScopeStatus @default(active)
  created_at         DateTime    @default(now())

  user       User       @relation(fields: [user_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)
  location   Location?  @relation(fields: [location_id], references: [id], onDelete: Cascade)

  @@index([user_id, permission_id, status])
  @@index([permission_id, status, valid_from, valid_until])
  @@index([location_id, include_descendants], where: { location_id: { not: null } })
  @@index([is_global, status], where: { is_global: true })
  @@map("user_permission_scopes")
}

model Delegation {
  id                 String           @id @default(uuid())
  delegator_user_id  String
  delegate_user_id   String
  permission_id      String
  location_id        String?          @db.Uuid
  include_descendants Boolean         @default(false)
  valid_from         DateTime
  valid_until        DateTime
  status             DelegationStatus @default(active)
  revoked_at         DateTime?
  created_at         DateTime         @default(now())

  delegator  User       @relation("Delegator", fields: [delegator_user_id], references: [id], onDelete: Cascade)
  delegate  User       @relation("Delegate", fields: [delegate_user_id], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)
  location  Location?  @relation(fields: [location_id], references: [id], onDelete: Cascade)

  @@index([delegate_user_id, permission_id, status])
  @@index([status, valid_from, valid_until])
  @@index([delegator_user_id])
  @@map("delegations")
}

model WorkflowTemplate {
  id           String                 @id @default(uuid())
  name         String
  resource_type ResourceType
  location_id  String
  version      Int                    @default(1)
  status       WorkflowTemplateStatus @default(active)
  created_at   DateTime               @default(now())

  location Location           @relation(fields: [location_id], references: [id], onDelete: Cascade)
  steps    WorkflowStep[]
  instances WorkflowInstance[]

  @@index([resource_type, location_id, status])
  @@index([id, version])
  @@map("workflow_templates")
}

model WorkflowStep {
  id                  String   @id @default(uuid())
  workflow_template_id String
  step_order          Int
  required_permission String
  allow_decline       Boolean  @default(true)
  allow_adjust        Boolean  @default(false)
  created_at          DateTime @default(now())

  template WorkflowTemplate @relation(fields: [workflow_template_id], references: [id], onDelete: Cascade)

  @@unique([workflow_template_id, step_order])
  @@index([required_permission])
  @@map("workflow_steps")
}

model WorkflowInstance {
  id                String         @id @default(uuid())
  workflow_template_id String
  resource_id        String
  resource_type      ResourceType
  current_step_order Int            @default(0)
  status             WorkflowStatus @default(Draft)
  created_by         String
  created_at         DateTime       @default(now())
  updated_at         DateTime       @updatedAt
  locked_at          DateTime?

  template WorkflowTemplate      @relation(fields: [workflow_template_id], references: [id], onDelete: Cascade)
  creator  User                  @relation(fields: [created_by], references: [id], onDelete: Cascade)
  steps    WorkflowStepInstance[]

  @@index([resource_type, resource_id])
  @@index([status, current_step_order])
  @@index([created_by])
  @@index([id, locked_at])
  @@map("workflow_instances")
}

model WorkflowStepInstance {
  id                 String             @id @default(uuid())
  workflow_instance_id String
  step_order         Int
  status             WorkflowStepStatus @default(pending)
  acted_by           String?
  delegated_from     String?            @db.Uuid
  acted_at           DateTime?
  comment            String?
  digital_signature  String?            // JWT signature
  signature_hash     String?
  ip_address         String?
  user_agent         String?
  created_at         DateTime           @default(now())

  workflow_instance WorkflowInstance @relation(fields: [workflow_instance_id], references: [id], onDelete: Cascade)
  actor             User?             @relation(fields: [acted_by], references: [id])

  @@index([workflow_instance_id, step_order])
  @@index([acted_by])
  @@index([workflow_instance_id, status])
  @@map("workflow_step_instances")
}

model LeaveType {
  id              String          @id @default(uuid())
  name            String          @unique
  description     String?
  is_paid         Boolean         @default(true)
  max_days_per_year Int?
  accrual_rule    String?        // JSON: { type: "monthly", days: 1.25 }
  status          LeaveTypeStatus @default(active)
  created_at      DateTime        @default(now())

  leave_balances LeaveBalance[]
  leave_requests LeaveRequest[]

  @@index([status])
  @@map("leave_types")
}

model LeaveBalance {
  id          String   @id @default(uuid())
  user_id     String
  leave_type_id String
  year        Int
  allocated   Decimal  @db.Decimal(10, 2) @default(0)
  used        Decimal  @db.Decimal(10, 2) @default(0)
  pending     Decimal  @db.Decimal(10, 2) @default(0)
  updated_at  DateTime @updatedAt

  user      User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  leave_type LeaveType @relation(fields: [leave_type_id], references: [id], onDelete: Cascade)

  @@unique([user_id, leave_type_id, year])
  @@index([year, leave_type_id])
  @@map("leave_balances")
}

model LeaveRequest {
  id                String         @id @default(uuid())
  user_id           String
  leave_type_id     String
  start_date        DateTime       @db.Date
  end_date          DateTime       @db.Date
  days_requested    Decimal        @db.Decimal(10, 2)
  reason            String?
  status            WorkflowStatus @default(Draft)
  workflow_instance_id String?     @db.Uuid
  location_id       String
  created_at        DateTime       @default(now())
  updated_at        DateTime       @updatedAt
  deleted_at        DateTime?

  user          User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  leave_type    LeaveType     @relation(fields: [leave_type_id], references: [id], onDelete: Cascade)
  location      Location      @relation(fields: [location_id], references: [id], onDelete: Cascade)

  @@index([user_id, status, deleted_at])
  @@index([start_date, end_date])
  @@index([location_id])
  @@index([workflow_instance_id])
  @@index([status, deleted_at])
  @@map("leave_requests")
}

model Timesheet {
  id                String          @id @default(uuid())
  user_id           String
  period_start      DateTime        @db.Date
  period_end        DateTime        @db.Date
  status            TimesheetStatus @default(Draft)
  workflow_instance_id String?      @db.Uuid
  location_id       String
  total_hours       Decimal         @db.Decimal(10, 2) @default(0)
  is_locked         Boolean         @default(false)
  locked_at         DateTime?
  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt
  deleted_at        DateTime?

  user    User            @relation(fields: [user_id], references: [id], onDelete: Cascade)
  location Location       @relation(fields: [location_id], references: [id], onDelete: Cascade)
  entries TimesheetEntry[]

  @@index([user_id, period_start, period_end])
  @@index([period_start, period_end, status])
  @@index([location_id])
  @@index([is_locked, locked_at])
  @@index([workflow_instance_id])
  @@map("timesheets")
}

model TimesheetEntry {
  id          String   @id @default(uuid())
  timesheet_id String
  date        DateTime @db.Date
  hours       Decimal  @db.Decimal(10, 2)
  description String?
  entry_type  String?  // "work", "leave", "holiday"
  leave_request_id String? @db.Uuid
  created_at DateTime @default(now())

  timesheet Timesheet @relation(fields: [timesheet_id], references: [id], onDelete: Cascade)

  @@index([timesheet_id])
  @@index([timesheet_id, date])
  @@map("timesheet_entries")
}

model TimesheetPeriod {
  id          String    @id @default(uuid())
  period_start DateTime @db.Date
  period_end   DateTime @db.Date
  is_locked   Boolean   @default(false)
  locked_at   DateTime?
  locked_by   String?   @db.Uuid
  created_at  DateTime  @default(now())

  @@index([period_start, period_end])
  @@index([is_locked, locked_at])
  @@map("timesheet_periods")
}

model WorkHoursConfig {
  id          String   @id @default(uuid())
  location_id String?
  staff_type  String?  // "Regular", "Temporary", "HRH"
  day_of_week Int      // 0=Sunday, 1=Monday, ..., 6=Saturday
  hours       Decimal  @db.Decimal(10, 2)
  is_active   Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  location Location? @relation(fields: [location_id], references: [id], onDelete: Cascade)

  @@index([location_id, staff_type, day_of_week])
  @@index([staff_type, day_of_week])
  @@map("work_hours_configs")
}

model AuditLog {
  id           String   @id @default(uuid())
  actor_id     String
  action       String
  resource_type String
  resource_id  String
  before_state Json?
  after_state  Json?
  metadata     Json?
  ip_address   String?
  timestamp    DateTime @default(now())

  actor User @relation(fields: [actor_id], references: [id], onDelete: Cascade)

  @@index([actor_id])
  @@index([resource_type, resource_id])
  @@index([action])
  @@index([timestamp])
  @@index([resource_type, resource_id, timestamp])
  @@map("audit_logs")
}
```

### Database Migration Commands

```bash
# Initialize Prisma
npx prisma init

# Create initial migration
npx prisma migrate dev --name init

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (GUI)
npx prisma studio
```

### Database Connection Setup

Create `app/lib/db/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Redis Connection Setup

Create `app/lib/redis/index.ts`:

```typescript
import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  throw new Error('REDIS_URL is not defined');
};

export const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});
```

---

## CORE BUSINESS LOGIC IMPLEMENTATION

### 1. Authority Resolution Service

Create `app/lib/services/authority.ts`:

```typescript
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { isDescendantOf } from '@/lib/services/location';

interface AuthorityCheckParams {
  userId: string;
  permission: string;
  locationId: string;
  workflowStepOrder?: number;
  workflowInstanceId?: string;
}

/**
 * Multi-layer authority resolution
 * Authority = Permission ∩ Location Scope ∩ Delegation Overlay ∩ Workflow Step Eligibility ∩ Active Status
 */
export async function checkAuthority(params: AuthorityCheckParams): Promise<{
  authorized: boolean;
  source: 'direct' | 'delegation' | null;
  delegationId?: string;
}> {
  const { userId, permission, locationId, workflowStepOrder, workflowInstanceId } = params;

  // 1. Check user is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deleted_at: true },
  });

  if (!user || user.status !== 'active' || user.deleted_at) {
    return { authorized: false, source: null };
  }

  // 2. Check workflow step eligibility (if workflow context provided)
  if (workflowInstanceId && workflowStepOrder !== undefined) {
    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      include: {
        template: {
          include: {
            steps: {
              where: { step_order: workflowStepOrder },
              take: 1,
            },
          },
        },
      },
    });

    if (!workflowInstance) {
      return { authorized: false, source: null };
    }

    const step = workflowInstance.template.steps[0];
    if (!step || step.required_permission !== permission) {
      return { authorized: false, source: null };
    }

    // Check if this is the current step
    if (workflowInstance.current_step_order !== workflowStepOrder) {
      return { authorized: false, source: null };
    }
  }

  // 3. Check cache first
  const cacheKey = `perms:${userId}:${locationId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const cachedPerms = JSON.parse(cached);
    if (cachedPerms.permissions.includes(permission)) {
      return { authorized: true, source: 'direct' };
    }
  }

  // 4. Get user roles
  const userRoles = await prisma.userRole.findMany({
    where: {
      user_id: userId,
      deleted_at: null,
    },
    include: {
      role: {
        where: { status: 'active' },
        include: {
          role_permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // 5. Extract permissions from roles
  const rolePermissions = new Set<string>();
  userRoles.forEach((ur) => {
    ur.role.role_permissions.forEach((rp) => {
      rolePermissions.add(rp.permission.name);
    });
  });

  // 6. Check if user has permission at all
  if (!rolePermissions.has(permission)) {
    // Check delegations as fallback
    const delegationAuth = await checkDelegationAuthority(userId, permission, locationId);
    if (delegationAuth.authorized) {
      return delegationAuth;
    }
    return { authorized: false, source: null };
  }

  // 7. Get active scopes for permission
  const now = new Date();
  const scopes = await prisma.userPermissionScope.findMany({
    where: {
      user_id: userId,
      permission: {
        name: permission,
      },
      status: 'active',
      valid_from: { lte: now },
      OR: [
        { valid_until: null },
        { valid_until: { gte: now } },
      ],
    },
  });

  // 8. Check location scope match
  const locationMatch = scopes.some((scope) => {
    if (scope.is_global) return true;
    if (!scope.location_id) return false;
    if (scope.location_id === locationId) return true;
    if (scope.include_descendants) {
      return isDescendantOf(locationId, scope.location_id);
    }
    return false;
  });

  if (locationMatch) {
    // Cache result
    await redis.setex(
      cacheKey,
      300, // 5 minutes
      JSON.stringify({
        permissions: Array.from(rolePermissions),
        locationId,
      })
    );
    return { authorized: true, source: 'direct' };
  }

  // 9. Check delegations as overlay
  const delegationAuth = await checkDelegationAuthority(userId, permission, locationId);
  return delegationAuth;
}

async function checkDelegationAuthority(
  userId: string,
  permission: string,
  locationId: string
): Promise<{
  authorized: boolean;
  source: 'direct' | 'delegation' | null;
  delegationId?: string;
}> {
  const now = new Date();
  const delegations = await prisma.delegation.findMany({
    where: {
      delegate_user_id: userId,
      permission: {
        name: permission,
      },
      status: 'active',
      valid_from: { lte: now },
      valid_until: { gte: now },
    },
  });

  for (const del of delegations) {
    if (!del.location_id) {
      // Global delegation
      return { authorized: true, source: 'delegation', delegationId: del.id };
    }
    if (del.location_id === locationId) {
      return { authorized: true, source: 'delegation', delegationId: del.id };
    }
    if (del.include_descendants) {
      const isDescendant = await isDescendantOf(locationId, del.location_id);
      if (isDescendant) {
        return { authorized: true, source: 'delegation', delegationId: del.id };
      }
    }
  }

  return { authorized: false, source: null };
}
```

### 2. Workflow Execution Service

Create `app/lib/services/workflow.ts`:

```typescript
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { checkAuthority } from './authority';
import { generateDigitalSignature } from '@/lib/auth/jwt';
import { createAuditLog } from './audit';

interface ApproveWorkflowParams {
  workflowInstanceId: string;
  userId: string;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface DeclineWorkflowParams extends ApproveWorkflowParams {
  routeTo: 'employee' | `step_${number}`;
  routeToStepOrder?: number;
}

/**
 * Acquire distributed lock for workflow instance
 */
async function acquireWorkflowLock(workflowInstanceId: string, userId: string): Promise<boolean> {
  const lockKey = `workflow:lock:${workflowInstanceId}`;
  const lockValue = JSON.stringify({
    userId,
    timestamp: Date.now(),
    action: 'approve',
  });

  // Try to acquire lock (atomic operation)
  const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
  return acquired === 'OK';
}

/**
 * Release workflow lock
 */
async function releaseWorkflowLock(workflowInstanceId: string): Promise<void> {
  const lockKey = `workflow:lock:${workflowInstanceId}`;
  await redis.del(lockKey);
}

/**
 * Approve workflow step
 */
export async function approveWorkflowStep(params: ApproveWorkflowParams): Promise<void> {
  const { workflowInstanceId, userId, comment, ipAddress, userAgent } = params;

  // 1. Acquire distributed lock
  const lockAcquired = await acquireWorkflowLock(workflowInstanceId, userId);
  if (!lockAcquired) {
    throw new Error('Workflow instance is currently being processed by another user');
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 2. Get workflow instance with row-level lock
      const workflowInstance = await tx.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
        include: {
          template: {
            include: {
              steps: {
                orderBy: { step_order: 'asc' },
              },
            },
          },
        },
      });

      if (!workflowInstance) {
        throw new Error('Workflow instance not found');
      }

      if (workflowInstance.status !== 'UnderReview') {
        throw new Error('Workflow is not in review status');
      }

      // 3. Get current step
      const currentStep = workflowInstance.template.steps.find(
        (s) => s.step_order === workflowInstance.current_step_order
      );

      if (!currentStep) {
        throw new Error('Current step not found');
      }

      // 4. Check authority
      const resource = await getResource(workflowInstance.resource_type, workflowInstance.resource_id);
      const authority = await checkAuthority({
        userId,
        permission: currentStep.required_permission,
        locationId: resource.location_id,
        workflowStepOrder: currentStep.step_order,
        workflowInstanceId,
      });

      if (!authority.authorized) {
        throw new Error('User does not have authority to approve this step');
      }

      // 5. Generate digital signature
      const signature = await generateDigitalSignature({
        userId,
        workflowInstanceId,
        stepOrder: currentStep.step_order,
        action: 'approve',
        timestamp: new Date(),
      });

      // 6. Create or update step instance
      await tx.workflowStepInstance.upsert({
        where: {
          workflow_instance_id_step_order: {
            workflow_instance_id: workflowInstanceId,
            step_order: currentStep.step_order,
          },
        },
        create: {
          workflow_instance_id: workflowInstanceId,
          step_order: currentStep.step_order,
          status: 'approved',
          acted_by: userId,
          delegated_from: authority.source === 'delegation' ? authority.delegationId : null,
          acted_at: new Date(),
          comment,
          digital_signature: signature.token,
          signature_hash: signature.hash,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        update: {
          status: 'approved',
          acted_by: userId,
          acted_at: new Date(),
          comment,
          digital_signature: signature.token,
          signature_hash: signature.hash,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      // 7. Check if this is the last step
      const isLastStep = currentStep.step_order === workflowInstance.template.steps.length - 1;

      if (isLastStep) {
        // Workflow complete - approve resource
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            status: 'Approved',
            current_step_order: currentStep.step_order + 1,
          },
        });

        // Update resource status
        await updateResourceStatus(
          tx,
          workflowInstance.resource_type,
          workflowInstance.resource_id,
          'Approved'
        );
      } else {
        // Move to next step
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            current_step_order: currentStep.step_order + 1,
          },
        });
      }

      // 8. Create audit log
      await createAuditLog(tx, {
        actorId: userId,
        action: `${workflowInstance.resource_type}.approve`,
        resourceType: workflowInstance.resource_type,
        resourceId: workflowInstance.resource_id,
        afterState: {
          workflowInstanceId,
          stepOrder: currentStep.step_order,
          status: 'approved',
        },
        metadata: {
          delegationId: authority.delegationId,
          source: authority.source,
        },
        ipAddress,
      });
    });
  } finally {
    // Always release lock
    await releaseWorkflowLock(workflowInstanceId);
  }
}

/**
 * Decline workflow step with routing
 */
export async function declineWorkflowStep(params: DeclineWorkflowParams): Promise<void> {
  const { workflowInstanceId, userId, comment, routeTo, routeToStepOrder, ipAddress, userAgent } = params;

  const lockAcquired = await acquireWorkflowLock(workflowInstanceId, userId);
  if (!lockAcquired) {
    throw new Error('Workflow instance is currently being processed by another user');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const workflowInstance = await tx.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
        include: {
          template: {
            include: {
              steps: true,
            },
          },
        },
      });

      if (!workflowInstance) {
        throw new Error('Workflow instance not found');
      }

      const currentStep = workflowInstance.template.steps.find(
        (s) => s.step_order === workflowInstance.current_step_order
      );

      if (!currentStep) {
        throw new Error('Current step not found');
      }

      // Check authority
      const resource = await getResource(workflowInstance.resource_type, workflowInstance.resource_id);
      const authority = await checkAuthority({
        userId,
        permission: currentStep.required_permission,
        locationId: resource.location_id,
        workflowStepOrder: currentStep.step_order,
        workflowInstanceId,
      });

      if (!authority.authorized) {
        throw new Error('User does not have authority to decline this step');
      }

      // Create step instance with declined status
      await tx.workflowStepInstance.upsert({
        where: {
          workflow_instance_id_step_order: {
            workflow_instance_id: workflowInstanceId,
            step_order: currentStep.step_order,
          },
        },
        create: {
          workflow_instance_id: workflowInstanceId,
          step_order: currentStep.step_order,
          status: 'declined',
          acted_by: userId,
          acted_at: new Date(),
          comment,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        update: {
          status: 'declined',
          acted_by: userId,
          acted_at: new Date(),
          comment,
        },
      });

      // Handle routing
      if (routeTo === 'employee') {
        // Route back to employee (Draft status)
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            status: 'Adjusted',
            current_step_order: 0,
          },
        });

        await updateResourceStatus(
          tx,
          workflowInstance.resource_type,
          workflowInstance.resource_id,
          'Draft'
        );
      } else if (routeTo.startsWith('step_')) {
        // Route to specific step
        const targetStepOrder = routeToStepOrder ?? parseInt(routeTo.replace('step_', ''));
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            status: 'Adjusted',
            current_step_order: targetStepOrder,
          },
        });
      } else {
        // Final rejection
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            status: 'Declined',
          },
        });

        await updateResourceStatus(
          tx,
          workflowInstance.resource_type,
          workflowInstance.resource_id,
          'Declined'
        );
      }

      // Audit log
      await createAuditLog(tx, {
        actorId: userId,
        action: `${workflowInstance.resource_type}.decline`,
        resourceType: workflowInstance.resource_type,
        resourceId: workflowInstance.resource_id,
        afterState: {
          workflowInstanceId,
          stepOrder: currentStep.step_order,
          status: 'declined',
          routedTo: routeTo,
        },
        metadata: {
          comment,
          routeTo,
        },
        ipAddress,
      });
    });
  } finally {
    await releaseWorkflowLock(workflowInstanceId);
  }
}

// Helper functions
async function getResource(resourceType: string, resourceId: string) {
  if (resourceType === 'leave') {
    return await prisma.leaveRequest.findUnique({
      where: { id: resourceId },
      select: { id: true, location_id: true },
    });
  } else if (resourceType === 'timesheet') {
    return await prisma.timesheet.findUnique({
      where: { id: resourceId },
      select: { id: true, location_id: true },
    });
  }
  throw new Error(`Unknown resource type: ${resourceType}`);
}

async function updateResourceStatus(
  tx: any,
  resourceType: string,
  resourceId: string,
  status: string
) {
  if (resourceType === 'leave') {
    await tx.leaveRequest.update({
      where: { id: resourceId },
      data: { status },
    });
  } else if (resourceType === 'timesheet') {
    await tx.timesheet.update({
      where: { id: resourceId },
      data: { status },
    });
  }
}
```

### 3. Location Service

Create `app/lib/services/location.ts`:

```typescript
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

/**
 * Check if locationId is a descendant of ancestorId
 */
export async function isDescendantOf(locationId: string, ancestorId: string): Promise<boolean> {
  // Check cache
  const cacheKey = `location:tree:${ancestorId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    const tree = JSON.parse(cached);
    return tree.descendants.includes(locationId);
  }

  // Get location path
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { path: true },
  });

  const ancestor = await prisma.location.findUnique({
    where: { id: ancestorId },
    select: { path: true },
  });

  if (!location || !ancestor) {
    return false;
  }

  // Check if location path starts with ancestor path
  const isDescendant = location.path.startsWith(ancestor.path + '.') || location.path === ancestor.path;

  // Cache tree structure
  const tree = await buildLocationTree(ancestorId);
  await redis.setex(cacheKey, 3600, JSON.stringify(tree)); // 1 hour TTL

  return isDescendant;
}

async function buildLocationTree(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return { ancestors: [], descendants: [], path: '' };
  }

  // Get all descendants
  const descendants = await prisma.location.findMany({
    where: {
      path: {
        startsWith: location.path + '.',
      },
    },
    select: { id: true },
  });

  // Get all ancestors
  const pathParts = location.path.split('.');
  const ancestorIds: string[] = [];
  for (let i = 1; i < pathParts.length; i++) {
    const ancestorPath = pathParts.slice(0, i).join('.');
    const ancestor = await prisma.location.findFirst({
      where: { path: ancestorPath },
      select: { id: true },
    });
    if (ancestor) {
      ancestorIds.push(ancestor.id);
    }
  }

  return {
    ancestors: ancestorIds,
    descendants: descendants.map((d) => d.id),
    path: location.path,
  };
}
```

---

## API ENDPOINT IMPLEMENTATION

### 1. Authentication Middleware

Create `app/lib/middleware/auth.ts`:

```typescript
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  status: string;
}

export async function authenticate(request: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized - No token provided');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!user || user.status !== 'active' || user.deleted_at) {
      throw new Error('User is not active');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  } catch (error) {
    throw new Error('Unauthorized - Invalid token');
  }
}
```

### 2. Permission Middleware

Create `app/lib/middleware/permissions.ts`:

```typescript
import { AuthenticatedUser } from './auth';
import { checkAuthority } from '@/lib/services/authority';

export async function requirePermission(
  user: AuthenticatedUser,
  permission: string,
  locationId?: string
): Promise<void> {
  if (!locationId) {
    // For non-location-scoped permissions, check if user has permission at all
    // This is a simplified check - implement based on your needs
    throw new Error('Location ID required for permission check');
  }

  const authority = await checkAuthority({
    userId: user.id,
    permission,
    locationId,
  });

  if (!authority.authorized) {
    throw new Error(`Forbidden - User does not have permission: ${permission}`);
  }
}
```

### 3. Example API Route: Workflow Approval

Create `app/api/workflows/instances/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, AuthenticatedUser } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { approveWorkflowStep } from '@/lib/services/workflow';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate
    const user = await authenticate(request);

    // 2. Get workflow instance
    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: params.id },
      include: {
        template: {
          include: {
            steps: {
              where: {
                step_order: {
                  // Will be set from workflowInstance.current_step_order
                },
              },
            },
          },
        },
      },
    });

    if (!workflowInstance) {
      return NextResponse.json(
        { error: 'Workflow instance not found' },
        { status: 404 }
      );
    }

    // 3. Get resource to get location
    let locationId: string;
    if (workflowInstance.resource_type === 'leave') {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: workflowInstance.resource_id },
        select: { location_id: true },
      });
      if (!leaveRequest) {
        return NextResponse.json(
          { error: 'Leave request not found' },
          { status: 404 }
        );
      }
      locationId = leaveRequest.location_id;
    } else {
      const timesheet = await prisma.timesheet.findUnique({
        where: { id: workflowInstance.resource_id },
        select: { location_id: true },
      });
      if (!timesheet) {
        return NextResponse.json(
          { error: 'Timesheet not found' },
          { status: 404 }
        );
      }
      locationId = timesheet.location_id;
    }

    // 4. Get current step
    const currentStep = workflowInstance.template.steps.find(
      (s) => s.step_order === workflowInstance.current_step_order
    );

    if (!currentStep) {
      return NextResponse.json(
        { error: 'Current step not found' },
        { status: 400 }
      );
    }

    // 5. Check permission
    await requirePermission(user, currentStep.required_permission, locationId);

    // 6. Parse request body
    const body = await request.json();
    const { comment } = body;

    // 7. Get IP and User Agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 8. Approve workflow step
    await approveWorkflowStep({
      workflowInstanceId: params.id,
      userId: user.id,
      comment,
      ipAddress,
      userAgent,
    });

    // 9. Return success
    return NextResponse.json({
      success: true,
      message: 'Workflow step approved successfully',
    });
  } catch (error: any) {
    console.error('Workflow approval error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 
                error.message?.includes('Forbidden') ? 403 : 500 }
    );
  }
}
```

### 4. Example API Route: Leave Request Submission

Create `app/api/leave/requests/[id]/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Get leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        location: true,
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    if (leaveRequest.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Not your leave request' },
        { status: 403 }
      );
    }

    if (leaveRequest.status !== 'Draft') {
      return NextResponse.json(
        { error: 'Leave request is not in draft status' },
        { status: 400 }
      );
    }

    // Get workflow template for this location and resource type
    const workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: leaveRequest.location_id,
        status: 'active',
      },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
      orderBy: { version: 'desc' },
    });

    if (!workflowTemplate) {
      return NextResponse.json(
        { error: 'No workflow template found for this location' },
        { status: 400 }
      );
    }

    // Create workflow instance
    const workflowInstance = await prisma.workflowInstance.create({
      data: {
        workflow_template_id: workflowTemplate.id,
        resource_id: leaveRequest.id,
        resource_type: 'leave',
        current_step_order: 0,
        status: 'Submitted',
        created_by: user.id,
      },
    });

    // Update leave request
    await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: workflowInstance.id,
      },
    });

    // Move to first step
    if (workflowTemplate.steps.length > 0) {
      await prisma.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          status: 'UnderReview',
          current_step_order: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        workflowInstanceId: workflowInstance.id,
        status: 'Submitted',
      },
    });
  } catch (error: any) {
    console.error('Leave request submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## TESTING STRATEGY

### 1. Test Setup

Install testing dependencies:

```bash
npm install -D jest @types/jest ts-jest
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D supertest @types/supertest
```

Create `jest.config.js`:

```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/types/**',
  ],
};

module.exports = createJestConfig(customJestConfig);
```

Create `jest.setup.js`:

```javascript
// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
```

### 2. Unit Tests: Authority Service

Create `app/lib/services/__tests__/authority.test.ts`:

```typescript
import { checkAuthority } from '../authority';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

jest.mock('@/lib/db');
jest.mock('@/lib/redis');

describe('Authority Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false for inactive user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      status: 'suspended',
      deleted_at: null,
    });

    const result = await checkAuthority({
      userId: 'user-1',
      permission: 'leave.approve',
      locationId: 'location-1',
    });

    expect(result.authorized).toBe(false);
  });

  it('should return true for user with direct permission and scope', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      status: 'active',
      deleted_at: null,
    });

    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
      {
        role: {
          status: 'active',
          role_permissions: [
            {
              permission: {
                name: 'leave.approve',
              },
            },
          ],
        },
      },
    ]);

    (prisma.userPermissionScope.findMany as jest.Mock).mockResolvedValue([
      {
        is_global: true,
        status: 'active',
        valid_from: new Date('2024-01-01'),
        valid_until: null,
      },
    ]);

    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');

    const result = await checkAuthority({
      userId: 'user-1',
      permission: 'leave.approve',
      locationId: 'location-1',
    });

    expect(result.authorized).toBe(true);
    expect(result.source).toBe('direct');
  });

  it('should return true for user with delegation', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      status: 'active',
      deleted_at: null,
    });

    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);

    (prisma.delegation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'del-1',
        delegate_user_id: 'user-1',
        location_id: null, // Global delegation
        status: 'active',
        valid_from: new Date('2024-01-01'),
        valid_until: new Date('2025-12-31'),
      },
    ]);

    const result = await checkAuthority({
      userId: 'user-1',
      permission: 'leave.approve',
      locationId: 'location-1',
    });

    expect(result.authorized).toBe(true);
    expect(result.source).toBe('delegation');
  });
});
```

### 3. Integration Tests: Workflow Approval

Create `app/api/workflows/instances/[id]/approve/__tests__/route.test.ts`:

```typescript
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { approveWorkflowStep } from '@/lib/services/workflow';

jest.mock('@/lib/db');
jest.mock('@/lib/services/workflow');

describe('POST /api/workflows/instances/[id]/approve', () => {
  it('should approve workflow step successfully', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
    };

    const mockWorkflowInstance = {
      id: 'wf-1',
      resource_type: 'leave',
      resource_id: 'leave-1',
      current_step_order: 0,
      status: 'UnderReview',
      template: {
        steps: [
          {
            step_order: 0,
            required_permission: 'leave.approve',
          },
        ],
      },
    };

    const mockLeaveRequest = {
      id: 'leave-1',
      location_id: 'location-1',
    };

    (prisma.workflowInstance.findUnique as jest.Mock).mockResolvedValue(mockWorkflowInstance);
    (prisma.leaveRequest.findUnique as jest.Mock).mockResolvedValue(mockLeaveRequest);
    (approveWorkflowStep as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/workflows/instances/wf-1/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ comment: 'Approved' }),
    });

    // Mock authenticate
    jest.spyOn(require('@/lib/middleware/auth'), 'authenticate').mockResolvedValue(mockUser);

    const response = await POST(request, { params: { id: 'wf-1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(approveWorkflowStep).toHaveBeenCalledWith({
      workflowInstanceId: 'wf-1',
      userId: 'user-1',
      comment: 'Approved',
      ipAddress: expect.any(String),
      userAgent: expect.any(String),
    });
  });

  it('should return 404 for non-existent workflow instance', async () => {
    (prisma.workflowInstance.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/workflows/instances/wf-1/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
    };

    jest.spyOn(require('@/lib/middleware/auth'), 'authenticate').mockResolvedValue(mockUser);

    const response = await POST(request, { params: { id: 'wf-1' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Workflow instance not found');
  });
});
```

### 4. E2E Test Scenarios

Create `__tests__/e2e/workflow-approval.test.ts`:

```typescript
/**
 * E2E Test: Complete Leave Request Approval Flow
 * 
 * Scenario:
 * 1. Employee creates leave request
 * 2. Employee submits for approval
 * 3. Manager approves (Step 1)
 * 4. Program Officer approves (Step 2)
 * 5. HR Manager approves (Step 3)
 * 6. Leave request is approved and added to timesheet
 */

describe('E2E: Leave Request Approval Flow', () => {
  it('should complete full approval workflow', async () => {
    // Setup: Create users, locations, workflow template
    // ... (setup code)

    // 1. Create leave request
    // 2. Submit leave request
    // 3. Approve at each step
    // 4. Verify final state
    // 5. Verify timesheet integration
  });
});
```

### 5. Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "jest --config jest.e2e.config.js"
  }
}
```

---

## DEPLOYMENT GUIDE

### 1. Production Environment Setup

#### Environment Variables

Create `.env.production`:

```env
# Database (DigitalOcean Managed PostgreSQL)
DATABASE_URL="postgresql://user:password@db-host:25060/hrapp_db?sslmode=require"

# Redis (DigitalOcean Managed Redis)
REDIS_URL="rediss://user:password@redis-host:25061"

# JWT Secrets (Generate strong secrets)
JWT_SECRET="<generate-strong-secret-256-bits>"
JWT_REFRESH_SECRET="<generate-strong-secret-256-bits>"

# JWT Expiration
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800

# Application
NODE_ENV="production"
PORT=3000

# Email Configuration
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASSWORD="<sendgrid-api-key>"
SMTP_FROM="PATH HR System <noreply@path.org>"
```

#### Generate JWT Secrets

```bash
# Generate strong JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Docker Production Build

#### Optimized Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 3. Deployment to DigitalOcean App Platform

#### App Spec File (`app.yaml`)

```yaml
name: hrapp-api
region: nyc
services:
  - name: api
    github:
      repo: your-org/hrapp
      branch: main
      deploy_on_push: true
    dockerfile_path: Dockerfile
    dockerfile: |
      FROM node:20-alpine AS deps
      WORKDIR /app
      COPY package.json package-lock.json* ./
      RUN npm ci --only=production
      
      FROM node:20-alpine AS builder
      WORKDIR /app
      COPY --from=deps /app/node_modules ./node_modules
      COPY . .
      RUN npx prisma generate
      ENV NEXT_TELEMETRY_DISABLED 1
      RUN npm run build
      
      FROM node:20-alpine AS runner
      WORKDIR /app
      ENV NODE_ENV production
      ENV NEXT_TELEMETRY_DISABLED 1
      RUN addgroup --system --gid 1001 nodejs
      RUN adduser --system --uid 1001 nextjs
      COPY --from=builder /app/public ./public
      COPY --from=builder /app/.next/standalone ./
      COPY --from=builder /app/.next/static ./.next/static
      COPY --from=builder /app/prisma ./prisma
      COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
      USER nextjs
      EXPOSE 3000
      ENV PORT 3000
      ENV HOSTNAME "0.0.0.0"
      CMD ["node", "server.js"]
    http_port: 3000
    instance_count: 2
    instance_size_slug: basic-xxs
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
      - key: REDIS_URL
        scope: RUN_TIME
        value: ${redis.REDIS_URL}
      - key: JWT_SECRET
        scope: RUN_TIME
        value: ${JWT_SECRET}
      - key: JWT_REFRESH_SECRET
        scope: RUN_TIME
        value: ${JWT_REFRESH_SECRET}
      - key: NODE_ENV
        scope: RUN_TIME
        value: production
    health_check:
      http_path: /api/health
      initial_delay_seconds: 30
      period_seconds: 10
      timeout_seconds: 5
      success_threshold: 1
      failure_threshold: 3
    routes:
      - path: /
    run_command: node server.js

databases:
  - name: db
    engine: PG
    version: "15"
    production: true
    cluster_name: hrapp-db-cluster

databases:
  - name: redis
    engine: REDIS
    version: "7"
    production: true
    cluster_name: hrapp-redis-cluster
```

### 4. Database Migration in Production

#### Migration Script

Create `scripts/migrate-production.sh`:

```bash
#!/bin/bash

# Run Prisma migrations in production
npx prisma migrate deploy

# Verify migration success
if [ $? -eq 0 ]; then
  echo "✅ Migrations applied successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
```

#### Run Migrations

```bash
# In production container
docker-compose exec app npx prisma migrate deploy

# Or via DigitalOcean App Platform
doctl apps create-deployment <app-id> --force-rebuild
```

### 5. Health Check Endpoint

Create `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 503 }
    );
  }
}
```

### 6. Production Checklist

#### Pre-Deployment

- [ ] All environment variables set in production
- [ ] JWT secrets generated and stored securely
- [ ] Database migrations tested in staging
- [ ] Redis connection tested
- [ ] Health check endpoint working
- [ ] Docker image builds successfully
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security audit completed

#### Database

- [ ] Database backups configured
- [ ] Connection pooling configured
- [ ] Indexes verified for performance
- [ ] Migration rollback plan prepared

#### Redis

- [ ] Redis persistence configured
- [ ] Memory limits set appropriately
- [ ] Cache invalidation strategy verified

#### Monitoring

- [ ] Application logs configured
- [ ] Error tracking (Sentry/LogRocket) set up
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured

#### Security

- [ ] HTTPS/SSL certificates configured
- [ ] CORS settings verified
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

### 7. Post-Deployment Verification

#### Verify Deployment

```bash
# Check health endpoint
curl https://your-api-domain.com/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-01-27T...",
#   "services": {
#     "database": "connected",
#     "redis": "connected"
#   }
# }
```

#### Test Critical Endpoints

```bash
# 1. Authentication
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Create Leave Request
curl -X POST https://your-api-domain.com/api/leave/requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"leave_type_id":"...","start_date":"2025-02-10","end_date":"2025-02-14"}'

# 3. Submit for Approval
curl -X POST https://your-api-domain.com/api/leave/requests/<id>/submit \
  -H "Authorization: Bearer <token>"
```

### 8. Monitoring & Maintenance

#### Log Monitoring

```bash
# View application logs
doctl apps logs <app-id> --type run

# Filter errors
doctl apps logs <app-id> --type run | grep ERROR
```

#### Database Maintenance

```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Analyze table statistics
psql $DATABASE_URL -c "ANALYZE;"

# Check index usage
psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_indexes;"
```

#### Performance Optimization

1. **Database Query Optimization**
   - Monitor slow queries
   - Add missing indexes
   - Optimize N+1 queries

2. **Redis Cache Optimization**
   - Monitor cache hit rates
   - Adjust TTL values
   - Implement cache warming

3. **API Response Times**
   - Monitor endpoint performance
   - Implement response caching where appropriate
   - Optimize database queries

### 9. Rollback Procedure

If deployment fails:

```bash
# 1. Rollback to previous version
doctl apps create-deployment <app-id> --force-rebuild --spec <previous-version>

# 2. Verify rollback
curl https://your-api-domain.com/api/health

# 3. Check logs
doctl apps logs <app-id> --type run
```

### 10. Backup Strategy

#### Database Backups

```bash
# Automated daily backups (configure in DigitalOcean)
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20250127.sql
```

#### Application State Backup

- Configuration backups (workflow templates, roles, permissions)
- Export critical data regularly
- Test restore procedures

---

## SUMMARY

This comprehensive implementation guide covers:

1. ✅ **Project Setup & Structure** - Complete project initialization
2. ✅ **Docker Configuration** - Multi-stage builds for production
3. ✅ **Database Setup & Migrations** - Prisma schema and migrations
4. ✅ **Core Business Logic** - Authority, Workflow, Location services
5. ✅ **API Endpoint Implementation** - Example routes with middleware
6. ✅ **Testing Strategy** - Unit, integration, and E2E tests
7. ✅ **Deployment Guide** - Production deployment on DigitalOcean

**Next Steps:**
1. Set up development environment
2. Run initial migrations
3. Implement remaining API endpoints
4. Write comprehensive tests
5. Deploy to staging environment
6. Perform security audit
7. Deploy to production

---

**Document Status:** ✅ Complete - All Phases Implemented

**Version:** 1.0  
**Last Updated:** 2025-01-27
