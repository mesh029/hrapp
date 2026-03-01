#!/bin/bash
# predev-check.sh - Pre-development checks to prevent UI issues
# This runs before npm run dev to ensure a clean state

# Check if .next exists and is corrupted
if [ -d ".next" ]; then
  # Check if CSS file exists and is valid
  if [ ! -f ".next/static/css/app/layout.css" ]; then
    echo "⚠️  Warning: CSS file missing in .next cache. Clearing cache..."
    rm -rf .next
  else
    # Check if CSS file has content
    CSS_SIZE=$(stat -f%z ".next/static/css/app/layout.css" 2>/dev/null || stat -c%s ".next/static/css/app/layout.css" 2>/dev/null || echo "0")
    if [ "$CSS_SIZE" -eq 0 ]; then
      echo "⚠️  Warning: CSS file is empty. Clearing cache..."
      rm -rf .next
    fi
  fi
fi

# Ensure required files exist
REQUIRED_FILES=("app/layout.tsx" "app/globals.css" "app/error.tsx" "app/global-error.tsx" "app/not-found.tsx")
MISSING=0

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Error: Required file missing: $file"
    MISSING=1
  fi
done

if [ $MISSING -eq 1 ]; then
  echo "❌ Cannot start dev server: Required files are missing"
  exit 1
fi

echo "✅ Pre-dev checks passed"
