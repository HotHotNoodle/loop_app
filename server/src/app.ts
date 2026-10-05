import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { authRouter } from './auth/routes.ts'
import { config } from './config.ts'
import { errorHandler, HttpError } from './http.ts'
import { apiRouter } from './routes.ts'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback') // correct client IPs for rate limiting behind Vite / a reverse proxy

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'form-action': ["'self'", config.OIDC_ISSUER],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  )
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())

  // No CORS middleware on purpose: the web app is served from the same origin (Vite proxy in dev,
  // this server in prod), so cross-origin requests are simply refused by the browser.

  const limiter = (limit: number) =>
    rateLimit({ windowMs: 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'rate_limited' } })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api/auth', limiter(config.NODE_ENV === 'test' ? 1000 : 30), authRouter)
  app.use('/api', limiter(300), apiRouter)
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found', 'No such endpoint')))

  // Production: serve the built React app from the same origin.
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url))
  if (config.isProd && existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }))
    app.get('/{*splat}', (_req, res) => res.sendFile(`${webDist}/index.html`))
  }

  app.use(errorHandler)
  return app
}
