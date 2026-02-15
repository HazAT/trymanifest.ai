# Manifest Framework

> *Production is our dev environment.*

## Overview

Manifest is a TypeScript framework built on Bun where every piece of code is written to be read, understood, and modified by AI agents. It ships as a Docker image and is designed for self-healing applications - an AI agent runs as a sidecar in production, monitoring the app and fixing issues in real-time.

Manifest is framework-first and vendor-agnostic. It integrates with error tracking tools (Sentry, Bugsnag, or custom) to feed context to the agent, but none are required. The agent can work from logs alone. The error tracking integration is pluggable - bring whatever you already use.

The framework takes inspiration from Symfony's explicit, no-magic philosophy and brings it to the TypeScript ecosystem - where most frameworks hide behavior behind bundlers, decorators, and convention-based magic. Manifest does the opposite: everything is a plain typed object, every dependency is an explicit import, every side effect is declared upfront.

## Core Philosophy

Three rules:

1. **One feature, one file.** A feature file contains everything an agent needs: route, input validation, authorization, business logic, side effects declaration, and error cases. No hunting across directories.

2. **Explicit over elegant.** If something happens, it's because the code says so - not because a middleware was auto-discovered, a decorator triggered behavior, or a bundler rewrote the code. Verbose is correct. Terse is suspicious.

3. **Self-describing code.** Every feature, every service, every schema carries machine-readable metadata: what it does, what it depends on, what it affects. The codebase is its own documentation. An agent dropping into the project cold can orient itself by reading a `MANIFEST.md` at the root and the metadata on any file.

## Technical Foundation

- **Runtime:** Bun (native TypeScript, no compilation step, built-in HTTP server, test runner, hot reload)
- **Language:** TypeScript (strict mode, no `any`)
- **ORM:** Drizzle ORM (explicit, SQL-like, TypeScript-native, built-in migrations)
- **API-only:** No server-rendered views. Supports modern frontends via REST, SSE, and webhooks.
- **No build step:** Bun runs TypeScript natively. The `.ts` files in the project ARE what runs.
- **Hot reload in production:** `bun --hot` watches files and hot-reloads the server on change. The agent edits a file, the server picks it up instantly. No restart, no cache clear.

### Why Bun?

| Need | Bun provides |
|------|-------------|
| Native TypeScript | No tsc, no build step, .ts files run directly |
| HTTP server | `Bun.serve()` - built-in, fast, no Express/Fastify needed |
| Hot reload | `bun --hot` - reloads server on file change, keeps connections alive |
| Password hashing | `Bun.password.hash()` - built-in bcrypt/argon2 |
| Test runner | `bun test` - built-in, Jest-compatible API |
| Package manager | `bun install` - built-in, fast |
| File I/O | `Bun.file()`, `Bun.write()` - built-in async file API |
| SQLite | Built-in `bun:sqlite` for local/development databases |

This means Manifest has very few dependencies. Bun IS the platform.

### Why Drizzle ORM?

Drizzle fits the Manifest philosophy perfectly:
- **Explicit:** You write SQL-like TypeScript. What you see is what runs. No magic query generation.
- **Schema as code:** Schemas are TypeScript files with full type inference. No separate schema DSL.
- **Migrations:** `drizzle-kit` generates migrations from schema changes automatically.
- **No runtime overhead:** Drizzle generates SQL at build time, not runtime.
- **Database agnostic:** PostgreSQL, MySQL, SQLite all supported.

## Project Structure

