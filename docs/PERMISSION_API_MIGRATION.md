# Permission API Migration Issue

## What Happened?

### The Problem
When we restarted the Docker containers, the build process failed with TypeScript errors. The containers were running fine before because:

1. **Old Build Artifacts**: The previous Docker build had successfully compiled the code, even though it had type errors
2. **No Rebuild**: When containers were just restarted (not rebuilt), Docker used the existing image
3. **Fresh Build**: When we ran `docker compose up --build`, it triggered a fresh TypeScript compilation that caught all the errors

### The Root Cause

The permission checking functions (`checkPermission` and `requirePermission`) were refactored to require:
- **New Signature**: `checkPermission(user: AuthenticatedUser, permission: string, options: PermissionCheckOptions)`
- **Old Usage**: Many files still use `checkPermission(user.id: string, permission: string, null)`

### Why This Matters

1. **Type Safety**: TypeScript now enforces the correct types, preventing runtime errors
2. **Location-Aware Permissions**: The new API requires location context for proper permission checking
3. **Better Security**: Location-based permissions are more secure and accurate

## The Fix

We need to update all calls from:
```typescript
// OLD (WRONG)
const hasPermission = await checkPermission(user.id, 'permission', null);
```

To:
```typescript
// NEW (CORRECT)
const userWithLocation = await prisma.user.findUnique({
  where: { id: user.id },
  select: { primary_location_id: true },
});
const locationId = userWithLocation?.primary_location_id || 
  (await prisma.location.findFirst({ select: { id: true } }))?.id;
const hasPermission = await checkPermission(user, 'permission', { locationId });
```

## Prevention

To prevent this from happening again:
1. Add TypeScript strict mode checks in CI/CD
2. Add pre-commit hooks to catch type errors
3. Document API changes in migration guides
4. Use deprecation warnings before breaking changes
