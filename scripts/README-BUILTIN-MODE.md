# BUILTIN Mode Build Script

Automated build script for setting up `AP_PIECES_SOURCE=BUILTIN` mode.

## Quick Start

```bash
# For quick testing (builds ~10 sample pieces, takes 2-3 minutes)
./scripts/build-builtin-mode.sh sample

# For production (builds all ~414 pieces, takes 10-15 minutes)
./scripts/build-builtin-mode.sh
```

## What It Does

1. **Builds Dependencies**
   - `pieces-framework` - Core piece framework
   - `pieces-common` - Common utilities
   - `shared` - Shared types and utilities

2. **Builds Community Pieces**
   - Sample mode: ~10 popular pieces (Slack, Gmail, HTTP, etc.)
   - All mode: All ~414 community pieces

3. **Builds Builtin Package**
   - The lightweight registry package (~10KB)
   - Contains only lazy-loading code, no piece code

4. **Generates Metadata**
   - `dist/packages/pieces/builtin/known/pieces.json` - For lazy loading
   - `dist/packages/pieces/builtin/types/pieces.json` - For UI metadata

## Usage

### Sample Mode (Recommended for Development)

```bash
./scripts/build-builtin-mode.sh sample
```

Builds only these pieces:
- slack
- gmail
- http
- google-sheets
- discord
- github
- telegram-bot
- stripe
- openai
- airtable

**Best for:**
- Local development
- Quick testing
- CI/CD pipelines
- Fast iteration

**Time:** 2-3 minutes

### All Mode (For Production)

```bash
./scripts/build-builtin-mode.sh
```

Builds all community pieces (~414 pieces).

**Best for:**
- Production builds
- Full feature testing
- Docker images
- Release preparation

**Time:** 10-15 minutes

## After Building

Start the server with BUILTIN mode:

```bash
AP_PIECES_SOURCE=BUILTIN npm run dev:backend
```

Verify pieces are loaded:

```bash
# List all pieces
curl http://localhost:3000/v1/pieces | jq '.data | length'

# Get specific piece
curl http://localhost:3000/v1/pieces/@activepieces/piece-slack | jq '.name'
```

## Output Files

After successful build, you'll have:

```
dist/packages/pieces/builtin/
├── known/
│   └── pieces.json          # ~500KB - Lazy loading paths
├── types/
│   └── pieces.json          # ~5MB - Full UI metadata
└── src/
    └── index.js             # Registry code
```

## Troubleshooting

### "Pieces manifest not found" Error

The JSON files weren't generated. Re-run the script:

```bash
./scripts/build-builtin-mode.sh sample
```

### Only 1-2 Pieces Showing

You only built the builtin test pieces. Run the script to build community pieces:

```bash
./scripts/build-builtin-mode.sh sample  # Quick
# or
./scripts/build-builtin-mode.sh         # Full
```

### Build Fails

Clean and rebuild:

```bash
# Clean dist
rm -rf dist/

# Rebuild dependencies first
npx nx build pieces-framework
npx nx build pieces-common
npx nx build shared

# Then run the script
./scripts/build-builtin-mode.sh sample
```

## Memory Usage

BUILTIN mode uses lazy loading for optimal memory:

| Stage | Memory Usage |
|-------|--------------|
| Startup (JSON only) | ~50MB |
| After 5 pieces used | ~80MB |
| After 50 pieces used | ~200MB |

Compare to DB mode:
- First piece load: 3-12 seconds (npm install)
- BUILTIN mode: < 50ms (require from disk)

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/build.yml
- name: Build BUILTIN mode
  run: ./scripts/build-builtin-mode.sh sample

- name: Test BUILTIN mode
  run: |
    AP_PIECES_SOURCE=BUILTIN npm run dev:backend &
    sleep 10
    curl http://localhost:3000/v1/pieces
```

## Related Files

- `scripts/generate-builtin-metadata.mjs` - Metadata generation logic
- `packages/pieces/builtin/src/registry.ts` - Lazy loading registry
- `PRPs/builtin-pieces-optimization.md` - Complete implementation guide

## Help

```bash
./scripts/build-builtin-mode.sh help
```
