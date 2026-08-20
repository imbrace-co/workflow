/**
 * Generate BUILTIN metadata files from COMPILED builtin package
 *
 * This script scans the compiled output of @activepieces/pieces-builtin
 * (which now includes community pieces in src/pieces) and generates
 * the necessary metadata files.
 *
 * Run AFTER:
 *   node scripts/sync-community-to-builtin.mjs
 *   npx nx build pieces-builtin
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const BUILTIN_DIST = path.join(ROOT_DIR, 'dist/packages/pieces/builtin')
const BUILTIN_PIECES_DIST = path.join(BUILTIN_DIST, 'src/pieces')
const BUILTIN_SRC_DIR = path.join(ROOT_DIR, 'packages/pieces/builtin/src/pieces')

// Create a require function
const require = createRequire(import.meta.url)

// Register module aliases for @activepieces packages
// We need to point to the BUILTIN package for framework/common since they are now inside it
const setupModuleAliases = () => {
    const moduleAlias = require('module-alias')

    // Note: In the compiled output, imports are relative or resolved.
    // But when we require() the piece to get metadata, we might need these aliases
    // if the piece code uses them.
    // However, since we built everything together, the require paths in the JS files
    // should be correct (relative) OR pointing to node_modules.
    // Let's see if we need this.
    
    // For now, map to the compiled output in builtin
    moduleAlias.addAliases({
        '@activepieces/pieces-framework': path.join(BUILTIN_DIST, 'src/pieces/framework/index.js'),
        '@activepieces/pieces-common': path.join(BUILTIN_DIST, 'src/pieces/common/index.js'),
        '@activepieces/shared': path.join(ROOT_DIR, 'dist/packages/shared/src/index.js'),
        '@activepieces/common-ai': path.join(BUILTIN_DIST, 'src/pieces/common-ai/index.js'),
    })
}

async function generateBuiltinMetadata() {
    console.log('='.repeat(60))
    console.log('Generating Metadata for BUILTIN package...')
    console.log('='.repeat(60))
    console.log('')

    try {
        setupModuleAliases()
        console.log('Module aliases configured')
    } catch (e) {
        console.warn('module-alias not found')
    }

    // Create output directories
    await fs.ensureDir(path.join(BUILTIN_DIST, 'known'))
    await fs.ensureDir(path.join(BUILTIN_DIST, 'types'))
    
    // Check if pieces dir exists in dist
    if (!await fs.pathExists(BUILTIN_PIECES_DIST)) {
        console.error(`Error: ${BUILTIN_PIECES_DIST} not found.`)
        console.error('Did you run sync-community-to-builtin.mjs and nx build pieces-builtin?')
        process.exit(1)
    }

    const pieceDirs = await fs.readdir(BUILTIN_PIECES_DIST)

    const knownPieces = { pieces: {} }
    const typePieces = { pieces: [] }

    let successCount = 0
    let skipCount = 0
    let partialCount = 0

    // Load versions
    const versionsPath = path.join(BUILTIN_DIST, 'src/versions.js')
    let pieceVersions = {}
    try {
        if (await fs.pathExists(versionsPath)) {
            const versionsModule = require(versionsPath)
            pieceVersions = versionsModule.pieceVersions || {}
            console.log(`Loaded versions map for ${Object.keys(pieceVersions).length} pieces`)
        } else {
            console.warn(`Warning: versions.js not found at ${versionsPath}. All pieces will use 0.0.0`)
        }
    } catch (e) {
        console.warn(`Warning: Failed to load versions.js: ${e.message}`)
    }

    console.log('Scanning compiled pieces...')

    for (const pieceDir of pieceDirs) {
        // Skip files (like index.js)
        if ((await fs.stat(path.join(BUILTIN_PIECES_DIST, pieceDir))).isFile()) continue
        
        // Skip framework/common/common-ai as they are not "pieces" in the registry sense
        // (Though they might be, but usually we don't expose them as pieces to the user)
        if (['framework', 'common', 'common-ai'].includes(pieceDir)) continue

        const distPiecePath = path.join(BUILTIN_PIECES_DIST, pieceDir)
        const distIndexPath = path.join(distPiecePath, 'index.js') // Note: it might be index.js directly in piece dir or src/index.js depending on compilation
        
        // Look for package.json in SOURCE directory since it's not copied to dist by default
        // const srcPackageJsonPath = path.join(BUILTIN_SRC_DIR, pieceDir, 'package.json')
        
        // Also verify dist index exists
        if (!await fs.pathExists(distIndexPath)) {
             // Try src/index.js if index.js doesn't exist (though usually flattened)
             if (await fs.pathExists(path.join(distPiecePath, 'src/index.js'))) {
                 // It seems I copied 'src' content to 'src/pieces/{name}'.
                 // If original was 'src/index.ts', it becomes 'src/pieces/{name}/index.ts'.
                 // Compiled: 'src/pieces/{name}/index.js'.
             } else {
                console.warn(`  SKIP: ${pieceDir} (missing index.js in dist)`)
                skipCount++
                continue
             }
        }
        
        // Infer metadata from directory name
        // We no longer expect package.json in the piece directory
        const name = `@activepieces/piece-${pieceDir}`
        const version = pieceVersions[pieceDir] || '0.0.0'
        const exportName = pieceDir // Keep dashes, e.g. send-message
        // Wait, standard pieces export 'const pieceName = createPiece(...)'.
        // And usually the export name matches the directory name but cleaned up?
        // Actually, the export name IS the piece name usually?
        // Let's check previous code.
        // It was: const exportName = name.replace('@activepieces/piece-', '')
        // So @activepieces/piece-http -> http.
        
        // Path relative to builtin package root
        const sourcePath = `./src/pieces/${pieceDir}/index.js`

        try {
            // 1. Add to known
            knownPieces.pieces[name] = {
                name,
                version,
                exportName, // This exportName is used to load the piece from the module.
                // We need to be careful. The module exports `export const http = ...`?
                // Or `export const piece = ...`?
                // Let's check `http` piece. `export const http = createPiece(...)`
                // So exportName should be 'http'.
                sourcePath,
                className: exportName,
            }

            // 2. Load metadata

            try {
                const resolvedPath = require.resolve(distIndexPath)
                delete require.cache[resolvedPath]
                
                const module = require(distIndexPath)
                const piece = module[exportName] || module.default || Object.values(module).find(v => v && typeof v === 'object' && 'metadata' in v)

                if (piece && typeof piece.metadata === 'function') {
                    const meta = piece.metadata()
                    typePieces.pieces.push({
                        name,
                        displayName: meta.displayName,
                        description: meta.description || '',
                        logoUrl: meta.logoUrl || '',
                        version,
                        categories: meta.categories || [],
                        actions: meta.actions || {},
                        triggers: meta.triggers || {},
                        auth: meta.auth,
                        authors: piece.authors || [],
                        minimumSupportedRelease: meta.minimumSupportedRelease,
                        maximumSupportedRelease: meta.maximumSupportedRelease,
                    })
                    successCount++
                    console.log(`  OK: ${name}`)
                } else {
                    partialCount++
                    console.warn(`  PARTIAL: ${name} (no metadata function)`)
                }
            } catch (e) {
                partialCount++
                console.warn(`  PARTIAL: ${name} (load error: ${e.message.split('\n')[0]})`)
            }

        } catch (e) {
            console.warn(`  ERROR: ${pieceDir}: ${e.message}`)
            skipCount++
        }
    }

    // Write JSON files
    const knownPath = path.join(BUILTIN_DIST, 'known/pieces.json')
    const typesPath = path.join(BUILTIN_DIST, 'types/pieces.json')

    await fs.writeJson(knownPath, knownPieces, { spaces: 2 })
    await fs.writeJson(typesPath, typePieces, { spaces: 2 })

    console.log('')
    console.log(`✓ Metadata generated for ${successCount} pieces`)
    console.log(`  Known: ${Object.keys(knownPieces.pieces).length}`)
    console.log(`  Partial: ${partialCount}, Skipped: ${skipCount}`)
    console.log(`  Manifest: ${knownPath}`)
    process.exit(0)
}

generateBuiltinMetadata().catch(console.error)
