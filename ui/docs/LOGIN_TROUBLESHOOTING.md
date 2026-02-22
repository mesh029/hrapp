# Login Troubleshooting Guide

**Date:** February 22, 2025

---

## Default Credentials

- **Email:** `admin@path.org`
- **Password:** `oneeyedragon`

---

## Verification Steps

### 1. Check Database
```bash
# Check if admin user exists
docker compose exec postgres psql -U root -d hrapp_db -c "SELECT email, name, status FROM users WHERE email = 'admin@path.org';"
```

### 2. Test API Directly
```bash
# Test login API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@path.org","password":"oneeyedragon"}'
```

### 3. Check Browser Console
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

### 4. Verify Services Running
```bash
# Check Docker containers
docker compose ps

# Check API logs
docker compose logs api --tail 50
```

---

## Common Issues

### Issue: 401 Unauthorized

**Possible Causes:**
1. Wrong email or password
2. User account is inactive
3. User account is deleted
4. Password hash mismatch

**Solutions:**
1. Verify credentials: `admin@path.org` / `oneeyedragon`
2. Re-seed database: `npm run db:seed`
3. Check user status in database
4. Verify password hash in database

### Issue: CORS Error

**Solution:**
- Ensure API and frontend are on same origin
- Check Next.js proxy configuration
- Verify API is accessible from browser

### Issue: Network Error

**Possible Causes:**
1. API not running
2. Port conflict
3. Firewall blocking

**Solutions:**
1. Start API: `docker compose up -d api`
2. Check port 3000 is available
3. Verify API health: `curl http://localhost:3000/api/health`

---

## Re-seeding Database

If credentials don't work, re-seed the database:

```bash
# Re-seed database
npm run db:seed

# This will create:
# - Admin user: admin@path.org
# - Password: oneeyedragon
# - All permissions and roles
```

---

## Manual User Creation

If needed, create admin user manually:

```bash
# Connect to database
docker compose exec postgres psql -U root -d hrapp_db

# Then run (password hash for 'oneeyedragon'):
# Note: You'll need to generate the hash first using the app
```

---

## Testing Login

### Via API (curl)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@path.org","password":"oneeyedragon"}' \
  | jq
```

### Via Browser
1. Navigate to: http://localhost:3000/login
2. Enter: `admin@path.org` / `oneeyedragon`
3. Check browser console for errors
4. Check Network tab for request/response

---

## Debug Checklist

- [ ] Database is running
- [ ] API container is running
- [ ] Admin user exists in database
- [ ] User status is 'active'
- [ ] User is not deleted (deleted_at is NULL)
- [ ] Password hash is correct (60 characters)
- [ ] API endpoint responds correctly
- [ ] No CORS errors in browser
- [ ] No network errors in browser console
- [ ] Credentials are typed correctly (no extra spaces)

---

**Last Updated:** February 22, 2025
