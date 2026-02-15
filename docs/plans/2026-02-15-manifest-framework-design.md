# Manifest Framework Design

## Overview

Manifest is a Symfony-based, API-only PHP framework where every piece of code is written to be read, understood, and modified by AI agents. It ships as a Docker image and is designed for self-healing applications - an AI agent runs as a sidecar in production, monitoring the app and fixing issues in real-time.

## Core Philosophy

Three rules:

1. **One feature, one file.** A feature file contains everything an agent needs: route, input validation, authorization, business logic, side effects declaration, and error cases. No hunting across directories.

2. **Explicit over elegant.** If something happens, it's because the code says so - not because a listener was auto-discovered, a convention was followed, or an annotation triggered behavior. Verbose is correct. Terse is suspicious.

3. **Self-describing code.** Every feature, every service, every schema carries machine-readable metadata: what it does, what it depends on, what it affects. The codebase is its own documentation. An agent dropping into the project cold can orient itself by reading a `MANIFEST.md` at the root and the metadata on any file.

## Technical Foundation

- **Base:** Symfony 7.x (HTTP kernel, DI container, console commands, event dispatcher used explicitly)
- **Replaces:** Symfony's routing annotations, form system, auto-wiring conventions, and project structure
- **Runtime:** PHP 8.3+
- **API-only:** No server-rendered views. Supports modern frontends via REST, SSE, and webhooks.
- **No compilation in production:** No cached routes, no compiled DI container. Code changes take effect on next request.

## Project Structure

```
manifest-app/
├── MANIFEST.md                    # Agent's entry point. Describes the app,
│                                  # architecture, conventions, how to work
│                                  # with this codebase. Every agent reads this first.
│
├── features/                      # One file per feature. This IS the application.
│   ├── UserRegistration.php
│   ├── UserLogin.php
│   ├── UserProfile.php
│   ├── CreatePost.php
│   ├── ListPosts.php
│   └── DeletePost.php
│
├── schemas/                       # Data schemas with full field descriptions.
│   ├── UserSchema.php             # Defines shape, types, constraints, relationships.
│   └── PostSchema.php             # Used by features AND generates migrations.
│
├── services/                      # Shared services. Explicit, no auto-discovery.
│   ├── Mailer.php
│   ├── PaymentGateway.php
│   └── ImageProcessor.php
│
├── policies/                      # Authorization. One file per resource.
│   ├── UserPolicy.php
│   └── PostPolicy.php
│
├── commands/                      # App-specific CLI commands (human or agent authored).
│   ├── SeedDemoTenant.php
│   └── PruneExpiredSessions.php
│
├── config/
│   ├── manifest.php               # Framework config. Flat, no nesting, commented.
│   ├── database.php
│   └── services.php               # Explicit service registration. No auto-wiring.
│
├── migrations/                    # Generated from schemas, stored as code.
├── tests/                         # Mirrors features/ structure 1:1.
│   ├── UserRegistrationTest.php
│   └── CreatePostTest.php
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── public/
    └── index.php                  # Thin entry point. Boots kernel, that's it.
```

The `features/` directory IS the application. Everything else is supporting infrastructure.

## The Feature File

The heart of Manifest. A complete, self-contained unit of application behavior.

