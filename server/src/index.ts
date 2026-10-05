import { createApp } from './app.ts'
import { pruneRefreshTokens } from './auth/tokens.ts'
import { config } from './config.ts'
import { db } from './db/db.ts'
import { seed } from './db/seed.ts'

const { count } = db.prepare('SELECT COUNT(*) AS count FROM events').get() as { count: number }
if (count === 0) {
  seed()
  console.log('🌱 Empty database — seeded demo events and students')
}

pruneRefreshTokens()
setInterval(pruneRefreshTokens, 60 * 60_000).unref()

createApp().listen(config.PORT, () => {
  console.log(`🔁 Loop API listening on http://localhost:${config.PORT}`)
  console.log(`   SSO issuer: ${config.OIDC_ISSUER}`)
})
