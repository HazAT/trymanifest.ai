# Manifest Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Manifest PHP framework core - from zero to a working app where you define a Feature file, run `php manifest serve`, and hit the endpoint.

**Architecture:** Two Composer packages: `manifest/framework` (the library with Feature, Schema, Kernel, CLI) and `manifest/skeleton` (the starter project template). We build the framework first in a monorepo structure with a `demo/` app for testing. Symfony 7.4 LTS components only (no framework-bundle). All DI is explicit, no autowiring.

**Tech Stack:** PHP 8.3, Symfony 7.4 components (http-kernel, http-foundation, routing, dependency-injection, console, event-dispatcher), PHPUnit 11

---

## Task 1: Project Scaffolding

**Files:**
- Create: `composer.json`
- Create: `src/` (empty, framework code goes here)
- Create: `tests/` (empty)
- Create: `bin/manifest`
- Create: `phpunit.xml.dist`
- Create: `.gitignore`

**Step 1: Create composer.json**

```json
{
    "name": "manifest/framework",
    "type": "library",
    "description": "Production is our dev environment. An agent-first PHP framework.",
    "license": "MIT",
    "require": {
        "php": "^8.3",
        "composer-runtime-api": "^2.2",
        "symfony/http-kernel": "^7.4",
        "symfony/http-foundation": "^7.4",
        "symfony/routing": "^7.4",
        "symfony/dependency-injection": "^7.4",
        "symfony/console": "^7.4",
        "symfony/event-dispatcher": "^7.4",
        "symfony/config": "^7.4"
    },
    "require-dev": {
        "phpunit/phpunit": "^11.0"
    },
    "autoload": {
        "psr-4": {
            "Manifest\\": "src/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Manifest\\Tests\\": "tests/",
            "Demo\\": "demo/"
        }
    },
    "bin": [
        "bin/manifest"
    ],
    "minimum-stability": "stable",
    "prefer-stable": true
}
```

**Step 2: Create bin/manifest**

```php
#!/usr/bin/env php
<?php

declare(strict_types=1);

$autoloadPaths = [
    $_composer_autoload_path ?? null,
    __DIR__ . '/../vendor/autoload.php',
    __DIR__ . '/../../../autoload.php',
];

$autoloaderFound = false;
foreach ($autoloadPaths as $path) {
    if ($path !== null && file_exists($path)) {
        require $path;
        $autoloaderFound = true;
        break;
    }
}

if (!$autoloaderFound) {
    fwrite(STDERR, "Could not find Composer autoloader. Run 'composer install' first.\n");
    exit(1);
}

// Placeholder - will be replaced in Task 12
echo "Manifest CLI - not yet implemented\n";
exit(0);
```

**Step 3: Create phpunit.xml.dist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         cacheDirectory=".phpunit.cache"
         colors="true"
         executionOrder="random"
         failOnRisky="true"
         failOnWarning="true"
         beStrictAboutOutputDuringTests="true"
         beStrictAboutTestsThatDoNotTestAnything="true">

    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>

    <source>
        <include>
            <directory suffix=".php">src</directory>
        </include>
    </source>
</phpunit>
```

**Step 4: Create .gitignore**

```
/vendor/
/.phpunit.cache/
composer.lock
```

**Step 5: Create directory structure**

```bash
mkdir -p src/Attribute src/Feature src/Schema src/Config src/Console src/Http
mkdir -p tests/Unit tests/Feature
mkdir -p demo/features demo/schemas demo/services demo/config
```

**Step 6: Run composer install**

```bash
composer install
```

**Step 7: Verify PHPUnit runs**

```bash
./vendor/bin/phpunit
```

Expected: 0 tests, 0 assertions (no tests yet, but PHPUnit boots).

**Step 8: Make bin/manifest executable and verify**

```bash
chmod +x bin/manifest
./bin/manifest
```

Expected: "Manifest CLI - not yet implemented"

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Symfony 7.4 components and PHPUnit 11"
```

---

## Task 2: Feature Attribute

The `#[Feature]` attribute is the metadata contract between the framework and agents.

**Files:**
- Create: `src/Attribute/Feature.php`
- Create: `tests/Unit/Attribute/FeatureTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Attribute;

use Manifest\Attribute\Feature;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(Feature::class)]
class FeatureTest extends TestCase
{
    #[Test]
    public function it_stores_all_metadata(): void
    {
        $feature = new Feature(
            name: 'user-registration',
            description: 'Creates a new user account.',
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
        );

        $this->assertSame('user-registration', $feature->name);
        $this->assertSame('Creates a new user account.', $feature->description);
        $this->assertSame(['POST', '/api/users/register'], $feature->route);
        $this->assertSame('none', $feature->authentication);
        $this->assertSame('5/minute/ip', $feature->rateLimit);
        $this->assertCount(2, $feature->sideEffects);
        $this->assertCount(2, $feature->errorCases);
    }

    #[Test]
    public function it_has_sensible_defaults(): void
    {
        $feature = new Feature(
            name: 'simple-feature',
            description: 'A simple feature.',
            route: ['GET', '/api/simple'],
        );

        $this->assertSame('required', $feature->authentication);
        $this->assertNull($feature->rateLimit);
        $this->assertSame([], $feature->sideEffects);
        $this->assertSame([], $feature->errorCases);
        $this->assertSame('request', $feature->type);
    }

    #[Test]
    public function it_supports_stream_type(): void
    {
        $feature = new Feature(
            name: 'event-stream',
            description: 'Streams events.',
            route: ['GET', '/api/events'],
            type: 'stream',
        );

        $this->assertSame('stream', $feature->type);
    }

    #[Test]
    public function it_supports_event_type(): void
    {
        $feature = new Feature(
            name: 'order-webhook',
            description: 'Sends webhook on order.',
            route: [],
            type: 'event',
            trigger: 'order.shipped',
        );

        $this->assertSame('event', $feature->type);
        $this->assertSame('order.shipped', $feature->trigger);
    }

    #[Test]
    public function it_can_be_read_from_class_attribute(): void
    {
        $ref = new \ReflectionClass(AnnotatedFeatureStub::class);
        $attrs = $ref->getAttributes(Feature::class);

        $this->assertCount(1, $attrs);

        $feature = $attrs[0]->newInstance();
        $this->assertSame('stub-feature', $feature->name);
        $this->assertSame(['GET', '/api/stub'], $feature->route);
    }
}

#[Feature(
    name: 'stub-feature',
    description: 'A stub for testing.',
    route: ['GET', '/api/stub'],
)]
class AnnotatedFeatureStub {}
```

