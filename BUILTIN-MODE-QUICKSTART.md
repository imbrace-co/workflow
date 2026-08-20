# BUILTIN Mode - Quick Start Guide

## Current Status

✅ **Implementation Complete**
- Registry with lazy loading for community pieces
- Build script to generate metadata JSON files
- All infrastructure code in place

❌ **Not Yet Built**
- Community pieces not compiled yet
- Metadata JSON files not generated

## What You Have Now

Your current implementation supports **TWO types of pieces**:

1. **Builtin pieces** (from `packages/pieces/builtin/src/pieces/`)
   - Example: `test-builtin` piece
   - ✅ Already working - loaded directly
   
2. **Community pieces** (from `packages/pieces/community/`)
   - Example: Slack, Gmail, HTTP, etc.
   - ❌ Not working yet - needs JSON metadata files

## The Problem

Your registry in `packages/pieces/builtin/src/registry.ts` is looking for:
```
dist/packages/pieces/builtin/known/pieces.json
```

But this file doesn't exist yet because you haven't run the build process.

## The Solution (3 Easy Steps)

### Step 1: Build Sample Pieces (2-3 minutes)

```bash
cd /Users/michael_loc009/Projects/imbrace/ap-workflow
./scripts/build-builtin-mode.sh sample
```

This will:
- ✓ Build dependencies (framework, common, shared)
- ✓ Build 10 popular pieces (Slack, Gmail, HTTP, etc.)
- ✓ Build builtin package
- ✓ Generate the JSON metadata files

### Step 2: Verify Files Were Created

```bash
# Check the JSON files exist
ls -lh dist/packages/pieces/builtin/known/pieces.json
ls -lh dist/packages/pieces/builtin/types/pieces.json

# Count how many pieces were registered
cat dist/packages/pieces/builtin/known/pieces.json | grep -o '"name"' | wc -l
# Should show: 10+ pieces
```

### Step 3: Test BUILTIN Mode

```bash
# Start server with BUILTIN mode
AP_PIECES_SOURCE=BUILTIN npm run dev:backend

# In another terminal, test the API
curl http://localhost:3000/v1/pieces | jq '.data | length'
# Should show: 10+ pieces (your builtin + community pieces)

curl http://localhost:3000/v1/pieces/@activepieces/piece-slack | jq '.name'
# Should show: "@activepieces/piece-slack"
```

## Expected Behavior

### Before Running Build Script

- ❌ Only builtin pieces work (test-builtin)
- ❌ Community pieces don't appear
- ❌ Error: "Pieces manifest not found"

### After Running Build Script

- ✅ Builtin pieces work (test-builtin)
- ✅ Community pieces work (Slack, Gmail, etc.)
- ✅ Lazy loading works (low memory)
- ✅ No npm install at runtime

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ BUILTIN Mode Architecture                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Startup (~100ms, ~50MB memory):                            │
│  ┌──────────────────────────────────────────┐              │
│  │ Load JSON files only (no code)          │              │
│  │ - known/pieces.json  (paths)            │              │
│  │ - types/pieces.json  (metadata)         │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  Runtime (when piece is used):                              │
│  ┌──────────────────────────────────────────┐              │
│  │ User executes flow with Slack           │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐              │
│  │ Registry checks cache - not found       │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐              │
│  │ require() from community dist (~50ms)    │              │
│  │ ../../community/slack/src/index.js      │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐              │
│  │ Cache piece for next time                │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  Memory: ~50MB + (~5MB per piece used)                      │
└─────────────────────────────────────────────────────────────┘
```

## Build Modes

### Sample Mode (Recommended for Development)

```bash
./scripts/build-builtin-mode.sh sample
```

**Builds:** 10 popular pieces
**Time:** 2-3 minutes
**Use for:** Development, testing, CI/CD

### Full Mode (For Production)

```bash
./scripts/build-builtin-mode.sh
```

**Builds:** All ~414 community pieces
**Time:** 10-15 minutes
**Use for:** Production, Docker images, releases

## Files Created

After build completes:

```
dist/packages/pieces/builtin/
├── known/
│   └── pieces.json           # Lazy loading paths
│       {
│         "pieces": {
│           "@activepieces/piece-slack": {
│             "name": "@activepieces/piece-slack",
│             "version": "0.10.9",
│             "exportName": "slack",
│             "sourcePath": "../../community/slack/src/index.js"
│           },
│           ...
│         }
│       }
│
└── types/
    └── pieces.json           # UI metadata
        {
          "pieces": [
            {
              "name": "@activepieces/piece-slack",
              "displayName": "Slack",
              "description": "Channel-based messaging",
              "actions": {...},
              "triggers": {...}
            },
            ...
          ]
        }
```

## Troubleshooting

### Issue: Script not found

```bash
# Make sure you're in the right directory
cd /Users/michael_loc009/Projects/imbrace/ap-workflow

# Make script executable
chmod +x ./scripts/build-builtin-mode.sh
```

### Issue: Build fails

```bash
# Clean and start fresh
rm -rf dist/

# Install dependencies
pnpm install

# Try again
./scripts/build-builtin-mode.sh sample
```

### Issue: "Pieces manifest not found" when starting server

You need to run the build script first:
```bash
./scripts/build-builtin-mode.sh sample
```

## Next Steps

1. ✅ Run the build script
2. ✅ Verify JSON files created
3. ✅ Test with AP_PIECES_SOURCE=BUILTIN
4. ✅ Create a flow and verify execution
5. ✅ Check memory usage (should be low)

## Resources

- **Build Script:** `scripts/build-builtin-mode.sh`
- **Script README:** `scripts/README-BUILTIN-MODE.md`
- **Full Implementation Guide:** `PRPs/builtin-pieces-optimization.md`
- **Registry Code:** `packages/pieces/builtin/src/registry.ts`
- **Metadata Generator:** `scripts/generate-builtin-metadata.mjs`

## Questions?

Run the help command:
```bash
./scripts/build-builtin-mode.sh help
```
