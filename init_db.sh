#!/bin/bash

# Database initialization script for Activepieces
# This script checks if the platform and user data exist, and creates them if not

set -e

# Database connection parameters from environment variables.
# All credentials are required — never hardcode them here. Source them from
# your .env file or secret store before running, e.g.:
#   set -a && . ./.env.local && set +a && ./init_db.sh
PGHOST=${AP_POSTGRES_HOST:?AP_POSTGRES_HOST is required}
PGPORT=${AP_POSTGRES_PORT:-5432}
PGDATABASE=${AP_POSTGRES_DATABASE:?AP_POSTGRES_DATABASE is required}
PGUSER=${AP_POSTGRES_USERNAME:?AP_POSTGRES_USERNAME is required}
PGPASSWORD=${AP_POSTGRES_PASSWORD:?AP_POSTGRES_PASSWORD is required}

# Platform ID from environment
PLATFORM_ID=${AP_SHARED_PLATFORM_ID:?AP_SHARED_PLATFORM_ID is required}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    log "Waiting for PostgreSQL to be ready at $PGHOST:$PGPORT..."
    
    # Check if pg_isready is available
    if ! command -v pg_isready &> /dev/null; then
        error "pg_isready command not found. PostgreSQL client tools are required."
        error "On macOS, install with: brew install postgresql@14"
        error "Or run this script inside Docker using: docker compose up db-init"
        exit 1
    fi
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        error "psql command not found. PostgreSQL client tools are required."
        error "On macOS, install with: brew install postgresql@14"
        error "Or run this script inside Docker using: docker compose up db-init"
        exit 1
    fi
    
    # Export PGPASSWORD for pg_isready and psql
    export PGPASSWORD
    
    for i in {1..30}; do
        if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
            success "PostgreSQL is ready (pg_isready check passed)"
            
            # Additional check: try a simple query to ensure database is truly ready
            if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" >/dev/null 2>&1; then
                success "PostgreSQL is accepting queries"
                return 0
            else
                warn "PostgreSQL responds to pg_isready but not accepting queries yet"
            fi
        fi
        log "Attempt $i/30: PostgreSQL not ready yet, waiting 3 seconds..."
        sleep 3
    done
    error "PostgreSQL failed to become ready after 90 seconds"
    error "Connection details: Host=$PGHOST, Port=$PGPORT, User=$PGUSER, Database=$PGDATABASE"
    error ""
    error "Troubleshooting:"
    error "1. Check if PostgreSQL container is running: docker ps | grep postgres"
    error "2. Check container logs: docker logs postgres"
    error "3. Verify port is exposed: docker port postgres 5432"
    error "4. Test connection: psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE"
    exit 1
}

# Check if platform exists
check_platform_exists() {
    local count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c \
        "SELECT COUNT(*) FROM public.platform WHERE id = '$PLATFORM_ID';" 2>/dev/null | xargs)
    
    if [ "$count" = "1" ]; then
        return 0  # Platform exists
    else
        return 1  # Platform does not exist
    fi
}

# Check if users table is empty
check_users_empty() {
    local count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c \
        "SELECT COUNT(*) FROM public.\"user\";" 2>/dev/null | xargs)
    
    if [ "$count" = "0" ]; then
        return 0  # Users table is empty
    else
        return 1  # Users table has data
    fi
}

# Create platform
create_platform() {
    log "Creating platform with ID: $PLATFORM_ID"
    
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 << EOF
INSERT INTO public.platform (
    id,
    created,
    updated,
    "ownerId",
    name,
    "primaryColor",
    "logoIconUrl",
    "fullLogoUrl",
    "favIconUrl",
    "cloudAuthEnabled",
    "filteredPieceNames",
    "filteredPieceBehavior",
    "allowedAuthDomains",
    "enforceAllowedAuthDomains",
    "emailAuthEnabled",
    "federatedAuthProviders",
    smtp,
    "pinnedPieces"
)
VALUES (
    '$PLATFORM_ID',
    '2025-09-15 05:07:51.476142 +00:00',
    '2025-09-15 05:07:51.476142 +00:00',
    (SELECT id FROM public."user" ORDER BY created LIMIT 1),
    'Imbrace',
    '#6e41e2',
    'https://cdn.activepieces.com/brand/logo.svg',
    'https://cdn.activepieces.com/brand/full-logo.png',
    'https://cdn.activepieces.com/brand/favicon.ico',
    true,
    '{}',
    'BLOCKED',
    '{}',
    false,
    true,
    '{}',
    null,
    '{}'
);
EOF

    if [ $? -eq 0 ]; then
        success "Platform created successfully"
    else
        error "Failed to create platform"
        exit 1
    fi
}

# Create default user
create_default_user() {
    log "Creating default user and user identity"

    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 << EOF
-- Insert user identity first (skip if already exists)
INSERT INTO public.user_identity (
    id,
    created,
    updated,
    email,
    password,
    "trackEvents",
    "newsLetter",
    verified,
    "firstName",
    "lastName",
    "tokenVersion",
    provider
) VALUES (
    'H9RJkUZZg9DRAHrKhBHHp',
    '2025-09-15 05:07:51.229000 +00:00',
    '2025-09-15 05:07:51.805735 +00:00',
    'agent01@imbrace.co',
    '\$2b\$10\$c/gG3flXo4pDQzPxhEwhhuzIc32viH6PJOwMxr0CMpx5Foa2X7SA.',
    true,
    false,
    true,
    'Michael',
    'Wong',
    'NoC1FLJeClTNbc67t7Sem',
    'EMAIL'
) ON CONFLICT (id) DO NOTHING;

-- Insert user (removed lastChangelogDismissed - column no longer exists)
INSERT INTO public."user" (
    id,
    created,
    updated,
    status,
    "externalId",
    "platformId",
    "platformRole",
    "identityId"
) VALUES (
    'ChI8glRHAEmj7CBlMVmt3',
    '2025-09-15 05:07:51.380609 +00:00',
    '2025-09-15 05:07:51.577000 +00:00',
    'ACTIVE',
    null,
    '$PLATFORM_ID',
    'ADMIN',
    'H9RJkUZZg9DRAHrKhBHHp'
) ON CONFLICT (id) DO NOTHING;
EOF

    if [ $? -eq 0 ]; then
        success "Default user created successfully"
    else
        error "Failed to create default user"
        exit 1
    fi
}

# Main initialization logic
main() {
    log "Starting Activepieces database initialization"
    log "================================================"
    log "Platform ID: $PLATFORM_ID"
    log "Database Connection:"
    log "  Host: $PGHOST"
    log "  Port: $PGPORT"
    log "  Database: $PGDATABASE"
    log "  User: $PGUSER"
    log "================================================"
    
    # Wait for PostgreSQL to be ready
    wait_for_postgres
    
    # First, check if users need to be created (do this before platform creation)
    if check_users_empty; then
        log "Users table is empty, creating default user first"
        create_default_user
    else
        success "Users already exist, skipping user creation"
    fi
    
    # Then check if platform exists (after users are created)
    if check_platform_exists; then
        success "Platform $PLATFORM_ID already exists, skipping creation"
    else
        log "Platform $PLATFORM_ID does not exist, creating..."
        create_platform
    fi
    
    success "Database initialization completed successfully"
}

# Export PostgreSQL password for psql commands
export PGPASSWORD

# Run main function
main "$@"