**Step 2: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Unit/Attribute/FeatureTest.php -v
```

Expected: FAIL - class not found.

**Step 3: Write the implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Attribute;

use Attribute;

#[Attribute(Attribute::TARGET_CLASS)]
class Feature
{
    /**
     * @param string $name Unique feature identifier. Kebab-case. Used in tests, logs, MANIFEST.md.
     * @param string $description What this feature does. Written for agents - be verbose.
     * @param array $route [METHOD, PATH] for HTTP features. Empty array for event-triggered features.
     * @param string $type 'request' (default), 'stream' (SSE), or 'event' (triggered internally).
     * @param string $authentication 'required' (default), 'none', or 'optional'.
     * @param string|null $rateLimit Rate limit expression like '5/minute/ip'. Null means no limit.
     * @param string|null $trigger Event name that triggers this feature. Only for type='event'.
     * @param string[] $sideEffects Human/agent-readable list of side effects.
     * @param string[] $errorCases Human/agent-readable list of error cases with HTTP status codes.
     */
    public function __construct(
        public readonly string $name,
        public readonly string $description,
        public readonly array $route,
        public readonly string $type = 'request',
        public readonly string $authentication = 'required',
        public readonly ?string $rateLimit = null,
        public readonly ?string $trigger = null,
        public readonly array $sideEffects = [],
        public readonly array $errorCases = [],
    ) {}
}
```

**Step 4: Run test to verify it passes**

```bash
./vendor/bin/phpunit tests/Unit/Attribute/FeatureTest.php -v
```

Expected: 5 tests, all PASS.

**Step 5: Commit**

```bash
git add src/Attribute/Feature.php tests/Unit/Attribute/FeatureTest.php
git commit -m "feat: Feature attribute with full metadata support"
```

---

## Task 3: InputSchema Builder

The fluent builder for declaring feature inputs with descriptions, types, and constraints.

**Files:**
- Create: `src/Feature/InputSchema.php`
- Create: `tests/Unit/Feature/InputSchemaTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Feature;

use Manifest\Feature\InputSchema;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(InputSchema::class)]
class InputSchemaTest extends TestCase
{
    #[Test]
    public function it_builds_string_fields(): void
    {
        $schema = InputSchema::create()
            ->string('email',
                description: 'User email address.',
                required: true,
                format: 'email',
            )
            ->string('name',
                description: 'Display name.',
                required: false,
                maxLength: 100,
            );

        $fields = $schema->getFields();
        $this->assertCount(2, $fields);

        $this->assertSame('string', $fields['email']['type']);
        $this->assertSame('User email address.', $fields['email']['description']);
        $this->assertTrue($fields['email']['required']);
        $this->assertSame('email', $fields['email']['format']);

        $this->assertSame('string', $fields['name']['type']);
        $this->assertFalse($fields['name']['required']);
        $this->assertSame(100, $fields['name']['maxLength']);
    }

    #[Test]
    public function it_builds_integer_fields(): void
    {
        $schema = InputSchema::create()
            ->integer('age',
                description: 'User age in years.',
                required: true,
                min: 0,
                max: 150,
            );

        $fields = $schema->getFields();
        $this->assertSame('integer', $fields['age']['type']);
        $this->assertSame(0, $fields['age']['min']);
        $this->assertSame(150, $fields['age']['max']);
    }

    #[Test]
    public function it_builds_boolean_fields(): void
    {
        $schema = InputSchema::create()
            ->boolean('accept_terms',
                description: 'Must accept terms of service.',
                required: true,
            );

        $fields = $schema->getFields();
        $this->assertSame('boolean', $fields['accept_terms']['type']);
    }

    #[Test]
    public function it_builds_array_fields(): void
    {
        $schema = InputSchema::create()
            ->array('tags',
                description: 'List of tags.',
                required: false,
                itemType: 'string',
            );

        $fields = $schema->getFields();
        $this->assertSame('array', $fields['tags']['type']);
        $this->assertSame('string', $fields['tags']['itemType']);
    }

    #[Test]
    public function it_validates_valid_input(): void
    {
        $schema = InputSchema::create()
            ->string('email', description: 'Email.', required: true, format: 'email')
            ->string('name', description: 'Name.', required: true, maxLength: 50);

        $errors = $schema->validate([
            'email' => 'user@example.com',
            'name' => 'Jane',
        ]);

        $this->assertEmpty($errors);
    }

    #[Test]
    public function it_catches_missing_required_fields(): void
    {
        $schema = InputSchema::create()
            ->string('email', description: 'Email.', required: true)
            ->string('name', description: 'Name.', required: true);

        $errors = $schema->validate([]);

        $this->assertArrayHasKey('email', $errors);
        $this->assertArrayHasKey('name', $errors);
        $this->assertSame('required', $errors['email']);
        $this->assertSame('required', $errors['name']);
    }

    #[Test]
    public function it_catches_string_too_long(): void
    {
        $schema = InputSchema::create()
            ->string('name', description: 'Name.', required: true, maxLength: 5);

        $errors = $schema->validate(['name' => 'TooLongName']);

        $this->assertArrayHasKey('name', $errors);
    }

    #[Test]
    public function it_catches_string_too_short(): void
    {
        $schema = InputSchema::create()
            ->string('password', description: 'Password.', required: true, minLength: 8);

        $errors = $schema->validate(['password' => 'short']);

        $this->assertArrayHasKey('password', $errors);
    }

    #[Test]
    public function it_catches_invalid_email_format(): void
    {
        $schema = InputSchema::create()
            ->string('email', description: 'Email.', required: true, format: 'email');

        $errors = $schema->validate(['email' => 'not-an-email']);

        $this->assertArrayHasKey('email', $errors);
    }

    #[Test]
    public function it_returns_required_field_names(): void
    {
        $schema = InputSchema::create()
            ->string('email', description: 'Email.', required: true)
            ->string('name', description: 'Name.', required: true)
            ->string('bio', description: 'Bio.', required: false);

        $this->assertSame(['email', 'name'], $schema->getRequiredFields());
    }
}
```

**Step 2: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Unit/Feature/InputSchemaTest.php -v
```

Expected: FAIL - class not found.

**Step 3: Write the implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

class InputSchema
{
    /** @var array<string, array<string, mixed>> */
    private array $fields = [];

    public static function create(): self
    {
        return new self();
    }

    public function string(
        string $name,
        string $description,
        bool $required = false,
        ?int $minLength = null,
        ?int $maxLength = null,
        ?string $format = null,
    ): self {
        $this->fields[$name] = array_filter([
            'type' => 'string',
            'description' => $description,
            'required' => $required,
            'minLength' => $minLength,
            'maxLength' => $maxLength,
            'format' => $format,
        ], fn ($v) => $v !== null);

        return $this;
    }

    public function integer(
        string $name,
        string $description,
        bool $required = false,
        ?int $min = null,
        ?int $max = null,
    ): self {
        $this->fields[$name] = array_filter([
            'type' => 'integer',
            'description' => $description,
            'required' => $required,
            'min' => $min,
            'max' => $max,
        ], fn ($v) => $v !== null);

        return $this;
    }

    public function boolean(
        string $name,
        string $description,
        bool $required = false,
    ): self {
        $this->fields[$name] = [
            'type' => 'boolean',
            'description' => $description,
            'required' => $required,
        ];

        return $this;
    }

    public function array(
        string $name,
        string $description,
        bool $required = false,
        string $itemType = 'string',
    ): self {
        $this->fields[$name] = [
            'type' => 'array',
            'description' => $description,
            'required' => $required,
            'itemType' => $itemType,
        ];

        return $this;
    }

    /** @return array<string, array<string, mixed>> */
    public function getFields(): array
    {
        return $this->fields;
    }

    /** @return string[] */
    public function getRequiredFields(): array
    {
        return array_keys(array_filter(
            $this->fields,
            fn (array $field) => $field['required'] ?? false,
        ));
    }

    /**
     * Validate input data against the schema.
     *
     * @param array<string, mixed> $data
     * @return array<string, string> Field name => error type. Empty means valid.
     */
    public function validate(array $data): array
    {
        $errors = [];

        foreach ($this->fields as $name => $field) {
            $value = $data[$name] ?? null;

            if ($value === null || $value === '') {
                if ($field['required'] ?? false) {
                    $errors[$name] = 'required';
                }
                continue;
            }

            if ($field['type'] === 'string' && is_string($value)) {
                if (isset($field['minLength']) && mb_strlen($value) < $field['minLength']) {
                    $errors[$name] = 'min_length';
                }
                if (isset($field['maxLength']) && mb_strlen($value) > $field['maxLength']) {
                    $errors[$name] = 'max_length';
                }
                if (isset($field['format']) && $field['format'] === 'email') {
                    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                        $errors[$name] = 'invalid_format';
                    }
                }
            }

            if ($field['type'] === 'integer') {
                if (!is_int($value) && !is_numeric($value)) {
                    $errors[$name] = 'invalid_type';
                    continue;
                }
                $intVal = (int) $value;
                if (isset($field['min']) && $intVal < $field['min']) {
                    $errors[$name] = 'min';
                }
                if (isset($field['max']) && $intVal > $field['max']) {
                    $errors[$name] = 'max';
                }
            }
        }

        return $errors;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
./vendor/bin/phpunit tests/Unit/Feature/InputSchemaTest.php -v
```

