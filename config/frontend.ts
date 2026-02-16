/**
 * Frontend build and serving configuration.
 * Flat, typed, no nesting. Every value is visible and greppable.
 */
export default {
  entryPoint: 'frontend/index.ts',
  outputDir: 'dist',
  sourceMaps: true,
  spaFallback: true,
  devReload: true,
  // Set to false if your project generates its own HTML (e.g., blog build script)
  copyHtml: true,
}
