# Quick Start - API Deployment

## For Cloud Server Deployment

This is a condensed guide for quickly deploying the HR App API to a cloud server.

## Prerequisites Checklist

- [ ] Cloud server (Ubuntu 20.04+ recommended)
- [ ] Domain name (optional)
- [ ] SSH access to server
- [ ] Root/sudo access

## 5-Minute Setup

### 1. Server Preparation (2 minutes)

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL and Redis
sudo apt install -y postgresql postgresql-contrib redis-server

# Install PM2
sudo npm install -g pm2
```

### 2. Database Setup (1 minute)

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE hrapp_db;
CREATE USER hrapp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE hrapp_db TO hrapp_user;
\q
```

### 3. Application Deployment (1 minute)

```bash
# Clone repository
git clone <your-repo-url> /home/$(whoami)/hrapp
cd /home/$(whoami)/hrapp

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL="postgresql://hrapp_user:your_secure_password@localhost:5432/hrapp_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
NODE_ENV=production
PORT=3000
EOF

# Setup database
npx prisma generate
npx prisma migrate deploy
npm run db:seed

# Build application
npm run build
```

### 4. Start Application (1 minute)

```bash
# Start with PM2
pm2 start npm --name "hrapp-api" -- start
pm2 save
pm2 startup
```

### 5. Configure Nginx (Optional - for domain)

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/hrapp
```

Add:

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

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/hrapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Verify Deployment

```bash
# Check application
curl http://localhost:3000/api/health

# Check PM2
pm2 status
pm2 logs

# Check database
psql -U hrapp_user -d hrapp_db -c "SELECT 1;"
```

## Environment Variables Reference

```env
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="min_32_characters_long"
NODE_ENV="production"
PORT=3000

# Optional
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@your-domain.com"
```

## Common Commands

```bash
# View logs
pm2 logs hrapp-api

# Restart application
pm2 restart hrapp-api

# Stop application
pm2 stop hrapp-api

# Database backup
pg_dump -U hrapp_user hrapp_db > backup.sql

# Database restore
psql -U hrapp_user hrapp_db < backup.sql
```

## Troubleshooting

**Application won't start:**
```bash
pm2 logs hrapp-api
# Check for errors in logs
```

**Database connection error:**
```bash
# Verify database is running
sudo systemctl status postgresql

# Test connection
psql -U hrapp_user -d hrapp_db
```

**Port already in use:**
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process or change PORT in .env
```

## Next Steps

1. Set up SSL certificate (Let's Encrypt)
2. Configure firewall
3. Set up monitoring
4. Configure backups
5. Review security settings

For detailed information, see `DEPLOYMENT_GUIDE.md`.

---

**Quick Start Version:** 1.0.0
**Last Updated:** 2025-01-24
