/**
 * Output an agent prompt for creating a new feature.
 *
 * Usage: bun manifest make:feature UserRegistration [--route="POST /api/users"] [--auth=none]
 *
 * Does NOT write any files. Instead, prints a structured prompt that tells an
 * agent exactly what file to create, the full template, and what to fill in.
 */

export async function makeFeature(args: string[]): Promise<void> {
  const className = args[0]

  if (!className) {
    console.error('  Usage: bun manifest make:feature <ClassName> [--route="METHOD /path"] [--auth=none|required]')
    process.exit(1)
  }

  let route = ''
  let auth = 'required'

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--route=')) route = arg.slice(8).replace(/"/g, '')
    if (arg.startsWith('--auth=')) auth = arg.slice(7)
  }

  const kebabName = className
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()

  let routeLine = `route: ['GET', '/api/${kebabName}'],`
  if (route) {
    const [method, ...pathParts] = route.split(' ')
    routeLine = `route: ['${method!.toUpperCase()}', '${pathParts.join(' ')}'],`
  }

  const prompt = `You are creating a new feature called '${kebabName}'.

Create the file \`features/${className}.ts\` with the following template:

\`\`\`typescript
// features/${className}.ts
import { defineFeature, t } from '../manifest'

export default defineFeature({
  name: '${kebabName}',
  description: \\\`[FILL IN: 2-3 sentences explaining what this feature does, why it exists,
                and any important context. Write for an agent reading this cold.]\\\`,
  ${routeLine}
  authentication: '${auth}',
  sideEffects: [
    // [FILL IN: List ALL side effects — database writes, emails sent, API calls made, etc.]
  ],
  errorCases: [
    // [FILL IN: List ALL error cases with HTTP status codes, e.g. '409 - Email already registered']
  ],

  input: {
    // [FILL IN: Define input fields using t.string(), t.integer(), etc.]
    // Every field MUST have a description explaining what it is and why it exists.
    // Example:
    // email: t.string({ description: 'User email address for account creation.', required: true }),
  },

  async handle({ input, ok, fail }) {
    // [FILL IN: Implement the feature logic. Keep it linear — no hidden branches.]
    return ok('${className} executed')
  },
})
\`\`\`

## What you need to fill in

1. **description** — 2-3 sentences. Explain what this feature does, why it exists, and any important context. Write for an agent that has never seen this codebase.
2. **input fields** — Define every input field with \`t.string()\`, \`t.integer()\`, etc. Every field must have a \`description\`.
3. **sideEffects** — List every side effect: database writes, emails, external API calls. Can be empty array if pure.
4. **errorCases** — List every error case with HTTP status code, e.g. \`'422 - Validation failed'\`.
5. **handle() logic** — Implement the business logic. Use \`ok()\` for success, \`fail()\` for errors.

## After creation

- Run \`bun manifest check\` to validate the feature follows conventions.
- Create a matching test file at \`tests/${className}.test.ts\` using \`createTestClient\` from \`../manifest/testing\`.`

  console.log(prompt)
}