```
manifest-app/
├── MANIFEST.md                    # Agent's entry point. Describes the app,
│                                  # architecture, conventions, how to work
│                                  # with this codebase. Every agent reads this first.
│
├── features/                      # One file per feature. This IS the application.
│   ├── UserRegistration.ts
│   ├── UserLogin.ts
│   ├── UserProfile.ts
│   ├── CreatePost.ts
│   ├── ListPosts.ts
│   └── DeletePost.ts
│
├── schemas/                       # Drizzle ORM schemas. One file per table.
│   ├── users.ts                   # Table definition + descriptions.
│   └── posts.ts                   # Relations defined explicitly.
│
├── services/                      # Shared services. Plain exported objects/functions.
│   ├── mailer.ts
│   ├── payments.ts
│   └── imageProcessor.ts
│
├── policies/                      # Authorization. One file per resource.
│   ├── userPolicy.ts
│   └── postPolicy.ts
│
├── commands/                      # CLI commands (human or agent authored).
│   ├── seedDemoTenant.ts
│   └── pruneExpiredSessions.ts
│
├── config/
│   ├── manifest.ts                # Framework config. Typed, flat, commented.
│   ├── database.ts
│   └── services.ts                # Service configuration.
│
├── migrations/                    # Generated by drizzle-kit from schema changes.
├── tests/                         # Mirrors features/ structure 1:1.
│   ├── UserRegistration.test.ts
│   └── CreatePost.test.ts
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── index.ts                       # Entry point. Boots the Manifest server.
├── package.json
├── tsconfig.json
└── drizzle.config.ts              # Drizzle ORM configuration.
```

The `features/` directory IS the application. Everything else is supporting infrastructure.

## The Feature File

The heart of Manifest. A complete, self-contained unit of application behavior defined as a plain typed object.

```typescript
// features/UserRegistration.ts
import { defineFeature, t } from 'manifest'
import { db } from '../config/database'
import { users } from '../schemas/users'
import { mailer } from '../services/mailer'
import { eq } from 'drizzle-orm'

export default defineFeature({
  name: 'user-registration',
  description: `Creates a new user account. Validates email uniqueness,
                hashes password, persists user, and sends a welcome email.
                Returns the created user without sensitive fields.`,
  route: ['POST', '/api/users/register'],
  authentication: 'none',
  rateLimit: '5/minute/ip',
  sideEffects: [
    'Inserts one row into users table',
    'Sends welcome email via mailer service',
  ],
  errorCases: [
    '409 - Email already registered',
    '422 - Validation failed',
  ],

  input: {
    email: t.string({
      description: 'User email address. Must be unique across all users.',
      required: true,
      format: 'email',
    }),
    password: t.string({
      description: 'Account password. Hashed with argon2 before storage.',
      required: true,
      minLength: 8,
      maxLength: 128,
    }),
    displayName: t.string({
      description: 'Public display name shown to other users.',
      required: true,
      maxLength: 100,
    }),
  },

  async handle({ input, ok, fail }) {
    // Step 1: Check uniqueness
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing.length > 0) {
      return fail('Email already registered', 409)
    }

    // Step 2: Create user
    const [user] = await db.insert(users).values({
      email: input.email,
      password: await Bun.password.hash(input.password),
      displayName: input.displayName,
    }).returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })

    // Step 3: Send welcome email (explicit, not a hidden listener)
    await mailer.send({
      template: 'welcome',
      to: user.email,
      context: { displayName: user.displayName },
    })

    return ok('User registered', { data: user, status: 201 })
  },
})
```

What an agent gets from this single file:
- What the feature does (description)
- What URL triggers it and how (route, method, auth, rate limit)
- Exactly what inputs it accepts, with types, constraints, and why each field exists
- Every side effect, declared before the agent reads the logic
- Every error case and its HTTP status
- The full execution flow - linear, no hidden branches
- All dependencies are explicit `import` statements at the top - the agent knows exactly what this feature touches

### No Classes, No Inheritance, No Magic

The `defineFeature()` function takes a plain typed object and returns a typed feature definition. There's no base class, no abstract methods, no decorator evaluation. The object literal IS the feature. An agent can read it as data.

### Three Feature Types

**Request (default)** - HTTP endpoint:
```typescript
export default defineFeature({
  name: 'list-posts',
  route: ['GET', '/api/posts'],
  type: 'request',
  // ...
  async handle({ input, ok }) { /* ... */ },
})
```

**Stream (SSE)** - Server-Sent Events:
```typescript
export default defineFeature({
  name: 'post-feed',
  description: 'Streams new posts to connected clients in real-time.',
  route: ['GET', '/api/posts/feed'],
  type: 'stream',
  authentication: 'required',
  // ...
  async stream({ input, emit, on }) {
    on('post.created', (post) => {
      emit('new-post', post)
    })
  },
})
```

