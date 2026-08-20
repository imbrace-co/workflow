# Community Folder Issue - Explanation and Solution

## The Problem

After running `./scripts/build-builtin-mode.sh`, the `dist/packages/pieces/community/` folder may reappear if you run subsequent build commands.

## Why This Happens

The community folder is part of the **normal build process** for Activepieces. When you run commands like:

- `nx build pieces-framework`
- `nx build pieces-common`
- `nx build pieces-http`
- `npm run dev:backend` (which rebuilds dependencies)
- `nx build server-api` (which rebuilds piece dependencies)

These commands output pieces to `dist/packages/pieces/community/` as part of their standard operation.

## The BUILTIN Mode Difference

In BUILTIN mode:
1. We **build** pieces normally (outputs to `community/`)
2. We **copy** them into `builtin/bundled/` (all-in-one package)
3. We **clean up** the `community/` folder (no longer needed)

**However**: If you run ANY other build command after this, it will recreate `community/`.

## Solutions

### Solution 1: Use the Cleanup Script (Recommended)

We've created a dedicated cleanup script:

```bash
./scripts/cleanup-community-dist.sh
```

**When to use**:
- After running other build commands
- Before deployment
- Whenever you see the community folder reappear

**What it does**:
```bash
✓ Community dist folder removed
Current dist structure:
  builtin/    <-- Only this remains!
```

### Solution 2: Manual Cleanup

```bash
rm -rf dist/packages/pieces/community
```

### Solution 3: Add to Your Workflow

If you have a deployment script, add the cleanup at the end:

```bash
# Your build commands
npm run build
# or
nx build server-api

# Clean up for BUILTIN mode
./scripts/cleanup-community-dist.sh
```

## Understanding the Architecture

### Normal Mode (FILE/DB/CLOUD_AND_DB)
```
dist/packages/pieces/
├── community/          <-- Pieces loaded from here
│   ├── framework/
│   ├── http/
│   └── ...
└── builtin/            <-- Not used in these modes
```

### BUILTIN Mode (All-in-One)
```
dist/packages/pieces/
└── builtin/            <-- Everything in one place
    ├── bundled/        <-- All pieces bundled here
    │   ├── framework/
    │   ├── http/
    │   └── ...
    ├── known/
    └── types/
```

## The Technical Reason

The reason the community folder keeps coming back:

1. **Nx Build System**: Each piece project (`pieces-http`, `pieces-framework`, etc.) has a `project.json` that specifies its output path as `dist/packages/pieces/community/piece-name`

2. **Dependencies**: When you build server or other packages, Nx rebuilds their dependencies (pieces) as needed

3. **Cache Skipping**: Even with `--skip-nx-cache`, Nx still builds to the configured output locations

4. **Build Order**: Any command that builds piece dependencies will recreate the community folder

## Best Practice for BUILTIN Mode

### During Development
1. Run `./scripts/build-builtin-mode.sh sample` or `./scripts/build-builtin-mode.sh`
2. If you rebuild anything else, run `./scripts/cleanup-community-dist.sh` before testing

### For Deployment
```bash
#!/bin/bash
# deployment-build.sh

# Build everything for BUILTIN mode
./scripts/build-builtin-mode.sh

# Build server/API
nx build server-api
nx build server-worker
nx build engine

# Final cleanup - ensure only builtin exists
./scripts/cleanup-community-dist.sh

# Package for deployment
tar -czf activepieces-builtin.tar.gz dist/packages/pieces/builtin
```

### For Docker
```dockerfile
# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN pnpm install
RUN ./scripts/build-builtin-mode.sh
RUN nx build server-api
RUN nx build server-worker
RUN nx build engine
# Clean up community folder
RUN rm -rf dist/packages/pieces/community

# Runtime stage
FROM node:20-slim
WORKDIR /app
# Only copy builtin package
COPY --from=builder /app/dist/packages/pieces/builtin /app/dist/packages/pieces/builtin
COPY --from=builder /app/dist/packages/server /app/dist/packages/server
# ... rest of files
ENV AP_PIECES_SOURCE=BUILTIN
CMD ["node", "dist/packages/server/api/main.js"]
```

## Verification

After cleanup, verify only builtin exists:

```bash
$ ls dist/packages/pieces/
builtin    # ✓ Only this!

$ du -sh dist/packages/pieces/builtin/
2.8M       # Complete all-in-one package
```

## Summary

✅ **Normal behavior**: Other build commands recreate `community/`
✅ **Not a bug**: This is how the Nx monorepo build system works
✅ **Solution**: Use `./scripts/cleanup-community-dist.sh` when needed
✅ **For deployment**: Run cleanup as the last step before packaging

The BUILTIN mode works perfectly - just remember to clean up the community folder as the final step if you've run other builds! 🎯
