#!/usr/bin/env node
/**
 * Verify UI Boundaries Script
 * 
 * Ensures enterprise UI components are not imported in OSS code paths.
 * This enforces the OSS Build Guarantee from AGENTS.md.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ENTERPRISE_PATTERN = /@requiem\/ui\/enterprise/
const OSS_RESTRICTED_DIRS = [
  'packages/ui/src/components/primitives',
  'packages/ui/src/components/layout', 
  'packages/ui/src/components/data',
  'packages/ui/src/lib',
]

const EXCLUDED_FILES = [
  'node_modules',
  'dist',
  '.git',
]

let violations = []

function findFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = []
  
  function walk(currentDir) {
    const entries = readdirSync(currentDir)
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      
      if (EXCLUDED_FILES.some(ex => fullPath.includes(ex))) {
        continue
      }
      
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (extensions.includes(extname(entry))) {
        files.push(fullPath)
      }
    }
  }
  
  walk(dir)
  return files
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  
  // Check for enterprise imports in OSS directories
  if (ENTERPRISE_PATTERN.test(content)) {
    const isOssPath = OSS_RESTRICTED_DIRS.some(dir => filePath.includes(dir))
    
    if (isOssPath) {
      violations.push({
        file: filePath,
        line: content.split('\n').findIndex(line => ENTERPRISE_PATTERN.test(line)) + 1,
        match: content.match(ENTERPRISE_PATTERN)?.[0]
      })
    }
  }
}

function main() {
  console.log('🔍 Verifying UI boundaries...\n')
  
  const filesToCheck = findFiles('packages/ui/src')
  
  for (const file of filesToCheck) {
    checkFile(file)
  }
  
  if (violations.length === 0) {
    console.log('✅ No boundary violations found')
    console.log('✅ OSS Build Guarantee maintained')
    process.exit(0)
  } else {
    console.error('❌ Boundary violations found:\n')
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`)
      console.error(`    Import: ${v.match}`)
      console.error()
    }
    console.error('❌ OSS Build Guarantee violated')
    console.error('Enterprise imports must not be in OSS code paths')
    process.exit(1)
  }
}

main()