```php
<?php

namespace App\Features;

use Manifest\Feature\Feature;
use Manifest\Feature\InputSchema;
use Manifest\Feature\Result;
use App\Schemas\UserSchema;
use App\Services\Mailer;

#[Feature(
    name: 'user-registration',
    description: 'Creates a new user account. Validates email uniqueness,
                  hashes password, persists user, and sends a welcome email.
                  Returns the created user without sensitive fields.',
    route: ['POST', '/api/users/register'],
    authentication: 'none',
    rateLimit: '5/minute/ip',
    sideEffects: [
        'Inserts one row into users table',
        'Sends welcome email via Mailer service',
    ],
    errorCases: [
        '409 - Email already registered',
        '422 - Validation failed',
    ],
)]
class UserRegistration extends Feature
{
    public function __construct(
        private readonly UserSchema $users,
        private readonly Mailer $mailer,
    ) {}

    public function input(): InputSchema
    {
        return InputSchema::create()
            ->string('email',
                description: 'User email address. Must be unique across all users.',
                required: true,
                format: 'email',
            )
            ->string('password',
                description: 'Account password. Hashed with bcrypt before storage.',
                required: true,
                minLength: 8,
                maxLength: 128,
            )
            ->string('display_name',
                description: 'Public display name shown to other users.',
                required: true,
                maxLength: 100,
            );
    }

    public function handle(Input $input): Result
    {
        if ($this->users->findOneBy(['email' => $input->email])) {
            return $this->fail(
                message: 'Email already registered',
                status: 409,
            );
        }

        $user = $this->users->create([
            'email' => $input->email,
            'password' => password_hash($input->password, PASSWORD_BCRYPT),
            'display_name' => $input->display_name,
        ]);

        $this->mailer->send(
            template: 'welcome',
            to: $user['email'],
            context: ['display_name' => $user['display_name']],
        );

        return $this->ok(
            message: 'User registered',
            data: $user,
            status: 201,
        );
    }
}
```

What an agent gets from a single file:
- What the feature does (description)
- What URL triggers it and how (route, method, auth, rate limit)
- Exactly what inputs it accepts, with types, constraints, and why each field exists
- Every side effect, declared before the agent reads the logic
- Every error case and its HTTP status
- The full execution flow - linear, no hidden branches

The `#[Feature]` attribute is a contract with the agent. An agent can read just the attribute block and know what this feature does without reading `handle()`.

## Schemas

Schemas replace Doctrine entities. They define data shape, generate migrations, and act as the query interface.

```php
<?php

namespace App\Schemas;

use Manifest\Schema\Schema;
use Manifest\Schema\Field;
use Manifest\Schema\Index;

#[Schema(
    name: 'users',
    table: 'users',
    description: 'Application users. One row per registered account.
                  Email is the unique identifier for authentication.
                  Soft-deleted: rows are never physically removed.',
)]
class UserSchema extends Schema
{
    public function fields(): array
    {
        return [
            Field::uuid('id')
                ->primary()
                ->description('Unique user identifier. Generated on creation.'),

            Field::string('email', length: 255)
                ->unique()
                ->description('Login email. Must be unique. Used for authentication
                              and all transactional email.'),

            Field::string('password', length: 255)
                ->description('Bcrypt-hashed password. Never exposed in API responses.')
                ->hidden(),

            Field::string('display_name', length: 100)
                ->description('Public name shown in UI and to other users.'),

            Field::enum('role', ['user', 'admin'])
                ->default('user')
                ->description('Authorization role. "admin" grants access to all
                              admin-prefixed features.'),

            Field::timestamp('email_verified_at')
                ->nullable()
                ->description('Null means unverified. Set when user clicks
                              verification link. Required for posting content.'),

            Field::timestamps(),
            Field::softDeletes(),
        ];
    }

    public function indexes(): array
    {
        return [
            Index::on('email')->unique(),
            Index::on('role')->description('Used by admin user listing feature.'),
        ];
    }

    public function relationships(): array
    {
        return [
            $this->hasMany('posts', PostSchema::class,
                description: 'All posts authored by this user. Cascade soft-delete.',
            ),
        ];
    }
}
```

Key design choices:
- `->description()` on everything. Every field, index, relationship explains itself.
- `->hidden()` marks fields that never appear in API responses. Framework enforces this.
- Schemas are also the query interface. `$this->users->findOneBy(...)`, `$this->users->create(...)`.
- Migrations are generated from schemas, not hand-written. Change the schema, run a command, get a migration.

## API Layer

### Routing

Defined in feature attributes. No separate route files. The framework scans `features/` on boot and registers them.

