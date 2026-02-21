# PATH HRMS - Complete System Guide

**Purpose:** Central navigation hub for all system documentation. This is your starting point for understanding and implementing the PATH HR Management System.

---

## 🧭 QUICK START

**New to the system?** Start here:
1. Read [System Compass](#system-compass) - Critical principles and rules
2. Read [Company Requirements](#company-requirements) - Understand the business context
3. Read [API Design](#api-design) - Complete endpoint specifications
4. Follow [Implementation Guide](#implementation-guide) - Phased development plan

**Ready to code?** Reference:
- [System Compass](./SYSTEM_COMPASS.md) - Your implementation compass
- [Implementation Guide](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md) - Phase-by-phase plan

---

## 📚 DOCUMENT INDEX

### 🧭 System Compass
**File:** [`SYSTEM_COMPASS.md`](./SYSTEM_COMPASS.md)  
**Purpose:** Quick reference guide for critical principles, dynamic elements, and enforcement rules  
**Use When:** You need to verify you're following system rules and principles  
**Contains:**
- Core principles (non-negotiable)
- Dynamic elements checklist
- Database schema principles
- Security enforcement rules
- Integration points
- Critical validations
- System invariants
- Common pitfalls

---

### 🏢 Company Requirements
**File:** [`PATH_COMPANY_REQUIREMENTS.md`](./PATH_COMPANY_REQUIREMENTS.md)  
**Purpose:** Original business requirements and context from PATH organization  
**Use When:** You need to understand the business logic and requirements  
**Contains:**
- PATH organization structure
- Staff types and locations
- Leave and timesheet requirements
- Approval workflow needs
- Delegation requirements

---

### 🔌 API Design
**File:** [`PATH_COMPREHENSIVE_API_DESIGN.md`](./PATH_COMPREHENSIVE_API_DESIGN.md)  
**Purpose:** Complete API endpoint specifications and workflow scenarios  
**Use When:** Implementing endpoints, understanding request/response formats, workflow logic  
**Contains:**
- Complete API endpoint catalog
- Request/response specifications
- Workflow scenarios (leave, timesheet, delegation)
- Database schema enhancements
- Error handling standards
- Digital signatures & timestamps
- Notification system design
- Reporting & dashboard APIs

---

### 👥 Dynamic Employee Type System
**File:** [`DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md`](./DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md)  
**Purpose:** Detailed explanation of how employee types work dynamically  
**Use When:** Implementing employee type management, work hours, or approver assignment  
**Contains:**
- Dynamic employee type creation & management
- Work hours configuration per employee type
- Leave entitlements per employee type
- Dynamic approver assignment
- Runtime configuration examples
- API endpoints for employee types

---

### 🔄 Workflow Dynamic Configuration
**File:** [`WORKFLOW_DYNAMICITY_EXPLANATION.md`](./WORKFLOW_DYNAMICITY_EXPLANATION.md)  
**Purpose:** Deep dive into workflow flexibility and dynamic configuration  
**Use When:** Building workflow engine, need to understand workflow flexibility  
**Contains:**
- Zero hardcoded workflows principle
- Default templates vs. hardcoded logic
- Workflow resolution logic
- API examples for custom workflows
- Database schema (no hardcoded constraints)
- Implementation logic examples

---

### 🛠️ Implementation Guide
**File:** [`COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md)  
**Purpose:** Strategic phased implementation plan with flow and direction  
**Use When:** Starting development, need to know what to build next  
**Contains:**
- 10-phase implementation plan
- Strategic flow for each phase
- Key architectural decisions
- Integration points
- Validation checklists
- Project setup & structure
- Docker configuration
- Database setup & migrations
- Core business logic
- Testing strategy
- Deployment guide

---

### 📋 Implementation Plan
**File:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)  
**Purpose:** Technical implementation details and system invariants  
**Use When:** Need technical details on core system invariants and architecture  
**Contains:**
- Core system invariants
- Authority formula
- Workflow state model
- Dynamic configuration principle
- API endpoint organization by phase
- Technical architecture decisions

---

### 📊 Workflow Diagrams
**File:** [`REACT_FLOW_WORKFLOW_DIAGRAMS.md`](./REACT_FLOW_WORKFLOW_DIAGRAMS.md)  
**Purpose:** Documentation of React Flow workflow visualizations  
**Use When:** Understanding workflow visualizations, component structure  
**Contains:**
- Workflow diagram descriptions
- Component file references
- Node and edge counts
- Mermaid reference diagrams

---

### 🎨 Workflow Visualization Setup
**File:** [`WORKFLOW_VISUALIZATION_SETUP.md`](./WORKFLOW_VISUALIZATION_SETUP.md)  
**Purpose:** Setup and configuration for React Flow workflow diagrams  
**Use When:** Setting up or modifying workflow visualization components  
**Contains:**
- React Flow setup instructions
- Component structure
- Styling guidelines

---

### 📄 Engineering Specification
**File:** [`HRH_API_Comprehensive_Engineering_Specification.pdf`](./HRH_API_Comprehensive_Engineering_Specification.pdf)  
**Purpose:** Original engineering specification document  
**Use When:** Reference for original specifications

---

## 🗺️ NAVIGATION BY TASK

### I'm Starting Development
1. Read [System Compass](./SYSTEM_COMPASS.md) - Understand the rules
2. Follow [Implementation Guide - Phase 0](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md#phase-0-foundation--infrastructure) - Set up project

### I'm Building an API Endpoint
1. Check [API Design](./PATH_COMPREHENSIVE_API_DESIGN.md) - See endpoint specification
2. Verify [System Compass - Security](./SYSTEM_COMPASS.md#-security-enforcement) - Follow auth/authorization rules
3. Check [System Compass - Validations](./SYSTEM_COMPASS.md#-critical-validations) - Required validations

### I'm Implementing Workflows
1. Read [Workflow Dynamic Explanation](./WORKFLOW_DYNAMICITY_EXPLANATION.md) - Understand flexibility
2. Check [System Compass - Dynamic Elements](./SYSTEM_COMPASS.md#-dynamic-elements-must-be-configurable) - Workflow rules
3. Reference [API Design - Workflow Endpoints](./PATH_COMPREHENSIVE_API_DESIGN.md#workflow-template-endpoints) - Endpoint specs

### I'm Working with Employee Types
1. Read [Dynamic Employee Type System](./DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md) - Complete guide
2. Check [API Design - Employee Type Endpoints](./PATH_COMPREHENSIVE_API_DESIGN.md#employee-type-management-endpoints) - API specs

### I Need to Understand Business Logic
1. Read [Company Requirements](./PATH_COMPANY_REQUIREMENTS.md) - Business context
2. Check [API Design - Workflow Scenarios](./PATH_COMPREHENSIVE_API_DESIGN.md#part-2-workflow-scenarios-based-on-path-story) - Real-world examples

### I'm Testing
1. Check [Implementation Guide - Testing Strategy](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md#testing-strategy) - Testing approach
2. Verify [System Compass - Checklist](./SYSTEM_COMPASS.md#-quick-checklist-before-moving-to-next-phase) - Phase completion

### I Need Quick Reference
1. Open [System Compass](./SYSTEM_COMPASS.md) - Quick rules and principles
2. Check relevant section in [API Design](./PATH_COMPREHENSIVE_API_DESIGN.md) - Endpoint details

---

## 🎯 DOCUMENT HIERARCHY

```
HRMS_GUIDE.md (This File - Start Here)
│
├── 🧭 SYSTEM_COMPASS.md (Quick Reference - Rules & Principles)
│
├── 📋 IMPLEMENTATION_GUIDE.md (Phased Development Plan)
│   └── Phase 0 → Phase 10 implementation flow
│
├── 🔌 API_DESIGN.md (Complete API Specifications)
│   ├── Endpoint Catalog
│   ├── Request/Response Specs
│   ├── Workflow Scenarios
│   └── Database Schema
│
├── 👥 EMPLOYEE_TYPE_SYSTEM.md (Employee Type Details)
│
├── 🔄 WORKFLOW_DYNAMICITY.md (Workflow Flexibility)
│
├── 🏢 COMPANY_REQUIREMENTS.md (Business Context)
│
└── 📊 Other Supporting Docs
    ├── IMPLEMENTATION_PLAN.md
    ├── REACT_FLOW_DIAGRAMS.md
    └── WORKFLOW_VISUALIZATION_SETUP.md
```

---

## ⚡ QUICK REFERENCE

### Most Important Documents
1. **System Compass** - Your daily reference for rules and principles
2. **Implementation Guide** - Your roadmap for building
3. **API Design** - Your specification for endpoints

### When to Use Each Document
- **Starting a new phase?** → Implementation Guide
- **Building an endpoint?** → API Design + System Compass
- **Need to verify a rule?** → System Compass
- **Understanding business logic?** → Company Requirements
- **Working with workflows?** → Workflow Dynamic Explanation
- **Working with employee types?** → Dynamic Employee Type System

---

## 🔑 KEY PRINCIPLES (Quick Reminder)

1. **Dynamic First** - No hardcoded business logic
2. **Authority Formula** - Permission ∩ Location Scope ∩ Delegation ∩ Workflow Step ∩ Active Status
3. **Version Isolation** - Template changes don't affect running instances
4. **Audit Trail** - All state changes must be logged
5. **Soft Deletes** - Never hard delete core entities

---

**Last Updated:** 2025-02-21  
**Version:** 1.0  
**Status:** Ready for Implementation
