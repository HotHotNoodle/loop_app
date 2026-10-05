import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'
import { config } from '../config.ts'
import { db, tx } from '../db/db.ts'

const accessKey = new TextEncoder().encode(config.JWT_SECRET)
const ISSUER = 'loop-api'
const AUDIENCE = 'loop-web'

export interface AccessClaims {
  sub: string
  email: string
  name: string
}

/** Short-lived JWT the web app keeps in memory and sends as `Authorization: Bearer`. */
export async function signAccessToken(user: { id: number; email: string; name: string }) {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(config.ACCESS_TOKEN_TTL)
    .sign(accessKey)
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'], // pin the algorithm: never accept `none` or an attacker-chosen alg
  })
  return payload as unknown as AccessClaims
}

// ---------------------------------------------------------------------------
// Refresh tokens: opaque random strings, stored only as SHA-256 hashes.
// ---------------------------------------------------------------------------

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export function issueRefreshToken(userId: number, family: string = randomUUID()) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString()
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at) VALUES (?, ?, ?, ?)').run(
    userId,
    hash(token),
    family,
    expiresAt,
  )
  return { token, expiresAt }
}

export type RotateResult =
  | { ok: true; userId: number; token: string; expiresAt: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' }

/**
 * Exchanges a refresh token for a new one (rotation). If a token that was already rotated
 * is presented again, someone else has a copy — revoke the whole family to log both out.
 */
export function rotateRefreshToken(token: string): RotateResult {
  return tx(() => {
    const row = db
      .prepare('SELECT id, user_id, family, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?')
      .get(hash(token)) as { id: number; user_id: number; family: string; expires_at: string; revoked_at: string | null } | undefined

    if (!row) return { ok: false, reason: 'unknown' } as const
    if (row.revoked_at) {
      revokeFamily(row.family)
      return { ok: false, reason: 'reused' } as const
    }
    if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' } as const

    db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?").run(row.id)
    const next = issueRefreshToken(row.user_id, row.family)
    return { ok: true, userId: row.user_id, ...next } as const
  })
}

export function revokeRefreshToken(token: string) {
  const row = db.prepare('SELECT family FROM refresh_tokens WHERE token_hash = ?').get(hash(token)) as { family: string } | undefined
  if (row) revokeFamily(row.family)
}

function revokeFamily(family: string) {
  db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family = ? AND revoked_at IS NULL").run(family)
}

/** Housekeeping: drop tokens that expired more than a day ago. */
export function pruneRefreshTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now', '-1 day')").run()
}