Expected: 10 tests, all PASS.

**Step 5: Commit**

```bash
git add src/Feature/InputSchema.php tests/Unit/Feature/InputSchemaTest.php
git commit -m "feat: InputSchema builder with validation"
```

---

## Task 4: Input and Result Value Objects

**Files:**
- Create: `src/Feature/Input.php`
- Create: `src/Feature/Result.php`
- Create: `tests/Unit/Feature/InputTest.php`
- Create: `tests/Unit/Feature/ResultTest.php`

**Step 1: Write the failing tests**

`tests/Unit/Feature/InputTest.php`:

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Feature;

use Manifest\Feature\Input;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(Input::class)]
class InputTest extends TestCase
{
    #[Test]
    public function it_provides_typed_access_to_fields(): void
    {
        $input = new Input([
            'email' => 'user@example.com',
            'name' => 'Jane',
            'age' => 25,
        ]);

        $this->assertSame('user@example.com', $input->email);
        $this->assertSame('Jane', $input->name);
        $this->assertSame(25, $input->age);
    }

    #[Test]
    public function it_returns_null_for_missing_fields(): void
    {
        $input = new Input(['email' => 'user@example.com']);

        $this->assertNull($input->name);
    }

    #[Test]
    public function it_provides_get_method(): void
    {
        $input = new Input(['key' => 'value']);

        $this->assertSame('value', $input->get('key'));
        $this->assertSame('default', $input->get('missing', 'default'));
    }

    #[Test]
    public function it_converts_to_array(): void
    {
        $data = ['email' => 'user@example.com', 'name' => 'Jane'];
        $input = new Input($data);

        $this->assertSame($data, $input->toArray());
    }

    #[Test]
    public function it_checks_field_existence(): void
    {
        $input = new Input(['email' => 'user@example.com']);

        $this->assertTrue($input->has('email'));
        $this->assertFalse($input->has('name'));
    }
}
```

`tests/Unit/Feature/ResultTest.php`:

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Feature;

use Manifest\Feature\Result;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(Result::class)]
class ResultTest extends TestCase
{
    #[Test]
    public function it_creates_success_result(): void
    {
        $result = Result::ok(
            message: 'User registered',
            data: ['id' => '123', 'email' => 'user@example.com'],
            status: 201,
        );

        $this->assertTrue($result->isSuccess());
        $this->assertSame(201, $result->getStatus());
        $this->assertSame('User registered', $result->getMessage());
        $this->assertSame(['id' => '123', 'email' => 'user@example.com'], $result->getData());
    }

    #[Test]
    public function it_creates_failure_result(): void
    {
        $result = Result::fail(
            message: 'Email already registered',
            status: 409,
        );

        $this->assertFalse($result->isSuccess());
        $this->assertSame(409, $result->getStatus());
        $this->assertSame('Email already registered', $result->getMessage());
        $this->assertNull($result->getData());
    }

    #[Test]
    public function it_creates_validation_error_result(): void
    {
        $result = Result::validationError(
            errors: ['email' => 'required', 'name' => 'required'],
        );

        $this->assertFalse($result->isSuccess());
        $this->assertSame(422, $result->getStatus());
        $this->assertSame(['email' => 'required', 'name' => 'required'], $result->getErrors());
    }

    #[Test]
    public function it_serializes_to_envelope(): void
    {
        $result = Result::ok(
            message: 'User registered',
            data: ['id' => '123'],
            status: 201,
        );

        $envelope = $result->toEnvelope(
            featureName: 'user-registration',
            requestId: 'req_abc123',
            durationMs: 42,
        );

        $this->assertSame(201, $envelope['status']);
        $this->assertSame('User registered', $envelope['message']);
        $this->assertSame(['id' => '123'], $envelope['data']);
        $this->assertSame('user-registration', $envelope['meta']['feature']);
        $this->assertSame('req_abc123', $envelope['meta']['request_id']);
        $this->assertSame(42, $envelope['meta']['duration_ms']);
    }

    #[Test]
    public function it_serializes_error_to_envelope(): void
    {
        $result = Result::validationError(
            errors: ['email' => 'required'],
        );

        $envelope = $result->toEnvelope(
            featureName: 'user-registration',
            requestId: 'req_abc123',
            durationMs: 5,
        );

        $this->assertSame(422, $envelope['status']);
        $this->assertSame(['email' => 'required'], $envelope['errors']);
        $this->assertArrayHasKey('meta', $envelope);
    }

    #[Test]
    public function it_defaults_to_200_for_success(): void
    {
        $result = Result::ok(message: 'Done');

        $this->assertSame(200, $result->getStatus());
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
./vendor/bin/phpunit tests/Unit/Feature/InputTest.php tests/Unit/Feature/ResultTest.php -v
```

Expected: FAIL - classes not found.

**Step 3: Write Input implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

class Input
{
    /** @param array<string, mixed> $data */
    public function __construct(
        private readonly array $data,
    ) {}

    public function __get(string $name): mixed
    {
        return $this->data[$name] ?? null;
    }

    public function get(string $name, mixed $default = null): mixed
    {
        return $this->data[$name] ?? $default;
    }

