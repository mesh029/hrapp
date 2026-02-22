# Setup Requirements & Verification

**Purpose:** Critical setup requirements to prevent import and path resolution issues in development and production.

---

## 🚨 Critical Files & Configurations

### 1. Path Mappings (`tsconfig.json`)

**Required Configuration:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/components/*": ["./components/*"],
      "@/*": ["./app/*"]
    }
  }
}
```

**Why:**
- `@/components/*` maps to root-level `components/` folder (for shadcn UI)
- `@/*` maps to `app/` folder (for app modules like `@/lib/*`)

**Verification:**
```bash
npm run verify:setup
```

---

### 2. Required File: `app/lib/utils.ts`

**Required Content:**
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge to resolve conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Why:**
- Shadcn UI components require `@/lib/utils` to import the `cn` function
- This utility merges Tailwind classes and resolves conflicts

**Location:** `app/lib/utils.ts` (NOT `lib/utils.ts` at root)

---

### 3. Required Dependencies

**Must be installed:**
```json
{
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  }
}
```

**Install if missing:**
```bash
npm install clsx tailwind-merge
```

---

## 📁 Project Structure

**Critical Structure:**
```
hrapp/
├── app/
│   └── lib/
│       └── utils.ts          ← REQUIRED: cn() function
├── components/
│   └── ui/                   ← shadcn UI components
│       ├── button.tsx
│       ├── tabs.tsx
│       └── card.tsx
├── tsconfig.json             ← REQUIRED: Path mappings
└── package.json              ← REQUIRED: Dependencies
```

---

## ✅ Setup Verification

### Automated Check

Run before building or deploying:
```bash
npm run verify:setup
```

This checks:
- ✅ `app/lib/utils.ts` exists and exports `cn`
- ✅ `tsconfig.json` has correct path mappings
- ✅ Required dependencies are installed
- ✅ UI components can resolve imports

### Manual Checklist

Before pushing to production:

- [ ] `app/lib/utils.ts` exists with `cn()` function
- [ ] `tsconfig.json` has both path mappings:
  - `"@/components/*": ["./components/*"]`
  - `"@/*": ["./app/*"]`
- [ ] `clsx` and `tailwind-merge` are in `package.json`
- [ ] `npm run verify:setup` passes all checks
- [ ] `npm run build` completes without errors
- [ ] No TypeScript errors in IDE

---

## 🔧 Troubleshooting

### Error: "Cannot find module '@/lib/utils'"

**Fix:**
1. Verify `app/lib/utils.ts` exists
2. Check it exports `cn` function
3. Verify `tsconfig.json` path mappings
4. Run `npm run verify:setup`

### Error: "Cannot find module '@/components/ui/*'"

**Fix:**
1. Verify `components/ui/` folder exists
2. Check `tsconfig.json` has `"@/components/*": ["./components/*"]`
3. Restart TypeScript server in IDE
4. Clear Next.js cache: `rm -rf .next`

### Error: "Module not found" in production build

**Fix:**
1. Run `npm run verify:setup` before building
2. Ensure all files are committed (not in `.gitignore`)
3. Check `package.json` dependencies are correct
4. Verify `tsconfig.json` is committed

---

## 🚀 Pre-Deployment Checklist

Before deploying to production:

1. **Run verification:**
   ```bash
   npm run verify:setup
   ```

2. **Test build:**
   ```bash
   npm run build
   ```

3. **Check for errors:**
   - No TypeScript errors
   - No module resolution errors
   - All imports resolve correctly

4. **Verify in CI/CD:**
   - Add `npm run verify:setup` to build pipeline
   - Fail build if verification fails

---

## 📝 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Verify Setup
  run: npm run verify:setup

- name: Build
  run: npm run build
```

### Pre-commit Hook (Optional)

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run verify:setup || exit 1
```

---

## 🔄 When This Breaks

**Common Causes:**
1. File deleted or moved
2. Path mappings changed incorrectly
3. Dependencies removed
4. Project structure changed

**Quick Fix:**
1. Run `npm run verify:setup` to identify issues
2. Follow the fix instructions in the output
3. Re-run verification until all checks pass

---

## 📚 Related Documentation

- [System Compass](./SYSTEM_COMPASS.md) - Core principles
- [Implementation Guide](./COMPREHENSIVE_IMPLEMENTATION_GUIDE.md) - Phase 0 setup
- [README.md](../README.md) - Project overview

---

**Last Updated:** After path mapping fixes  
**Maintained By:** Development team  
**Review Frequency:** Before each production deployment
