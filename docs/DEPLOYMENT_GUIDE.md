# HR App API - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the HR App API to a cloud server (AWS, DigitalOcean, Azure, etc.) or any Linux-based server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+
- Git
- PM2 (for process management) or systemd

### Required Accounts
- Cloud server account (AWS, DigitalOcean, Azure, etc.)
- Domain name (optional, for production)

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Git
sudo apt install -y git

# Install PM2 globally (optional but recommended)
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

### 2. Create Application User

```bash
# Create a dedicated user for the application
sudo adduser --disabled-password --gecos "" hrapp
sudo su - hrapp
```

### 3. Clone Repository

```bash
# Clone your repository
git clone <your-repo-url> /home/hrapp/hrapp
cd /home/hrapp/hrapp
```

## Database Setup

### 1. PostgreSQL Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE hrapp_db;
CREATE USER hrapp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE hrapp_db TO hrapp_user;
\q
```

### 2. Redis Configuration

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Set bind address (0.0.0.0 for remote access, 127.0.0.1 for local only)
bind 127.0.0.1

# Set password (optional but recommended)
requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

## Application Deployment

### 1. Install Dependencies

```bash
cd /home/hrapp/hrapp
npm install
```

### 2. Environment Configuration

Create `.env` file:

```bash
nano .env
```

Add the following configuration:

```env
# Database
DATABASE_URL="postgresql://hrapp_user:your_secure_password@localhost:5432/hrapp_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="your_redis_password"

# JWT Secret (generate a strong random string)
JWT_SECRET="your_jwt_secret_key_here_min_32_chars"

# Application
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=http://your-domain.com/api

# Email (if using email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@your-domain.com
```

### 3. Generate JWT Secret

```bash
# Generate a secure random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run db:seed
```

### 5. Build Application

```bash
# Build Next.js application
npm run build
```

## Process Management

### Option 1: PM2 (Recommended)

```bash
# Create PM2 ecosystem file
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [{
    name: 'hrapp-api',
    script: 'npm',
    args: 'start',
    cwd: '/home/hrapp/hrapp',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2: Systemd

Create service file:

```bash
sudo nano /etc/systemd/system/hrapp.service
```

Add:

```ini
[Unit]
Description=HR App API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=hrapp
WorkingDirectory=/home/hrapp/hrapp
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hrapp
sudo systemctl start hrapp
sudo systemctl status hrapp
```

## Reverse Proxy (Nginx)

### 1. Install Nginx

```bash
sudo apt install -y nginx
```

### 2. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/hrapp
```

Add:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

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

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/hrapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is set up automatically
```

## Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Check application status
pm2 status
# or
sudo systemctl status hrapp

# Check logs
pm2 logs
# or
sudo journalctl -u hrapp -f

# Test API endpoint
curl http://localhost:3000/api/health
```

### 2. Health Check Endpoint

Create a health check endpoint:

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 503 }
    );
  }
}
```

### 3. Monitoring

Set up monitoring with:
- PM2 monitoring: `pm2 monit`
- Log aggregation: Use PM2 logs or systemd journal
- Application monitoring: Consider Sentry, DataDog, or similar

## Environment Configuration Details

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Redis password (if set) | `your_redis_password` |
| `JWT_SECRET` | Secret for JWT tokens | `min_32_characters_long` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |

### Optional Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server for emails | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password | `your-app-password` |
| `SMTP_FROM` | From email address | `noreply@your-domain.com` |
| `NEXT_PUBLIC_API_URL` | Public API URL | `https://api.your-domain.com` |

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U hrapp_user -d hrapp_db -h localhost

# Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Redis Connection Issues

```bash
# Check Redis status
sudo systemctl status redis-server

# Test connection
redis-cli ping

# Check logs
sudo tail -f /var/log/redis/redis-server.log
```

### Application Issues

```bash
# Check application logs
pm2 logs hrapp-api
# or
sudo journalctl -u hrapp -n 100

# Restart application
pm2 restart hrapp-api
# or
sudo systemctl restart hrapp

# Check port usage
sudo netstat -tlnp | grep 3000
```

### Nginx Issues

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

## Security Best Practices

1. **Firewall**: Only open necessary ports
2. **SSL/TLS**: Always use HTTPS in production
3. **Secrets**: Never commit `.env` file to git
4. **Database**: Use strong passwords and limit access
5. **Updates**: Keep system and dependencies updated
6. **Backups**: Set up regular database backups
7. **Monitoring**: Set up application and server monitoring

## Backup Strategy

### Database Backup

```bash
# Create backup script
nano /home/hrapp/backup-db.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/home/hrapp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U hrapp_user hrapp_db > "$BACKUP_DIR/hrapp_db_$DATE.sql"
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

Make executable and schedule:

```bash
chmod +x /home/hrapp/backup-db.sh
crontab -e
# Add: 0 2 * * * /home/hrapp/backup-db.sh
```

## Scaling

### Horizontal Scaling

- Use PM2 cluster mode (already configured)
- Add more instances behind load balancer
- Use Redis for session storage

### Database Scaling

- Consider read replicas for read-heavy workloads
- Use connection pooling
- Monitor query performance

## Support

For issues or questions:
1. Check logs first
2. Review this deployment guide
3. Check API documentation
4. Review troubleshooting section

---

**Last Updated:** 2025-01-24
**Version:** 1.0.0