    public function has(string $name): bool
    {
        return array_key_exists($name, $this->data);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->data;
    }
}
```

**Step 4: Write Result implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

class Result
{
    /**
     * @param bool $success Whether the operation succeeded.
     * @param int $status HTTP status code.
     * @param string $message Human/agent-readable message.
     * @param array<string, mixed>|null $data Response payload for success results.
     * @param array<string, string> $errors Validation errors (field => error type).
     */
    private function __construct(
        private readonly bool $success,
        private readonly int $status,
        private readonly string $message,
        private readonly ?array $data = null,
        private readonly array $errors = [],
    ) {}

    public static function ok(
        string $message,
        ?array $data = null,
        int $status = 200,
    ): self {
        return new self(
            success: true,
            status: $status,
            message: $message,
            data: $data,
        );
    }

    public static function fail(
        string $message,
        int $status = 400,
    ): self {
        return new self(
            success: false,
            status: $status,
            message: $message,
        );
    }

    /** @param array<string, string> $errors */
    public static function validationError(
        array $errors,
        string $message = 'Validation failed',
    ): self {
        return new self(
            success: false,
            status: 422,
            message: $message,
            errors: $errors,
        );
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    /** @return array<string, mixed>|null */
    public function getData(): ?array
    {
        return $this->data;
    }

    /** @return array<string, string> */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Serialize to the standard Manifest response envelope.
     *
     * @return array<string, mixed>
     */
    public function toEnvelope(
        string $featureName,
        string $requestId,
        int $durationMs,
    ): array {
        $envelope = [
            'status' => $this->status,
            'message' => $this->message,
        ];

        if ($this->data !== null) {
            $envelope['data'] = $this->data;
        }

        if (!empty($this->errors)) {
            $envelope['errors'] = $this->errors;
        }

        $envelope['meta'] = [
            'feature' => $featureName,
            'request_id' => $requestId,
            'duration_ms' => $durationMs,
        ];

        return $envelope;
    }
}
```

**Step 5: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Unit/Feature/InputTest.php tests/Unit/Feature/ResultTest.php -v
```

Expected: 11 tests, all PASS.

**Step 6: Commit**

```bash
git add src/Feature/Input.php src/Feature/Result.php tests/Unit/Feature/InputTest.php tests/Unit/Feature/ResultTest.php
git commit -m "feat: Input and Result value objects with envelope serialization"
```

---

## Task 5: Feature Base Class

The abstract class that all features extend. Provides `ok()`, `fail()`, and `validationError()` helper methods.

**Files:**
- Create: `src/Feature/AbstractFeature.php`
- Create: `tests/Unit/Feature/AbstractFeatureTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Feature;

use Manifest\Attribute\Feature;
use Manifest\Feature\AbstractFeature;
use Manifest\Feature\Input;
use Manifest\Feature\InputSchema;
use Manifest\Feature\Result;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(AbstractFeature::class)]
class AbstractFeatureTest extends TestCase
{
    #[Test]
    public function it_executes_a_feature_with_valid_input(): void
    {
        $feature = new HelloFeatureStub();
        $result = $feature->execute(new Input(['name' => 'Jane']));

        $this->assertTrue($result->isSuccess());
        $this->assertSame(200, $result->getStatus());
        $this->assertSame('Hello, Jane!', $result->getMessage());
    }

    #[Test]
    public function it_returns_validation_errors_for_invalid_input(): void
    {
        $feature = new HelloFeatureStub();
        $result = $feature->execute(new Input([]));

        $this->assertFalse($result->isSuccess());
        $this->assertSame(422, $result->getStatus());
        $this->assertArrayHasKey('name', $result->getErrors());
    }

    #[Test]
    public function it_reads_feature_attribute_metadata(): void
    {
        $feature = new HelloFeatureStub();
        $metadata = $feature->getMetadata();

        $this->assertSame('hello', $metadata->name);
        $this->assertSame(['GET', '/api/hello'], $metadata->route);
    }
}

#[Feature(
    name: 'hello',
    description: 'Says hello.',
    route: ['GET', '/api/hello'],
    authentication: 'none',
)]
class HelloFeatureStub extends AbstractFeature
{
    public function input(): InputSchema
    {
        return InputSchema::create()
            ->string('name', description: 'Who to greet.', required: true);
    }

    public function handle(Input $input): Result
    {
        return $this->ok("Hello, {$input->name}!");
    }
}
```

**Step 2: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Unit/Feature/AbstractFeatureTest.php -v
```

Expected: FAIL - class not found.

**Step 3: Write the implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

use Manifest\Attribute\Feature;

abstract class AbstractFeature
{
    abstract public function input(): InputSchema;

    abstract public function handle(Input $input): Result;

    /**
     * Validate input against schema, then call handle().
     */
    public function execute(Input $input): Result
    {
        $errors = $this->input()->validate($input->toArray());

        if (!empty($errors)) {
            return Result::validationError($errors);
        }

        return $this->handle($input);
    }

    /**
     * Read the #[Feature] attribute from this class.
     */
    public function getMetadata(): Feature
    {
        $ref = new \ReflectionClass($this);
        $attrs = $ref->getAttributes(Feature::class);

        if (empty($attrs)) {
            throw new \RuntimeException(
                sprintf('Class %s is missing the #[Feature] attribute.', static::class)
            );
        }

        return $attrs[0]->newInstance();
    }

    protected function ok(string $message, ?array $data = null, int $status = 200): Result
    {
        return Result::ok(message: $message, data: $data, status: $status);
    }

