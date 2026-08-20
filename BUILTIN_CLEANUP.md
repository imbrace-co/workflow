# BUILTIN Mode - Cleanup and Optimization

## Changes Made

### 1. ✅ Removed Community Dist Folder After Build

**Problem**: The `dist/packages/pieces/community/` folder remained after copying to bundled, causing:
- Duplicate files (wasting ~1.42 MB)
- Confusion about which folder to deploy
- Larger deployment artifacts

**Solution**: Added cleanup step in build script:
```bash
# Clean up: Remove community dist folder (no longer needed)
print_info "Cleaning up community dist folder (now bundled in builtin package)..."
if [ -d "dist/packages/pieces/community" ]; then
    rm -rf dist/packages/pieces/community
    print_success "Community dist folder removed"
fi
```

**Result**:
```
dist/packages/pieces/
└── builtin/              <-- ONLY this folder exists! ✨
    ├── bundled/
    ├── known/
    ├── types/
    └── src/
```

### 2. ✅ Simplified Package.json Files

**Problem**: Each bundled piece had a full package.json with:
- All dependencies listed (even though they're bundled)
- Build configurations
- Override/resolution configs
- Unnecessary metadata

**Old package.json** (~40+ lines):
```json
{
  "name": "@activepieces/piece-http",
  "version": "0.9.1",
  "dependencies": {
    "@sinclair/typebox": "0.34.11",
    "axios": "1.8.3",
    "axios-retry": "4.4.1",
    "deepmerge-ts": "7.1.0",
    "form-data": "4.0.4",
    "https-proxy-agent": "7.0.4",
    "mime-types": "2.1.35",
    "nanoid": "3.3.8",
    "semver": "7.6.0",
    "zod": "3.25.76",
    "@activepieces/pieces-common": "0.7.0",
    "@activepieces/pieces-framework": "0.20.1",
    "@activepieces/shared": "0.21.0",
    "tslib": "1.14.1"
  },
  "overrides": { ... },
  "resolutions": { ... },
  ...
}
```

**New minimal package.json** (5 lines):
```json
{
  "name": "@activepieces/piece-http",
  "version": "0.9.1",
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts"
}
```

**Why This Works**:
- Dependencies are already bundled in the same package
- Node.js only needs to know the entry point (`main`)
- TypeScript only needs the types location (`types`)
- Module type is specified for proper loading (`commonjs`)

### 3. Implementation Details

**In `generate-builtin-metadata.mjs`**:
```javascript
// After copying piece files, create minimal package.json
const minimalPackageJson = {
    name,
    version,
    type: 'commonjs',
    main: './src/index.js',
    types: './src/index.d.ts'
}
await fs.writeJson(
    path.join(targetDir, 'package.json'),
    minimalPackageJson,
    { spaces: 2 }
)
```

## Benefits

### 🎯 Cleaner Distribution

**Before**:
```
dist/packages/pieces/
├── community/          <-- 1.42 MB (duplicate!)
│   ├── framework/
│   ├── common/
│   ├── http/
│   └── ...
└── builtin/            <-- 1.42 MB
    └── bundled/        (same files as community/)
```

**After**:
```
dist/packages/pieces/
└── builtin/            <-- 2.8 MB total (includes src/)
    └── bundled/        <-- 1.42 MB (only location)
```

### 📦 Smaller Package Size

- **Removed duplicate** community dist folder (~1.42 MB saved)
- **Minimal package.json** files (~80% smaller per file)
- **Total builtin package**: 2.8 MB (registry + all bundled pieces)

### 🚀 Deployment Simplified

**Before**:
```dockerfile
# Had to wonder which folder to copy
COPY dist/packages/pieces/community /app/dist/...  # Is this needed?
COPY dist/packages/pieces/builtin /app/dist/...    # Or just this?
```

**After**:
```dockerfile
# Crystal clear - one folder, everything included
COPY dist/packages/pieces/builtin /app/dist/packages/pieces/builtin
```

### 🔒 True Self-Contained Package

- ✅ **One source of truth**: Only `builtin/` exists
- ✅ **No confusion**: Can't accidentally use community dist
- ✅ **Minimal metadata**: Only what Node.js needs for module resolution
- ✅ **All dependencies bundled**: framework, common, common-ai included

## Build Output

```bash
$ ./scripts/build-builtin-mode.sh sample

# ... build steps ...

✓ known/pieces.json created (4.0K)
✓ types/pieces.json created (184K)
ℹ Cleaning up community dist folder (now bundled in builtin package)...
✓ Community dist folder removed               <-- NEW!

Build Complete!
✓ Total pieces registered: 9

dist/packages/pieces/
└── builtin/                                   <-- ONLY this!
    ├── src/                (registry code)
    ├── bundled/            (all pieces)
    │   ├── framework/      (minimal package.json)
    │   ├── common/         (minimal package.json)
    │   ├── http/           (minimal package.json)
    │   └── ...
    ├── known/pieces.json
    └── types/pieces.json
```

## Verification

Check that community folder is removed:
```bash
ls dist/packages/pieces/
# Output: builtin (only!)
```

Check minimal package.json:
```bash
cat dist/packages/pieces/builtin/bundled/http/package.json
# Output: 5 lines of essential metadata only
```

Check total size:
```bash
du -sh dist/packages/pieces/builtin/
# Output: 2.8M (registry + bundled pieces)
```

## Summary

✅ **Community dist folder removed** - No duplicates, cleaner output
✅ **Minimal package.json files** - Only essential metadata for module resolution
✅ **True all-in-one package** - Everything in `builtin/`, nothing else needed
✅ **Smaller deployment size** - No duplicate files
✅ **Clearer architecture** - One folder to deploy, no confusion

The builtin package is now truly self-contained and optimized! 🎉