**Event** - Triggered by internal events, not HTTP:
```typescript
export default defineFeature({
  name: 'notify-order-shipped',
  description: 'Sends webhook to merchant when order status changes to shipped.',
  type: 'event',
  trigger: 'order.shipped',
  sideEffects: ['POST to merchant webhook URL'],
  // ...
  async handle({ input, ok }) {
    await webhook.send({
      url: input.merchantWebhookUrl,
      event: 'order.shipped',
      payload: input.order,
    })
    return ok('Webhook delivered')
  },
})
```

## Schemas (Drizzle ORM)

Schemas define the database structure using Drizzle ORM's TypeScript-native syntax. Every field has a description.

```typescript
// schemas/users.ts
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { posts } from './posts'

/**
 * Application users. One row per registered account.
 * Email is the unique identifier for authentication.
 * Soft-deleted: rows are never physically removed.
 */
export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  /** Unique user identifier. Generated on creation. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Login email. Must be unique. Used for authentication and all transactional email. */
  email: varchar('email', { length: 255 }).unique().notNull(),

  /** Argon2-hashed password. Never exposed in API responses. */
  password: varchar('password', { length: 255 }).notNull(),

  /** Public name shown in UI and to other users. */
  displayName: varchar('display_name', { length: 100 }).notNull(),

  /** Authorization role. 'admin' grants access to all admin-prefixed features. */
  role: userRole('role').default('user').notNull(),

  /** Null means unverified. Set when user clicks verification link. */
  emailVerifiedAt: timestamp('email_verified_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
})

/** All posts authored by this user. Cascade soft-delete. */
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

/** Fields that should never appear in API responses. */
export const usersHiddenFields = ['password'] as const
```

Key points:
- **JSDoc comments on every field.** An agent reads the schema and knows why every column exists.
- **`usersHiddenFields`** - explicit list of fields to strip from API responses. No magic `hidden()` method - just a typed constant.
- **Relations are explicit.** Defined in the same file, not auto-discovered.
- **Drizzle handles migrations.** Run `bunx drizzle-kit generate` to create migrations from schema changes.

## API Layer

### Response Envelope

Every response follows a standard envelope:

```json
{
  "status": 201,
  "message": "User registered",
  "data": {
    "id": "a1b2c3",
    "email": "user@example.com",
    "displayName": "Jane"
  },
  "meta": {
    "feature": "user-registration",
    "duration_ms": 42,
    "request_id": "req_xyz789"
  }
}
```

Every response includes `meta.feature` and `meta.request_id`. When something breaks, the agent knows which feature produced it and can trace the request. Errors follow the same envelope - no surprise HTML pages.

### Bun.serve() as the Foundation

The HTTP server uses Bun's built-in `Bun.serve()`:

```typescript
// index.ts
import { createManifestServer } from 'manifest'

const server = await createManifestServer({
  projectDir: import.meta.dir,
  port: 8080,
})

console.log(`Manifest server running on http://localhost:${server.port}`)
```

Under the hood, `createManifestServer` scans `features/`, builds a route table, and calls `Bun.serve()` with a request handler that matches routes, validates input, executes features, and returns JSON envelopes.

### Hot Reload

Running with `bun --hot index.ts` enables hot reloading. When the agent modifies a feature file, Bun reloads the module and the next request uses the new code. No restart, no cache clear. This is the key enabler for agent self-healing in production.

## MANIFEST.md

Every Manifest project has a `MANIFEST.md` at the root. It's the system prompt for any agent that touches the codebase. The framework generates and maintains it - when you add a feature, it updates. Always in sync.

```markdown
# Manifest: my-app

## System
- Runtime: Bun 1.x, TypeScript 5.x, Manifest 1.x
- Database: PostgreSQL 16
- Cache: Redis 7

