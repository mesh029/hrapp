#!/usr/bin/env tsx
/**
 * Script to automatically fix all checkPermission calls to use the correct signature
 * 
 * Usage: tsx scripts/fix-permission-calls.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = join(process.cwd(), 'app', 'api');

interface FixResult {
  file: string;
  fixed: number;
  errors: string[];
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function fixCheckPermissionCalls(content: string, filePath: string): { fixed: number; newContent: string; errors: string[] } {
  let fixed = 0;
  const errors: string[] = [];
  let newContent = content;
  
  // Pattern 1: const var = await checkPermission(user.id, 'permission', null)
  const pattern1 = /const\s+(\w+)\s*=\s*await\s+checkPermission\s*\(\s*user\.id\s*,\s*['"]([^'"]+)['"]\s*,\s*null\s*\)\s*;/g;
  
  // Pattern 2: inline checks like if (!(await checkPermission(user.id, 'permission', null)))
  const pattern2 = /\(?\s*!?\s*\(?\s*await\s+checkPermission\s*\(\s*user\.id\s*,\s*['"]([^'"]+)['"]\s*,\s*null\s*\)\s*\)?\s*\)?/g;
  
  const matches1 = [...content.matchAll(pattern1)];
  const matches2 = [...content.matchAll(pattern2)];
  
  for (const match of matches1) {
    const varName = match[1];
    const permission = match[2];
    const fullMatch = match[0];
    
    // Check if prisma is already imported
    const hasPrismaImport = content.includes("import { prisma } from '@/lib/db';") || 
                           content.includes('import { prisma } from "@/lib/db";');
    
    // Generate unique variable names to avoid conflicts
    const userWithLocationVar = `userWithLocation_${varName}`;
    const locationIdVar = `locationId_${varName}`;
    
    // Create the replacement code
    const replacement = `// Check permission
    const ${userWithLocationVar} = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const ${locationIdVar} = ${userWithLocationVar}?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!${locationIdVar}) {
      return errorResponse('No location available for permission check', 400);
    }

    const ${varName} = await checkPermission(user, '${permission}', { locationId: ${locationIdVar} });`;
    
    newContent = newContent.replace(fullMatch, replacement);
    fixed++;
    
    // Add prisma import if needed
    if (!hasPrismaImport) {
      // Find the import section and add prisma
      const importPattern = /(import\s+{[^}]*}\s+from\s+['"]@\/lib\/middleware\/auth['"];)/;
      const importMatch = newContent.match(importPattern);
      if (importMatch) {
        newContent = newContent.replace(
          importMatch[1],
          `${importMatch[1]}\nimport { prisma } from '@/lib/db';`
        );
      } else {
        // Try to find any import from @/lib
        const libImportPattern = /(import\s+{[^}]*}\s+from\s+['"]@\/lib\/[^'"]+['"];)/;
        const libImportMatch = newContent.match(libImportPattern);
        if (libImportMatch) {
          newContent = newContent.replace(
            libImportMatch[1],
            `${libImportMatch[1]}\nimport { prisma } from '@/lib/db';`
          );
        } else {
          errors.push(`Could not find import section to add prisma import in ${filePath}`);
        }
      }
    }
  }
  
  return { fixed, newContent, errors };
}

function fixRequirePermissionCalls(content: string, filePath: string): { fixed: number; newContent: string; errors: string[] } {
  let fixed = 0;
  const errors: string[] = [];
  let newContent = content;
  
  // Pattern: requirePermission(request, user.id, 'permission')
  const pattern = /const\s+(\w+)\s*=\s*await\s+requirePermission\s*\(\s*request\s*,\s*user\.id\s*,\s*['"]([^'"]+)['"]\s*\)\s*;/g;
  
  const matches = [...content.matchAll(pattern)];
  
  for (const match of matches) {
    const varName = match[1];
    const permission = match[2];
    const fullMatch = match[0];
    
    // Check if prisma is already imported
    const hasPrismaImport = content.includes("import { prisma } from '@/lib/db';") || 
                           content.includes('import { prisma } from "@/lib/db";');
    
    // Generate unique variable names
    const userWithLocationVar = `userWithLocation_${varName}`;
    const locationIdVar = `locationId_${varName}`;
    
    // Create the replacement code
    const replacement = `// Check permission
    const ${userWithLocationVar} = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const ${locationIdVar} = ${userWithLocationVar}?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!${locationIdVar}) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, '${permission}', { locationId: ${locationIdVar} });
    } catch {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }`;
    
    newContent = newContent.replace(fullMatch, replacement);
    fixed++;
    
    // Add prisma import if needed
    if (!hasPrismaImport) {
      const importPattern = /(import\s+{[^}]*}\s+from\s+['"]@\/lib\/middleware\/auth['"];)/;
      const importMatch = newContent.match(importPattern);
      if (importMatch) {
        newContent = newContent.replace(
          importMatch[1],
          `${importMatch[1]}\nimport { prisma } from '@/lib/db';`
        );
      } else {
        errors.push(`Could not find import section to add prisma import in ${filePath}`);
      }
    }
  }
  
  return { fixed, newContent, errors };
}

function processFile(filePath: string): FixResult {
  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Skip if file doesn't contain checkPermission or requirePermission
    if (!content.includes('checkPermission') && !content.includes('requirePermission')) {
      return { file: filePath, fixed: 0, errors: [] };
    }
    
    let totalFixed = 0;
    const allErrors: string[] = [];
    
    // Fix checkPermission calls
    const checkResult = fixCheckPermissionCalls(content, filePath);
    content = checkResult.newContent;
    totalFixed += checkResult.fixed;
    allErrors.push(...checkResult.errors);
    
    // Fix requirePermission calls
    const requireResult = fixRequirePermissionCalls(content, filePath);
    content = requireResult.newContent;
    totalFixed += requireResult.fixed;
    allErrors.push(...requireResult.errors);
    
    // Only write if changes were made
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Fixed ${totalFixed} issue(s) in ${filePath}`);
    }
    
    return { file: filePath, fixed: totalFixed, errors: allErrors };
  } catch (error: any) {
    return { file: filePath, fixed: 0, errors: [error.message] };
  }
}

function main() {
  console.log('🔍 Finding TypeScript files in app/api...\n');
  
  const files = findTsFiles(API_DIR);
  console.log(`Found ${files.length} files to check\n`);
  
  const results: FixResult[] = [];
  
  for (const file of files) {
    const result = processFile(file);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const totalFixed = results.reduce((sum, r) => sum + r.fixed, 0);
  const filesWithErrors = results.filter(r => r.errors.length > 0);
  const filesFixed = results.filter(r => r.fixed > 0);
  
  console.log(`Total files processed: ${results.length}`);
  console.log(`Files fixed: ${filesFixed.length}`);
  console.log(`Total issues fixed: ${totalFixed}`);
  console.log(`Files with errors: ${filesWithErrors.length}`);
  
  if (filesWithErrors.length > 0) {
    console.log('\n⚠️  Files with errors:');
    filesWithErrors.forEach(r => {
      console.log(`  - ${r.file}`);
      r.errors.forEach(e => console.log(`    ${e}`));
    });
  }
  
  if (totalFixed > 0) {
    console.log('\n✅ Fix complete! Please review the changes and test your API.');
  } else {
    console.log('\n✅ No issues found. All permission calls are using the correct signature.');
  }
}

main();