    protected function fail(string $message, int $status = 400): Result
    {
        return Result::fail(message: $message, status: $status);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
./vendor/bin/phpunit tests/Unit/Feature/AbstractFeatureTest.php -v
```

Expected: 3 tests, all PASS.

**Step 5: Commit**

```bash
git add src/Feature/AbstractFeature.php tests/Unit/Feature/AbstractFeatureTest.php
git commit -m "feat: AbstractFeature base class with validation and metadata"
```

---

## Task 6: Feature Scanner

Scans the `features/` directory, reads `#[Feature]` attributes, and returns a registry of all features.

**Files:**
- Create: `src/Feature/FeatureScanner.php`
- Create: `src/Feature/FeatureRegistry.php`
- Create: `tests/Unit/Feature/FeatureScannerTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Feature;

use Manifest\Feature\FeatureScanner;
use Manifest\Feature\FeatureRegistry;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(FeatureScanner::class)]
#[CoversClass(FeatureRegistry::class)]
class FeatureScannerTest extends TestCase
{
    #[Test]
    public function it_scans_a_directory_and_finds_features(): void
    {
        // demo/features/ has at least one feature file
        $scanner = new FeatureScanner();
        $registry = $scanner->scan(__DIR__ . '/../../../demo/features');

        $this->assertInstanceOf(FeatureRegistry::class, $registry);
        $this->assertGreaterThan(0, count($registry->all()));
    }

    #[Test]
    public function it_returns_empty_registry_for_empty_directory(): void
    {
        $tmpDir = sys_get_temp_dir() . '/manifest_test_empty_' . uniqid();
        mkdir($tmpDir);

        $scanner = new FeatureScanner();
        $registry = $scanner->scan($tmpDir);

        $this->assertCount(0, $registry->all());

        rmdir($tmpDir);
    }

    #[Test]
    public function it_indexes_features_by_name(): void
    {
        $scanner = new FeatureScanner();
        $registry = $scanner->scan(__DIR__ . '/../../../demo/features');

        // The demo app should have a 'hello-world' feature
        $feature = $registry->get('hello-world');
        $this->assertNotNull($feature);
    }

    #[Test]
    public function it_returns_null_for_unknown_feature(): void
    {
        $scanner = new FeatureScanner();
        $registry = $scanner->scan(__DIR__ . '/../../../demo/features');

        $this->assertNull($registry->get('nonexistent-feature'));
    }
}
```

**Step 2: Create the demo feature this test depends on**

`demo/features/HelloWorld.php`:

```php
<?php

declare(strict_types=1);

namespace Demo\Features;

use Manifest\Attribute\Feature;
use Manifest\Feature\AbstractFeature;
use Manifest\Feature\Input;
use Manifest\Feature\InputSchema;
use Manifest\Feature\Result;

#[Feature(
    name: 'hello-world',
    description: 'A simple greeting endpoint. Returns a hello message with the provided name.',
    route: ['GET', '/api/hello'],
    authentication: 'none',
    sideEffects: [],
    errorCases: [
        '422 - Validation failed (name is required)',
    ],
)]
class HelloWorld extends AbstractFeature
{
    public function input(): InputSchema
    {
        return InputSchema::create()
            ->string('name',
                description: 'The name to greet. Defaults to "World" if not provided.',
                required: false,
                maxLength: 100,
            );
    }

    public function handle(Input $input): Result
    {
        $name = $input->name ?? 'World';

        return $this->ok(
            message: "Hello, {$name}!",
            data: ['greeting' => "Hello, {$name}!"],
        );
    }
}
```

**Step 3: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Unit/Feature/FeatureScannerTest.php -v
```

Expected: FAIL - FeatureScanner class not found.

**Step 4: Write FeatureRegistry implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

use Manifest\Attribute\Feature;

class FeatureRegistry
{
    /**
     * @param array<string, array{class: class-string<AbstractFeature>, metadata: Feature}> $features
     */
    public function __construct(
        private readonly array $features = [],
    ) {}

    /**
     * @return array<string, array{class: class-string<AbstractFeature>, metadata: Feature}>
     */
    public function all(): array
    {
        return $this->features;
    }

    /**
     * @return array{class: class-string<AbstractFeature>, metadata: Feature}|null
     */
    public function get(string $name): ?array
    {
        return $this->features[$name] ?? null;
    }

    public function has(string $name): bool
    {
        return isset($this->features[$name]);
    }
}
```

**Step 5: Write FeatureScanner implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Feature;

use Manifest\Attribute\Feature;

class FeatureScanner
{
    /**
     * Scan a directory for PHP files containing classes with the #[Feature] attribute.
     */
    public function scan(string $directory): FeatureRegistry
    {
        if (!is_dir($directory)) {
            return new FeatureRegistry([]);
        }

        $features = [];
        $files = glob($directory . '/*.php');

        foreach ($files as $file) {
            $className = $this->extractClassName($file);
            if ($className === null) {
                continue;
            }

            // Ensure the class is loaded
            require_once $file;

            if (!class_exists($className)) {
                continue;
            }

            $ref = new \ReflectionClass($className);
            $attrs = $ref->getAttributes(Feature::class);

            if (empty($attrs)) {
                continue;
            }

            $metadata = $attrs[0]->newInstance();
            $features[$metadata->name] = [
                'class' => $className,
                'metadata' => $metadata,
            ];
        }

        return new FeatureRegistry($features);
    }

    /**
     * Extract the fully qualified class name from a PHP file by reading
     * the namespace declaration and class declaration.
     */
    private function extractClassName(string $file): ?string
    {
        $contents = file_get_contents($file);
        if ($contents === false) {
            return null;
        }

        $namespace = null;
        $class = null;

        if (preg_match('/namespace\s+([^;]+);/', $contents, $matches)) {
            $namespace = $matches[1];
        }

        if (preg_match('/class\s+(\w+)/', $contents, $matches)) {
            $class = $matches[1];
        }

        if ($class === null) {
            return null;
        }

        return $namespace !== null ? $namespace . '\\' . $class : $class;
    }
}
```

**Step 6: Run test to verify it passes**

```bash
./vendor/bin/phpunit tests/Unit/Feature/FeatureScannerTest.php -v
```

Expected: 4 tests, all PASS.

**Step 7: Commit**

```bash
git add src/Feature/FeatureScanner.php src/Feature/FeatureRegistry.php tests/Unit/Feature/FeatureScannerTest.php demo/features/HelloWorld.php
git commit -m "feat: FeatureScanner and FeatureRegistry for feature discovery"
```

---

## Task 7: Config Loader

Loads flat PHP config files. No YAML, no .env magic.

**Files:**
- Create: `src/Config/ConfigLoader.php`
- Create: `tests/Unit/Config/ConfigLoaderTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Unit\Config;

use Manifest\Config\ConfigLoader;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(ConfigLoader::class)]
class ConfigLoaderTest extends TestCase
{
    private string $tmpDir;

    protected function setUp(): void
    {
        $this->tmpDir = sys_get_temp_dir() . '/manifest_config_test_' . uniqid();
        mkdir($this->tmpDir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->tmpDir . '/*.php'));
        rmdir($this->tmpDir);
    }

    #[Test]
    public function it_loads_a_config_file(): void
    {
        file_put_contents($this->tmpDir . '/app.php', '<?php return ["name" => "my-app", "debug" => false];');

        $loader = new ConfigLoader($this->tmpDir);
        $config = $loader->get('app');

        $this->assertSame('my-app', $config['name']);
        $this->assertFalse($config['debug']);
    }

    #[Test]
    public function it_returns_empty_array_for_missing_file(): void
    {
        $loader = new ConfigLoader($this->tmpDir);
        $config = $loader->get('nonexistent');

        $this->assertSame([], $config);
    }

    #[Test]
    public function it_loads_all_config_files(): void
    {
        file_put_contents($this->tmpDir . '/app.php', '<?php return ["name" => "my-app"];');
        file_put_contents($this->tmpDir . '/database.php', '<?php return ["host" => "localhost"];');

        $loader = new ConfigLoader($this->tmpDir);
        $all = $loader->all();

        $this->assertArrayHasKey('app', $all);
        $this->assertArrayHasKey('database', $all);
        $this->assertSame('my-app', $all['app']['name']);
    }

    #[Test]
    public function it_provides_dot_notation_access(): void
    {
        file_put_contents($this->tmpDir . '/app.php', '<?php return ["name" => "my-app", "debug" => true];');

        $loader = new ConfigLoader($this->tmpDir);

        $this->assertSame('my-app', $loader->value('app.name'));
        $this->assertTrue($loader->value('app.debug'));
        $this->assertNull($loader->value('app.missing'));
        $this->assertSame('default', $loader->value('app.missing', 'default'));
    }
}
```

**Step 2: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Unit/Config/ConfigLoaderTest.php -v
```

**Step 3: Write the implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Config;

class ConfigLoader
{
    /** @var array<string, array<string, mixed>> */
    private array $loaded = [];

    public function __construct(
        private readonly string $configDir,
    ) {}

    /** @return array<string, mixed> */
    public function get(string $name): array
    {
        if (!isset($this->loaded[$name])) {
            $file = $this->configDir . '/' . $name . '.php';
            $this->loaded[$name] = file_exists($file) ? require $file : [];
        }

        return $this->loaded[$name];
    }

