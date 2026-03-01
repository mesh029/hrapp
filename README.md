# PATH HR Management System

Multi-location HR management system with configurable workflows, leave management, and timesheet tracking.

## Requirements

- **Node.js:** 20.x or higher
- **Docker:** 20.x or higher
- **Docker Compose:** 2.x or higher
- **PostgreSQL:** 15 (via Docker)
- **Redis:** 7 (via Docker)

## Docker Services

Docker is used to run three services:

1. **PostgreSQL Database** - Stores all application data (users, leave requests, timesheets, workflows)
2. **Redis Cache** - Handles session management and caching
3. **API Application** - Next.js application serving API routes and frontend

All services run in isolated containers managed by Docker Compose.

## Project Structure

- **API Routes:** `app/api/` (Next.js API routes)
- **Frontend:** `app/` (Next.js pages and components)
- **Database:** `prisma/` (Prisma schema and migrations)
- **Docker:** Root directory (docker-compose.yml, Dockerfile)

## Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd hrapp
npm install
```

### 2. Environment Configuration

Create `.env` file:

```env
# Database
DATABASE_URL="postgresql://root:oneeyedragon@localhost:5433/hrapp_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6380"

# JWT (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="your_jwt_secret_min_32_chars"
JWT_REFRESH_SECRET="your_refresh_secret_min_32_chars"

# Application
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start Docker Containers

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify containers are running
docker-compose ps
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Application runs at `http://localhost:3001`

## Production Deployment

### 1. Create Production Environment File

Create `.env.prod`:

```env
POSTGRES_USER=hrapp_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=hrapp_db
POSTGRES_PORT=5432

REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379

JWT_SECRET=your_jwt_secret_min_32_chars
NEXT_PUBLIC_API_URL=http://your-domain.com
API_PORT=3000
```

### 2. Start Production Containers

```bash
# Build and start all services (from project root)
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run migrations (API container runs from root directory)
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed database (optional)
docker-compose -f docker-compose.prod.yml exec api npm run db:seed
```

### 3. Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Test API health
curl http://localhost:3000/api/health
```

## Docker Commands

All commands run from the project root directory:

```bash
# Start services (PostgreSQL, Redis, API)
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View API logs only
docker-compose logs -f api

# Restart API
docker-compose restart api

# Rebuild API (after code changes)
docker-compose build api
docker-compose up -d api
```

## Database Backups

### Create Backup

```bash
# Backup PostgreSQL database (from project root)
docker-compose exec postgres pg_dump -U root hrapp_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using docker exec directly
docker exec hrapp-postgres pg_dump -U root hrapp_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Backup

```bash
# Restore from backup file
docker-compose exec -T postgres psql -U root hrapp_db < backup_20250127_120000.sql

# Or using docker exec directly
docker exec -i hrapp-postgres psql -U root hrapp_db < backup_20250127_120000.sql
```

### Production Backups

```bash
# Production backup (using production compose file)
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U ${POSTGRES_USER:-hrapp_user} ${POSTGRES_DB:-hrapp_db} > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U ${POSTGRES_USER:-hrapp_user} ${POSTGRES_DB:-hrapp_db} | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Automated Backup Script

Create a cron job for daily backups:

```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/hrapp && docker-compose exec -T postgres pg_dump -U root hrapp_db | gzip > /backups/hrapp_backup_$(date +\%Y\%m\%d).sql.gz
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Cache:** Redis
- **Authentication:** JWT

## Documentation

Complete documentation available in [`docs/`](./docs/) folder.

**Start here:** [`docs/HRMS_GUIDE.md`](./docs/HRMS_GUIDE.md)
