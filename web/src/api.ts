import type { LoopEvent, Squad, User } from './types'

/**
 * The access token (a short-lived JWT) lives only in memory — never localStorage — so an XSS
 * bug can't exfiltrate a long-lived credential. The refresh token is an httpOnly cookie the
 * browser sends to /api/auth only; JavaScript can't read it.
 */
let accessToken: string | null = null
let refreshing: Promise<User | null> | null = null
let onSignedOut: () => void = () => {}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function onSessionEnded(handler: () => void) {
  onSignedOut = handler
}

/** Single-flight: concurrent callers share one refresh, so a rotating token is never used twice. */
export function refreshSession(): Promise<User | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-Requested-With': 'loop' } })
    .then(async (res) => {
      if (!res.ok) {
        accessToken = null
        return null
      }
      const body = (await res.json()) as { accessToken: string; user: User }
      accessToken = body.accessToken
      return body.user
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })

  let res = await send()
  if (res.status === 401) {
    // Access token expired — silently refresh once and retry.
    const user = await refreshSession()
    if (!user) {
      onSignedOut()
      throw new ApiError(401, 'unauthenticated', 'Your session has ended — please sign in again')
    }
    res = await send()
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const fieldError = body?.details && Object.values(body.details as Record<string, string[]>)[0]?.[0]
    throw new ApiError(res.status, body?.error ?? 'error', fieldError ?? body?.message ?? 'Request failed')
  }
  return body as T
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) })

export const api = {
  me: () => request<User>('/me'),
  updateMe: (patch: Partial<Pick<User, 'name' | 'degree' | 'year' | 'interests' | 'mode'>>) => request<User>('/me', json('PATCH', patch)),
  updateGroup: (patch: { name?: string; lookingFor?: 'group' | 'plusOne' }) => request<User>('/me/group', json('PATCH', patch)),
  addMember: (zid: string) => request<User>('/me/group/members', json('POST', { zid })),
  removeMember: (id: number) => request<User>(`/me/group/members/${id}`, json('DELETE')),

  deck: () => request<{ events: LoopEvent[]; total: number }>('/events/deck'),
  swipe: (eventId: string, direction: 'left' | 'right') =>
    request<{ matched: boolean; squad: Squad | null }>('/swipes', json('POST', { eventId, direction })),
  undo: () => request<{ eventId: string }>('/swipes/undo', json('POST')),

  squads: () => request<Squad[]>('/squads'),
  confirmSquad: (id: number) => request<Squad>(`/squads/${id}/confirm`, json('POST')),
  declineSquad: (id: number) => request<Squad>(`/squads/${id}/decline`, json('POST')),
}

/** Full-page redirect into the university SSO flow (Authorization Code + PKCE, handled server-side). */
export function signIn(opts: { switchAccount?: boolean } = {}) {
  window.location.assign(`/api/auth/sso/login${opts.switchAccount ? '?prompt=login' : ''}`)
}

export async function signOut() {
  const res = await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'loop' } }).catch(() => null)
  accessToken = null
  const body = (await res?.json().catch(() => null)) as { logoutUrl?: string | null } | null
  // Also end the SSO session at the university IdP, then come back to Loop's sign-in screen.
  window.location.assign(body?.logoutUrl ?? '/')
}