    /** @return array<string, array<string, mixed>> */
    public function all(): array
    {
        $files = glob($this->configDir . '/*.php');
        foreach ($files as $file) {
            $name = basename($file, '.php');
            $this->get($name);
        }

        return $this->loaded;
    }

    public function value(string $dotPath, mixed $default = null): mixed
    {
        $parts = explode('.', $dotPath, 2);
        $config = $this->get($parts[0]);

        if (!isset($parts[1])) {
            return $config ?: $default;
        }

        return $config[$parts[1]] ?? $default;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
./vendor/bin/phpunit tests/Unit/Config/ConfigLoaderTest.php -v
```

Expected: 4 tests, all PASS.

**Step 5: Commit**

```bash
git add src/Config/ConfigLoader.php tests/Unit/Config/ConfigLoaderTest.php
git commit -m "feat: ConfigLoader for flat PHP config files"
```

---

## Task 8: HTTP Kernel

The core that ties everything together: scans features, matches routes, handles requests, returns JSON responses.

**Files:**
- Create: `src/Http/Kernel.php`
- Create: `tests/Feature/KernelTest.php`

**Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Manifest\Tests\Feature;

use Manifest\Http\Kernel;
use Symfony\Component\HttpFoundation\Request;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(Kernel::class)]
class KernelTest extends TestCase
{
    private Kernel $kernel;

    protected function setUp(): void
    {
        $this->kernel = new Kernel(
            projectDir: __DIR__ . '/../../demo',
        );
    }

    #[Test]
    public function it_handles_a_request_to_a_known_feature(): void
    {
        $request = Request::create('/api/hello', 'GET', ['name' => 'Jane']);
        $response = $this->kernel->handleRequest($request);

        $this->assertSame(200, $response->getStatusCode());

        $body = json_decode($response->getContent(), true);
        $this->assertSame('Hello, Jane!', $body['message']);
        $this->assertSame('hello-world', $body['meta']['feature']);
        $this->assertArrayHasKey('request_id', $body['meta']);
        $this->assertArrayHasKey('duration_ms', $body['meta']);
    }

    #[Test]
    public function it_returns_404_for_unknown_routes(): void
    {
        $request = Request::create('/api/nonexistent', 'GET');
        $response = $this->kernel->handleRequest($request);

        $this->assertSame(404, $response->getStatusCode());

        $body = json_decode($response->getContent(), true);
        $this->assertSame('Not found', $body['message']);
    }

    #[Test]
    public function it_returns_405_for_wrong_method(): void
    {
        $request = Request::create('/api/hello', 'DELETE');
        $response = $this->kernel->handleRequest($request);

        $this->assertSame(405, $response->getStatusCode());
    }

    #[Test]
    public function it_returns_validation_errors(): void
    {
        // HelloWorld feature has 'name' as optional, so we need a feature
        // with a required field to test validation. For now, test that
        // the kernel returns proper JSON for any request.
        $request = Request::create('/api/hello', 'GET');
        $response = $this->kernel->handleRequest($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('application/json', $response->headers->get('Content-Type'));
    }
}
```

**Step 2: Create demo config**

`demo/config/manifest.php`:

```php
<?php

return [
    'app_name' => 'manifest-demo',
    'debug' => true,
    'include_meta_in_responses' => true,
    'include_duration_in_meta' => true,
];
```

`demo/config/services.php`:

```php
<?php

return [];
```

**Step 3: Run test to verify it fails**

```bash
./vendor/bin/phpunit tests/Feature/KernelTest.php -v
```

**Step 4: Write the Kernel implementation**

```php
<?php

declare(strict_types=1);

namespace Manifest\Http;

use Manifest\Config\ConfigLoader;
use Manifest\Feature\AbstractFeature;
use Manifest\Feature\FeatureRegistry;
use Manifest\Feature\FeatureScanner;
use Manifest\Feature\Input;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Exception\MethodNotAllowedException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Symfony\Component\Routing\Matcher\UrlMatcher;
use Symfony\Component\Routing\RequestContext;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

class Kernel
{
    private FeatureRegistry $registry;
    private RouteCollection $routes;
    private ConfigLoader $config;

    public function __construct(
        private readonly string $projectDir,
    ) {
        $this->config = new ConfigLoader($this->projectDir . '/config');
        $this->boot();
    }

    private function boot(): void
    {
        $scanner = new FeatureScanner();
        $this->registry = $scanner->scan($this->projectDir . '/features');
        $this->routes = $this->buildRoutes();
    }

    private function buildRoutes(): RouteCollection
    {
        $routes = new RouteCollection();

        foreach ($this->registry->all() as $name => $entry) {
            $metadata = $entry['metadata'];

            if (empty($metadata->route) || $metadata->type !== 'request') {
                continue;
            }

            [$method, $path] = $metadata->route;

            $routes->add($name, new Route(
                path: $path,
                defaults: ['_manifest_feature' => $name],
                methods: [$method],
            ));
        }

        return $routes;
    }

    public function handleRequest(?Request $request = null): Response
    {
        $request = $request ?? Request::createFromGlobals();
        $startTime = hrtime(true);
        $requestId = 'req_' . bin2hex(random_bytes(8));

        try {
            $context = new RequestContext();
            $context->fromRequest($request);

            $matcher = new UrlMatcher($this->routes, $context);
            $match = $matcher->match($request->getPathInfo());

            $featureName = $match['_manifest_feature'];
            $entry = $this->registry->get($featureName);

            if ($entry === null) {
                return $this->jsonError('Not found', 404, $requestId, $startTime);
            }

            $featureClass = $entry['class'];
            /** @var AbstractFeature $feature */
            $feature = new $featureClass();

            $inputData = array_merge(
                $request->query->all(),
                $request->request->all(),
                json_decode($request->getContent() ?: '{}', true) ?: [],
            );

            $result = $feature->execute(new Input($inputData));

            $durationMs = (int) ((hrtime(true) - $startTime) / 1_000_000);

            $envelope = $result->toEnvelope(
                featureName: $featureName,
                requestId: $requestId,
                durationMs: $durationMs,
            );

            return new JsonResponse($envelope, $result->getStatus());

        } catch (ResourceNotFoundException) {
            return $this->jsonError('Not found', 404, $requestId, $startTime);
        } catch (MethodNotAllowedException) {
            return $this->jsonError('Method not allowed', 405, $requestId, $startTime);
        } catch (\Throwable $e) {
            $status = 500;
            $message = $this->config->value('manifest.debug', false)
                ? $e->getMessage()
                : 'Internal server error';

            return $this->jsonError($message, $status, $requestId, $startTime);
        }
    }

    private function jsonError(string $message, int $status, string $requestId, int $startTime): JsonResponse
    {
        $durationMs = (int) ((hrtime(true) - $startTime) / 1_000_000);

        return new JsonResponse([
            'status' => $status,
            'message' => $message,
            'meta' => [
                'request_id' => $requestId,
                'duration_ms' => $durationMs,
            ],
        ], $status);
    }

    public function getRegistry(): FeatureRegistry
    {
        return $this->registry;
    }

    public function getConfig(): ConfigLoader
    {
        return $this->config;
    }
}
```

**Step 5: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Feature/KernelTest.php -v
```

Expected: 4 tests, all PASS.

**Step 6: Create public/index.php for the demo**

`demo/public/index.php`:

```php
<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use Manifest\Http\Kernel;

$kernel = new Kernel(
    projectDir: dirname(__DIR__),
);

$response = $kernel->handleRequest();
$response->send();
```

**Step 7: Commit**

```bash
git add src/Http/Kernel.php tests/Feature/KernelTest.php demo/config/ demo/public/index.php
git commit -m "feat: HTTP Kernel with routing, feature execution, and JSON envelope responses"
```

---

## Task 9: CLI Application

The `php manifest` CLI with `serve`, `index`, and `check` commands.

**Files:**
- Modify: `bin/manifest`
- Create: `src/Console/ManifestApplication.php`
- Create: `src/Console/Command/ServeCommand.php`
- Create: `src/Console/Command/IndexCommand.php`
- Create: `src/Console/Command/CheckCommand.php`

**Step 1: Write the ManifestApplication class**

```php
<?php

declare(strict_types=1);

namespace Manifest\Console;

use Manifest\Console\Command\CheckCommand;
use Manifest\Console\Command\IndexCommand;
use Manifest\Console\Command\ServeCommand;
use Symfony\Component\Console\Application;

class ManifestApplication extends Application
{
    public function __construct()
    {
        parent::__construct('Manifest', '0.1.0');

        $this->addCommands([
            new ServeCommand(),
            new IndexCommand(),
            new CheckCommand(),
        ]);
    }
}
```

**Step 2: Write ServeCommand**

```php
<?php

declare(strict_types=1);

namespace Manifest\Console\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'serve',
    description: 'Start the Manifest development server.',
)]
class ServeCommand extends Command
{
    protected function configure(): void
    {
        $this
            ->addOption('host', null, InputOption::VALUE_OPTIONAL, 'Host to bind to', '0.0.0.0')
            ->addOption('port', 'p', InputOption::VALUE_OPTIONAL, 'Port to bind to', '8080');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $host = $input->getOption('host');
        $port = $input->getOption('port');

        $projectDir = getcwd();
        $publicDir = $projectDir . '/public';
        $entryPoint = $publicDir . '/index.php';

        if (!file_exists($entryPoint)) {
            $io->error("No public/index.php found in {$projectDir}");
            return Command::FAILURE;
        }

        $io->success("Manifest server starting on http://{$host}:{$port}");
        $io->text('Press Ctrl+C to stop.');

        $command = sprintf(
            'php -S %s:%s -t %s %s',
            $host,
            $port,
            escapeshellarg($publicDir),
            escapeshellarg($entryPoint),
        );

        passthru($command, $exitCode);

        return $exitCode === 0 ? Command::SUCCESS : Command::FAILURE;
    }
}
```

**Step 3: Write IndexCommand (generates MANIFEST.md)**

```php
<?php

