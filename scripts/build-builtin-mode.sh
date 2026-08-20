#!/bin/bash

###############################################################################
# Build Script for BUILTIN Mode (ALL-IN-ONE PACKAGE)
#
# This script automates the complete build process for BUILTIN mode:
# 1. Build framework and common dependencies
# 2. Build community pieces (all or specific ones)
# 3. Copy all community pieces INTO builtin package (bundled/)
# 4. Build builtin package
# 5. Generate metadata JSON files (known/pieces.json, types/pieces.json)
#
# Result: One single @activepieces/pieces-builtin package contains EVERYTHING
#         No separate community piece folders needed at runtime
#
# Usage:
#   ./scripts/build-builtin-mode.sh          # Build ALL community pieces
#   ./scripts/build-builtin-mode.sh sample   # Build only sample pieces for testing
#   ./scripts/build-builtin-mode.sh help     # Show help
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to root directory
cd "$ROOT_DIR"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

show_help() {
    cat << EOF
${GREEN}BUILTIN Mode Build Script - ALL-IN-ONE PACKAGE${NC}

This script builds a single unified package for AP_PIECES_SOURCE=BUILTIN mode.

${YELLOW}What it does:${NC}
  1. Builds framework and common dependencies
  2. Builds community pieces (all or sample)
  3. ${GREEN}Copies all community pieces into builtin package (bundled/)${NC}
  4. Builds builtin package
  5. Generates metadata JSON files for lazy loading

${YELLOW}Result:${NC}
  ✓ One single @activepieces/pieces-builtin package contains EVERYTHING
  ✓ No separate community piece folders needed at runtime
  ✓ True "all-in-one" distribution for Docker/deployment

${YELLOW}Usage:${NC}
  ./scripts/build-builtin-mode.sh [mode]

${YELLOW}Modes:${NC}
  (none)    Build ALL community pieces (~10-15 min, ~414 pieces)
  sample    Build only sample pieces for quick testing (~2-3 min, ~10 pieces)
  help      Show this help message

${YELLOW}Output Structure:${NC}
  dist/packages/pieces/builtin/
    ├── src/                  Registry and builtin pieces
    ├── bundled/              ${GREEN}ALL community pieces copied here${NC}
    │   ├── http/
    │   ├── slack/
    │   ├── webhook/
    │   └── ... (~414 pieces)
    ├── known/pieces.json     Lazy loading manifest
    └── types/pieces.json     UI metadata

${YELLOW}After running:${NC}
  Start server with: AP_PIECES_SOURCE=BUILTIN npm run dev:backend
  Deploy only: dist/packages/pieces/builtin/ (no community/ folder needed!)

${YELLOW}Examples:${NC}
  # Full build (all pieces)
  ./scripts/build-builtin-mode.sh

  # Quick test (sample pieces only)
  ./scripts/build-builtin-mode.sh sample

EOF
}

###############################################################################
# Build Steps
###############################################################################

build_dependencies() {
    print_header "Step 1/4: Building Dependencies"
    
    print_info "Building pieces-framework..."
    npx nx build pieces-framework --skip-nx-cache
    print_success "pieces-framework built"
    
    print_info "Building pieces-common..."
    npx nx build pieces-common --skip-nx-cache
    print_success "pieces-common built"
    
    print_info "Building shared package..."
    npx nx build shared --skip-nx-cache
    print_success "shared package built"

    print_info "Building common-ai..."
    npx nx build common-ai --skip-nx-cache
    print_success "common-ai built"
}

build_community_pieces_sample() {
    print_header "Step 2/4: Building Sample Community Pieces"
    
    # Sample of popular pieces for quick testing
    local sample_pieces=(
        "pieces-http"
        "pieces-webhook"
    )
    
    print_info "Building ${#sample_pieces[@]} sample pieces..."
    
    local built=0
    local failed=0
    
    for piece in "${sample_pieces[@]}"; do
        if npx nx build "$piece" --skip-nx-cache 2>/dev/null; then
            print_success "$piece"
            ((built++))
        else
            print_warning "$piece (not found or failed)"
            ((failed++))
        fi
    done
    
    echo ""
    print_success "Built $built sample pieces"
    if [ $failed -gt 0 ]; then
        print_warning "$failed pieces skipped"
    fi
}

