#!/bin/bash

###############################################################################
# Cleanup Script - Remove Community Dist Folder
#
# This script removes the community dist folder, leaving only the builtin
# all-in-one package. Use this if the community folder gets recreated by
# subsequent build commands.
#
# Usage:
#   ./scripts/cleanup-community-dist.sh [--force]
#
# Options:
#   --force   Skip confirmation prompt (useful for CI)
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Parse arguments
FORCE=false
if [ "$1" = "--force" ]; then
    FORCE=true
fi

echo ""
echo "============================================================"
echo -e "${BLUE}BUILTIN Mode Cleanup${NC}"
echo "============================================================"
echo ""

# Check if dist/packages/pieces exists
if [ ! -d "dist/packages/pieces" ]; then
    echo -e "${YELLOW}⚠ dist/packages/pieces not found${NC}"
    echo "Run a build first: ./scripts/build-builtin-mode.sh sample"
    exit 1
fi

# Check if community folder exists
if [ ! -d "dist/packages/pieces/community" ]; then
    echo -e "${GREEN}✓ Community dist folder not found (already clean)${NC}"
    echo ""
    echo -e "${BLUE}Current structure:${NC}"
    ls -lah dist/packages/pieces/ | grep -v "^total" | grep -v "^\."
    echo ""
    exit 0
fi

# Show what will be deleted
COMMUNITY_SIZE=$(du -sh dist/packages/pieces/community 2>/dev/null | cut -f1 || echo "unknown")
PIECE_COUNT=$(find dist/packages/pieces/community -maxdepth 1 -type d | wc -l | tr -d ' ')
PIECE_COUNT=$((PIECE_COUNT - 1))  # Subtract the community dir itself

echo -e "${BLUE}Found community dist folder:${NC}"
echo "  Location: dist/packages/pieces/community/"
echo "  Size: ${COMMUNITY_SIZE}"
echo "  Pieces: ${PIECE_COUNT}"
echo ""

# Confirm deletion (unless --force)
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}This will permanently delete the community dist folder.${NC}"
    echo "The builtin package already contains all pieces (all-in-one approach)."
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    echo ""
fi

# Perform cleanup
echo -e "${BLUE}Removing community dist folder...${NC}"
rm -rf dist/packages/pieces/community

# Verify removal
if [ -d "dist/packages/pieces/community" ]; then
    echo -e "${RED}✗ Failed to remove community dist folder${NC}"
    echo "Check permissions and try again."
    exit 1
fi

echo -e "${GREEN}✓ Community dist folder removed (freed ${COMMUNITY_SIZE})${NC}"
echo ""

# Show final structure
echo "============================================================"
echo -e "${BLUE}Final structure:${NC}"
echo "============================================================"
ls -lah dist/packages/pieces/ | grep -v "^total" | grep -v "^\."
echo ""

# Verify builtin package exists and show stats
if [ -d "dist/packages/pieces/builtin" ]; then
    BUILTIN_SIZE=$(du -sh dist/packages/pieces/builtin | cut -f1)
    echo -e "${GREEN}Builtin package (all-in-one):${NC}"
    echo "  Size: ${BUILTIN_SIZE}"
    
    if [ -d "dist/packages/pieces/builtin/bundled" ]; then
        BUNDLED_COUNT=$(find dist/packages/pieces/builtin/bundled -maxdepth 1 -type d | wc -l | tr -d ' ')
        BUNDLED_COUNT=$((BUNDLED_COUNT - 1))
        echo "  Bundled pieces: ${BUNDLED_COUNT}"
    fi
    
    if [ -f "dist/packages/pieces/builtin/known/pieces.json" ]; then
        KNOWN_COUNT=$(grep -o '"name":' dist/packages/pieces/builtin/known/pieces.json | wc -l | tr -d ' ')
        echo "  Known pieces (manifest): ${KNOWN_COUNT}"
    fi
else
    echo -e "${RED}✗ Builtin package not found!${NC}"
    echo "Run ./scripts/build-builtin-mode.sh first"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Cleanup complete!${NC}"
echo ""
echo -e "${BLUE}Deploy this folder:${NC}"
echo "  dist/packages/pieces/builtin/"
echo ""
echo -e "${BLUE}Start server with:${NC}"
echo "  AP_PIECES_SOURCE=BUILTIN npm run dev:backend"
echo ""
echo -e "${YELLOW}Note: If you run other build commands (nx build, pnpm build),${NC}"
echo -e "${YELLOW}the community folder may be recreated. Run this script again.${NC}"
echo "============================================================"
