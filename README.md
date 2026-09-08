# iMBrace Workflow

The workflow-automation engine of the [iMBrace](https://github.com/imbrace-co/iMBrace)
platform — build, manage and deploy stateful DAG workflows that combine AI,
deterministic logic, integrations and human approval.

> **Based on [Activepieces](https://github.com/activepieces/activepieces)** (upstream **v0.72.4**).
> See [About](#about--based-on-activepieces) for what iMBrace changed and the [License](#license).

## Table of Contents

- [About / Based on Activepieces](#about--based-on-activepieces)
- [Quick Start](#quick-start)
- [Local Development Setup](#local-development-setup)
- [Building Pieces](#building-pieces)
- [Builtin Pieces Sync](#builtin-pieces-sync)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## About / Based on Activepieces

iMBrace Workflow is a fork of **[Activepieces](https://github.com/activepieces/activepieces)**,
tracking upstream **v0.72.4**. The enterprise-only code (`packages/ee/`) has been
removed, so this repository ships the MIT-licensed core only.

### What iMBrace changed

- **iMBrace ecosystem integration** — replaces Activepieces auth with iMBrace
  auth (auto-login, sidebar hidden); the organization is resolved from the
  account context instead of a selector; all API calls are routed through the
  iMBrace **app-gateway** (migrated off the legacy backend); the dashboard
  validates the `x-organization-id` header.
- **Custom pieces** (the largest change) — iMBrace-built pieces under
  `packages/pieces/community/`: `automate-data-board`, `document-ai`,
  `ask-a-question`, `record-linker`, `assign-team-and-end-flow`, `end-flow`,
  `clip-and-cache`, `prep-and-send`, `databoard`, plus an AI connector (v2 with
  custom instructions, suggestions and a document provider).
- **Kafka integration** — Kafka trigger, CRM topic, offset commits, retry and
  rebalance handling, SSL config.
- **Internationalization** — Chinese (zh/cn) translations for pieces and the
  right panel.
- **Infrastructure** — split `Dockerfile.backend` / `Dockerfile.engine` /
  `Dockerfile.frontend`, production/staging nginx configs, CI/CD, DB
  migration/init and worker-scaling docs.

---

## Quick Start

Get up and running in minutes:

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Docker** (for PostgreSQL and Redis)

### Steps

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/imbrace-co/workflow.git
   cd workflow
   ```

2. **Set up environment files**:
   ```bash
   cp .env.example .env
   cp .env packages/server/api/.env
   ```

3. **Start infrastructure** (PostgreSQL and Redis):
   ```bash
   docker-compose -f docker-compose.infra.yml up -d
   ```

4. **Set up the development environment**:
   ```bash
   node tools/setup-dev.js
   ```

5. **Run database migrations** (required on first run and after pulling new migrations):
   ```bash
   npm run db:migrate
   ```
   This applies pending TypeORM migrations and seeds, then exits. The API server no longer
   migrates on boot — see [docs/HORIZONTAL_WORKER_SCALING.md](docs/HORIZONTAL_WORKER_SCALING.md#database-migrations).

6. **Start the application**:
   ```bash
   npm start
   ```

7. **Access the application**:
   - **Option 1**: Open [http://localhost:4200](http://localhost:4200) and login with:
     - Email: `dev@ap.com`
     - Password: `12345678`
   - **Option 2**: Use direct URL with token from iMBrace webapp:
     ```
     http://localhost:4200/projects/?token=<YOUR_TOKEN>&organizationId=<YOUR_ORG_ID>
     ```
     Example:
     ```
     http://localhost:4200/projects/?token=acc_ba7b7672-ae89-4e4f-a48a-159b3ab9ebb8&organizationId=org_imbrace
     ```

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** v9+
- **Docker** ([Download](https://www.docker.com/products/docker-desktop))

### Environment Files Setup

The project requires environment configuration in two locations:

#### Root `.env` File

Copy the example file to create your local configuration:

```bash
cp .env.example .env
```

The `.env` file contains:

- **Database Configuration**: PostgreSQL connection settings
  - `AP_POSTGRES_DATABASE`, `AP_POSTGRES_HOST`, `AP_POSTGRES_PORT`, `AP_POSTGRES_USERNAME`, `AP_POSTGRES_PASSWORD`
- **Redis Configuration**: Redis connection settings for caching and queuing
  - `AP_REDIS_HOST`, `AP_REDIS_PORT`, `AP_REDIS_DB`
- **Security Configuration**: Encryption and JWT secrets
  - `AP_ENCRYPTION_KEY`, `AP_JWT_SECRET`
- **Pieces Configuration**: Controls which pieces are loaded
  - `AP_PIECES_SOURCE=BUILTIN` (use builtin pieces)
  - `AP_DEV_PIECES` (comma-separated list of pieces to load during development)
- **Kafka Configuration** (optional): For event streaming
  - `KAFKA_ENABLED`, `KAFKA_ENDPOINT`, credentials, etc.
- **AWS Credentials** (optional): For AWS services integration

#### Server API `.env` File

The server API also needs a copy of the environment file:

```bash
cp .env packages/server/api/.env
```

**Quick command** to set up both files:
```bash
cp .env.example .env && cp .env packages/server/api/.env
```

### Infrastructure Setup

The project uses Docker Compose to run PostgreSQL and Redis locally.

#### Start Infrastructure

```bash
docker-compose -f docker-compose.infra.yml up -d
```

This starts:
- **PostgreSQL 14.4** on port `5432`
- **Redis 7.0.7** on port `6379`

#### Stop Infrastructure

```bash
docker-compose -f docker-compose.infra.yml down
```

#### View Logs

```bash
docker-compose -f docker-compose.infra.yml logs -f
```

### Database Migrations

The API server no longer runs migrations on boot. Run them explicitly with:

```bash
npm run db:migrate
```

This connects to the database configured in `.env`, applies all pending TypeORM migrations,
runs seeds (roles + dev data), then exits. Run it on first setup and any time you pull new
migrations. See [docs/HORIZONTAL_WORKER_SCALING.md](docs/HORIZONTAL_WORKER_SCALING.md#database-migrations).

### Development Workflow

1. Make your code changes
2. The application supports **hot reloading** - changes appear in ~7 seconds
3. Test your changes at [http://localhost:4200](http://localhost:4200)

---

## Building Pieces

Pieces are reusable workflow components (integrations, actions, triggers) built in TypeScript.

### Quick Overview

Building pieces is:
- ✅ **Code-based**: Built with TypeScript for type safety and flexibility
- ✅ **Fast iteration**: Hot reloading shows changes within seconds
- ✅ **Open source**: Explore and contribute to existing pieces
- ✅ **Community-driven**: ask questions and collaborate in [GitHub Discussions](https://github.com/imbrace-co/workflow/discussions)
- ✅ **AI-powered**: Universal AI SDK for multi-provider AI integration

### Getting Started with Pieces

1. **Fork the repository** (for contributions)
2. **Set up your development environment** (see above)
3. **Create a piece definition** in `packages/pieces/community/{your-piece}`
4. **Add authentication** (if needed)
5. **Create actions** (operations your piece can perform)
6. **Create triggers** (events your piece can listen to)

### Example: Creating a New Piece

Create a new piece in the community folder:

```bash
packages/pieces/community/my-piece/
├── src/
│   ├── index.ts          # Piece definition
│   ├── lib/
│   │   └── auth.ts       # Authentication
│   └── actions/
│       └── my-action.ts  # Actions
└── package.json
```

**For detailed guides**, see the [Documentation](#documentation) section below.

---

## Builtin Pieces Sync

The `pieces-builtin` package aggregates selected community pieces into a single optimized bundle for performance and deployment.

### Overview

- **Source**: `packages/pieces/community/{piece}`
- **Destination**: `packages/pieces/builtin/src/pieces/{piece}`
- **Versions**: `packages/pieces/builtin/src/versions.ts` (auto-generated)
- **Registry**: `packages/pieces/builtin/src/registry.ts` (dynamic loader)

### Syncing Community Pieces to Builtin

#### 1. Run the Sync Script

The sync script copies source code, merges dependencies, and generates metadata files.

```bash
# Sync SAMPLE pieces only (default)
node scripts/sync-community-to-builtin.mjs sample

# Sync ALL community pieces
node scripts/sync-community-to-builtin.mjs all

# Sync SPECIFIC pieces by name (recommended for targeted updates)
node scripts/sync-community-to-builtin.mjs google-sheets cal-com
node scripts/sync-community-to-builtin.mjs document-ai
```


**What it does:**
1. Cleans `packages/pieces/builtin/src/pieces`
2. Copies `src/` from each community piece to `builtin/src/pieces/{piece}`
   - ⚠️ **Note**: `package.json` is NOT copied to keep the source tree clean
3. Merges dependencies into `packages/pieces/builtin/package.json`
4. Generates `packages/pieces/builtin/src/pieces/index.ts`
5. Generates `packages/pieces/builtin/src/versions.ts` (preserving original versions)

#### 2. Build the Builtin Package

After syncing, rebuild the builtin package:

```bash
npx nx build pieces-builtin
```

#### 3. Generate Metadata

Generate the metadata JSON files used by the UI/Backend:

```bash
node scripts/generate-builtin-metadata.mjs
```

This creates:
- `dist/packages/pieces/builtin/known/pieces.json`
- `dist/packages/pieces/builtin/types/pieces.json`

### Adding a New Piece

1. Create the piece in `packages/pieces/community` as usual
2. Run the sync script: `node scripts/sync-community-to-builtin.mjs all`
3. Rebuild `pieces-builtin`: `npx nx build pieces-builtin`
4. Generate metadata: `node scripts/generate-builtin-metadata.mjs`
5. Commit changes to:
   - `packages/pieces/builtin/src/pieces`
   - `packages/pieces/builtin/package.json`
   - `packages/pieces/builtin/src/versions.ts`

### Troubleshooting

**`PIECE_NOT_FOUND` error:**
- Ensure `packages/pieces/builtin/src/versions.ts` exists and contains your piece
- Check that `registry.ts` correctly infers the piece name

**Build Errors:**
- Check for version conflicts in `package.json`
- Verify all dependencies are included in the consolidated package
- Run `npm install` in `packages/pieces/builtin`

---

## Documentation

Detailed documentation is available in the `docs/developers/` folder:

### Development Setup

- [Getting Started](docs/developers/development-setup/getting-started.mdx) - Overview of setup options
- [Local Environment](docs/developers/development-setup/local.mdx) - Local development setup
- [Codespaces](docs/developers/development-setup/codespaces.mdx) - Quick setup with GitHub Codespaces
- [Dev Container](docs/developers/development-setup/dev-container.mdx) - Remote development setup

### Building Pieces

- [Overview](docs/developers/building-pieces/overview.mdx) - Introduction to building pieces
- [Start Building](docs/developers/building-pieces/start-building.mdx) - Step-by-step tutorial
- [Setup Fork](docs/developers/building-pieces/setup-fork.mdx) - Fork the repository
- [Piece Definition](docs/developers/building-pieces/piece-definition.mdx) - Define your piece structure
- [Piece Authentication](docs/developers/building-pieces/piece-authentication.mdx) - Add authentication
- [Create Action](docs/developers/building-pieces/create-action.mdx) - Build actions
- [Create Trigger](docs/developers/building-pieces/create-trigger.mdx) - Build triggers

### Piece Reference

- [Properties](docs/developers/piece-reference/properties.mdx) - Input/output properties
- [Properties Validation](docs/developers/piece-reference/properties-validation.mdx) - Validate user input
- [Authentication](docs/developers/piece-reference/authentication.mdx) - Authentication patterns
- [Custom API Calls](docs/developers/piece-reference/custom-api-calls.mdx) - Make HTTP requests
- [External Libraries](docs/developers/piece-reference/external-libraries.mdx) - Use npm packages
- [Files](docs/developers/piece-reference/files.mdx) - Work with files
- [Flow Control](docs/developers/piece-reference/flow-control.mdx) - Conditional logic
- [Persistent Storage](docs/developers/piece-reference/persistent-storage.mdx) - Store data
- [Piece Versioning](docs/developers/piece-reference/piece-versioning.mdx) - Version your pieces
- [i18n](docs/developers/piece-reference/i18n.mdx) - Internationalization
- [AI Providers](docs/developers/piece-reference/ai-providers.mdx) - AI integration
- [Examples](docs/developers/piece-reference/examples.mdx) - Code examples

### Additional Resources

- [BUILTIN Mode Build Script](scripts/README-BUILTIN-MODE.md) - Building pieces for `AP_PIECES_SOURCE=BUILTIN`

---

## Contributing

Contributions are welcome — most pieces in this project are community-contributed.

- 🐛 Open issues and pull requests on
  [github.com/imbrace-co/workflow](https://github.com/imbrace-co/workflow)
- 💬 Ask questions and collaborate in
  [GitHub Discussions](https://github.com/imbrace-co/workflow/discussions)

---

## License

iMBrace Workflow is licensed under the **MIT License** — see [LICENSE](LICENSE).

The enterprise-only code from the upstream project has been removed, so this
repository contains only MIT-licensed code. As required by the MIT license, the
original copyright notice of the upstream project (Activepieces Inc.) is
retained in [LICENSE](LICENSE).

---

**Happy building! 🚀**
