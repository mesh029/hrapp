# HR App API - Docker Deployment

## Quick Deploy

```bash
# 1. Copy environment file
cp .env.prod.example .env.prod

# 2. Edit .env.prod with your values
nano .env.prod

# 3. Deploy
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 4. Run migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 5. Seed (optional)
docker-compose -f docker-compose.prod.yml exec api npm run db:seed
```

## API Access

- **Local:** `http://localhost:3000/api`
- **Health Check:** `http://localhost:3000/api/health`

## Documentation

- **Docker Guide:** `DOCKER_DEPLOYMENT.md`
- **API Reference:** `docs/API_REFERENCE.md`
- **Full API Docs:** `docs/API_DOCUMENTATION_BUNDLE.md`

That's it! 🚀
