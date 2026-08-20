#!/bin/bash

###############################################################################
# Complete Rebuild for BUILTIN Mode
#
# This script rebuilds EVERYTHING needed for BUILTIN mode to work:
# 1. Server packages (API, Worker, Shared)
# 2. Piece dependencies (framework, common, shared, common-ai)
# 3. Sample community pieces
# 4. Builtin package and metadata
# 5. Cleanup community dist folder
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$(dirname "$0")/.."

echo "============================================================"
echo "Complete Rebuild for BUILTIN Mode"
echo "============================================================"
echo ""

# Step 1: Rebuild server packages with BUILTIN support
echo -e "${BLUE}Step 1/5: Rebuilding server packages...${NC}"
npx nx build server-shared --skip-nx-cache
npx nx build server-api --skip-nx-cache  
npx nx build server-worker --skip-nx-cache
npx nx build engine --skip-nx-cache
echo -e "${GREEN}✓ Server packages rebuilt${NC}"
echo ""

# Step 2: Build dependencies
echo -e "${BLUE}Step 2/5: Building piece dependencies...${NC}"
npx nx build pieces-framework --skip-nx-cache
npx nx build pieces-common --skip-nx-cache
npx nx build shared --skip-nx-cache
npx nx build common-ai --skip-nx-cache
echo -e "${GREEN}✓ Dependencies built${NC}"
echo ""

# Step 3: Build sample community pieces
echo -e "${BLUE}Step 3/5: Building sample community pieces...${NC}"
npx nx build pieces-http --skip-nx-cache || echo -e "${YELLOW}  (http skipped)${NC}"
npx nx build pieces-webhook --skip-nx-cache || echo -e "${YELLOW}  (webhook skipped)${NC}"
echo -e "${GREEN}✓ Sample pieces built${NC}"
echo ""

# Step 4: Build builtin package and generate metadata
echo -e "${BLUE}Step 4/5: Building builtin package...${NC}"
npx nx build pieces-builtin --skip-nx-cache
echo -e "${GREEN}✓ Builtin package built${NC}"
echo ""

echo -e "${BLUE}Generating metadata (all-in-one package)...${NC}"
if ! node scripts/generate-builtin-metadata.mjs; then
    echo -e "${RED}✗ Failed to generate metadata${NC}"
    exit 1
fi
echo ""

# Step 5: Clean up community dist folder
echo -e "${BLUE}Step 5/5: Cleaning up community dist folder...${NC}"
if [ -d "dist/packages/pieces/community" ]; then
    # Calculate size before cleanup for reporting
    COMMUNITY_SIZE=$(du -sh dist/packages/pieces/community 2>/dev/null | cut -f1 || echo "unknown")
    
    # Remove community folder
    rm -rf dist/packages/pieces/community
    
    # Verify removal
    if [ -d "dist/packages/pieces/community" ]; then
        echo -e "${RED}✗ Failed to remove community dist folder${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Community dist folder removed (freed ${COMMUNITY_SIZE})${NC}"
else
    echo -e "${GREEN}✓ Community dist folder already clean${NC}"
fi
echo ""

# Final verification
echo "============================================================"
echo -e "${GREEN}✓ Complete rebuild finished!${NC}"
echo "============================================================"
echo ""
echo -e "${BLUE}Final structure:${NC}"
if [ -d "dist/packages/pieces" ]; then
    ls -lah dist/packages/pieces/ | grep -v "^total" | grep -v "^\."
    echo ""
    
    # Show size of builtin package
    if [ -d "dist/packages/pieces/builtin" ]; then
        BUILTIN_SIZE=$(du -sh dist/packages/pieces/builtin | cut -f1)
        BUNDLED_COUNT=$(find dist/packages/pieces/builtin/bundled -maxdepth 1 -type d | wc -l | tr -d ' ')
        BUNDLED_COUNT=$((BUNDLED_COUNT - 1))  # Subtract the bundled dir itself
        
        echo -e "${GREEN}Builtin package:${NC}"
        echo "  Size: ${BUILTIN_SIZE}"
        echo "  Bundled pieces: ${BUNDLED_COUNT}"
        
        # Check manifest files
        if [ -f "dist/packages/pieces/builtin/known/pieces.json" ]; then
            KNOWN_COUNT=$(grep -o '"name":' dist/packages/pieces/builtin/known/pieces.json | wc -l | tr -d ' ')
            echo "  Known pieces (manifest): ${KNOWN_COUNT}"
        fi
        
        if [ -f "dist/packages/pieces/builtin/types/pieces.json" ]; then
            TYPES_COUNT=$(grep -o '"displayName":' dist/packages/pieces/builtin/types/pieces.json | wc -l | tr -d ' ')
            echo "  Type metadata: ${TYPES_COUNT}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ dist/packages/pieces not found${NC}"
fi
echo ""
echo -e "${BLUE}Start server with:${NC}"
echo "  AP_PIECES_SOURCE=BUILTIN npm run dev:backend"
echo ""
echo -e "${YELLOW}Note: This is the ALL-IN-ONE package approach.${NC}"
echo "Only dist/packages/pieces/builtin/ is needed at runtime."
echo "============================================================"
