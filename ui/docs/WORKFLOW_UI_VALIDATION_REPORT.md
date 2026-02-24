# Workflow UI Validation Report

**Date:** February 24, 2025  
**Status:** In Progress  
**Scenario:** See `WORKFLOW_TEST_SCENARIO.md`

---

## Issues Found

### 1. ApproverPreviewDialog Missing onPreviewApprovers in Edit Template Page

**Location:** `app/workflows/templates/[id]/page.tsx`  
**Issue:** The `StepConfigurationDialog` in the edit template page is not passed the `onPreviewApprovers` callback, so users cannot preview approvers when editing steps.  
**Severity:** Medium  
**Fix Required:** Add `onPreviewApprovers` handler and `ApproverPreviewDialog` component to edit template page.

### 2. Conditional Rules Not Validated

**Location:** `components/workflows/StepConfigurationDialog.tsx`  
**Issue:** Conditional rules can be added but there's no validation that they're properly formatted or that the condition field is not empty.  
**Severity:** Low  
**Fix Required:** Add validation for conditional rules before saving.

### 3. Location Scope Parent/Descendants Not Fully Implemented

**Location:** `app/api/workflows/templates/preview-approvers/route.ts`  
**Issue:** The preview-approvers API has TODO comments for parent and descendants location scope checks. They currently fall back to 'same' location check.  
**Severity:** Medium  
**Fix Required:** Implement proper parent/descendants location checking using location hierarchy.

### 4. Step Index Calculation Issue in Edit Template

**Location:** `app/workflows/templates/[id]/page.tsx`  
**Issue:** When adding a new step, `stepIndex` is calculated as `formData.steps.length`, but this might not account for the step_order correctly if steps are reordered.  
**Severity:** Low  
**Fix Required:** Ensure step_order is correctly calculated when adding new steps.

---

## Validation Checklist

### Template Creation Page (`/workflows/templates/new`)

- [x] Resource type dropdown shows: `leave`, `timesheet` ✅
- [x] Location dropdown loads and shows all active locations ✅
- [x] Staff type dropdown shows all staff types with "All Employee Types" option ✅
- [x] Leave type dropdown shows all leave types (only for leave workflows) ✅
- [x] "Add Step" button opens StepConfigurationDialog ✅
- [x] StepConfigurationDialog shows all required fields ✅
- [x] Required permission dropdown is filtered by resource type ✅
- [x] Approver strategy dropdown shows all 4 options ✅
- [x] Include manager toggle appears for combined/permission strategies ✅
- [x] Required roles multi-select shows all roles ✅
- [x] Location scope dropdown shows all 4 options ✅
- [x] Allow decline toggle works ✅
- [x] Allow adjust toggle works ✅
- [x] Conditional rules builder is present (advanced) ✅
- [x] Drag-and-drop reordering works ✅
- [x] Step preview shows correct approvers (when location is selected) ✅
- [x] Template can be saved successfully ✅
- [ ] Validation prevents saving if role-based step has no roles selected ✅
- [ ] Validation prevents saving if required permission is missing ✅

### Template Edit Page (`/workflows/templates/[id]`)

- [x] All fields from creation page are editable ✅
- [x] "Add Step" button works (opens dialog) ✅
- [x] "Edit" button on existing steps works ✅
- [x] Step removal works (with confirmation) ✅
- [x] Changes can be saved ✅
- [ ] **ISSUE:** Approver preview not available in edit mode ❌

### Workflow Simulator (`/workflows/test/simulator`)

- [x] Template dropdown shows all active templates ✅
- [x] Employee dropdown shows all active users ✅
- [x] "Create Request & Start Simulation" creates real data ✅
- [x] Simulation shows all steps with correct approvers ✅
- [x] Approve button works for each step ✅
- [x] Decline button works for each step ✅
- [x] Timeline updates correctly after each action ✅
- [x] Link to created leave/timesheet works ✅
- [x] Auto-run works correctly ✅

### Step Configuration Dialog

- [x] Required permission field is required ✅
- [x] Approver strategy options are correct ✅
- [x] Include manager toggle appears conditionally ✅
- [x] Required roles selection works ✅
- [x] Location scope options are correct ✅
- [x] Allow decline toggle works ✅
- [x] Allow adjust toggle works ✅
- [x] Conditional rules can be added/removed ✅
- [ ] **ISSUE:** Conditional rules validation is missing ⚠️
- [x] Preview approvers button works (when location is selected) ✅

### Approver Preview Dialog

- [x] Employee selection dropdown works ✅
- [x] Preview button resolves approvers correctly ✅
- [x] Approvers are displayed with source (manager/role/permission) ✅
- [x] Error handling works ✅
- [ ] **ISSUE:** Parent/descendants location scope not fully implemented ⚠️

---

## API Validation

### Workflow Template API (`/api/workflows/templates`)

- [x] GET endpoint returns templates with filters ✅
- [x] POST endpoint creates templates with all fields ✅
- [x] Staff type filter works ✅
- [x] Leave type filter works (only for leave) ✅
- [x] Location filter works ✅
- [x] Resource type filter works ✅

### Preview Approvers API (`/api/workflows/templates/preview-approvers`)

- [x] POST endpoint accepts step configuration ✅
- [x] Manager strategy resolution works ✅
- [x] Role strategy resolution works ✅
- [x] Permission strategy resolution works ✅
- [x] Combined strategy resolution works ✅
- [x] Location scope 'same' works ✅
- [x] Location scope 'all' works ✅
- [ ] **ISSUE:** Location scope 'parent' not implemented ⚠️
- [ ] **ISSUE:** Location scope 'descendants' not implemented ⚠️

### Workflow Simulation API (`/api/workflows/test/simulate`)

- [x] Creates real leave requests ✅
- [x] Creates real timesheets ✅
- [x] Creates workflow instances ✅
- [x] Resolves approvers correctly ✅
- [x] Returns simulation state ✅

---

## Recommendations

1. **Fix Approver Preview in Edit Template:** Add `ApproverPreviewDialog` and `onPreviewApprovers` handler to edit template page.

2. **Implement Location Hierarchy:** Complete the parent/descendants location scope checks in the preview-approvers API and workflow service.

3. **Add Conditional Rules Validation:** Validate that conditional rules have non-empty conditions before saving.

4. **Add Step Order Validation:** Ensure step_order is always sequential and unique when adding/editing steps.

5. **Improve Error Messages:** Add more descriptive error messages for validation failures.

---

## Test Execution Plan

1. **Phase 1:** Fix identified issues
2. **Phase 2:** Re-test all functionality
3. **Phase 3:** Execute full scenario test (see `WORKFLOW_TEST_SCENARIO.md`)
4. **Phase 4:** Document results
