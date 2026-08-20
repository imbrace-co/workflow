import { Piece } from '@activepieces/pieces-framework'
import * as path from 'path'
import * as fs from 'fs'

export type BuiltinPieceInfo = {
    name: string
    version: string
    piece: Piece
}

/**
 * Piece loading details - stored in known/pieces.json
 * Only contains paths, NOT actual code
 */
interface PieceLoadingDetails {
    name: string           // @activepieces/piece-slack
    version: string
    exportName: string     // slack (the named export)
    sourcePath: string     // Relative path to built piece
}

interface KnownPieces {
    pieces: Record<string, PieceLoadingDetails>
}

/**
 * BuiltinPieceRegistry - TRUE Lazy Loading
 *
 * Checks `known/pieces.json` for piece location and uses `require()`
 * to load code only when requested.
 */
class BuiltinPieceRegistry {
    // Loaded pieces cache
    private loadedPieces: Map<string, Piece> = new Map()
    
    // Manifest cache
    private known: KnownPieces | null = null
    
    private knownPath: string
    private basePath: string

    constructor() {
        // Try to find the manifest file
        // 1. In production (dist), it should be at ../known/pieces.json relative to this file
        // 2. In dev/source, it might not exist yet or be in a different place
        
        const possiblePaths = [
            path.resolve(__dirname, '../known/pieces.json'), // From dist/packages/pieces/builtin/src/
            path.resolve(__dirname, '../../known/pieces.json'), // Just in case
            path.resolve(process.cwd(), 'dist/packages/pieces/builtin/known/pieces.json') // From project root
        ]
        
        let foundPath: string | null = null
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                foundPath = testPath
                break
            }
        }
        
        if (foundPath) {
            this.knownPath = foundPath
            // basePath is the package root (dist/packages/pieces/builtin)
            // If manifest is at /.../builtin/known/pieces.json, root is /.../builtin
            this.basePath = path.dirname(path.dirname(foundPath))
            
            this.registerModuleAliases()
        } else {
             // Fallback logic
             this.knownPath = possiblePaths[0]
             this.basePath = path.resolve(__dirname, '../')
             console.warn(`[BuiltinRegistry] Manifest not found. Expected at: ${this.knownPath}`)
        }
    }

    private registerModuleAliases() {
        try {
            const moduleAlias = require('module-alias')
            // Map @activepieces/* to the bundled locations in dist
            moduleAlias.addAliases({
                '@activepieces/pieces-framework': path.join(this.basePath, 'src/pieces/framework/index.js'),
                '@activepieces/pieces-common': path.join(this.basePath, 'src/pieces/common/index.js'),
                '@activepieces/shared': path.join(this.basePath, '../../shared/src/index.js'), 
                '@activepieces/common-ai': path.join(this.basePath, 'src/pieces/common-ai/index.js'),
            })
            // console.log('[BuiltinRegistry] Registered module aliases for bundled pieces')
        } catch (e) {
            // module-alias might not be available or needed
            // console.warn('[BuiltinRegistry] Failed to register module aliases:', e)
        }
    }

    /**
     * Normalize piece name to full package name
     * Converts "automate-data-board" to "@activepieces/piece-automate-data-board"
     * If already in full format, returns as-is
     */
    private normalizePieceName(pieceName: string): string {
        // If already in full format, return as-is
        if (pieceName.startsWith('@activepieces/piece-')) {
            return pieceName
        }
        // Convert short name to full package name
        return `@activepieces/piece-${pieceName}`
    }

    private loadKnown(): KnownPieces {
        if (this.known) return this.known
        
        if (!fs.existsSync(this.knownPath)) {
            console.warn(`[BuiltinRegistry] Manifest file missing at ${this.knownPath}`)
            return { pieces: {} }
        }
        
        try {
            this.known = JSON.parse(fs.readFileSync(this.knownPath, 'utf-8'))
            return this.known!
        } catch (e) {
            console.error(`[BuiltinRegistry] Failed to parse manifest:`, e)
            return { pieces: {} }
        }
    }

    /**
     * Check if piece exists
     */
    hasPiece(pieceName: string): boolean {
        const known = this.loadKnown()
        const normalizedName = this.normalizePieceName(pieceName)
        return normalizedName in known.pieces
    }

    /**
     * List all builtin pieces info (without loading code if possible)
     * Note: BuiltinPieceInfo requires the `piece` object, so this would trigger loading.
     * Use listPieceNames() if you just want names.
     */
    listBuiltinPieces(): BuiltinPieceInfo[] {
        const known = this.loadKnown()
        // We iterate over known pieces and load them only if strictly needed by current interface signature
        // The current interface implies we return the piece object.
        // For optimization, consumers should preferably not call this if they just want metadata.
        
        return Object.values(known.pieces).map(details => {
            // Lazy load - but actually this forces loading if we need the 'piece' object immediately
            const piece = this.getPiece(details.name)
            return {
                name: details.name,
                version: details.version,
                piece: piece
            }
        })
    }

    /**
     * Get piece - LAZY LOAD
     */
    getPiece(pieceName: string): Piece {
        const normalizedName = this.normalizePieceName(pieceName)
        
        if (this.loadedPieces.has(normalizedName)) {
            return this.loadedPieces.get(normalizedName)!
        }

        const known = this.loadKnown()
        const details = known.pieces[normalizedName]

        if (!details) {
            throw new Error(`Piece ${pieceName} (normalized: ${normalizedName}) not found in builtin registry`)
        }

        try {
            // Resolve the path to the piece code
            // sourcePath is something like "./src/pieces/http/index.js"
            const piecePath = path.resolve(this.basePath, details.sourcePath)
            
            // Lazy load!
            const module = require(piecePath)
            
            // Extract piece
            // Extract piece
            const piece = module[details.exportName] || module.default || Object.values(module).find((v: any) => v?.type === 'PIECE' || (v && typeof v === 'object' && 'metadata' in v))
            
            if (!piece) {
                 throw new Error(`Piece object not found in export of ${pieceName}`)
            }
            
            // Fix metadata/name if needed (similar to previous logic)
            // But usually the piece should be correct.
            // If the piece metadata name is missing or different, we might want to override?
            // For now, assume it's correct or minimal override.
            
            this.loadedPieces.set(normalizedName, piece)
            return piece
        } catch (e) {
            console.error(`[BuiltinRegistry] Failed to load piece ${pieceName}:`, e)
            throw e
        }
    }

    /**
     * Get piece path for engine
     */
    getPiecePath(pieceName: string): string {
         const normalizedName = this.normalizePieceName(pieceName)
         const known = this.loadKnown()
         const details = known.pieces[normalizedName]
         
         if (!details) {
             throw new Error(`Piece ${pieceName} (normalized: ${normalizedName}) not found`)
         }
         
         const fullPath = path.resolve(this.basePath, details.sourcePath)
         // Return directory of the index.js
         return path.dirname(fullPath)
    }
    
    getBuiltinPieceInfo(pieceName: string): BuiltinPieceInfo | undefined {
        if (!this.hasPiece(pieceName)) return undefined
        
        const normalizedName = this.normalizePieceName(pieceName)
        const piece = this.getPiece(pieceName)
        const known = this.loadKnown()
        return {
            name: normalizedName,
            version: known.pieces[normalizedName].version,
            piece: piece
        }
    }
}

export const builtinRegistry = new BuiltinPieceRegistry()
export const builtinPiecesMap = new Map<string, BuiltinPieceInfo>() // Deprecated/Empty
export const builtinPiecesList: BuiltinPieceInfo[] = [] // Deprecated/Empty

