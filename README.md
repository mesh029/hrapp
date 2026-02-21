# PATH HR Management System

A fully dynamic, multi-location HR management system with configurable workflows, leave management, and timesheet tracking.

## 📚 Documentation

**All documentation is located in the [`docs/`](./docs/) folder.**

**Start here:** [`docs/HRMS_GUIDE.md`](./docs/HRMS_GUIDE.md) - Complete system guide and navigation hub

### Quick Links

- 🧭 **[System Compass](./docs/SYSTEM_COMPASS.md)** - Quick reference for rules and principles
- 🛠️ **[Implementation Guide](./docs/COMPREHENSIVE_IMPLEMENTATION_GUIDE.md)** - Phased development plan
- 🔌 **[API Design](./docs/PATH_COMPREHENSIVE_API_DESIGN.md)** - Complete API specifications
- 👥 **[Employee Types](./docs/DYNAMIC_EMPLOYEE_TYPE_SYSTEM.md)** - Dynamic employee type system
- 🔄 **[Workflow Dynamic](./docs/WORKFLOW_DYNAMICITY_EXPLANATION.md)** - Workflow flexibility guide

## 🚀 Getting Started

1. Read [`docs/HRMS_GUIDE.md`](./docs/HRMS_GUIDE.md) for complete documentation index
2. Follow [`docs/COMPREHENSIVE_IMPLEMENTATION_GUIDE.md`](./docs/COMPREHENSIVE_IMPLEMENTATION_GUIDE.md) Phase 0 for setup
3. Reference [`docs/SYSTEM_COMPASS.md`](./docs/SYSTEM_COMPASS.md) during development

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Cache:** Redis
- **Authentication:** JWT
- **UI:** React Flow, shadcn/ui, Tailwind CSS

## 📁 Project Structure

```
hrapp/
├── docs/                    # 📚 All documentation (context folder)
│   ├── HRMS_GUIDE.md       # Main navigation hub
│   ├── SYSTEM_COMPASS.md   # Quick reference
│   └── ...                  # Other documentation
├── app/                     # Next.js app directory
│   ├── api/                # API routes
│   └── workflows/          # Workflow visualization pages
├── components/              # React components
│   ├── ui/                 # shadcn/ui components
│   └── workflows/          # React Flow workflow diagrams
└── lib/                     # Utilities and services
```

## 🔑 Key Principles

1. **Dynamic First** - No hardcoded business logic
2. **Authority Formula** - Multi-layer permission checks
3. **Version Isolation** - Template changes don't affect running instances
4. **Audit Trail** - All state changes logged
5. **Soft Deletes** - Never hard delete core entities

---

**For complete documentation, see [`docs/HRMS_GUIDE.md`](./docs/HRMS_GUIDE.md)**
