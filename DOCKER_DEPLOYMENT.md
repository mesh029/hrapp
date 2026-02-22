# Docker Deployment Guide

## Quick Start

### 1. Create `.env.prod` file

```bash
cp .env.example .env.prod
```

Edit `.env.prod`:
```env
# Database
POSTGRES_USER=hrapp_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=hrapp_db
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379

# API
JWT_SECRET=your_jwt_secret_min_32_chars
NEXT_PUBLIC_API_URL=http://your-domain.com
API_PORT=3000
```

### 2. Deploy

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed database (optional)
docker-compose -f docker-compose.prod.yml exec api npm run db:seed
```

### 3. Verify

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f api

# Test API
curl http://localhost:3000/api/health
```

## Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart API
docker-compose -f docker-compose.prod.yml restart api

# Rebuild API
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api
```

## Production Setup

### With Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Base URL

- **Local:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `REDIS_PASSWORD` | Yes | Redis password |
| `JWT_SECRET` | Yes | JWT secret (min 32 chars) |
| `NEXT_PUBLIC_API_URL` | No | Public API URL |
| `POSTGRES_USER` | No | PostgreSQL user (default: hrapp_user) |
| `POSTGRES_DB` | No | Database name (default: hrapp_db) |

## Troubleshooting

**API won't start:**
```bash
docker-compose -f docker-compose.prod.yml logs api
```

**Database connection error:**
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U hrapp_user -d hrapp_db
```

**Rebuild everything:**
```bash
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

---

**That's it!** Your API is now running in Docker.
