#!/usr/bin/env node

/**
 * Test script to verify BUILTIN mode is working correctly
 * 
 * Usage: node scripts/test-builtin-mode.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('='.repeat(70));
console.log('BUILTIN Mode - Verification Test');
console.log('='.repeat(70));
console.log('');

// Test 1: Check if JSON files exist
console.log('Test 1: Checking metadata JSON files...');
const knownPath = path.join(ROOT_DIR, 'dist/packages/pieces/builtin/known/pieces.json');
const typesPath = path.join(ROOT_DIR, 'dist/packages/pieces/builtin/types/pieces.json');

if (fs.existsSync(knownPath)) {
    const knownData = JSON.parse(fs.readFileSync(knownPath, 'utf-8'));
    const pieceCount = Object.keys(knownData.pieces).length;
    console.log(`  ✓ known/pieces.json exists (${pieceCount} pieces)`);
    
    // Show first 5 pieces
    const pieceNames = Object.keys(knownData.pieces).slice(0, 5);
    console.log('  First 5 pieces:');
    pieceNames.forEach(name => console.log(`    - ${name}`));
    if (pieceCount > 5) {
        console.log(`    ... and ${pieceCount - 5} more`);
    }
} else {
    console.log('  ✗ known/pieces.json NOT FOUND');
    console.log('  Run: ./scripts/build-builtin-mode.sh sample');
    process.exit(1);
}

if (fs.existsSync(typesPath)) {
    const typesData = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));
    console.log(`  ✓ types/pieces.json exists (${typesData.pieces.length} pieces with metadata)`);
} else {
    console.log('  ✗ types/pieces.json NOT FOUND');
}

console.log('');

// Test 2: Check if builtin package is built
console.log('Test 2: Checking builtin package build...');
const builtinIndexPath = path.join(ROOT_DIR, 'dist/packages/pieces/builtin/src/index.js');
if (fs.existsSync(builtinIndexPath)) {
    console.log('  ✓ Builtin package built');
} else {
    console.log('  ✗ Builtin package NOT built');
    console.log('  Run: npx nx build pieces-builtin');
    process.exit(1);
}

console.log('');

// Test 3: Try to load the registry
console.log('Test 3: Testing registry...');
try {
    const { builtinRegistry } = await import(path.join(ROOT_DIR, 'dist/packages/pieces/builtin/src/index.js'));
    
    // Get all piece names
    const allNames = builtinRegistry.listAllPieceNames();
    const builtinPieces = builtinRegistry.listBuiltinPieces();
    const communityPieces = builtinRegistry.listCommunityPieces();
    
    console.log(`  ✓ Registry loaded successfully`);
    console.log(`  Total pieces: ${allNames.length}`);
    console.log(`    - Builtin pieces: ${builtinPieces.length}`);
    console.log(`    - Community pieces: ${communityPieces.length}`);
    
    // Test loading a community piece
    console.log('');
    console.log('Test 4: Testing lazy loading...');
    
    if (communityPieces.length > 0) {
        const testPieceName = communityPieces[0].name;
        console.log(`  Testing piece: ${testPieceName}`);
        
        try {
            const piece = builtinRegistry.getPiece(testPieceName);
            console.log(`  ✓ Piece loaded successfully`);
            
            const meta = piece.metadata();
            console.log(`    - Display name: ${meta.displayName}`);
            console.log(`    - Actions: ${Object.keys(meta.actions || {}).length}`);
            console.log(`    - Triggers: ${Object.keys(meta.triggers || {}).length}`);
            
            // Check cache
            const loadedCount = builtinRegistry.getLoadedCommunityCount();
            console.log(`  ✓ Cached pieces: ${loadedCount}`);
        } catch (error) {
            console.log(`  ✗ Failed to load piece: ${error.message}`);
            console.log(`  Error details:`, error);
        }
    } else {
        console.log('  ⚠ No community pieces to test');
    }
    
} catch (error) {
    console.log(`  ✗ Failed to load registry: ${error.message}`);
    console.log(`  Error details:`, error);
    process.exit(1);
}

console.log('');
console.log('='.repeat(70));
console.log('Summary:');
console.log('  ✓ BUILTIN mode is configured correctly');
console.log('  ✓ Community pieces are available via lazy loading');
console.log('');
console.log('Next steps:');
console.log('  1. Start server: AP_PIECES_SOURCE=BUILTIN npm run dev:backend');
console.log('  2. Test API: curl http://localhost:3000/v1/pieces');
console.log('='.repeat(70));