### Response Envelope

Every response follows a standard envelope:

```json
{
    "status": 201,
    "message": "User registered",
    "data": {
        "id": "a1b2c3",
        "email": "user@example.com",
        "display_name": "Jane"
    },
    "meta": {
        "feature": "user-registration",
        "duration_ms": 42,
        "request_id": "req_xyz789"
    }
}
```

Every response includes `meta.feature` and `meta.request_id`. When something breaks, the agent knows which feature produced it and can trace the request. Errors follow the same envelope - no surprise HTML pages.

### Feature Types

Three types of features: **request** (default), **stream** (SSE), and **event** (triggered internally, not by HTTP).

**SSE Stream:**
```php
#[Feature(
    name: 'post-feed',
    description: 'Streams new posts to connected clients in real-time.',
    route: ['GET', '/api/posts/feed'],
    type: 'stream',
    authentication: 'required',
)]
class PostFeed extends Feature
{
    public function stream(Input $input, Stream $stream): void
    {
        $stream->on('post.created', function (array $post) use ($stream) {
            $stream->emit('new-post', data: $post);
        });
    }
}
```

**Event-triggered (webhooks etc):**
```php
#[Feature(
    name: 'notify-order-shipped',
    description: 'Sends webhook to merchant when order status changes to shipped.',
    trigger: 'event',
    event: 'order.shipped',
    sideEffects: ['POST to merchant webhook URL'],
)]
class NotifyOrderShipped extends Feature
{
    public function handle(Input $input): Result
    {
        $this->webhook->send(
            url: $input->merchant_webhook_url,
            event: 'order.shipped',
            payload: $input->order,
        );

        return $this->ok('Webhook delivered');
    }
}
```

## MANIFEST.md

Every Manifest project has a `MANIFEST.md` at the root. It's the system prompt for any agent that touches the codebase. The framework generates and maintains it - when you add a feature, it updates. Always in sync.

```markdown
# Manifest: my-app

## System
- Runtime: PHP 8.3, Symfony 7.x, Manifest 1.x
- Database: PostgreSQL 16
- Cache: Redis 7
- Queue: Redis-backed

## Architecture
This is a Manifest application. All behavior lives in feature files.
- features/ - One file per application behavior (31 features)
- schemas/ - Data definitions (8 schemas)
- services/ - Shared services (5 services)
- policies/ - Authorization rules (4 policies)
- commands/ - CLI commands (6 commands)

## Conventions
- NEVER use auto-wiring. All services are registered in config/services.php.
- NEVER create event listeners. Side effects go in the feature's handle() method.
- NEVER scatter one behavior across multiple files. One feature = one file.
- Every field, parameter, and return value MUST have a description.
- Features MUST declare all side effects in the #[Feature] attribute.
- Schemas MUST describe every field and relationship.

## Feature Index
| Name | Route | Type | Description |
|------|-------|------|-------------|
| user-registration | POST /api/users/register | request | Creates new account |
| user-login | POST /api/users/login | request | Authenticates user |
| post-feed | GET /api/posts/feed | stream | Real-time post stream |

## Schema Index
| Name | Table | Fields | Description |
|------|-------|--------|-------------|
| users | users | 8 | Application user accounts |
| posts | posts | 6 | User-authored content |

## Service Index
| Name | Description | Used by |
|------|-------------|---------|
| Mailer | Sends transactional email via SMTP | user-registration, password-reset |

## Command Index
| Name | Created By | Description |
|------|-----------|-------------|
| app:seed-demo-tenant | agent | Creates demo tenant with sample data |

## Known Issues
- None currently.

## Recent Changes
- 2026-02-14: Added post-feed SSE stream feature
- 2026-02-13: Added soft-delete to UserSchema
```

The Feature/Schema/Service/Command indexes are auto-generated. Known Issues and Recent Changes are maintained by agents.

## Config & Services

Config is flat PHP files returning arrays. No YAML, no .env magic, no nested config cascading.

