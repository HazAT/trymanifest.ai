import type { FeatureDef } from './feature'
import { readdirSync, existsSync, statSync } from 'fs'
import path from 'path'

export type FeatureRegistry = Record<string, FeatureDef>

export async function scanFeatures(featuresDir: string): Promise<FeatureRegistry> {
  const registry: FeatureRegistry = {}

  let files: string[]
  try {
    files = readdirSync(featuresDir)
  } catch {
    return registry
  }

  const tsFiles = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  for (const file of tsFiles) {
    const fullPath = path.resolve(featuresDir, file)
    try {
      const mod = await import(fullPath)
      const feature = mod.default as FeatureDef | undefined
      if (feature && typeof feature === 'object' && feature.name) {
        registry[feature.name] = feature
      }
    } catch (err) {
      console.error(`[manifest] Failed to load feature from ${file}:`, err)
    }
  }

  return registry
}

export async function scanAllFeatures(projectDir: string): Promise<FeatureRegistry> {
  const registry = await scanFeatures(path.join(projectDir, 'features'))

  const extensionsDir = path.join(projectDir, 'extensions')
  if (!existsSync(extensionsDir)) return registry

  let entries: string[]
  try {
    entries = readdirSync(extensionsDir)
  } catch {
    return registry
  }

  for (const entry of entries) {
    const entryPath = path.join(extensionsDir, entry)
    if (!statSync(entryPath).isDirectory()) continue

    const extFeaturesDir = path.join(entryPath, 'features')
    if (!existsSync(extFeaturesDir)) continue

    const extRegistry = await scanFeatures(extFeaturesDir)
    Object.assign(registry, extRegistry)
  }

  return registry
}
