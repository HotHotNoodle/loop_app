import { timingSafeEqual } from 'node:crypto'
import { Router, type CookieOptions, type Response } from 'express'
import { config } from '../config.ts'
import { db } from '../db/db.ts'
import { HttpError } from '../http.ts'
import { loadUser } from '../services/users.ts'
import { requireCsrfHeader } from './middleware.ts'
import {
  buildAuthorizationUrl,
  exchangeCode,
  getDiscovery,
  isAllowedStudentEmail,
  openTransaction,
  randomToken,
  sealTransaction,
} from './oidc.ts'
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from './tokens.ts'

export const authRouter = Router()

const REFRESH_COOKIE = 'loop_rt'
const TX_COOKIE = 'loop_oidc'

const refreshCookie = (expires: Date): CookieOptions => ({
  httpOnly: true, // JavaScript can never read it → XSS can't steal the long-lived token
  secure: config.isProd,
  sameSite: 'strict',
  path: '/api/auth', // only sent to the auth endpoints, not every API call
  expires,
})

const txCookie: CookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax', // must survive the top-level redirect back from the IdP
  path: '/api/auth/sso',
  maxAge: 10 * 60_000,
}

/** Only allow same-app relative paths, never `//evil.com` or absolute URLs (open-redirect). */
const safeReturnTo = (v: unknown) => (typeof v === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) ? v : '/')

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

function failLogin(res: Response, code: string) {
  res.clearCookie(TX_COOKIE, { ...txCookie, maxAge: undefined })
  res.redirect(`${config.APP_ORIGIN}/?auth_error=${encodeURIComponent(code)}`)
}

// Step 1 — browser hits this, we redirect to the university IdP.
authRouter.get('/sso/login', async (req, res, next) => {
  try {
    const state = randomToken()
    const nonce = randomToken()
    const verifier = randomToken()
    const sealed = await sealTransaction({ state, nonce, verifier, returnTo: safeReturnTo(req.query.returnTo) })
    const prompt = req.query.prompt === 'login' ? 'login' : undefined

    res.cookie(TX_COOKIE, sealed, txCookie)
    res.redirect(await buildAuthorizationUrl({ state, nonce, verifier, prompt }))
  } catch (err) {
    console.error('[sso] could not start login:', (err as Error).message)
    failLogin(res, 'idp_unreachable')
  }
})

// Step 2 — the IdP redirects back here with ?code&state.
authRouter.get('/sso/callback', async (req, res) => {
  const { code, state, error } = req.query
  if (typeof error === 'string') return failLogin(res, error === 'access_denied' ? 'cancelled' : 'idp_error')
  if (typeof code !== 'string' || typeof state !== 'string') return failLogin(res, 'bad_callback')

  let login
  try {
    login = await openTransaction(req.cookies?.[TX_COOKIE] ?? '')
  } catch {
    return failLogin(res, 'session_expired')
  }
  if (!safeEqual(state, login.state)) return failLogin(res, 'state_mismatch')

  let identity
  try {
    identity = await exchangeCode(code, login.verifier, login.nonce)
  } catch (err) {
    console.error('[sso] code exchange failed:', (err as Error).message)
    return failLogin(res, 'token_invalid')
  }

  if (!isAllowedStudentEmail(identity.email)) return failLogin(res, 'not_a_student')

  const userId = upsertStudent(identity)
  const { token, expiresAt } = issueRefreshToken(userId)

  res.clearCookie(TX_COOKIE, { ...txCookie, maxAge: undefined })
  res.cookie(REFRESH_COOKIE, token, refreshCookie(new Date(expiresAt)))
  res.redirect(`${config.APP_ORIGIN}${login.returnTo}`)
})

function upsertStudent({ sub, email, name }: { sub: string; email: string; name: string }): number {
  const zid = /^(z\d{7})@/i.exec(email)?.[1]?.toLowerCase() ?? null
  const existing = db.prepare('SELECT id FROM users WHERE sso_sub = ?').get(sub) as { id: number } | undefined
  if (existing) {
    db.prepare("UPDATE users SET email = ?, last_login_at = datetime('now') WHERE id = ?").run(email, existing.id)
    return existing.id
  }
  const result = db
    .prepare("INSERT INTO users (sso_sub, email, zid, name, last_login_at) VALUES (?, ?, ?, ?, datetime('now'))")
    .run(sub, email, zid, name)
  return Number(result.lastInsertRowid)
}

// Step 3 — the SPA calls this on load (and when its access token expires).
authRouter.post('/refresh', requireCsrfHeader, async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE]
  if (!presented) throw new HttpError(401, 'no_session', 'Not signed in')

  const result = rotateRefreshToken(presented)
  if (!result.ok) {
    res.clearCookie(REFRESH_COOKIE, refreshCookie(new Date(0)))
    if (result.reason === 'reused') console.warn('[auth] refresh token reuse detected — session family revoked')
    throw new HttpError(401, result.reason === 'reused' ? 'session_revoked' : 'session_expired', 'Please sign in again')
  }

  const user = loadUser(result.userId)
  res.cookie(REFRESH_COOKIE, result.token, refreshCookie(new Date(result.expiresAt)))
  res.json({
    accessToken: await signAccessToken(user),
    tokenType: 'Bearer',
    user,
  })
})

authRouter.post('/logout', requireCsrfHeader, async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE]
  if (presented) revokeRefreshToken(presented)
  res.clearCookie(REFRESH_COOKIE, refreshCookie(new Date(0)))

  // Single sign-OUT: also end the session at the IdP so the next login asks again.
  let logoutUrl: string | null = null
  try {
    const d = await getDiscovery()
    if (d.end_session_endpoint) {
      const u = new URL(d.end_session_endpoint)
      u.searchParams.set('client_id', config.OIDC_CLIENT_ID)
      u.searchParams.set('post_logout_redirect_uri', config.APP_ORIGIN)
      logoutUrl = u.toString()
    }
  } catch {
    /* IdP down — local logout still succeeded */
  }
  res.json({ ok: true, logoutUrl })
})