```php
<?php
// config/manifest.php

return [
    'app_name' => 'my-app',
    'app_url' => 'https://my-app.com',
    'debug' => false,
    'include_meta_in_responses' => true,
    'include_duration_in_meta' => true,
    'rate_limit_driver' => 'redis',
    'rate_limit_prefix' => 'manifest:',
    'sse_heartbeat_seconds' => 15,
    'sse_max_connection_seconds' => 300,
];
```

Environment-specific values use `getenv()` directly in the config file - visible, explicit, greppable:

```php
'database_host' => getenv('DB_HOST') ?: 'localhost',
```

Services are registered explicitly in `config/services.php`. No auto-discovery, no auto-wiring. Every service has a description.

```php
<?php
// config/services.php

return [
    Mailer::class => [
        'description' => 'Sends transactional email. Uses SMTP in production,
                          logs to file in development.',
        'args' => [
            'host' => getenv('SMTP_HOST'),
            'port' => (int) getenv('SMTP_PORT') ?: 587,
            'from' => 'hello@my-app.com',
        ],
    ],
];
```

Dependency trace is always three hops: feature constructor -> services.php -> actual class.

## Testing

Tests mirror features 1:1. Every feature has exactly one test file.

```php
<?php

namespace Tests\Features;

use Manifest\Testing\FeatureTest;

#[TestFor(
    feature: 'user-registration',
    description: 'Verifies account creation, email uniqueness enforcement,
                  input validation, and welcome email dispatch.',
)]
class UserRegistrationTest extends FeatureTest
{
    public function test_creates_user_with_valid_input(): void
    {
        $result = $this->call('user-registration', [
            'email' => 'jane@example.com',
            'password' => 'secure-password-123',
            'display_name' => 'Jane',
        ]);

        $result->assertStatus(201);
        $result->assertMessage('User registered');
        $result->assertDataHas('email', 'jane@example.com');
        $result->assertDataMissing('password');

        $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
        $this->assertMailSent('welcome', to: 'jane@example.com');
    }

    public function test_rejects_duplicate_email(): void
    {
        $this->seedUser(email: 'taken@example.com');

        $result = $this->call('user-registration', [
            'email' => 'taken@example.com',
            'password' => 'secure-password-123',
            'display_name' => 'Jane',
        ]);

        $result->assertStatus(409);
        $result->assertMessage('Email already registered');
        $this->assertMailNotSent('welcome');
    }

    public function test_validates_required_fields(): void
    {
        $result = $this->call('user-registration', []);

        $result->assertStatus(422);
        $result->assertValidationErrors([
            'email' => 'required',
            'password' => 'required',
            'display_name' => 'required',
        ]);
    }
}
```

Key design choices:
- `$this->call('feature-name', [...])` - Tests call features by name, not HTTP route. URL changes don't break tests.
- `#[TestFor]` links tests to features. Framework can verify every feature has tests.
- No mocking unless absolutely necessary. Real assertions against real state.

## Live Code Runtime

No compilation in production. No cached routes, no compiled DI container. Features are scanned, services resolved, and routes registered on every request.

```php
<?php
// public/index.php

require __DIR__ . '/../vendor/autoload.php';

use Manifest\Kernel;

$kernel = new Kernel(
    projectDir: dirname(__DIR__),
    cacheEnabled: false,
);

$kernel->handleRequest();
```

For a typical app with 30-50 features, the overhead is ~5-15ms per request. That's the price of live code. If needed, opt-in caching is available with `php manifest cache:clear && php manifest cache:warm` after changes.

## CLI Tooling

### Built-in Commands

```bash
php manifest make:feature UserRegistration --route="POST /api/users/register" --type=request --auth=none
php manifest make:schema User --table=users
php manifest make:test UserRegistration
php manifest migrate:generate
php manifest migrate
php manifest index          # Rebuild MANIFEST.md from codebase
php manifest check          # Validate conventions
php manifest agent:changelog  # Show agent changes since last release
php manifest serve          # Boot PHP server + agent process
```

