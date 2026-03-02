import fs from 'fs';
import path from 'path';

function walk(dir) {
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

    // Replace relative imports/exports that don't have an extension
    // We check for: from './foo' or from '../foo' or import('./foo')
    // We avoid: from 'commander' or from 'node:fs'

    const regex = /(from|import)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]\s*\)?/g;

    let changed = false;
    const newContent = content.replace(regex, (match, type, path) => {
        // If it already has an extension (like .js, .json, .css), leave it
        if (path.match(/\.[a-z0-9]+$/i)) {
            return match;
        }

        changed = true;
        // Add .js
        if (match.includes('(')) {
            return `${type}('${path}.js')`;
        }
        return `${type} '${path}.js'`;
    });

    if (changed) {
        fs.writeFileSync(filePath, newContent);
    }
}

walk('packages/cli/src');
console.log('Done fixing extensions in packages/cli/src');
