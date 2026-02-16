/**
 * Static page builder with include support.
 *
 * Reads page templates from frontend/site/pages/,
 * replaces <!-- include: filename --> with content from frontend/site/includes/,
 * and writes output to the locations the frontend build expects:
 *   - index.html        → frontend/index.html (root page)
 *   - philosophy.html   → frontend/public/philosophy/index.html
 *   - [name].html       → frontend/public/[name]/index.html
 */

import fs from 'fs'
import path from 'path'

const siteDir = path.resolve(import.meta.dir)
const pagesDir = path.join(siteDir, 'pages')
const includesDir = path.join(siteDir, 'includes')
const frontendDir = path.resolve(siteDir, '..')

function processIncludes(html: string): string {
  return html.replace(/<!--\s*include:\s*(.+?)\s*-->/g, (_match, filename) => {
    const includePath = path.join(includesDir, filename.trim())
    if (!fs.existsSync(includePath)) {
      console.error(`  ✗ Include not found: ${filename}`)
      return `<!-- ERROR: include "${filename}" not found -->`
    }
    return fs.readFileSync(includePath, 'utf-8')
  })
}

const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'))

console.log(`[site] Building ${pages.length} page(s)...`)

for (const page of pages) {
  const source = fs.readFileSync(path.join(pagesDir, page), 'utf-8')
  const output = processIncludes(source)
  const name = page.replace('.html', '')

  let outPath: string
  if (name === 'index') {
    outPath = path.join(frontendDir, 'index.html')
  } else {
    const dir = path.join(frontendDir, 'public', name)
    fs.mkdirSync(dir, { recursive: true })
    outPath = path.join(dir, 'index.html')
  }

  fs.writeFileSync(outPath, output)
  const rel = path.relative(path.resolve(siteDir, '../..'), outPath)
  console.log(`  ${rel}`)
}

console.log('[site] Done.')