`php manifest check` enforces conventions:
```
$ php manifest check

 Feature 'create-post' is missing side effects declaration
 Schema 'PostSchema' field 'slug' has no description
 Feature 'delete-user' has no test file
 Service 'ImageProcessor' is registered but has no description
 MANIFEST.md is in sync
 All routes are unique
 No auto-wired services detected

4 issues found. Run 'php manifest check --fix' for suggestions.
```

### Agent-Authored Commands

Agents can create custom CLI commands in `commands/`. Commands track who created them and why:

```php
#[Command(
    name: 'app:seed-demo-tenant',
    description: 'Creates a demo tenant with sample users and posts.',
    usage: 'php manifest app:seed-demo-tenant --name="Acme Corp"',
    createdBy: 'agent',
    reason: 'Agent noticed manual tenant seeding via raw SQL on 2026-02-10 and 2026-02-12.',
)]
class SeedDemoTenant extends Command { ... }
```

## Deployment & Git Workflow

### Two Branches

```
main        <- Human works here. Normal development.
production  <- Deployed code. Agent works here.
```

### Deployment Flow

1. Human merges main -> production
2. CI builds new Docker image from production branch
3. Orchestrator sends SIGTERM to old container
4. Agent gets graceful shutdown (30s): commits and pushes any uncommitted work, writes memory file
5. Old container stops, new container starts
6. New agent boots: git pull, `php manifest index`, reads MANIFEST.md, reads memory file, logs what changed

### Agent Commits

Always prefixed with `[agent]`, always structured:

```
[agent] fix: Null check in UserRegistration

Sentry Issue: MYAPP-1234
Root cause: $input->display_name could be null when OAuth provider omits the name field.
Side effects of this fix: None.
Features modified: user-registration
Risk: Low - adds null coalesce, no behavior change for valid inputs.
```

### Git as Persistence

The container is stateless. Git is the brain. The agent always pushes its work. If a container dies unexpectedly, worst case is losing an uncommitted in-progress fix - which the agent redoes because the Sentry alert still exists.

### Merge Conflicts

The agent never force-resolves conflicts. If production and main have diverged and merging creates conflicts, the agent stops and flags it for human resolution.

### Docker Image

```dockerfile
FROM php:8.3-fpm

COPY . /app
WORKDIR /app

RUN composer install --no-dev
RUN apt-get update && apt-get install -y git

ENV MANIFEST_GIT_REMOTE=origin
ENV MANIFEST_GIT_BRANCH=production
ENV MANIFEST_AGENT_SHUTDOWN_GRACE_SECONDS=30

EXPOSE 8080
CMD ["php", "manifest", "serve"]
```

`php manifest serve` boots both the PHP server and the agent process. On SIGTERM it coordinates graceful handoff.

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
| Database | application user, not root | Agent fixes code, not schema (migrations are human-authored) |
| Filesystem | /app directory only | No access outside the project |
| Network | outbound to git remote + Sentry API only | No arbitrary network access |
| SSH to host | deny | Agent lives inside the container, not on the host |

### What the agent should NOT have

- Root access to the host machine (only inside the container)
- Access to other repositories
- Ability to modify CI/CD pipelines
- Access to secrets management systems (it receives secrets via env vars, it doesn't manage them)
- Ability to create or delete GitHub users/teams

### Config

```php
<?php
// config/manifest.php

return [
    // ...

    // Agent git credentials
    'agent_git_ssh_key' => getenv('MANIFEST_GIT_SSH_KEY'),
    'agent_git_user_name' => 'manifest-agent',
    'agent_git_user_email' => 'agent@myapp.manifest',

    // Agent permissions (enforced by framework)
    'agent_allowed_branches' => ['production'],
    'agent_can_force_push' => false,
    'agent_can_run_migrations' => false,
];
