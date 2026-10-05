/**
 * Mock university identity provider — a minimal but spec-shaped OpenID Connect server.
 * It stands in for the real university SSO (e.g. Microsoft Entra ID) during development
 * and demos. Supports: discovery, JWKS, authorization code + PKCE (S256 only), ID tokens
 * signed with RS256, SSO sessions (log in once, one-click thereafter) and RP logout.
 *
 * NOT for production: in-memory state, demo passwords.
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import cookieParser from 'cookie-parser'
import express, { type Request, type Response } from 'express'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { config } from '../config.ts'
import { DEMO_PASSWORD, DIRECTORY, type DirectoryEntry } from './directory.ts'
import { accountChooserPage, errorPage, loginPage, type AuthParams } from './views.ts'

const ISSUER = config.OIDC_ISSUER.replace(/\/$/, '')
const KID = randomUUID()
const { privateKey, publicKey } = await generateKeyPair('RS256')
const publicJwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' }

// The one registered client: Loop.
const CLIENT = { id: config.OIDC_CLIENT_ID, secret: config.OIDC_CLIENT_SECRET, redirectUri: config.redirectUri }

interface PendingCode extends AuthParams {
  sub: string
  expires: number
  authTime: number
}
const codes = new Map<string, PendingCode>()
const sessions = new Map<string, { sub: string; authTime: number }>()
const SESSION_COOKIE = 'idp_session'

const app = express()
app.disable('x-powered-by')
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  res.set('X-Frame-Options', 'DENY')
  next()
})

const b64url = (b: Buffer) => b.toString('base64url')
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const findUser = (login: string) =>
  DIRECTORY.find((u) => u.zid === login.trim().toLowerCase() || u.email === login.trim().toLowerCase())

app.get('/.well-known/openid-configuration', (_req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
    end_session_endpoint: `${ISSUER}/logout`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: ['sub', 'email', 'name', 'given_name', 'family_name', 'nonce'],
  })
})

app.get('/jwks', (_req, res) => {
  res.json({ keys: [publicJwk] })
})

/** Validates the authorization request. Errors before redirect_uri is trusted are shown, never redirected. */
function readAuthParams(src: Record<string, unknown>): AuthParams | string {
  const p = Object.fromEntries(
    ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method', 'prompt'].map(
      (k) => [k, typeof src[k] === 'string' ? (src[k] as string) : ''],
    ),
  ) as unknown as AuthParams
  if (p.client_id !== CLIENT.id) return 'Unknown application (client_id).'
  if (p.redirect_uri !== CLIENT.redirectUri) return 'redirect_uri is not registered for this application.'
  if (p.response_type !== 'code') return 'Only response_type=code is supported.'
  if (!p.scope.split(' ').includes('openid')) return 'The openid scope is required.'
  if (!p.state || !p.nonce) return 'state and nonce are required.'
  if (p.code_challenge_method !== 'S256' || p.code_challenge.length < 43) return 'PKCE with S256 is required.'
  return p
}

function issueCode(res: Response, p: AuthParams, user: DirectoryEntry, authTime: number) {
  const code = b64url(randomBytes(32))
  codes.set(code, { ...p, sub: user.sub, expires: Date.now() + 60_000, authTime })
  const to = new URL(p.redirect_uri)
  to.searchParams.set('code', code)
  to.searchParams.set('state', p.state)
  res.redirect(to.toString())
}

function currentSession(req: Request) {
  const sid = req.cookies?.[SESSION_COOKIE]
  const session = sid ? sessions.get(sid) : undefined
  const user = session && DIRECTORY.find((u) => u.sub === session.sub)
  return session && user ? { ...session, user } : null
}

app.get('/authorize', (req, res) => {
  const p = readAuthParams(req.query)
  if (typeof p === 'string') return void res.status(400).send(errorPage(p))

  const session = currentSession(req)
  if (session && p.prompt !== 'login') return void res.send(accountChooserPage(p, session.user))
  res.send(loginPage(p))
})

