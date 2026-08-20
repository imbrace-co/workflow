#!/usr/bin/env node

/**
 * Diagnostic script to check BUILTIN mode setup
 * Run: node scripts/diagnose-builtin.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('='.repeat(70));
console.log('BUILTIN Mode Diagnostic');
console.log('='.repeat(70));
console.log('');

// Test 1: Check JSON files
console.log('1. Checking JSON metadata files...');

const knownPath = path.resolve(ROOT_DIR, 'dist/packages/pieces/builtin/known/pieces.json');
const typesPath = path.resolve(ROOT_DIR, 'dist/packages/pieces/builtin/types/pieces.json');

if (!fs.existsSync(knownPath)) {
    console.error('  ✗ known/pieces.json NOT FOUND');
    console.error('  Run: ./scripts/build-builtin-mode.sh sample');
    process.exit(1);
}

if (!fs.existsSync(typesPath)) {
    console.error('  ✗ types/pieces.json NOT FOUND');
    process.exit(1);
}

const knownData = JSON.parse(fs.readFileSync(knownPath, 'utf-8'));
const typesData = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));

console.log(`  ✓ known/pieces.json: ${Object.keys(knownData.pieces).length} pieces`);
console.log(`  ✓ types/pieces.json: ${typesData.pieces.length} pieces`);

// List first 5 pieces
console.log('  Community pieces:');
Object.keys(knownData.pieces).slice(0, 5).forEach(name => {
    console.log(`    - ${name}`);
});
if (Object.keys(knownData.pieces).length > 5) {
    console.log(`    ... and ${Object.keys(knownData.pieces).length - 5} more`);
}

console.log('');

// Test 2: Check package structure
console.log('2. Checking builtin package...');
const builtinIndexPath = path.resolve(ROOT_DIR, 'dist/packages/pieces/builtin/src/index.js');
if (!fs.existsSync(builtinIndexPath)) {
    console.error('  ✗ Builtin package NOT built');
    console.error('  Run: npx nx build pieces-builtin');
    process.exit(1);
}
console.log('  ✓ Builtin package built');

// Test 3: Check piece files exist
console.log('');
console.log('3. Checking community piece files...');
let missingFiles = 0;
let foundFiles = 0;

for (const [pieceName, details] of Object.entries(knownData.pieces)) {
    const basePath = path.resolve(ROOT_DIR, 'dist/packages/pieces/builtin/src');
    const fullPath = path.resolve(basePath, details.sourcePath);
    
    if (fs.existsSync(fullPath)) {
        foundFiles++;
    } else {
        console.error(`  ✗ Missing: ${pieceName} at ${details.sourcePath}`);
        missingFiles++;
    }
}

console.log(`  ✓ Found: ${foundFiles} files`);
if (missingFiles > 0) {
    console.error(`  ✗ Missing: ${missingFiles} files`);
    console.error('  Some pieces are registered but files don\'t exist');
    console.error('  Run: ./scripts/build-builtin-mode.sh sample');
}

console.log('');

// Test 4: Path resolution
console.log('4. Testing path resolution...');
const testPiece = Object.keys(knownData.pieces)[0];
if (testPiece) {
    const details = knownData.pieces[testPiece];
    const basePath = path.resolve(ROOT_DIR, 'dist/packages/pieces/builtin/src');
    const fullFilePath = path.resolve(basePath, details.sourcePath);
    const packageRoot = path.dirname(path.dirname(fullFilePath));
    
    console.log(`  Test piece: ${testPiece}`);
    console.log(`  Source path: ${details.sourcePath}`);
    console.log(`  Resolved package root: ${packageRoot}`);
    
    // Check if package.json exists
    const packageJsonPath = path.join(packageRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        console.log(`  ✓ package.json found`);
        console.log(`    Name: ${packageJson.name}`);
        console.log(`    Main: ${packageJson.main || 'not specified'}`);
    } else {
        console.error(`  ✗ package.json NOT FOUND at ${packageJsonPath}`);
    }
}

console.log('');
console.log('='.repeat(70));
console.log('Summary:');
console.log(`  Community pieces registered: ${Object.keys(knownData.pieces).length}`);
console.log(`  Piece files found: ${foundFiles}`);
console.log(`  Piece files missing: ${missingFiles}`);
console.log('');

if (missingFiles === 0 && foundFiles > 0) {
    console.log('✓ BUILTIN mode is configured correctly');
    console.log('');
    console.log('Start server with: AP_PIECES_SOURCE=BUILTIN npm run dev:backend');
} else {
    console.error('✗ Issues found - see above');
    process.exit(1);
}
console.log('='.repeat(70));
