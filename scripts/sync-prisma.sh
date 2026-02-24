#!/bin/bash
# Ensure Prisma client is in sync with schema
# Run this whenever schema changes

echo "🔄 Syncing Prisma client with schema..."

# Validate schema
echo "1. Validating schema..."
npx prisma validate

# Push schema to database
echo "2. Pushing schema to database..."
npx prisma db push

# Generate Prisma client
echo "3. Generating Prisma client..."
npx prisma generate

echo "✅ Prisma sync complete!"
echo ""
echo "If you're running a dev server, restart it to pick up the new Prisma client."
