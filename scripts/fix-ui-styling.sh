#!/bin/bash
# fix-ui-styling.sh - Permanent fix for UI styling issues
# This script automates the process of fixing corrupted Next.js build cache

set -e

echo "🛠️  Fixing UI styling issues..."
echo ""

# Step 1: Stop the dev server
echo "1️⃣  Stopping dev server..."
pkill -f "next dev" || pkill -f "npm run dev" || true
sleep 2
echo "   ✅ Dev server stopped"
echo ""

# Step 2: Clear build cache
echo "2️⃣  Clearing build cache..."
if [ -d ".next" ]; then
  rm -rf .next
  echo "   ✅ .next cache cleared"
else
  echo "   ℹ️  .next directory doesn't exist (already clean)"
fi
echo ""

# Step 3: Clear node_modules/.cache if it exists
if [ -d "node_modules/.cache" ]; then
  echo "3️⃣  Clearing node_modules cache..."
  rm -rf node_modules/.cache
  echo "   ✅ node_modules cache cleared"
  echo ""
fi

# Step 4: Verify required files exist
echo "4️⃣  Verifying required files..."
REQUIRED_FILES=(
  "app/layout.tsx"
  "app/globals.css"
  "app/error.tsx"
  "app/global-error.tsx"
  "app/not-found.tsx"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
  echo "   ✅ All required files exist"
else
  echo "   ⚠️  Missing files: ${MISSING_FILES[*]}"
  echo "   Please create these files before continuing"
fi
echo ""

# Step 5: Restart server
echo "5️⃣  Starting fresh build..."
echo "   This may take 1-2 minutes..."
echo ""

# Start server in background and capture PID
npm run dev > /tmp/nextjs-dev.log 2>&1 &
DEV_PID=$!
echo "   ✅ Dev server started (PID: $DEV_PID)"
echo "   📝 Logs: tail -f /tmp/nextjs-dev.log"
echo ""

# Step 6: Wait for build to complete
echo "6️⃣  Waiting for build to complete..."
MAX_WAIT=120  # 2 minutes
ELAPSED=0
READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if grep -q "Ready" /tmp/nextjs-dev.log 2>/dev/null; then
    READY=true
    break
  fi
  
  # Check if process is still running
  if ! kill -0 $DEV_PID 2>/dev/null; then
    echo "   ❌ Dev server crashed. Check logs: tail -50 /tmp/nextjs-dev.log"
    exit 1
  fi
  
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done

echo ""
if [ "$READY" = true ]; then
  echo "   ✅ Build completed successfully!"
else
  echo "   ⚠️  Build may still be in progress. Check logs: tail -f /tmp/nextjs-dev.log"
fi
echo ""

# Step 7: Verify CSS file exists
echo "7️⃣  Verifying CSS file..."
sleep 3  # Give it a moment to generate CSS

if [ -f ".next/static/css/app/layout.css" ]; then
  CSS_SIZE=$(stat -f%z ".next/static/css/app/layout.css" 2>/dev/null || stat -c%s ".next/static/css/app/layout.css" 2>/dev/null || echo "0")
  if [ "$CSS_SIZE" -gt 0 ]; then
    echo "   ✅ CSS file exists and has content ($CSS_SIZE bytes)"
  else
    echo "   ⚠️  CSS file exists but is empty"
  fi
else
  echo "   ⚠️  CSS file not found yet (may still be generating)"
fi
echo ""

# Step 8: Test server response
echo "8️⃣  Testing server response..."
sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200"; then
  echo "   ✅ Server is responding"
else
  echo "   ⚠️  Server may not be ready yet. Wait a bit longer and try: curl http://localhost:3001/api/health"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fix process completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Hard refresh your browser:"
echo "      • Chrome/Edge: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo "      • Firefox: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)"
echo ""
echo "   2. Navigate to: http://localhost:3001"
echo ""
echo "   3. If styling is still missing, check:"
echo "      • Browser console for errors"
echo "      • Network tab for 404s on CSS files"
echo "      • Server logs: tail -f /tmp/nextjs-dev.log"
echo ""
echo "🔍 Monitor logs: tail -f /tmp/nextjs-dev.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
