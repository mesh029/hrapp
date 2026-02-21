# System Credentials & Connection Information

**Purpose:** Centralized reference for all system credentials, usernames, passwords, and connection details used throughout the HRMS application.

**⚠️ SECURITY NOTE:** This document contains sensitive information. In production, use environment variables and secure secret management. Never commit actual production credentials to version control.

---

## Database Credentials

### PostgreSQL Database
- **Username:** `root`
- **Password:** `oneeyedragon`
- **Database Name:** `hrapp_db`
- **Host:** `localhost` (development) / `postgres` (Docker)
- **Port:** `5432`
- **Connection String Format:** `postgresql://root:oneeyedragon@localhost:5432/hrapp_db?schema=public`

### Redis Cache
- **Host:** `localhost` (development) / `redis` (Docker)
- **Port:** `6379`
- **Password:** None (development) / Configure in production
- **Connection String Format:** `redis://localhost:6379`

---

## Docker Services

### PostgreSQL Container
- **Container Name:** `hrapp-postgres`
- **Image:** `postgres:15-alpine`
- **Environment Variables:**
  - `POSTGRES_USER=root`
  - `POSTGRES_PASSWORD=oneeyedragon`
  - `POSTGRES_DB=hrapp_db`

### Redis Container
- **Container Name:** `hrapp-redis`
- **Image:** `redis:7-alpine`
- **Port:** `6379`

---

## Application Users

### Default Admin User (Seed Data)
- **Email:** `admin@path.org` (to be created in Phase 1)
- **Password:** `oneeyedragon` (will be hashed with bcrypt)
- **Role:** System Administrator
- **Status:** Active

**Note:** This user will be created via seed script in Phase 1. Password will be hashed before storage.

---

## JWT Secrets

### Development Secrets
- **JWT_SECRET:** `your-super-secret-jwt-key-change-in-production`
- **JWT_REFRESH_SECRET:** `your-super-secret-refresh-key-change-in-production`

**⚠️ IMPORTANT:** Generate strong, unique secrets for production:
```bash
# Generate strong JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment Variables Summary

### Database
```env
DATABASE_URL="postgresql://root:oneeyedragon@localhost:5432/hrapp_db?schema=public"
```

### Redis
```env
REDIS_URL="redis://localhost:6379"
```

### JWT
```env
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800
```

### Application
```env
NODE_ENV="development"
PORT=3000
```

---

## Production Considerations

### Database
- Use managed database services (DigitalOcean, AWS RDS, etc.)
- Enable SSL/TLS connections
- Use connection pooling
- Set up automated backups
- Use strong, unique passwords

### Redis
- Use managed Redis services (DigitalOcean, AWS ElastiCache, etc.)
- Enable authentication in production
- Use SSL/TLS connections
- Set up persistence and backups

### Secrets Management
- Use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate secrets regularly
- Never hardcode secrets in code
- Use environment variables or secure config files

---

## Connection Testing

### Test PostgreSQL Connection
```bash
psql -h localhost -U root -d hrapp_db
# Password: oneeyedragon
```

### Test Redis Connection
```bash
redis-cli -h localhost -p 6379
# Or from Docker:
docker exec -it hrapp-redis redis-cli
```

---

## Credential Rotation Policy

1. **Database Passwords:** Rotate every 90 days
2. **JWT Secrets:** Rotate every 180 days
3. **Application Secrets:** Rotate every 90 days
4. **User Passwords:** Enforce password policy (min 8 chars, complexity requirements)

---

**Last Updated:** 2025-01-27  
**Version:** 1.0  
**Status:** Development Credentials
