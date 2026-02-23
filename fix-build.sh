#!/bin/bash
# fix-build.sh - Quick fix for styling/build issues

echo "🛠️  Fixing build issues..."

# Stop server
echo "1. Stopping dev server..."
pkill -f "next dev" || pkill -f "npm run dev" || true
sleep 2

# Clear cache
echo "2. Clearing build cache..."
rm -rf .next
echo "   ✅ Cache cleared"

# Restart server
echo "3. Starting fresh build..."
npm run dev &
echo "   ✅ Server starting in background"
echo ""
echo "⏳ Wait 1-2 minutes for build to complete, then refresh your browser"
