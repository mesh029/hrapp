#!/usr/bin/env tsx
/**
 * Setup Verification Script
 * 
 * Verifies that all critical files and configurations are in place
 * to prevent import and path resolution issues.
 * 
 * Run: npm run verify:setup
 * Or: tsx scripts/verify-setup.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
}

const checks: CheckResult[] = [];

function check(name: string, condition: boolean, message: string, fix?: string) {
  checks.push({ name, passed: condition, message, fix });
  if (!condition) {
    console.error(`❌ ${name}: ${message}`);
    if (fix) {
      console.error(`   Fix: ${fix}`);
    }
  } else {
    console.log(`✅ ${name}: ${message}`);
  }
}

console.log('🔍 Verifying project setup...\n');

// 1. Check critical files exist
check(
  'app/lib/utils.ts exists',
  existsSync('app/lib/utils.ts'),
  'File exists',
  'Create app/lib/utils.ts with cn() function (see docs/SETUP_REQUIREMENTS.md)'
);

check(
  'tsconfig.json exists',
  existsSync('tsconfig.json'),
  'File exists',
  'Create tsconfig.json with proper path mappings'
);

check(
  'next.config.js exists',
  existsSync('next.config.js'),
  'File exists',
  'Create next.config.js'
);

// 2. Check tsconfig.json path mappings
if (existsSync('tsconfig.json')) {
  try {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8'));
    const paths = tsconfig.compilerOptions?.paths || {};
    
    check(
      'Path mapping: @/components/*',
      paths['@/components/*']?.includes('./components/*'),
      'Correctly mapped to ./components/*',
      'Add "\\"@/components/*\\": [\\"./components/*\\"]" to tsconfig.json paths'
    );
    
    check(
      'Path mapping: @/*',
      paths['@/*']?.includes('./app/*'),
      'Correctly mapped to ./app/*',
      'Add "\\"@/*\\": [\\"./app/*\\"]" to tsconfig.json paths'
    );
  } catch (error) {
    check('tsconfig.json is valid JSON', false, 'Invalid JSON', 'Fix tsconfig.json syntax');
  }
}

// 3. Check app/lib/utils.ts exports cn function
if (existsSync('app/lib/utils.ts')) {
  const utilsContent = readFileSync('app/lib/utils.ts', 'utf-8');
  
  check(
    'utils.ts exports cn function',
    /export\s+(function|const)\s+cn/.test(utilsContent),
    'cn function exported',
    'Add: export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }'
  );
  
  check(
    'utils.ts imports clsx',
    /import.*clsx/.test(utilsContent),
    'clsx imported',
    'Add: import { clsx } from "clsx"'
  );
  
  check(
    'utils.ts imports tailwind-merge',
    /import.*tailwind-merge/.test(utilsContent),
    'tailwind-merge imported',
    'Add: import { twMerge } from "tailwind-merge"'
  );
}

// 4. Check required dependencies
if (existsSync('package.json')) {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    check(
      'clsx dependency',
      !!deps.clsx,
      'Installed',
      'Run: npm install clsx'
    );
    
    check(
      'tailwind-merge dependency',
      !!deps['tailwind-merge'],
      'Installed',
      'Run: npm install tailwind-merge'
    );
  } catch (error) {
    check('package.json is valid JSON', false, 'Invalid JSON', 'Fix package.json syntax');
  }
}

// 5. Check UI components can resolve @/lib/utils
const uiComponents = ['components/ui/button.tsx', 'components/ui/tabs.tsx', 'components/ui/card.tsx'];
uiComponents.forEach(component => {
  if (existsSync(component)) {
    const content = readFileSync(component, 'utf-8');
    const hasImport = /from\s+['"]@\/lib\/utils['"]/.test(content);
    check(
      `${component} imports @/lib/utils`,
      hasImport || !content.includes('@/lib/utils'),
      hasImport ? 'Correctly imports' : 'No import found (OK if not needed)',
      hasImport ? undefined : 'If needed, add: import { cn } from "@/lib/utils"'
    );
  }
});

// Summary
console.log('\n' + '='.repeat(60));
const failed = checks.filter(c => !c.passed);
const passed = checks.filter(c => c.passed);

console.log(`\n📊 Results: ${passed.length}/${checks.length} checks passed`);

if (failed.length > 0) {
  console.error(`\n❌ ${failed.length} check(s) failed. Please fix the issues above.\n`);
  process.exit(1);
} else {
  console.log('\n✅ All checks passed! Your setup is correct.\n');
  process.exit(0);
}
