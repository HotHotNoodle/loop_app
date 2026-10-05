import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, EncryptJWT, jwtDecrypt, jwtVerify, type JWTPayload } from 'jose'
import { config } from '../config.ts'

/**
 * A small, standards-only OpenID Connect client (Authorization Code flow + PKCE).
 * Works with the bundled mock IdP and with real providers such as Microsoft Entra ID,
 * which is what most Australian universities (including UNSW) use for student SSO.
 */

interface Discovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  end_session_endpoint?: string
}

let discovery: Promise<Discovery> | null = null
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export function getDiscovery(): Promise<Discovery> {
  discovery ??= (async () => {
    const url = `${config.OIDC_ISSUER.replace(/\/$/, '')}/.well-known/openid-configuration`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`OIDC discovery failed (${res.status}) at ${url}`)
    const doc = (await res.json()) as Discovery
    if (doc.issuer.replace(/\/$/, '') !== config.OIDC_ISSUER.replace(/\/$/, '')) {
      throw new Error(`OIDC issuer mismatch: expected ${config.OIDC_ISSUER}, got ${doc.issuer}`)
    }
    jwks = createRemoteJWKSet(new URL(doc.jwks_uri))
    return doc
  })().catch((err) => {
    discovery = null // allow retry once the IdP is reachable
    throw err
  })
  return discovery
}

const b64url = (buf: Buffer) => buf.toString('base64url')
export const randomToken = () => b64url(randomBytes(32))
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest())

export async function buildAuthorizationUrl(p: { state: string; nonce: string; verifier: string; prompt?: string }) {
  const d = await getDiscovery()
  const url = new URL(d.authorization_endpoint)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.OIDC_CLIENT_ID,
    redirect_uri: config.redirectUri,
    scope: config.OIDC_SCOPES,
    state: p.state,
    nonce: p.nonce,
    code_challenge: pkceChallenge(p.verifier),
    code_challenge_method: 'S256',
    ...(p.prompt ? { prompt: p.prompt } : {}),
  }).toString()
  return url.toString()
}

export interface StudentIdentity {
  sub: string
  email: string
  name: string
}

/** Back-channel: swap the one-time code for tokens, then verify the ID token's signature and claims. */
export async function exchangeCode(code: string, verifier: string, expectedNonce: string): Promise<StudentIdentity> {
  const d = await getDiscovery()
  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.OIDC_CLIENT_ID,
      client_secret: config.OIDC_CLIENT_SECRET,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`)
  const { id_token } = (await res.json()) as { id_token?: string }
  if (!id_token) throw new Error('Token response had no id_token')

  const { payload } = await jwtVerify(id_token, jwks!, {
    issuer: d.issuer,
    audience: config.OIDC_CLIENT_ID,
    algorithms: ['RS256'],
    maxTokenAge: '10m',
  })
  if (payload.nonce !== expectedNonce) throw new Error('ID token nonce mismatch')

  // Entra puts the UPN in preferred_username when `email` isn't released.
  const email = String(payload.email ?? payload.preferred_username ?? '').toLowerCase()
  if (!payload.sub || !email) throw new Error('ID token is missing sub/email')
  return { sub: payload.sub, email, name: String(payload.name ?? email.split('@')[0]) }
}

export function isAllowedStudentEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && config.ALLOWED_EMAIL_DOMAINS.includes(domain)
}

// ---------------------------------------------------------------------------
// The in-flight login (state, nonce, PKCE verifier) lives in an *encrypted*,
// httpOnly, 10-minute cookie — so the server stays stateless and the browser
// can't read or tamper with it.
// ---------------------------------------------------------------------------

const txKey = createHash('sha256').update(`${config.JWT_SECRET}:oidc-tx`).digest()

export interface LoginTransaction extends JWTPayload {
  state: string
  nonce: string
  verifier: string
  returnTo: string
}

export const sealTransaction = (t: Omit<LoginTransaction, keyof JWTPayload>) =>
  new EncryptJWT({ ...t }).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setIssuedAt().setExpirationTime('10m').encrypt(txKey)

export async function openTransaction(sealed: string) {
  const { payload } = await jwtDecrypt(sealed, txKey)
  return payload as LoginTransaction
}
