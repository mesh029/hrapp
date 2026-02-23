# Admin UI & Workflow Management Phases

**Date:** February 23, 2025  
**Purpose:** Phased implementation of admin UI configuration, approval timelines, workflow creators, and employee workflow assignment

---

## Phase 1: Admin UI Configuration System

### Goals
- Build admin interface to configure component visibility for different user categories
- Allow admins to control what UI elements users see without code changes
- Create user category management system

### Components
1. **Database Schema**
   - `UserCategory` model
   - `ComponentVisibilityConfig` model
   - `UserCategoryAssignment` model

2. **API Endpoints**
   - Component visibility CRUD
   - User category CRUD
   - User category assignment
   - Get user's visible components

3. **Admin UI**
   - Component Visibility Manager (`/administration/component-visibility`)
   - User Category Manager (`/administration/user-categories`)
   - Component preview and testing

### Status: 🚧 In Progress

---

## Phase 2: Approval Timeline View

### Goals
- Add approval timeline/history to leave request detail page
- Add approval timeline/history to timesheet detail page
- Show workflow steps, approvers, status changes, comments

### Components
1. **Timeline Component**
   - Visual timeline showing workflow progression
   - Step-by-step approval history
   - Comments and signatures
   - Status indicators

2. **API Integration**
   - Fetch workflow instance for leave/timesheet
   - Get workflow step instances with actor details
   - Format timeline data

3. **UI Pages**
   - Update leave request detail page
   - Update timesheet detail page

### Status: ⏳ Pending

---

## Phase 3: Interactive Workflow Creator

### Goals
- Build visual workflow template builder for leave requests
- Build visual workflow template builder for timesheets
- Drag-and-drop step ordering
- Step configuration (permissions, allow decline, allow adjust)

### Components
1. **Workflow Builder UI**
   - Visual step editor (React Flow)
   - Step configuration form
   - Permission selector
   - Preview mode

2. **API Endpoints**
   - Create/update workflow templates
   - Validate workflow structure
   - Test workflow execution

3. **Features**
   - Drag-and-drop step reordering
   - Add/remove steps
   - Configure step properties
   - Save as draft/publish

### Status: ⏳ Pending

---

## Phase 4: Employee Workflow Assignment

### Goals
- Interactive workflow assignment interface
- Configure workflows for existing employees
- Location-based workflow assignment
- Bulk assignment capabilities

### Components
1. **Assignment UI**
   - Employee selector
   - Workflow template selector
   - Location-based filtering
   - Bulk operations

2. **API Endpoints**
   - Assign workflow to user
   - Get user's assigned workflow
   - Bulk assignment
   - Workflow override per user

3. **Features**
   - Search and filter employees
   - Preview workflow before assignment
   - Assignment history
   - Override default workflow per user

### Status: ⏳ Pending

---

## Implementation Order

1. ✅ **Phase 1** - Admin UI Configuration (Foundation)
2. ⏳ **Phase 2** - Approval Timeline (Quick Win)
3. ⏳ **Phase 3** - Workflow Creator (Core Feature)
4. ⏳ **Phase 4** - Employee Assignment (Completion)

---

## Dependencies

- Phase 1: No dependencies
- Phase 2: Requires workflow system (already exists)
- Phase 3: Requires workflow API (already exists)
- Phase 4: Requires Phase 3 completion

---

## Timeline Estimate

- Phase 1: 2-3 days
- Phase 2: 1 day
- Phase 3: 3-4 days
- Phase 4: 2 days

**Total:** ~8-10 days
