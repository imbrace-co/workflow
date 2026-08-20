#!/usr/bin/env node
/**
 * Quick test script to verify BUILTIN registry can load pieces from bundled/ directory
 */

const path = require('path');
const fs = require('fs');

// Set environment to BUILTIN mode
process.env.AP_PIECES_SOURCE = 'BUILTIN';

const BUILTIN_DIST = path.join(__dirname, 'dist/packages/pieces/builtin');
const KNOWN_JSON = path.join(BUILTIN_DIST, 'known/pieces.json');
const BUNDLED_DIR = path.join(BUILTIN_DIST, 'bundled');

console.log('='.repeat(60));
console.log('Testing BUILTIN Registry - ALL-IN-ONE Package');
console.log('='.repeat(60));
console.log('');

// 1. Check structure
console.log('Step 1: Checking package structure...');
console.log(`  Builtin dist: ${BUILTIN_DIST}`);
console.log(`  Exists: ${fs.existsSync(BUILTIN_DIST)}`);
console.log('');

console.log(`  Bundled dir: ${BUNDLED_DIR}`);
console.log(`  Exists: ${fs.existsSync(BUNDLED_DIR)}`);
if (fs.existsSync(BUNDLED_DIR)) {
    const pieces = fs.readdirSync(BUNDLED_DIR);
    console.log(`  Pieces in bundled/: ${pieces.length}`);
    console.log(`  List: ${pieces.join(', ')}`);
}
console.log('');

// 2. Check manifest
console.log('Step 2: Checking manifest file...');
console.log(`  Manifest: ${KNOWN_JSON}`);
console.log(`  Exists: ${fs.existsSync(KNOWN_JSON)}`);
if (fs.existsSync(KNOWN_JSON)) {
    const manifest = JSON.parse(fs.readFileSync(KNOWN_JSON, 'utf-8'));
    console.log(`  Pieces in manifest: ${Object.keys(manifest.pieces).length}`);
    console.log('');
    console.log('  Sample entries:');
    Object.entries(manifest.pieces).slice(0, 3).forEach(([name, details]) => {
        console.log(`    - ${name}`);
        console.log(`      sourcePath: ${details.sourcePath}`);
        const fullPath = path.resolve(BUILTIN_DIST, details.sourcePath);
        console.log(`      resolved: ${fullPath}`);
        console.log(`      exists: ${fs.existsSync(fullPath)}`);
    });
}
console.log('');

// 3. Test loading the registry
console.log('Step 3: Testing registry loading...');
try {
    // Import the registry
    const registryPath = path.join(BUILTIN_DIST, 'src/registry.js');
    console.log(`  Loading registry from: ${registryPath}`);
    
    const { builtinRegistry } = require(registryPath);
    
    console.log('  ✓ Registry loaded successfully');
    console.log('');
    
    // Test hasPiece
    console.log('  Testing hasPiece()...');
    const testPieces = ['@activepieces/piece-http', '@activepieces/piece-slack', '@activepieces/piece-webhook'];
    testPieces.forEach(pieceName => {
        const exists = builtinRegistry.hasPiece(pieceName);
        console.log(`    ${pieceName}: ${exists ? '✓' : '✗'}`);
    });
    console.log('');
    
    // Test getPiecePath
    console.log('  Testing getPiecePath()...');
    testPieces.forEach(pieceName => {
        try {
            if (builtinRegistry.hasPiece(pieceName)) {
                const piecePath = builtinRegistry.getPiecePath(pieceName);
                const exists = fs.existsSync(piecePath);
                console.log(`    ${pieceName}:`);
                console.log(`      path: ${piecePath}`);
                console.log(`      exists: ${exists ? '✓' : '✗'}`);
            }
        } catch (error) {
            console.log(`    ${pieceName}: ERROR - ${error.message}`);
        }
    });
    console.log('');
    
    // Test piece counts
    console.log('  Piece counts:');
    console.log(`    Total available: ${builtinRegistry.getTotalCount()}`);
    console.log(`    Builtin pieces: ${builtinRegistry.getBuiltinCount()}`);
    console.log(`    Community loaded: ${builtinRegistry.getLoadedCommunityCount()}`);
    
} catch (error) {
    console.log('  ✗ Error loading registry:');
    console.log(`    ${error.message}`);
    console.log('');
    console.log('  Stack trace:');
    console.log(error.stack);
}

console.log('');
console.log('='.repeat(60));
console.log('Test complete!');
console.log('='.repeat(60));
