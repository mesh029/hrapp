# PATH HR System - Implementation Compass

**Purpose:** Quick reference guide for critical system principles, dynamic elements, and enforcement rules. Use this as your compass when building to ensure you're on the right track.

**⚠️ DOCUMENTATION-FIRST PRINCIPLE:**
- **Always refer to docs** - Before implementing anything, check the documentation
- **Lost context?** → Read [`HRMS_GUIDE.md`](./HRMS_GUIDE.md) and [`COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md)
- **Have questions?** → Check the docs first, then **ask to adjust the docs** if clarification is needed
- **Unclear requirements?** → Update documentation to clarify, don't guess
- **Documentation is the source of truth** - If code and docs don't match, update the docs first, then code

**⚠️ PHASE MANAGEMENT:**
- **Large phases should be split into parts** - If a phase feels too big, break it down into manageable parts
- **Document phase parts in progress files** - Use `progress/PHASE_X_PROGRESS.md` to track and highlight parts
- **Highlight parts clearly** - Make it obvious which part you're working on (e.g., Phase 2 Part A, Part B, etc.)
- **Complete parts incrementally** - Finish and validate each part before moving to the next part
- **Update progress files** - Track completion status of each part in progress documentation

---

## 🧭 CORE PRINCIPLES (NON-NEGOTIABLE)

### 1. Dynamic Configuration First
- ❌ **NO hardcoded business logic** - Everything must be database-driven
- ❌ **NO hardcoded workflows** - All approval sequences configurable
- ❌ **NO fixed starting points** - First workflow step can be ANY role/permission
- ❌ **NO required roles** - Workflows can use any roles in any order
- ✅ **ALL configurations changeable at runtime** via API

### 2. Authority Formula (MUST PASS ALL LAYERS)
```
Authority = Permission ∩ Location Scope ∩ Delegation Overlay ∩ Workflow Step Eligibility ∩ Active Status
```
- Every action requires explicit permission
- Permission must include location scope
- Delegation can temporarily grant authority
- User must be eligible for current workflow step
- User must be active (not deleted/inactive)

### 3. Workflow State Model
```
Draft → Submitted → Under Review → Approved | Declined | Adjusted | Cancelled
```
- No state skipping allowed
- Adjust can route back to ANY step or to employee
- All transitions must be explicit and validated

### 4. Version Isolation
- Workflow template changes **DO NOT** affect running instances
- Template modifications only apply to new instances
- Running workflows use template version at creation time

### 5. Audit Trail
- **ALL state changes** must be logged
- **ALL approvals** must have digital signature + timestamp
- **ALL user actions** must be auditable
- Complete history required for compliance

---

## 🔄 DYNAMIC ELEMENTS (MUST BE CONFIGURABLE)

### Staff Types
- ✅ Create/update/delete at runtime
- ✅ Link to work hours configurations
- ✅ Link to workflow templates (optional)
- ✅ Assign users to staff types dynamically

### Leave Types
- ✅ Create/update/delete at runtime
- ✅ Configure: is_paid, accrual_rate, max_balance
- ✅ No hardcoded leave types (Sick Leave, Vacation, etc.)

### Work Hours
- ✅ Configure per staff type OR per location
- ✅ Priority: Location > Staff Type
- ✅ Support any schedule (not just 40hrs/week)
- ✅ Configurable per day of week

### Workflow Templates
- ✅ Create with ANY number of steps (1 to N)
- ✅ First step can be ANY role/permission
- ✅ Add/remove/reorder steps at runtime
- ✅ Location-specific templates
- ✅ Staff-type-specific templates (optional)
- ✅ Default templates are examples only (can be deleted/modified)

### Roles
- ✅ Create/update/delete at runtime
- ✅ Assign permissions dynamically
- ✅ Users can have multiple roles (union of permissions)
- ✅ No hardcoded role names (Manager, HR Manager, etc.)

### Locations
- ✅ Create/update/delete at runtime
- ✅ Hierarchical tree structure
- ✅ Move locations in tree
- ✅ Support unlimited depth

---

## 📊 DATABASE SCHEMA PRINCIPLES

### Primary Keys
- Use UUIDs for all tables
- Never use auto-incrementing integers

### Soft Deletes
- Use `deleted_at` timestamp (never hard delete)
- Applies to: users, locations, roles, permissions, staff_types
- Soft-deleted records filtered out by default

### Indexes (REQUIRED)
- All foreign keys must be indexed
- Frequently queried fields must be indexed
- Composite indexes for common query patterns
- Location path fields for hierarchy queries

### Relationships
- Use proper foreign key constraints
- Cascade rules: ON DELETE RESTRICT for critical relationships
- Many-to-many: Use junction tables (user_roles, role_permissions)

### Timestamps
- All tables: `created_at`, `updated_at`
- Soft deletes: `deleted_at`
- Workflow approvals: `approved_at`, `signed_at`

---

## 🔐 SECURITY ENFORCEMENT

### Authentication
- JWT access tokens (short-lived: 15-30 min)
- JWT refresh tokens (long-lived: 7 days, stored in Redis)
- Token invalidation on logout
- User status check on every request

### Authorization
- Permission check on every endpoint
- Location scope validation
- Delegation overlay check
- Workflow step eligibility check

### Input Validation
- Validate all inputs with Zod schemas
- Sanitize user inputs
- Validate UUIDs, dates, enums
- Reject invalid data early

### Digital Signatures
- Generate on every approval action
- Include: JWT signature, timestamp, IP address, user agent
- Store in `workflow_approvals` table
- Append to PDF exports

---

## 🔗 INTEGRATION POINTS

### Leave → Workflow
- Submit creates workflow instance
- Use location-specific template
- Resolve approvers dynamically
- Update balance on final approval

### Leave → Timesheet
- Approved leave auto-adds to timesheet
- Create entry with leave type label
- Calculate hours from work hours config
- Link entry to leave request

### Timesheet → Workflow
- Submit creates workflow instance
- Use location-specific template
- Generate signatures on approval
- Lock timesheet on final approval

### Delegation → Authority
- Check active delegations in authority resolution
- Validate: time validity, scope, status
- Log delegated approvals with delegation context

---

## ⚠️ CRITICAL VALIDATIONS

### Before Creating Workflow Instance
- ✅ Template exists and is active
- ✅ Template matches resource type
- ✅ Template matches location (or location parent)
- ✅ Template matches staff type (if specified)
- ✅ All steps have valid permissions/roles

### Before Approving Workflow Step
- ✅ User has required permission
- ✅ Permission scope includes location
- ✅ User is eligible for current step
- ✅ Workflow is in correct state
- ✅ No duplicate approvals

### Before Creating Leave Request
- ✅ Leave type exists and is active
- ✅ User has sufficient balance (if required)
- ✅ Dates are valid (not in past, end > start)
- ✅ No overlapping requests

### Before Creating Timesheet
- ✅ Period exists and is not locked
- ✅ User has work hours configuration
- ✅ No duplicate timesheet for period

### Before Delegation
- ✅ Delegator has the permission being delegated
- ✅ Valid time range (valid_from < valid_until)
- ✅ Scope is valid (location exists)
- ✅ Delegate user is active

---

## 🎯 SYSTEM INVARIANTS (NEVER VIOLATE)

1. **No authority without permission** - Every action requires explicit permission
2. **No authority without scope** - Permissions must be bound to location scope
3. **No approval outside workflow** - All approvals must follow workflow templates
4. **Delegation never permanently modifies permission** - Delegations are temporary overlays
5. **Location hierarchy must always remain valid** - Tree integrity enforced at all times
6. **Workflow templates do not mutate running instances** - Version isolation required
7. **All state transitions must be auditable** - Complete audit trail mandatory
8. **Soft delete only for core entities** - Never hard delete user/location/permission data

---

## 📋 QUICK CHECKLIST (Before Moving to Next Phase)

### Phase Completion Checklist
- ✅ All endpoints return proper status codes (200, 201, 400, 401, 403, 404, 500)
- ✅ All inputs validated with Zod schemas
- ✅ All database operations use transactions where needed
- ✅ All errors handled gracefully with proper messages
- ✅ All state changes logged to audit trail
- ✅ All permissions checked before actions
- ✅ All configurations are database-driven (no hardcoded values)
- ✅ All workflows are fully configurable (no hardcoded sequences)

---

## 🔍 COMMON PITFALLS TO AVOID

### ❌ DON'T:
- Hardcode role names in workflow logic
- Assume workflows start with "Manager"
- Create fixed approval sequences
- Skip permission checks
- Hard delete core entities
- Modify running workflow instances when template changes
- Cache without invalidation strategy
- Skip input validation
- Forget to log state changes

### ✅ DO:
- Resolve approvers dynamically from database
- Check all layers of authority formula
- Use transactions for multi-step operations
- Validate all inputs
- Log all state changes
- Generate digital signatures for approvals
- Cache permissions in Redis with TTL
- Use soft deletes
- Test dynamic configuration scenarios

---

## 📚 REFERENCE DOCUMENTS

**Main Navigation:** [`HRMS_GUIDE.md`](./HRMS_GUIDE.md) - Start here for complete document index

**Key Documents:**
- **Implementation Guide:** [`COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md) - Phased implementation plan
- **API Design:** [`PATH_COMPREHENSIVE_API_DESIGN.md`](./PATH_COMPREHENSIVE_API_DESIGN.md) - Complete endpoint specifications
- **Dynamic Employee Types:** [`DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md`](./DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md) - Employee type system details
- **Workflow Dynamic:** [`WORKFLOW_DYNAMICITY_EXPLANATION.md`](./WORKFLOW_DYNAMICITY_EXPLANATION.md) - Workflow flexibility explained