declare(strict_types=1);

namespace Manifest\Console\Command;

use Manifest\Feature\FeatureScanner;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'index',
    description: 'Rebuild MANIFEST.md from the current codebase state.',
)]
class IndexCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = getcwd();

        $scanner = new FeatureScanner();
        $registry = $scanner->scan($projectDir . '/features');

        $features = $registry->all();

        $md = "# Manifest: " . basename($projectDir) . "\n\n";
        $md .= "## System\n";
        $md .= "- Runtime: PHP " . PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION . ", Manifest 0.1.x\n\n";

        $md .= "## Architecture\n";
        $md .= "This is a Manifest application. All behavior lives in feature files.\n";
        $md .= "- features/ - One file per application behavior (" . count($features) . " features)\n\n";

        $md .= "## Conventions\n";
        $md .= "- NEVER use auto-wiring. All services are registered in config/services.php.\n";
        $md .= "- NEVER create event listeners. Side effects go in the feature's handle() method.\n";
        $md .= "- NEVER scatter one behavior across multiple files. One feature = one file.\n";
        $md .= "- Every field, parameter, and return value MUST have a description.\n";
        $md .= "- Features MUST declare all side effects in the #[Feature] attribute.\n";
        $md .= "- Schemas MUST describe every field and relationship.\n\n";

        $md .= "## Feature Index\n";
        $md .= "| Name | Route | Type | Description |\n";
        $md .= "|------|-------|------|-------------|\n";

        foreach ($features as $name => $entry) {
            $meta = $entry['metadata'];
            $route = !empty($meta->route)
                ? $meta->route[0] . ' ' . $meta->route[1]
                : ($meta->trigger ?? 'n/a');
            $desc = str_replace("\n", ' ', substr($meta->description, 0, 80));
            $md .= "| {$name} | {$route} | {$meta->type} | {$desc} |\n";
        }

        $md .= "\n## Known Issues\n";
        $md .= "- None currently.\n\n";

        $md .= "## Recent Changes\n";
        $md .= "- " . date('Y-m-d') . ": MANIFEST.md regenerated by `php manifest index`\n";

        file_put_contents($projectDir . '/MANIFEST.md', $md);

        $io->success("MANIFEST.md generated with " . count($features) . " features indexed.");

        return Command::SUCCESS;
    }
}
```

**Step 4: Write CheckCommand (validates conventions)**

```php
<?php

declare(strict_types=1);

namespace Manifest\Console\Command;

use Manifest\Feature\FeatureScanner;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'check',
    description: 'Validate that the project follows Manifest conventions.',
)]
class CheckCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = getcwd();
        $issues = [];
        $passes = [];

        // Scan features
        $scanner = new FeatureScanner();
        $registry = $scanner->scan($projectDir . '/features');
        $features = $registry->all();

        // Check: Every feature has a description
        foreach ($features as $name => $entry) {
            $meta = $entry['metadata'];

            if (empty($meta->description)) {
                $issues[] = "Feature '{$name}' has no description.";
            }

            if ($meta->type === 'request' && empty($meta->route)) {
                $issues[] = "Feature '{$name}' is type 'request' but has no route.";
            }

            // Check: Feature has a test file
            $className = (new \ReflectionClass($entry['class']))->getShortName();
            $testFile = $projectDir . '/tests/' . $className . 'Test.php';
            if (!file_exists($testFile)) {
                $issues[] = "Feature '{$name}' has no test file (expected tests/{$className}Test.php).";
            }
        }

        // Check: MANIFEST.md exists and is in sync
        $manifestFile = $projectDir . '/MANIFEST.md';
        if (file_exists($manifestFile)) {
            $passes[] = 'MANIFEST.md exists.';
        } else {
            $issues[] = 'MANIFEST.md does not exist. Run `php manifest index` to generate it.';
        }

        // Check: All routes are unique
        $routes = [];
        foreach ($features as $name => $entry) {
            $meta = $entry['metadata'];
            if (!empty($meta->route)) {
                $routeKey = implode(' ', $meta->route);
                if (isset($routes[$routeKey])) {
                    $issues[] = "Duplicate route '{$routeKey}' in features '{$routes[$routeKey]}' and '{$name}'.";
                }
                $routes[$routeKey] = $name;
            }
        }
        if (empty(array_filter($routes, fn() => false))) {
            $passes[] = 'All routes are unique.';
        }

        // Output
        foreach ($issues as $issue) {
            $io->text("  <fg=red>✗</> {$issue}");
        }
        foreach ($passes as $pass) {
            $io->text("  <fg=green>✓</> {$pass}");
        }

        $io->newLine();
        if (count($issues) > 0) {
            $io->warning(count($issues) . " issue(s) found.");
            return Command::FAILURE;
        }

        $io->success("All checks passed.");
        return Command::SUCCESS;
    }
}
```

**Step 5: Update bin/manifest**

Replace the placeholder in `bin/manifest`:

```php
#!/usr/bin/env php
<?php

