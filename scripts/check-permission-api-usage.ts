#!/usr/bin/env tsx
/**
 * Script to check for incorrect permission API usage
 * This prevents the same issue from recurring
 * 
 * Usage: tsx scripts/check-permission-api-usage.ts
 * 
 * Exit code 1 if issues found, 0 if all good
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = join(process.cwd(), 'app', 'api');

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

interface Issue {
  file: string;
  line: number;
  pattern: string;
  message: string;
}

function checkFile(filePath: string): Issue[] {
  const issues: Issue[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Pattern 1: checkPermission(user.id, ...)
    const pattern1 = /checkPermission\s*\(\s*user\.id\s*,/g;
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        file: filePath,
        line: lineNum,
        pattern: 'checkPermission(user.id, ...)',
        message: 'checkPermission should receive user object, not user.id'
      });
    }
    
    // Pattern 2: requirePermission(request, user.id, ...)
    const pattern2 = /requirePermission\s*\(\s*request\s*,\s*user\.id\s*,/g;
    while ((match = pattern2.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        file: filePath,
        line: lineNum,
        pattern: 'requirePermission(request, user.id, ...)',
        message: 'requirePermission should receive user object, not request and user.id'
      });
    }
    
    // Pattern 3: checkPermission(..., null) or requirePermission(..., null)
    const pattern3 = /(checkPermission|requirePermission)\s*\([^)]*,\s*null\s*\)/g;
    while ((match = pattern3.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        file: filePath,
        line: lineNum,
        pattern: match[0],
        message: 'Permission functions should use { locationId } options object, not null'
      });
    }
    
  } catch (error: any) {
    console.error(`Error checking ${filePath}: ${error.message}`);
  }
  
  return issues;
}

function main() {
  console.log('🔍 Checking for incorrect permission API usage...\n');
  
  const files = findTsFiles(API_DIR);
  const allIssues: Issue[] = [];
  
  for (const file of files) {
    const issues = checkFile(file);
    allIssues.push(...issues);
  }
  
  if (allIssues.length > 0) {
    console.log('❌ Found incorrect permission API usage:\n');
    
    // Group by file
    const issuesByFile = new Map<string, Issue[]>();
    allIssues.forEach(issue => {
      if (!issuesByFile.has(issue.file)) {
        issuesByFile.set(issue.file, []);
      }
      issuesByFile.get(issue.file)!.push(issue);
    });
    
    issuesByFile.forEach((issues, file) => {
      console.log(`📄 ${file}`);
      issues.forEach(issue => {
        console.log(`   Line ${issue.line}: ${issue.pattern}`);
        console.log(`   ⚠️  ${issue.message}\n`);
      });
    });
    
    console.log(`\n❌ Total issues found: ${allIssues.length}`);
    console.log('\n💡 Run: npx tsx scripts/fix-permission-calls.ts to auto-fix these issues');
    process.exit(1);
  } else {
    console.log('✅ All permission API calls are using the correct signature!');
    process.exit(0);
  }
}

main();