app.post('/authorize', (req, res) => {
  const p = readAuthParams(req.body)
  if (typeof p === 'string') return void res.status(400).send(errorPage(p))

  if (req.body.action === 'cancel') {
    const to = new URL(p.redirect_uri)
    to.searchParams.set('error', 'access_denied')
    to.searchParams.set('state', p.state)
    return void res.redirect(to.toString())
  }

  if (req.body.action === 'continue') {
    const session = currentSession(req)
    if (!session) return void res.send(loginPage(p))
    return issueCode(res, p, session.user, session.authTime)
  }

  const user = findUser(String(req.body.login ?? ''))
  const password = String(req.body.password ?? '')
  if (!user || !safeEqual(password, DEMO_PASSWORD)) {
    return void res.status(401).send(loginPage(p, 'Incorrect zID or password.'))
  }

  const sid = b64url(randomBytes(24))
  const authTime = Math.floor(Date.now() / 1000)
  sessions.set(sid, { sub: user.sub, authTime })
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 3600_000 })
  issueCode(res, p, user, authTime)
})

app.post('/token', express.urlencoded({ extended: false }), async (req, res) => {
  const fail = (status: number, error: string, description: string) =>
    void res.status(status).json({ error, error_description: description })

  // Client authentication: client_secret_post or client_secret_basic.
  let { client_id: clientId, client_secret: clientSecret } = req.body as Record<string, string>
  const basic = req.get('authorization')
  if (basic?.startsWith('Basic ')) {
    ;[clientId, clientSecret] = Buffer.from(basic.slice(6), 'base64').toString().split(':').map(decodeURIComponent)
  }
  if (clientId !== CLIENT.id || !clientSecret || !safeEqual(clientSecret, CLIENT.secret)) {
    return fail(401, 'invalid_client', 'Client authentication failed')
  }

  const { grant_type, code, redirect_uri, code_verifier } = req.body as Record<string, string>
  if (grant_type !== 'authorization_code') return fail(400, 'unsupported_grant_type', 'Only authorization_code')

  const pending = codes.get(code)
  codes.delete(code) // single use, even on failure
  if (!pending || pending.expires < Date.now()) return fail(400, 'invalid_grant', 'Code is invalid or expired')
  if (pending.client_id !== clientId || pending.redirect_uri !== redirect_uri) return fail(400, 'invalid_grant', 'Code was not issued for this client/redirect')

  const challenge = b64url(createHash('sha256').update(code_verifier ?? '').digest())
  if (!safeEqual(challenge, pending.code_challenge)) return fail(400, 'invalid_grant', 'PKCE verification failed')

  const user = DIRECTORY.find((u) => u.sub === pending.sub)!
  const [given, ...family] = user.name.split(' ')
  const idToken = await new SignJWT({
    email: user.email,
    email_verified: true,
    name: user.name,
    given_name: given,
    family_name: family.join(' '),
    nonce: pending.nonce,
    auth_time: pending.authTime,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(CLIENT.id)
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

  res.json({ token_type: 'Bearer', access_token: b64url(randomBytes(32)), expires_in: 300, id_token: idToken, scope: pending.scope })
})

app.get('/logout', (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE]
  if (sid) sessions.delete(sid)
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  const back = req.query.post_logout_redirect_uri
  // Only redirect to the registered app origin — never an arbitrary URL.
  if (back === config.APP_ORIGIN) return void res.redirect(back)
  res.send(errorPage('You have been signed out of Campus SSO.', 'Signed out'))
})

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of codes) if (v.expires < now) codes.delete(k)
}, 60_000).unref()

app.listen(config.MOCK_IDP_PORT, () => {
  console.log(`🎓 Mock Campus SSO (OIDC) on ${ISSUER}  ·  demo password: ${DEMO_PASSWORD}`)
})
