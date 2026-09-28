import { cp, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const standalone = join(root, '.next', 'standalone')

if (!existsSync(join(standalone, 'server.js'))) {
  throw new Error('Production build is missing. Run npm run build before npm run start.')
}

for (const source of [join(root, 'public'), join(root, '.next', 'static')]) {
  if (!existsSync(source)) continue
  const destination = source.endsWith('public')
    ? join(standalone, 'public')
    : join(standalone, '.next', 'static')
  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
}

process.env.NODE_ENV = 'production'
await import(pathToFileURL(join(standalone, 'server.js')).href)
