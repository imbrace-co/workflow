import fs from 'fs/promises'
import path from 'path'
import { Action, Piece, PiecePropertyMap, Trigger } from '@activepieces/pieces-framework'
import { ActivepiecesError, ErrorCode, ExecutePropsOptions, extractPieceFromModule, getPackageAliasForPiece, isNil } from '@activepieces/shared'
import { utils } from '../utils'

export const pieceLoader = {
    loadPieceOrThrow: async (
        { pieceName, pieceVersion, devPieces }: LoadPieceParams,
    ): Promise<Piece> => {
        try {
            const pieceSource = "BUILTIN"
            const packageName = pieceLoader.getPackageAlias({
                pieceName,
                pieceVersion,
                pieceSource,
                devPieces,
            })
            console.log(`[PIECE_LOADER] loadPieceOrThrow: pieceName=${pieceName}, packageName=${packageName}, pieceSource=${pieceSource}`)

            const piecePath = await pieceLoader.getPiecePath({ packageName, pieceSource, devPieces })
            console.log(`[PIECE_LOADER] Got piece path: ${piecePath}`)

            // Check if this is a builtin or community piece marker
            if (piecePath.startsWith('builtin://') || piecePath.startsWith('community://')) {
                console.log(`[REGISTRY] Loading piece "${packageName}" directly from registry`)
                const { builtinRegistry } = await import('@activepieces/pieces-builtin')
                console.log(`[REGISTRY] Registry imported, attempting to get piece`)
                const piece = builtinRegistry.getPiece(packageName)
                console.log(`[REGISTRY] Piece loaded successfully from registry`)
                return piece
            }

            console.log(`[PIECE_LOADER] Importing piece from path: ${piecePath}`)
            const module = await import(piecePath)

            const piece = extractPieceFromModule<Piece>({
                module,
                pieceName,
                pieceVersion,
            })

            if (isNil(piece)) {
                throw new ActivepiecesError({
                    code: ErrorCode.PIECE_NOT_FOUND,
                    params: {
                        pieceName,
                        pieceVersion,
                        message: 'Piece not found in the engine',
                    },
                })
            }

            return piece
        }
        catch (error) {
            console.error(`[PIECE_LOADER] Error loading piece ${pieceName}:`, error)
            throw error
        }
    },

    getPieceAndTriggerOrThrow: async (params: GetPieceAndTriggerParams): Promise<{ piece: Piece, pieceTrigger: Trigger }> => {
        const { pieceName, pieceVersion, triggerName, pieceSource, devPieces } = params
        const piece = await pieceLoader.loadPieceOrThrow({ pieceName, pieceVersion, pieceSource, devPieces })
        const trigger = piece.getTrigger(triggerName)

        if (trigger === undefined) {
            throw new Error(`trigger not found, pieceName=${pieceName}, triggerName=${triggerName}`)
        }

        return {
            piece,
            pieceTrigger: trigger,
        }
    },

    getPieceAndActionOrThrow: async (params: GetPieceAndActionParams): Promise<{ piece: Piece, pieceAction: Action }> => {
        const { pieceName, pieceVersion, actionName, pieceSource, devPieces } = params

        const piece = await pieceLoader.loadPieceOrThrow({ pieceName, pieceVersion, pieceSource, devPieces })
        const pieceAction = piece.getAction(actionName)

        if (isNil(pieceAction)) {
            throw new ActivepiecesError({
                code: ErrorCode.STEP_NOT_FOUND,
                params: {
                    pieceName,
                    pieceVersion,
                    stepName: actionName,
                },
            })
        }

        return {
            piece,
            pieceAction,
        }
    },

    getPropOrThrow: async ({ pieceName, pieceVersion, actionOrTriggerName, propertyName, pieceSource }: GetPropParams) => {
        try {
            // Use packageType from the piece package to determine the correct source
            const actualPieceSource = "BUILTIN"
            console.log(`[PIECE_LOADER] getPropOrThrow: piece=${pieceName}, pieceVersion=${pieceVersion}, pieceSource=${pieceSource}, actualPieceSource=${actualPieceSource}, actionOrTriggerName=${actionOrTriggerName}, propertyName=${propertyName}`)

            const piece = await pieceLoader.loadPieceOrThrow({ pieceName, pieceVersion, pieceSource: actualPieceSource, devPieces: [] })
            console.log(`[PIECE_LOADER] Piece loaded successfully: ${pieceName}`)

            const actionOrTrigger = piece.getAction(actionOrTriggerName) ?? piece.getTrigger(actionOrTriggerName)

            if (isNil(actionOrTrigger)) {
                console.log(`[PIECE_LOADER] Action/Trigger not found: ${actionOrTriggerName}`)
                throw new ActivepiecesError({
                    code: ErrorCode.STEP_NOT_FOUND,
                    params: {
                        pieceName,
                        pieceVersion,
                        stepName: actionOrTriggerName,
                    },
                })
            }

            console.log(`[PIECE_LOADER] Action/Trigger found: ${actionOrTriggerName}`)
            const prop = (actionOrTrigger.props as PiecePropertyMap)[propertyName]

            if (isNil(prop)) {
                console.log(`[PIECE_LOADER] Property not found: ${propertyName}, available props: ${Object.keys(actionOrTrigger.props)}`)
                throw new ActivepiecesError({
                    code: ErrorCode.CONFIG_NOT_FOUND,
                    params: {
                        pieceName,
                        pieceVersion,
                        stepName: actionOrTriggerName,
                        configName: propertyName,
                    },
                })
            }

            console.log(`[PIECE_LOADER] Property found: ${propertyName}, type: ${prop.type}`)
            return prop
        }
        catch (error) {
            console.error(`[PIECE_LOADER] Error in getPropOrThrow:`, error)
            throw error
        }
    },

    getPackageAlias: ({ pieceName, pieceVersion, pieceSource }: GetPackageAliasParams) => {
        if (isNil(pieceSource)) {
            return pieceName
        }
        if (pieceSource.trim() === 'FILE' || pieceSource.trim() === 'BUILTIN') {
            return pieceName
        }

        return getPackageAliasForPiece({
            pieceName,
            pieceVersion,
        })
    },

    getPiecePath: async ({ packageName, pieceSource }: GetPiecePathParams): Promise<string> => {
        let piecePath = null
        switch (pieceSource) {
            case 'FILE':
                piecePath = await loadPieceFromDistFolder(packageName)
                break
            case 'BUILTIN':
                piecePath = await loadPieceFromBuiltinPackage(packageName)
                break
            case 'DB':
            default:
                piecePath = await traverseAllParentFoldersToFindPiece(packageName)
                break
        }
        console.log(`Resolved piece path for package "${packageName}" with source "${pieceSource}": ${piecePath}`)
        if (isNil(piecePath)) {
            throw new ActivepiecesError({
                code: ErrorCode.PIECE_NOT_FOUND,
                params: {
                    pieceName: packageName,
                    pieceVersion: undefined,
                    message: `Piece path not found for package: ${packageName}`,
                },
            })
        }
        return piecePath
    },
}