build_community_pieces_all() {
    print_header "Step 2/4: Building ALL Community Pieces"
    
    print_info "This will take 10-15 minutes..."
    print_info "Building all pieces with 8 parallel workers..."
    
    # Build all pieces matching pattern pieces-*
    # Exclude framework, common, common-ai, builtin
    npx nx run-many \
        --target=build \
        --projects="pieces-*" \
        --exclude="pieces-framework,pieces-common,pieces-builtin,common-ai" \
        --parallel=8 \
        --skip-nx-cache
    
    print_success "All community pieces built"
}

build_builtin_package() {
    print_header "Step 3/4: Building Builtin Package"
    
    print_info "Building pieces-builtin (registry only)..."
    npx nx build pieces-builtin --skip-nx-cache
    print_success "pieces-builtin built"
}

generate_metadata() {
    print_header "Step 4/4: Generating ALL-IN-ONE Package"
    
    print_info "Copying community pieces into builtin package and generating metadata..."
    node scripts/generate-builtin-metadata.mjs
    
    # Check if files were created
    if [ -f "dist/packages/pieces/builtin/known/pieces.json" ]; then
        local known_size=$(du -h "dist/packages/pieces/builtin/known/pieces.json" | cut -f1)
        print_success "known/pieces.json created ($known_size)"
    else
        print_error "known/pieces.json not created!"
        exit 1
    fi
    
    if [ -f "dist/packages/pieces/builtin/types/pieces.json" ]; then
        local types_size=$(du -h "dist/packages/pieces/builtin/types/pieces.json" | cut -f1)
        print_success "types/pieces.json created ($types_size)"
    else
        print_error "types/pieces.json not created!"
        exit 1
    fi
}

show_summary() {
    # Clean up: Remove community dist folder (no longer needed)
    # This is done LAST to ensure it doesn't get recreated by any build steps
    print_info "Cleaning up community dist folder (now bundled in builtin package)..."
    if [ -d "dist/packages/pieces/community" ]; then
        rm -rf dist/packages/pieces/community
        print_success "Community dist folder removed"
    fi
    
    print_header "Build Complete!"
    
    # Count pieces in metadata
    if [ -f "dist/packages/pieces/builtin/known/pieces.json" ]; then
        local piece_count=$(grep -o '"name"' dist/packages/pieces/builtin/known/pieces.json | wc -l)
        print_success "Total pieces registered: $piece_count"
    fi
    
    echo ""
    print_info "Next steps:"
    echo "  1. Start server: ${GREEN}AP_PIECES_SOURCE=BUILTIN npm run dev:backend${NC}"
    echo "  2. Test API: ${GREEN}curl http://localhost:3000/v1/pieces${NC}"
    echo "  3. Create a flow and verify it executes without npm install"
    echo ""
    print_info "Files created:"
    echo "  - dist/packages/pieces/builtin/known/pieces.json"
    echo "  - dist/packages/pieces/builtin/types/pieces.json"
    echo ""
    print_info "Deploy only this folder:"
    echo "  - dist/packages/pieces/builtin/ (${GREEN}community folder removed!${NC})"
    echo ""
    print_warning "IMPORTANT: If you run other build commands (nx build, npm run build),"
    echo "           the community folder may be recreated. To clean it up, run:"
    echo "           ${GREEN}./scripts/cleanup-community-dist.sh${NC}"
    echo ""
}

###############################################################################
# Main Script
###############################################################################

main() {
    local mode="${1:-all}"
    
    case "$mode" in
        help|-h|--help)
            show_help
            exit 0
            ;;
        sample)
            print_header "BUILTIN Mode Build (SAMPLE)"
            build_dependencies
            build_community_pieces_sample
            build_builtin_package
            generate_metadata
            show_summary
            ;;
        all|"")
            print_header "BUILTIN Mode Build (ALL PIECES)"
            print_warning "This will take 10-15 minutes to build ~414 pieces"
            build_dependencies
            build_community_pieces_all
            build_builtin_package
            generate_metadata
            show_summary
            ;;
        *)
            print_error "Unknown mode: $mode"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