---

## 🔄 DOCUMENTATION PROTOCOL

### Before Implementing Anything:
1. ✅ Check [`HRMS_GUIDE.md`](./HRMS_GUIDE.md) for relevant documents
2. ✅ Read the relevant section in [`COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md)
3. ✅ Verify requirements in [`PATH_COMPREHENSIVE_API_DESIGN.md`](./PATH_COMPREHENSIVE_API_DESIGN.md)
4. ✅ Check this compass for principles and rules

### When Context is Lost:
1. ✅ Re-read [`HRMS_GUIDE.md`](./HRMS_GUIDE.md) - Navigation hub
2. ✅ Check current phase in [`COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md)
3. ✅ Review [`SYSTEM_COMPASS.md`](./SYSTEM_COMPASS.md) - This file for principles
4. ✅ Reference relevant detailed docs as needed

### When Questions Arise:
1. ✅ Check documentation first - Answer might already be there
2. ✅ If unclear or missing → **Ask to adjust/update the documentation**
3. ✅ Don't implement based on assumptions - Clarify in docs first
4. ✅ Documentation updates should happen before code changes

### Documentation Maintenance:
- **Docs are the source of truth** - Code should match docs
- **If code and docs differ** → Update docs first, then align code
- **New requirements** → Document first, then implement
- **Clarifications needed** → Update docs, don't just remember

### Phase Management:
- **If a phase is too big** → Split it into smaller parts
- **Document phase parts** in progress tracking files (e.g., `PHASE_X_PROGRESS.md`)
- **Highlight phase parts** clearly in progress documentation
- **Complete and validate each part** before moving to the next part
- **Update progress files** to track which parts are done
- **Example:** Phase 2 might be split into: Part A (Users), Part B (Roles), Part C (Permissions), Part D (Locations)

---

**Remember:** When in doubt, check this compass. If something feels hardcoded or rigid, it probably is - make it dynamic! **Always refer to documentation before implementing.**
