# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Activepieces** - An open-source automation platform (alternative to Zapier) with 280+ community-contributed integration pieces. Built as a monorepo using Nx, TypeScript, and a multi-process architecture.

- **Version:** 0.69.0
- **Repository:** https://github.com/activepieces/activepieces
- **License:** MIT (Community), Commercial (Enterprise)

## Repository Structure

```
├── packages/
│   ├── server/
│   │   ├── api/              # Fastify API server (port 3000)
│   │   ├── shared/           # Shared server utilities
│   │   └── worker/           # Background job worker
│   ├── engine/               # Execution engine (port 3001)
│   ├── react-ui/             # React frontend (port 4200)
│   ├── shared/               # Shared types and utilities
│   ├── cli/                  # Piece management CLI
│   ├── pieces/
│   │   ├── community/        # 414 community pieces (lazy loaded)
│   │   ├── builtin/          # Builtin pieces package (direct import)
│   │   └── custom/           # Custom pieces
│   ├── ee/                   # Enterprise Edition features
│   └── tests-e2e/            # Playwright E2E tests
├── tools/                    # Build and utility scripts
├── deploy/                   # Pulumi deployment config
└── docs/                     # Project documentation
```

## Technology Stack

- **Runtime:** Node.js 18.19.0 (see .nvmrc)
- **Language:** TypeScript 5.5.4
- **Monorepo:** Nx 21.1.2
- **Package Manager:** pnpm 9.15.0
- **Backend:** Fastify 5.4.0, TypeORM 0.3.18
- **Database:** PostgreSQL 14.4
- **Cache/Queue:** Redis 7.0.7, BullMQ 5.28.1
- **Frontend:** React 18.3.1, Vite 6.3.5, TailwindCSS 3.4.3
- **AI Integration:** @ai-sdk/* packages (OpenAI, Anthropic, Google, Azure, Replicate)
- **Testing:** Jest 29.7.0, Playwright 1.52.0
- **Execution Sandbox:** isolated-vm 5.0.1

## Development Commands

### Primary Development Workflows

```bash
# Start all services (Frontend + Backend + Engine)
npm run dev

# Start individual services
npm run serve:frontend    # React UI only (port 4200)
npm run serve:backend     # API server only (port 3000)
npm run serve:engine      # Engine only (port 3001)
npm run dev:backend       # API + Engine
```

### Piece Development

```bash
npm run create-piece      # Interactive piece creation wizard
npm run create-action     # Add action to existing piece
npm run create-trigger    # Add trigger to existing piece
npm run sync-pieces       # Sync pieces with registry
npm run build-piece       # Build specific piece
npm run publish-piece     # Publish piece to npm
```

### Testing and Quality

```bash
npx nx test <project>                # Run tests for specific package
npx nx run-many --target=test        # Run all tests
npx nx run-many --target=lint --fix  # Lint and fix all
npm run push                         # Lint fix + git push
```

### Build and Deployment

```bash
npx nx build <project>               # Build specific package
npx nx run-many --target=build       # Build all affected packages
```

### Docker Development

```bash
# Infrastructure only (PostgreSQL + Redis)
docker-compose -f docker-compose.infra.yml up

# Full local stack
docker-compose -f docker-compose.local.yml up

# Individual services
docker-compose -f docker-compose.backend.yml up
docker-compose -f docker-compose.engine.yml up
docker-compose -f docker-compose.frontend.yml up
```

## Architecture

### Multi-Process Architecture

1. **API Server** (`packages/server/api/`)
   - Fastify web framework (port 3000)
   - REST API endpoints
   - WebSocket server for real-time updates
   - Entry: `packages/server/api/src/main.ts`

2. **Engine** (`packages/engine/`)
   - Executes flows and operations (port 3001)
   - Sandboxed execution using isolated-vm
   - WebSocket communication with Worker
   - Entry: `packages/engine/src/main.ts`

3. **Worker** (`packages/server/worker/`)
   - Background job processing
   - BullMQ-based queue consumer
   - Connects to API and Engine via WebSocket
   - Entry: `packages/server/worker/src/main.ts`

4. **Frontend** (`packages/react-ui/`)
   - React 18 with Vite
   - TanStack React Query for data fetching
   - Zustand for state management
   - Radix UI components with TailwindCSS

### Key Architectural Patterns

#### Authentication Model (IMPORTANT)

**Custom header-based authentication** - NOT traditional Bearer tokens:
- `x-user-id` - User identifier (optional for backward compatibility)
- `x-organization-id` - Organization identifier (required)
- `x-role` - User role (optional)
- `x-fingerprint-id` - Device fingerprint (optional)

Implementation: `packages/server/api/src/app/core/security/authn/dashboard-access-token-authn-handler.ts`

**No access token validation** happens at the Activepieces level. The gateway handles authentication, and Activepieces trusts the headers provided.

#### Type Safety Guidelines

- **Service inputs:** MUST be typed (use domain types or primitives)
- **Service outputs:** Can return `any` types
- **Shared types:** Defined in `@activepieces/shared` package
- **Path aliases:** Use `@activepieces/*` throughout (configured in `tsconfig.base.json`)

#### Module Structure

Each feature module follows:
```
feature/
├── feature.module.ts       # Module registration
├── feature.service.ts      # Business logic
├── feature.controller.ts   # Route handlers (Fastify)
├── feature.repository.ts   # Data access (TypeORM)
└── types.ts               # Feature-specific types
```

### Piece Framework

Pieces are **TypeScript npm packages** with:
- Type-safe operation definitions
- Actions, Triggers, and Polling Triggers
- Authentication/credential handlers
- Hot reloading support in development
- Independent versioning (e.g., `@activepieces/piece-slack@0.20.1`)
- MCP server availability for LLM integration

**Framework package:** `@activepieces/pieces-framework`

### Pieces Source Modes (AP_PIECES_SOURCE)

The `AP_PIECES_SOURCE` environment variable controls how pieces are loaded:

| Mode | Description | Use Case |
|------|-------------|----------|
| `DB` / `CLOUD_AND_DB` | Runtime npm install | Production (default) |
| `FILE` | Load from local dist folder | Development |
| `BUILTIN` | Hybrid: builtin + lazy load community | Offline/Performance |

#### BUILTIN Mode Architecture

```
packages/pieces/builtin/
├── src/
│   ├── index.ts              # Export registry + pieces
│   ├── registry.ts           # Hybrid loader
│   └── pieces/               # NEW pieces go here
│       ├── index.ts          # Register pieces
│       └── <piece-name>/
│           ├── index.ts      # createPiece()
│           └── actions/

dist/packages/pieces/builtin/
├── known/pieces.json         # Community pieces paths (lazy load)
└── types/pieces.json         # Community pieces metadata (UI)
```

**Priority:** Builtin pieces > Community pieces (same name)

#### Developing with BUILTIN Mode

```bash
# 1. Build builtin package
npx nx build pieces-builtin

# 2. (Optional) Generate community pieces metadata
node scripts/generate-builtin-metadata.mjs

# 3. Run backend with BUILTIN mode
AP_PIECES_SOURCE=BUILTIN npm run dev:backend

# Watch mode for auto-rebuild
npx nx watch pieces-builtin
```

#### Creating a New Builtin Piece

1. Create piece folder:
```bash
mkdir -p packages/pieces/builtin/src/pieces/my-piece/actions
```

2. Create piece (`packages/pieces/builtin/src/pieces/my-piece/index.ts`):
```typescript
import { createPiece, PieceAuth } from '@activepieces/pieces-framework'
import { myAction } from './actions/my-action'

export const myPiece = createPiece({
    displayName: 'My Piece',
    logoUrl: 'https://cdn.activepieces.com/pieces/piece-placeholder.svg',
    auth: PieceAuth.None(),
    actions: [myAction],
    triggers: [],
})
```

3. Register in `packages/pieces/builtin/src/pieces/index.ts`:
```typescript
import { myPiece } from './my-piece'

const builtinPiecesConfig: BuiltinPieceInfo[] = [
    { name: '@activepieces/piece-my-piece', version: '0.0.1', piece: myPiece },
]
```

4. Build and test:
```bash
npx nx build pieces-builtin
AP_PIECES_SOURCE=BUILTIN npm run dev:backend
```

### Database

- **ORM:** TypeORM 0.3.18
- **Database:** PostgreSQL 14.4
- **Migrations:** TypeORM-based (see `migrations.json`)
- **Connection:** Configured via environment variables

**DuckDB Postgres Extension:** For DuckDB integration, refer to https://duckdb.org/docs/stable/core_extensions/postgres

### Job Queue

- **Queue:** BullMQ with Redis backend
- **Worker Process:** Separate from API server
- **Communication:** WebSocket between Worker and Engine
- **Observability:** OpenTelemetry integration via `bullmq-otel`

## Environment Setup

### Required Environment Variables

```bash
# Backend
AP_ENVIRONMENT=dev
AP_POSTGRES_DATABASE=activepieces
AP_POSTGRES_HOST=postgres
AP_POSTGRES_USERNAME=postgres
AP_POSTGRES_PASSWORD=
AP_REDIS_HOST=redis
AP_REDIS_PORT=6379
AP_JWT_SECRET=
AP_ENCRYPTION_KEY=
AP_EXECUTION_MODE=UNSANDBOXED  # Use SANDBOXED in production
AP_FLOW_TIMEOUT_SECONDS=600

# Frontend
AP_FRONTEND_URL=http://localhost:4200

# Engine
AP_ENGINE_EXECUTABLE_PATH=dist/packages/engine/main.js
```

### Configuration Files

- `nx.json` - Nx workspace configuration
- `tsconfig.base.json` - Base TypeScript config with ~500+ path aliases
- `jest.config.ts` - Jest testing setup
- `.eslintrc.json` - ESLint rules
- `docker-compose.*.yml` - Various Docker setups

## AI Integration

Always check https://ai-sdk.dev/llms.txt before making changes to AI-related code.

**Available AI SDKs:**
- `@ai-sdk/openai` (2.0.12)
- `@ai-sdk/anthropic` (2.0.3)
- `@ai-sdk/google` (2.0.6)
- `@ai-sdk/azure` (2.0.12)
- `@ai-sdk/replicate` (1.0.3)

**Native clients:**
- `openai` (4.67.1)
- `@anthropic-ai/sdk` (0.39.0)
- `@google/generative-ai` (0.21.0)

## Testing

### Unit Tests
- Framework: Jest 29.7.0
- Location: `src/**/*.spec.ts` in each package
- Run: `npx nx test <package-name>`

### E2E Tests
- Framework: Playwright 1.52.0
- Location: `packages/tests-e2e/`
- Structure:
  - `pages/` - Page object models
  - `scenarios/` - Test scenarios
  - `helper/` - Test utilities

## Important Notes

1. **Always prefer editing existing files** rather than creating new ones
2. **Authentication:** Uses custom headers (x-user-id, x-organization-id), not Bearer tokens
3. **Service typing:** Inputs must be typed; outputs can be any type
4. **Hot reloading:** Available for piece development
5. **Enterprise features:** Separated in `/packages/ee/` directory
6. **Nx caching:** Enabled for builds and tests - speeds up CI
7. **Git workflow:** Develop branch → Main branch for PRs
8. **Commit format:** Conventional commits enforced by commitlint
9. **Pre-commit hooks:** Husky enforces linting and formatting
10. **Node version:** Use Node.js 18.19.0 (specified in .nvmrc)

## Common Patterns

### Creating a New Feature Module

1. Create module in appropriate package (e.g., `packages/server/api/src/app/<feature>/`)
2. Define types in `packages/shared/src/` for cross-package usage
3. Implement service with TypeORM repository
4. Add Fastify controller with routes
5. Register in module system
6. Add tests in `*.spec.ts` files

### Creating a New Piece

```bash
npm run create-piece
# Follow interactive prompts
# Edit piece in packages/pieces/community/<piece-name>/
npm run build-piece
npm run sync-pieces
```

### Database Migrations

```bash
# Generate migration
npx nx run server-api:generate-migration --name=<migration-name>

# Run migrations (happens automatically on server start)
```

### Adding AI Functionality

Check https://ai-sdk.dev/llms.txt for latest patterns and APIs before implementing.

## Key API Modules

Located in `packages/server/api/src/app/`:
- `agents/` - AI agents
- `ai/` - AI provider integration
- `app-connection/` - Third-party service connections
- `authentication/` - Auth utilities and controllers
- `flows/` - Workflow management
- `pieces/` - Piece/integration management
- `ee/` - Enterprise features (RBAC, SSO, licensing)
- `webhook/` - Webhook handling
- `workers/` - Job processing
- `database/` - Database initialization
- `core/security/` - Security handlers including custom header auth

## Resources

- **Documentation:** https://www.activepieces.com/docs
- **Piece Development:** https://www.activepieces.com/docs/developers/overview
- **Contributing Guide:** https://www.activepieces.com/docs/contributing/overview
- **Discord:** https://discord.gg/2jUXBKDdP8
- AP_PIECES_SOURCE=BUILTIN is default.