## Architecture
This is a Manifest application. All behavior lives in feature files.
- features/ - One file per application behavior (31 features)
- schemas/ - Drizzle ORM table definitions (8 schemas)
- services/ - Shared services (5 services)
- policies/ - Authorization rules (4 policies)
- commands/ - CLI commands (6 commands)

## Conventions
- NEVER use decorator-based patterns. Features are defined with defineFeature().
- NEVER create event listeners or middleware. Side effects go in the feature's handle() function.
- NEVER scatter one behavior across multiple files. One feature = one file.
- Every input field MUST have a description.
- Features MUST declare all side effects in the feature definition.
- Schema fields MUST have JSDoc descriptions.
- All dependencies MUST be explicit imports. No global state, no service locators.

## Feature Index
| Name | Route | Type | Description |
|------|-------|------|-------------|
| user-registration | POST /api/users/register | request | Creates new account |
| user-login | POST /api/users/login | request | Authenticates user |
| post-feed | GET /api/posts/feed | stream | Real-time post stream |
| ... | ... | ... | ... |

## Schema Index
| Name | Table | Fields | Description |
|------|-------|--------|-------------|
| users | users | 8 | Application user accounts |
| posts | posts | 6 | User-authored content |
| ... | ... | ... | ... |

## Service Index
| Name | Description | Used by |
|------|-------------|---------|
| mailer | Sends transactional email via SMTP | user-registration, password-reset |
| ... | ... | ... |

## Command Index
| Name | Created By | Description |
|------|-----------|-------------|
| seed-demo-tenant | agent | Creates demo tenant with sample data |
| prune-sessions | agent | Removes expired sessions older than 30 days |

## Known Issues
- None currently.

## Recent Changes
- 2026-02-14: Added post-feed SSE stream feature
- 2026-02-13: Added soft-delete to users schema
```

The Feature/Schema/Service/Command indexes are auto-generated by `bun manifest index`. Known Issues and Recent Changes are maintained by agents.

## Config

Config is typed TypeScript files. No YAML, no .env magic. Full IDE support.

```typescript
// config/manifest.ts
export default {
  appName: 'my-app',
  appUrl: 'https://my-app.com',
  debug: false,

  // API response settings
  includeMetaInResponses: true,
  includeDurationInMeta: true,

  // Rate limiting
  rateLimitDriver: 'redis' as const,  // 'redis' or 'memory'
  rateLimitPrefix: 'manifest:',

  // Real-time
  sseHeartbeatSeconds: 15,
  sseMaxConnectionSeconds: 300,
} satisfies ManifestConfig
```

Environment-specific values use `Bun.env` directly - visible, explicit, greppable:

```typescript
// config/database.ts
export default {
  host: Bun.env.DB_HOST ?? 'localhost',
  port: Number(Bun.env.DB_PORT ?? 5432),
  database: Bun.env.DB_NAME ?? 'manifest',
  user: Bun.env.DB_USER ?? 'manifest',
  password: Bun.env.DB_PASSWORD ?? '',
} satisfies DatabaseConfig
```

### Services

Services are plain exported objects or functions. No DI container - TypeScript's module system IS the dependency injection:

```typescript
// services/mailer.ts
import config from '../config/manifest'

/**
 * Sends transactional email. Uses SMTP in production,
 * logs to console in development.
 */
export const mailer = {
  async send(options: {
    template: string
    to: string
    context: Record<string, unknown>
  }): Promise<void> {
    if (config.debug) {
      console.log('[mailer]', options)
      return
    }
    // SMTP implementation
  },
}
```

Features import services directly:
```typescript
import { mailer } from '../services/mailer'
```

An agent traces dependencies by following imports. No service container, no string-based lookups, no auto-wiring. Just `import`.

## Testing

Tests use Bun's built-in test runner. Tests mirror features 1:1.

```typescript
// tests/UserRegistration.test.ts
import { describe, test, expect } from 'bun:test'
import { createTestClient } from 'manifest/testing'

