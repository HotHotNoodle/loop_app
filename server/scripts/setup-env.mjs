// Creates server/.env with freshly generated secrets (never overwrites an existing one).
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url))

if (existsSync(envPath)) {
  console.log('server/.env already exists — leaving it alone.')
  process.exit(0)
}

const secret = () => randomBytes(32).toString('base64url')
const env = readFileSync(examplePath, 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
  .replace(/^OIDC_CLIENT_SECRET=.*$/m, `OIDC_CLIENT_SECRET=${secret()}`)

writeFileSync(envPath, env, { mode: 0o600 })
console.log('✅ Wrote server/.env with random secrets.')
