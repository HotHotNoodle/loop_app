import type { NextFunction, Request, Response } from 'express'
import { db } from '../db/db.ts'
import { HttpError } from '../http.ts'
import { verifyAccessToken } from './tokens.ts'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: number
    }
  }
}

/** Requires a valid `Authorization: Bearer <access JWT>` and a user that still exists. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer realm="loop"')
    return next(new HttpError(401, 'unauthenticated', 'Missing bearer token'))
  }

  try {
    const claims = await verifyAccessToken(token)
    const userId = Number(claims.sub)
    const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)
    if (!exists) throw new Error('user no longer exists')
    req.userId = userId
    next()
  } catch {
    res.set('WWW-Authenticate', 'Bearer realm="loop", error="invalid_token"')
    next(new HttpError(401, 'invalid_token', 'Access token is invalid or expired'))
  }
}

/**
 * CSRF defence for the cookie-authenticated endpoints (refresh/logout). Browsers can't send
 * a custom header cross-site without a CORS preflight, which this API never approves.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.get('x-requested-with') !== 'loop') {
    return next(new HttpError(403, 'csrf', 'Missing X-Requested-With header'))
  }
  next()
}