describe('user-registration', () => {
  const client = createTestClient({ featuresDir: './features' })

  test('creates user with valid input', async () => {
    const result = await client.call('user-registration', {
      email: 'jane@example.com',
      password: 'secure-password-123',
      displayName: 'Jane',
    })

    expect(result.status).toBe(201)
    expect(result.message).toBe('User registered')
    expect(result.data.email).toBe('jane@example.com')
    expect(result.data).not.toHaveProperty('password')

    await expect(client.database).toHaveRow('users', {
      email: 'jane@example.com',
    })

    expect(client.mailer.sent).toContainEqual(
      expect.objectContaining({ template: 'welcome', to: 'jane@example.com' })
    )
  })

  test('rejects duplicate email', async () => {
    await client.seed('users', { email: 'taken@example.com' })

    const result = await client.call('user-registration', {
      email: 'taken@example.com',
      password: 'secure-password-123',
      displayName: 'Jane',
    })

    expect(result.status).toBe(409)
    expect(result.message).toBe('Email already registered')
    expect(client.mailer.sent).toHaveLength(0)
  })

  test('validates required fields', async () => {
    const result = await client.call('user-registration', {})

    expect(result.status).toBe(422)
    expect(result.errors).toHaveProperty('email', 'required')
    expect(result.errors).toHaveProperty('password', 'required')
    expect(result.errors).toHaveProperty('displayName', 'required')
  })
})
```

Key design choices:
- **`client.call('feature-name', {...})`** - Tests call features by name, not HTTP route.
- **Bun's built-in test runner** - No Jest, no Vitest. `bun test` just works.
- **Test helpers** - `client.database`, `client.mailer.sent` provide inspection without mocking.

## Live Code Runtime

Bun's `--hot` flag is the key to everything. It watches the filesystem and hot-reloads modules when they change. Unlike Node.js `--watch` (which restarts the process), `--hot` reloads in-place - keeping WebSocket connections alive and avoiding cold start.

```bash
# Development
bun --hot index.ts

# Production (with hot reload for agent self-healing)
bun --hot index.ts
```

The agent edits a feature file → Bun detects the change → the module is reloaded → the next request uses the new code. No restart, no deploy, no cache clear.

### What about `bun build`?

We don't use it. There's no build step. The `.ts` files in the project ARE what runs. This is critical for agent self-healing: the agent modifies a `.ts` file and it takes effect immediately. If there were a build step, the agent would need to know about the build pipeline, which adds complexity and failure modes.

## CLI Tooling

### Built-in Commands

```bash
bun manifest serve              # Start the server (with --hot by default)
bun manifest index              # Rebuild MANIFEST.md from codebase
bun manifest check              # Validate conventions
bun manifest make:feature       # Scaffold a new feature
bun manifest make:schema        # Scaffold a new schema
bun manifest make:test          # Scaffold a test for a feature
bun manifest agent:changelog    # Show agent changes since last release
```

The `manifest` CLI is a Bun script (`bin/manifest.ts`), not a separate binary.

### `bun manifest check`

Enforces conventions:
```
$ bun manifest check

✗ Feature 'create-post' is missing side effects declaration
✗ Schema 'posts' field 'slug' has no JSDoc description
✗ Feature 'delete-user' has no test file
✗ Service 'imageProcessor' has no JSDoc description
✓ MANIFEST.md is in sync
✓ All routes are unique
✓ No decorator patterns detected

4 issues found.
```

### Agent-Authored Commands

Agents can create CLI commands in `commands/`:

```typescript
// commands/seedDemoTenant.ts
import { defineCommand } from 'manifest'
import { db } from '../config/database'
import { users } from '../schemas/users'
import { posts } from '../schemas/posts'

