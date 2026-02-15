# What is Manifest?

Manifest is a TypeScript/Bun web framework built for AI agents to read, write, and fix code — not just run it.

Most frameworks scatter a single behavior across many files: routes, controllers, validators, middleware, services. Understanding what happens when someone hits an endpoint requires knowing the framework's internals and chasing through a dozen conventions. This works for humans who've memorized the framework. It doesn't work for agents.

Manifest puts everything in one file. A feature declares its route, inputs, side effects, error cases, and business logic in a single `defineFeature()` call. No decorators, no middleware chains, no auto-discovery. An agent reads one file and understands one complete behavior.

The framework itself ships as ~1,000 lines of TypeScript source code inside your project — not as an npm package. When an agent needs to understand how routing works, it reads `manifest/router.ts` (76 lines). When it needs a new validation rule, it edits `manifest/validator.ts`. There's no black box.

It runs on Bun with `--hot`, so when code changes, the server reloads the module instantly. No build step, no restart. This makes the self-healing loop possible: an error fires, the agent reads the feature file, fixes the bug, and the next request uses the new code.

The interesting side effect is that optimizing for agent comprehension produces code that's unusually easy for humans to work with too. Explicit dependencies, small files, declared side effects, linear execution — these are things good engineering has always valued. Manifest just makes them structural.
