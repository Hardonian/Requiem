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
            checkFile(fullPath);
        }
    }
}

function checkFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const dirOfFile = path.dirname(filePath);

    const regex = /(import|export)(\s+[\w\s\*\{\},]*from\s+)['"](\.\.?\/[^'"]+)['"]/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
        let importPath = match[3];

        // If it ends in .js, check if it SHOULD be /index.js
        if (importPath.endsWith('.js')) {
            const base = importPath.slice(0, -3);
            const absolutePath = path.resolve(dirOfFile, base);

            if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
                console.log(`POOR IMPORT in ${filePath}: ${importPath} -> should be ${base}/index.js`);
            }
        } else if (!importPath.match(/\.[a-z0-9]+$/i)) {
             console.log(`MISSING EXTENSION in ${filePath}: ${importPath}`);
        }
    }
}

['packages/cli/src', 'packages/ai/src'].forEach(walk);
