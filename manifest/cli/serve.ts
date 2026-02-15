/**
 * Start the Manifest development server.
 * Usage: bun manifest serve [--port=8080] [--host=0.0.0.0]
 */

import { createManifestServer } from '../server'

export async function serve(args: string[]): Promise<void> {
  const projectDir = process.cwd()
  let port = 8080
  let host = '0.0.0.0'

  for (const arg of args) {
    if (arg.startsWith('--port=')) {
      port = parseInt(arg.slice(7), 10)
    }
    if (arg.startsWith('--host=')) {
      host = arg.slice(7)
    }
  }

  const server = await createManifestServer({
    projectDir,
    port,
  })

  console.log(``)
  console.log(`  Manifest server running on http://${host}:${server.port}`)
  console.log(`  Production is our dev environment.`)
  console.log(``)
  console.log(`  Tip: Run with 'bun --hot' for live reload:`)
  console.log(`    bun --hot manifest/cli/index.ts serve`)
  console.log(``)
}