async function loadPieceFromDistFolder(packageName: string): Promise<string | null> {
    const distPath = path.resolve('dist/packages/pieces')
    const entries = (await utils.walk(distPath)).filter((entry) => entry.name === 'package.json')
    for (const entry of entries) {
        try {
            const packageJsonPath = entry.path
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
            const packageJson = JSON.parse(packageJsonContent)
            if (packageJson.name === packageName) {
                return path.dirname(packageJsonPath)
            }
        }
        catch (error) {
            // Skip invalid package.json files
        }
    }
    return null
}

async function loadPieceFromBuiltinPackage(packageName: string): Promise<string | null> {
    try {
        // For builtin pieces, we return a special marker that tells the engine
        // to get the piece directly from the registry instead of importing
        // The marker format: builtin://@activepieces/pieces-builtin
        const { builtinRegistry } = await import('@activepieces/pieces-builtin')

        // Check if the piece exists in the registry (Builtin or Community bundled)
        if (!builtinRegistry.hasPiece(packageName)) {
            console.log(`[BUILTIN] Piece "${packageName}" not found in registry`)
            return null
        }

        // Return special marker for Engine to use registry.getPiece()
        console.log(`[BUILTIN] Piece "${packageName}" found in registry, returning marker`)
        return `builtin://@activepieces/pieces-builtin#${packageName}`
    }
    catch (error) {
        // Builtin package not installed or piece not found
        console.error(`[BUILTIN] Error loading piece "${packageName}":`, error)
        return null
    }
}

async function traverseAllParentFoldersToFindPiece(packageName: string): Promise<string | null> {
    const rootDir = path.parse(__dirname).root
    let currentDir = __dirname
    const maxIterations = currentDir.split(path.sep).length
    for (let i = 0; i < maxIterations; i++) {
        const piecePath = path.resolve(currentDir, 'pieces', packageName, 'node_modules', packageName)
        if (await utils.folderExists(piecePath)) {
            return piecePath
        }
        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir || currentDir === rootDir) {
            break
        }
        currentDir = parentDir
    }
    return null
}

type GetPiecePathParams = {
    packageName: string
    pieceSource?: string
    devPieces: string[]

}

type LoadPieceParams = {
    pieceName: string
    pieceVersion: string
    pieceSource?: string
    devPieces: string[]

}

type GetPieceAndTriggerParams = {
    pieceName: string
    pieceVersion: string
    triggerName: string
    pieceSource?: string
    devPieces: string[]

}

type GetPieceAndActionParams = {
    pieceName: string
    pieceVersion: string
    actionName: string
    pieceSource?: string
    devPieces: string[]

}

type GetPropParams = {
    pieceName: string
    pieceVersion: string
    actionOrTriggerName: string
    propertyName: string
    pieceSource?: string
    devPieces: string[]

}

type GetPackageAliasParams = {

    pieceName: string
    pieceSource?: string
    pieceVersion: string
    devPieces: string[]
}

