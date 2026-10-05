import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// Load server/.env if present (Node's built-in loader — no dotenv dependency).
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  /** Public origin the browser uses for the app (the Vite dev server in dev). */
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('data/loop.db'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(14),

  OIDC_ISSUER: z.url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(16),
  OIDC_SCOPES: z.string().default('openid profile email'),
  /** Comma-separated: only students from these email domains can sign in. */
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default('unsw.edu.au,ad.unsw.edu.au,student.unsw.edu.au')
    .transform((s) => s.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)),

  // Mock IdP (dev/showcase only)
  MOCK_IDP_PORT: z.coerce.number().default(4001),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid server configuration:\n' + z.prettifyError(parsed.error))
  console.error('\nRun `npm run setup` from the project root to generate server/.env')
  process.exit(1)
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  redirectUri: `${parsed.data.APP_ORIGIN}/api/auth/sso/callback`,
}
