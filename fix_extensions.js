import fs from 'fs';
import path from 'path';

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
            fixFile(fullPath);
        }
    }
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const dirOfFile = path.dirname(filePath);

    let changed = false;

    // Helper to resolve extension
    function resolvePath(importPath) {
        if (importPath.match(/\.[a-z0-9]+$/i)) {
            return importPath;
        }

        const absolutePath = path.resolve(dirOfFile, importPath);
        const possibleTsFile = absolutePath + '.ts';
        const possibleJsFile = absolutePath + '.js';
        const possibleDir = absolutePath;

        if (fs.existsSync(possibleTsFile) || fs.existsSync(possibleJsFile)) {
            return importPath + '.js';
        } else if (fs.existsSync(possibleDir) && fs.statSync(possibleDir).isDirectory()) {
            return importPath + (importPath.endsWith('/') ? '' : '/') + 'index.js';
        }
        return importPath + '.js'; // Default guess
    }

    // 1. Static imports/exports: import ... from './foo'
    content = content.replace(/(import|export)(\s+[\w\s\*\{\},]*from\s+)['"](\.\.?\/[^'"]+)['"]/g, (match, type, middle, importPath) => {
        const fixed = resolvePath(importPath);
        if (fixed !== importPath) {
            changed = true;
            return `${type}${middle}'${fixed}'`;
        }
        return match;
    });

    // 2. Bare imports: import './foo'
    content = content.replace(/(import\s+)['"](\.\.?\/[^'"]+)['"]/g, (match, type, importPath) => {
        const fixed = resolvePath(importPath);
        if (fixed !== importPath) {
            changed = true;
            return `${type}'${fixed}'`;
        }
        return match;
    });

    // 3. Dynamic imports: import('./foo')
    content = content.replace(/(import\s*\(\s*)['"](\.\.?\/[^'"]+)['"](\s*\))/g, (match, prefix, importPath, suffix) => {
        const fixed = resolvePath(importPath);
        if (fixed !== importPath) {
            changed = true;
            return `${prefix}'${fixed}'${suffix}`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
    }
}

['packages/cli/src', 'packages/ai/src'].forEach(walk);
console.log('Done fixing extensions with robust regex and directory support');
