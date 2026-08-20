#!/usr/bin/env node

/**
 * Test piece path resolution
 */

import { builtinRegistry } from '../dist/packages/pieces/builtin/src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('Testing BUILTIN piece path resolution...\n');

// Test webhook piece
const pieceName = '@activepieces/piece-webhook';

try {
    const hasPiece = builtinRegistry.hasPiece(pieceName);
    console.log(`1. Has piece "${pieceName}": ${hasPiece}`);
    
    if (hasPiece) {
        const piecePath = builtinRegistry.getPiecePath(pieceName);
        console.log(`2. Piece path: ${piecePath}`);
        
        // Check if path is relative or absolute
        const isAbsolute = path.isAbsolute(piecePath);
        console.log(`3. Is absolute: ${isAbsolute}`);
        
        // Check what the path looks like
        const relativePath = path.relative(ROOT_DIR, piecePath);
        console.log(`4. Relative to root: ${relativePath}`);
        
        // Expected: dist/packages/pieces/community/webhook
        const expected = 'dist/packages/pieces/community/webhook';
        const matches = relativePath === expected;
        console.log(`5. Matches expected (${expected}): ${matches ? '✓' : '✗'}`);
        
        if (!matches) {
            console.log(`   Expected: ${expected}`);
            console.log(`   Got:      ${relativePath}`);
        }
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}

console.log('\n✓ Path resolution test complete');