export default defineCommand({
  name: 'seed-demo-tenant',
  description: `Creates a demo tenant with sample users and posts.
                This app is multi-tenant. Every time we onboard a new
                demo client, we need a pre-populated tenant.`,
  createdBy: 'agent',
  reason: 'Agent noticed manual tenant seeding via raw SQL on 2026-02-10 and 2026-02-12.',

  args: {
    name: { type: 'string', description: 'Tenant company name', required: true },
  },

  async run({ args, log }) {
    // ... seed logic
    log.success(`Demo tenant '${args.name}' created`)
  },
})
```

## Deployment & Git Workflow

### Two Branches

```
main        ← Human works here. Normal development.
production  ← Deployed code. Agent works here.
```

### Deployment Flow

1. Human merges main → production
2. CI builds new Docker image from production branch
3. Orchestrator sends SIGTERM to old container
4. Agent gets graceful shutdown (30s): commits and pushes any uncommitted work, writes memory file
5. Old container stops, new container starts
6. New agent boots: git pull, `bun manifest index`, reads MANIFEST.md, reads memory file, logs what changed

### Agent Commits

Always prefixed with `[agent]`, always structured:

```
[agent] fix: Null check in UserRegistration

Error Tracker Issue: MYAPP-1234
Root cause: input.displayName could be undefined when OAuth provider omits the name field.
Side effects of this fix: None.
Features modified: user-registration
Risk: Low - adds nullish coalescing, no behavior change for valid inputs.
```

### Git as Persistence

The container is stateless. Git is the brain. The agent always pushes its work. If a container dies unexpectedly, worst case is losing an uncommitted in-progress fix - which the agent redoes because the error alert still exists.

### Merge Conflicts

The agent never force-resolves conflicts. If production and main have diverged and merging creates conflicts, the agent stops and flags it for human resolution.

### Docker Image

```dockerfile
FROM oven/bun:1

COPY . /app
WORKDIR /app

RUN bun install --production

ENV MANIFEST_GIT_REMOTE=origin
ENV MANIFEST_GIT_BRANCH=production
ENV MANIFEST_AGENT_SHUTDOWN_GRACE_SECONDS=30

EXPOSE 8080
CMD ["bun", "--hot", "index.ts"]
```

The `--hot` flag means the agent can modify code and Bun picks it up instantly. No restart needed.

## Security: Agent Credentials

The agent runs in production with git push access. This needs to be locked down.

### Recommended Setup

**Create a dedicated machine user (e.g. `manifest-agent`) with its own SSH key:**

1. Create a new GitHub user (e.g. `manifest-agent-myapp`) or a GitHub deploy key
2. Generate a dedicated SSH keypair for this user
3. Grant **read/write access to the production branch only** - not main, not other repos
4. Use GitHub branch protection rules to enforce:
   - Agent can only push to `production`
   - Agent cannot force-push
   - Agent cannot delete branches
   - Agent cannot merge to `main` (only humans do this)

```bash
# Generate a dedicated key for the agent
ssh-keygen -t ed25519 -C "manifest-agent@myapp" -f ./agent_deploy_key

# Pass it to the container via environment or volume mount
docker run \
  -e MANIFEST_GIT_SSH_KEY=/secrets/agent_deploy_key \
  -v ./agent_deploy_key:/secrets/agent_deploy_key:ro \
  my-manifest-app
```

### Principle of Least Privilege

The agent should have the minimum permissions it needs:

| Permission | Recommended | Why |
|-----------|-------------|-----|
| Git push | production branch only | Agent should never touch main |
| Git force-push | deny | Never lose history |
| Database | application user, not superuser | Agent fixes code, not schema (migrations are human-authored) |
| Filesystem | /app directory only | No access outside the project |
| Network | outbound to git remote + error tracker API only | No arbitrary network access |
| SSH to host | deny | Agent lives inside the container, not on the host |

### What the agent should NOT have

- Root access to the host machine (only inside the container)
- Access to other repositories
- Ability to modify CI/CD pipelines
- Access to secrets management systems (it receives secrets via env vars, it doesn't manage them)
- Ability to create or delete GitHub users/teams

### Config

```typescript
// config/manifest.ts
export default {
  // ...

  // Agent git credentials
  agentGitSshKey: Bun.env.MANIFEST_GIT_SSH_KEY,
  agentGitUserName: 'manifest-agent',
  agentGitUserEmail: 'agent@myapp.manifest',

  // Agent permissions (enforced by framework)
  agentAllowedBranches: ['production'],
  agentCanForcePush: false,
  agentCanRunMigrations: false,
} satisfies ManifestConfig
```