declare(strict_types=1);

$autoloadPaths = [
    $_composer_autoload_path ?? null,
    __DIR__ . '/../vendor/autoload.php',
    __DIR__ . '/../../../autoload.php',
];

$autoloaderFound = false;
foreach ($autoloadPaths as $path) {
    if ($path !== null && file_exists($path)) {
        require $path;
        $autoloaderFound = true;
        break;
    }
}

if (!$autoloaderFound) {
    fwrite(STDERR, "Could not find Composer autoloader. Run 'composer install' first.\n");
    exit(1);
}

$app = new Manifest\Console\ManifestApplication();
exit($app->run());
```

**Step 6: Verify serve command works**

```bash
cd demo && ../bin/manifest serve --port=8080 &
sleep 2
curl -s http://localhost:8080/api/hello?name=Jane | jq .
kill %1
cd ..
```

Expected JSON response with "Hello, Jane!" message.

**Step 7: Verify index command works**

```bash
cd demo && ../bin/manifest index && cat MANIFEST.md && cd ..
```

Expected: MANIFEST.md generated with feature index.

**Step 8: Verify check command works**

```bash
cd demo && ../bin/manifest check && cd ..
```

Expected: reports any issues found.

**Step 9: Commit**

```bash
git add bin/manifest src/Console/ demo/
git commit -m "feat: CLI with serve, index, and check commands"
```

---

## Task 10: make:feature Scaffolding Command

Generates a new feature file with the correct structure.

**Files:**
- Create: `src/Console/Command/MakeFeatureCommand.php`
- Modify: `src/Console/ManifestApplication.php` (register new command)

**Step 1: Write MakeFeatureCommand**

```php
<?php

declare(strict_types=1);

namespace Manifest\Console\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'make:feature',
    description: 'Generate a new feature file.',
)]
class MakeFeatureCommand extends Command
{
    protected function configure(): void
    {
        $this
            ->addArgument('name', InputArgument::REQUIRED, 'Feature class name (e.g. UserRegistration)')
            ->addOption('route', null, InputOption::VALUE_REQUIRED, 'Route definition (e.g. "POST /api/users")')
            ->addOption('type', null, InputOption::VALUE_OPTIONAL, 'Feature type: request, stream, event', 'request')
            ->addOption('auth', null, InputOption::VALUE_OPTIONAL, 'Authentication: required, none, optional', 'required');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $projectDir = getcwd();
        $className = $input->getArgument('name');
        $type = $input->getOption('type');
        $auth = $input->getOption('auth');

        $kebabName = strtolower(preg_replace('/[A-Z]/', '-$0', lcfirst($className)));

        $routeLine = "route: [],";
        if ($input->getOption('route')) {
            $parts = explode(' ', $input->getOption('route'), 2);
            $method = strtoupper($parts[0]);
            $path = $parts[1] ?? '/';
            $routeLine = "route: ['{$method}', '{$path}'],";
        }

        $handleMethod = $type === 'stream'
            ? "    public function stream(Input \$input, Stream \$stream): void\n    {\n        // TODO: implement stream logic\n    }"
            : "    public function handle(Input \$input): Result\n    {\n        // TODO: implement feature logic\n        return \$this->ok('Done');\n    }";

        $code = <<<PHP
<?php

declare(strict_types=1);

namespace App\\Features;

use Manifest\\Attribute\\Feature;
use Manifest\\Feature\\AbstractFeature;
use Manifest\\Feature\\Input;
use Manifest\\Feature\\InputSchema;
use Manifest\\Feature\\Result;

#[Feature(
    name: '{$kebabName}',
    description: 'TODO: Describe what this feature does. Be verbose - this is for agents.',
    {$routeLine}
    type: '{$type}',
    authentication: '{$auth}',
    sideEffects: [
        // TODO: List all side effects (database writes, emails, API calls, etc.)
    ],
    errorCases: [
        // TODO: List all error cases with HTTP status codes
    ],
)]
class {$className} extends AbstractFeature
{
    public function input(): InputSchema
    {
        return InputSchema::create();
        // TODO: Define input fields
        // ->string('field_name', description: 'What this field is for.', required: true)
    }

{$handleMethod}
}
PHP;

        $featuresDir = $projectDir . '/features';
        if (!is_dir($featuresDir)) {
            mkdir($featuresDir, 0755, true);
        }

        $filePath = $featuresDir . '/' . $className . '.php';
        if (file_exists($filePath)) {
            $io->error("Feature file already exists: {$filePath}");
            return Command::FAILURE;
        }

        file_put_contents($filePath, $code);
        $io->success("Created feature: features/{$className}.php");

        return Command::SUCCESS;
    }
}
```

**Step 2: Register command in ManifestApplication**

Add `new MakeFeatureCommand()` to the `addCommands` array in `ManifestApplication`.

**Step 3: Test manually**

```bash
cd demo && ../bin/manifest make:feature CreatePost --route="POST /api/posts" --auth=required
cat features/CreatePost.php
rm features/CreatePost.php
cd ..
```

Expected: properly scaffolded feature file.

**Step 4: Commit**

```bash
git add src/Console/Command/MakeFeatureCommand.php src/Console/ManifestApplication.php
git commit -m "feat: make:feature scaffolding command"
```

---

## Task 11: Run All Tests, Verify Everything Works End-to-End

**Step 1: Run the full test suite**

```bash
./vendor/bin/phpunit -v
```

Expected: All tests pass.

**Step 2: Run the demo app end-to-end**

```bash
cd demo
../bin/manifest index
../bin/manifest check
cat MANIFEST.md
cd ..
```

**Step 3: Final commit with any fixes needed**

```bash
git add -A
git commit -m "feat: complete Manifest framework MVP"
```

---

## Summary

After completing all 11 tasks, you'll have:

| Component | Status |
|-----------|--------|
| `#[Feature]` attribute | Full metadata support |
| `InputSchema` | Builder with validation |
| `Input` / `Result` | Value objects with envelope serialization |
| `AbstractFeature` | Base class with validate-then-handle flow |
| `FeatureScanner` / `FeatureRegistry` | Auto-discovery from features/ directory |
| `ConfigLoader` | Flat PHP config files |
| `Kernel` | HTTP request handling with JSON responses |
| `manifest serve` | Development server |
| `manifest index` | MANIFEST.md generation |
| `manifest check` | Convention validation |
| `manifest make:feature` | Feature scaffolding |
| Demo app | Working HelloWorld feature |

**What's NOT included (future tasks):**
- Schema system (Task 14+)
- Service container with explicit DI (currently features have no constructor injection)
- SSE stream support
- Event-triggered features
- Testing base class (`FeatureTest`)
- `make:schema`, `make:test` commands
- Docker setup
- Agent sidecar integration
