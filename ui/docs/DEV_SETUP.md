# Development Setup Guide

**Date:** February 22, 2025

---

## Port Configuration

### Issue: Port Conflict

When running `npm run dev`, Next.js runs on port 3000 and serves:
- Frontend pages
- API routes at `/api/*`

If Docker API container is also running on port 3000, there will be a conflict.

---

## Solution Options

### Option 1: Use Next.js Dev Server (Recommended for UI Development)

**Stop Docker API:**
```bash
docker compose stop api
```

**Start Dev Server:**
```bash
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- API Routes: http://localhost:3000/api/*

**Pros:**
- Hot reload for UI changes
- Faster development cycle
- API routes work automatically

**Cons:**
- Need to stop Docker API first

---

### Option 2: Use Docker API + Dev Server on Different Port

**Keep Docker API running:**
```bash
docker compose up -d api
```

**Start Dev Server on Different Port:**
```bash
PORT=3001 npm run dev
```

**Update API Base URL:**
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Access:**
- Frontend: http://localhost:3001
- API: http://localhost:3000 (Docker)

**Pros:**
- Can test against production-like API
- Both services run simultaneously

**Cons:**
- Need to configure CORS
- Need to update API base URL

---

### Option 3: Use Docker for Everything

**Start All Services:**
```bash
docker compose up -d
```

**Access:**
- Frontend + API: http://localhost:3000

**Pros:**
- Production-like environment
- All services managed together

**Cons:**
- Slower development cycle
- Need to rebuild Docker image for changes

---

## Recommended Workflow

### For UI Development (Phase 2+)

1. **Stop Docker API:**
   ```bash
   docker compose stop api
   ```

2. **Start Dev Server:**
   ```bash
   npm run dev
   ```

3. **Access Application:**
   - Login: http://localhost:3000/login
   - Credentials: `admin@path.org` / `oneeyedragon`

4. **Make UI Changes:**
   - Changes hot-reload automatically
   - API routes work via Next.js

### For API Testing

1. **Start Docker Services:**
   ```bash
   docker compose up -d
   ```

2. **Test API:**
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## Troubleshooting

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process or stop Docker container
docker compose stop api
# OR
kill -9 <PID>
```

### API Routes Not Working

**Check:**
1. Dev server is running: `npm run dev`
2. API routes exist in `app/api/`
3. No port conflicts
4. Check browser console for errors

### Login Not Working

**Check:**
1. Database is seeded: `npm run db:seed`
2. Admin user exists: `admin@path.org`
3. Password is correct: `oneeyedragon`
4. API endpoint works: Test with curl
5. Browser console for errors

---

## Environment Variables

### Development (.env.local)

```env
# Database (if using local)
DATABASE_URL=postgresql://root:oneeyedragon@localhost:5433/hrapp_db?schema=public

# Redis (if using local)
REDIS_URL=redis://localhost:6380

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# API URL (if using Docker API)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Quick Start Commands

### Start Development (UI Focus)
```bash
# Stop Docker API
docker compose stop api

# Start dev server
npm run dev

# Access: http://localhost:3000
```

### Start Full Stack (Docker)
```bash
# Start all services
docker compose up -d

# Access: http://localhost:3000
```

### Reset Database
```bash
# Re-seed database
npm run db:seed
```

---

**Last Updated:** February 22, 2025
