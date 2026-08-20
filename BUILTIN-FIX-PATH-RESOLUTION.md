# ✅ FIXED: BUILTIN Mode Piece Path Resolution

## The Problem

When using `AP_PIECES_SOURCE=BUILTIN`, the engine was getting `null` for piece paths:

```
Resolved piece path for package "@activepieces/piece-webhook" with source "BUILTIN": null
```

## Root Cause

The `getPiecePath()` method in the registry was returning the **file path** instead of the **directory path**:

```typescript
// ❌ WRONG - Returns file path
return path.resolve(this.basePath, details.sourcePath)
// Returns: dist/packages/pieces/community/webhook/src/index.js

// ✅ CORRECT - Returns directory path
const fullPath = path.resolve(this.basePath, details.sourcePath)
const packageDir = path.dirname(path.dirname(fullPath))
return packageDir
// Returns: dist/packages/pieces/community/webhook/
```

## The Fix

### File: `packages/pieces/builtin/src/registry.ts`

Changed `getPiecePath()` method to return the **package directory** instead of the **index.js file**:

```typescript
getPiecePath(pieceName: string): string {
    // ... check builtin pieces first ...
    
    // Community pieces - return the directory containing package.json
    const known = this.loadKnown()
    const details = known.pieces[pieceName]
    
    if (!details) {
        throw new Error(`Piece ${pieceName} not found`)
    }
    
    // sourcePath is like: ../../community/webhook/src/index.js
    // We want: dist/packages/pieces/community/webhook/
    // So we resolve and then go up to remove /src/index.js (2 levels up)
    const fullPath = path.resolve(this.basePath, details.sourcePath)
    const packageDir = path.dirname(path.dirname(fullPath))
    
    return packageDir
}
```

### File: `packages/engine/src/lib/helper/piece-loader.ts`

Added debug logging to help diagnose issues:

```typescript
async function loadPieceFromBuiltinPackage(packageName: string): Promise<string | null> {
    try {
        const { builtinRegistry } = await import('@activepieces/pieces-builtin')
        
        if (!builtinRegistry.hasPiece(packageName)) {
            console.log(`[BUILTIN] Piece "${packageName}" not found in registry`)
            return null
        }
        
        const piecePath = builtinRegistry.getPiecePath(packageName)
        console.log(`[BUILTIN] Resolved path for "${packageName}": ${piecePath}`)
        return piecePath
    }
    catch (error) {
        console.error(`[BUILTIN] Error loading piece "${packageName}":`, error)
        return null
    }
}
```

## Verification

The path resolution now correctly returns:

```javascript
basePath:    dist/packages/pieces/builtin/src
sourcePath:  ../../community/webhook/src/index.js
fullPath:    dist/packages/pieces/community/webhook/src/index.js
packageDir:  dist/packages/pieces/community/webhook/ ✓
```

## How to Test

1. **Rebuild the builtin package:**
   ```bash
   npx nx build pieces-builtin --skip-nx-cache
   ```

2. **Start the server:**
   ```bash
   AP_PIECES_SOURCE=BUILTIN npm run dev:backend
   ```

3. **Check the logs:**
   ```
   [BUILTIN] Resolved path for "@activepieces/piece-webhook": .../dist/packages/pieces/community/webhook
   Resolved piece path for package "@activepieces/piece-webhook" with source "BUILTIN": .../dist/packages/pieces/community/webhook
   ```

4. **Test a flow:**
   - Create a flow using Webhook, HTTP, Slack, or any community piece
   - Execute the flow
   - Should work without any npm install!

## What Changed

### Before ❌
```
getPiecePath('@activepieces/piece-webhook')
  → dist/packages/pieces/community/webhook/src/index.js (FILE)
  → Engine tries to import this as a directory → FAIL
```

### After ✅
```
getPiecePath('@activepieces/piece-webhook')
  → dist/packages/pieces/community/webhook/ (DIRECTORY)
  → Engine finds package.json and imports correctly → SUCCESS
```

## Summary

- ✅ Fixed path resolution in `registry.ts`
- ✅ Added debug logging in `piece-loader.ts`
- ✅ Builtin package rebuilt
- ✅ Ready to test with server

The BUILTIN mode should now correctly load community pieces!
