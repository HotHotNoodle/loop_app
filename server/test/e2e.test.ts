/**
 * End-to-end tests: boots the real mock IdP + API as child processes against a temp database,
 * then drives the full browser SSO redirect dance with fetch (redirect: 'manual').
 */
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

const API_PORT = 4600 + Math.floor(Math.random() * 300)
const IDP_PORT = API_PORT + 1000
const API = `http://localhost:${API_PORT}`
const IDP = `http://localhost:${IDP_PORT}`
const tmp = mkdtempSync(join(tmpdir(), 'loop-e2e-'))

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(API_PORT),
  APP_ORIGIN: API, // no Vite in tests: the IdP redirects straight back to the API
  DATABASE_PATH: join(tmp, 'test.db'),
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  OIDC_ISSUER: IDP,
  OIDC_CLIENT_ID: 'loop-web',
  OIDC_CLIENT_SECRET: 'test-client-secret-1234',
  MOCK_IDP_PORT: String(IDP_PORT),
}

const procs: ChildProcess[] = []
async function startProcess(script: string, url: string) {
  const p = spawn(process.execPath, ['--import', 'tsx', script], { cwd: new URL('..', import.meta.url), env, stdio: 'pipe' })
  procs.push(p)
  let log = ''
  p.stdout!.on('data', (d) => (log += d))
  p.stderr!.on('data', (d) => (log += d))
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error(`${script} did not start:\n${log}`)
}

before(async () => {
  await startProcess('src/mock-idp/server.ts', `${IDP}/jwks`)
  await startProcess('src/index.ts', `${API}/api/health`)
})
after(() => {
  procs.forEach((p) => p.kill())
  rmSync(tmp, { recursive: true, force: true })
})

// --- A tiny cookie-aware "browser" -------------------------------------------

class Browser {
  jar = new Map<string, Map<string, string>>() // host -> name -> value

  async go(url: string, init: RequestInit = {}) {
    const u = new URL(url)
    const cookies = [...(this.jar.get(u.host) ?? new Map())].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await fetch(url, { ...init, redirect: 'manual', headers: { ...(init.headers as object), ...(cookies ? { cookie: cookies } : {}) } })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [name, ...rest] = pair.split('=')
      const host = this.jar.get(u.host) ?? new Map()
      const value = rest.join('=')
      if (!value || /expires=Thu, 01 Jan 1970/i.test(c)) host.delete(name)
      else host.set(name, value)
      this.jar.set(u.host, host)
    }
    return res
  }

  cookie(url: string, name: string) {
    return this.jar.get(new URL(url).host)?.get(name)
  }
}

/** Runs the full SSO flow and returns the browser plus where the callback finally redirected. */
async function ssoLogin(login: string, password = 'loop-demo', b = new Browser()) {
  const start = await b.go(`${API}/api/auth/sso/login`)
  assert.equal(start.status, 302)
  const authorizeUrl = new URL(start.headers.get('location')!)
  assert.equal(authorizeUrl.origin, IDP)

  const form = new URLSearchParams(authorizeUrl.searchParams)
  form.set('login', login)
  form.set('password', password)
  form.set('action', 'login')
  const submitted = await b.go(`${IDP}/authorize`, { method: 'POST', body: form })
  if (submitted.status !== 302) return { b, landed: null, callbackUrl: null, status: submitted.status }

  const callbackUrl = submitted.headers.get('location')!
  const cb = await b.go(callbackUrl)
  return { b, landed: cb.headers.get('location'), callbackUrl, status: cb.status }
}

async function refresh(b: Browser) {
  return b.go(`${API}/api/auth/refresh`, { method: 'POST', headers: { 'x-requested-with': 'loop' } })
}

async function signIn(zid: string) {
  const { b } = await ssoLogin(zid)
  const res = await refresh(b)
  assert.equal(res.status, 200)
  const { accessToken } = (await res.json()) as { accessToken: string }
  const api = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API}/api${path}`, {
      ...init,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(init.headers as object) },
    })
    return { status: r.status, body: (await r.json()) as any }
  }
  return { b, accessToken, api }
}

// --- Auth & security ---------------------------------------------------------

describe('SSO + JWT auth', () => {
  test('API rejects requests without a token', async () => {
    const res = await fetch(`${API}/api/me`)
    assert.equal(res.status, 401)
    assert.match(res.headers.get('www-authenticate')!, /Bearer/)
  })

  test('login redirect uses PKCE S256, state and nonce', async () => {
    const res = await new Browser().go(`${API}/api/auth/sso/login`)
    const q = new URL(res.headers.get('location')!).searchParams
    assert.equal(q.get('code_challenge_method'), 'S256')
    assert.ok(q.get('code_challenge')!.length >= 43)
    assert.ok(q.get('state') && q.get('nonce'))
    assert.match(res.headers.get('set-cookie')!, /loop_oidc=.*HttpOnly/i)
  })

  test('full SSO login issues an httpOnly refresh cookie and a working access JWT', async () => {
    const { b, landed } = await ssoLogin('z5300001')
    assert.equal(landed, `${API}/`)
    assert.ok(b.cookie(API, 'loop_rt'))

    const res = await refresh(b)
    const body = (await res.json()) as any
    assert.equal(body.user.name, 'Maya Chen')
    assert.equal(body.user.zid, 'z5300001')
    assert.equal(body.accessToken.split('.').length, 3)

    const me = await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${body.accessToken}` } })
    assert.equal(me.status, 200)
  })

  test('wrong password is rejected by the IdP', async () => {
    const { status } = await ssoLogin('z5300001', 'nope')
    assert.equal(status, 401)
  })

  test('students from other universities are refused', async () => {
    const { landed, b } = await ssoLogin('jpar1234')
    assert.equal(landed, `${API}/?auth_error=not_a_student`)
    assert.equal(b.cookie(API, 'loop_rt'), undefined)
  })

  test('a tampered state is rejected', async () => {
    const b = new Browser()
    const { callbackUrl } = await ssoLogin('z5300002', 'loop-demo', b)
    const bad = new URL(callbackUrl!)
    bad.searchParams.set('state', 'attacker-state')
    // fresh login transaction so the cookie is valid but the state differs
    await b.go(`${API}/api/auth/sso/login`)
    const res = await b.go(bad.toString())
    assert.equal(res.headers.get('location'), `${API}/?auth_error=state_mismatch`)
  })

  test('authorization codes are single-use', async () => {
    const b = new Browser()
    const start = await b.go(`${API}/api/auth/sso/login`)
    const form = new URLSearchParams(new URL(start.headers.get('location')!).searchParams)
    form.set('login', 'z5300003')
    form.set('password', 'loop-demo')
    const submitted = await b.go(`${IDP}/authorize`, { method: 'POST', body: form })
    const callback = submitted.headers.get('location')!
    const txCookie = b.cookie(API, 'loop_oidc')!

    const first = await b.go(callback)
    assert.equal(first.headers.get('location'), `${API}/`)

    const replay = await fetch(callback, { redirect: 'manual', headers: { cookie: `loop_oidc=${txCookie}` } })
    assert.equal(replay.headers.get('location'), `${API}/?auth_error=token_invalid`)
  })

  test('refresh requires the CSRF header', async () => {
    const { b } = await ssoLogin('z5300001')
    const res = await b.go(`${API}/api/auth/refresh`, { method: 'POST' })
    assert.equal(res.status, 403)
  })

  test('refresh tokens rotate, and replaying an old one revokes the whole session', async () => {
    const { b } = await ssoLogin('z5300001')
    const original = b.cookie(API, 'loop_rt')!
    assert.equal((await refresh(b)).status, 200)
    const rotated = b.cookie(API, 'loop_rt')!
    assert.notEqual(original, rotated)

    // An attacker replays the stolen original token...
    const replay = await fetch(`${API}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `loop_rt=${original}`, 'x-requested-with': 'loop' },
    })
    assert.equal(replay.status, 401)
    assert.equal(((await replay.json()) as any).error, 'session_revoked')

    // ...which also kills the legitimate user's current token.
    assert.equal((await refresh(b)).status, 401)
  })

  test('forged or tampered access tokens are rejected', async () => {
    const { accessToken } = await signIn('z5300001')
    const [h, p] = accessToken.split('.')
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`
    const evilPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: '1' })).toString('base64url')
    for (const token of [none, `${h}.${evilPayload}.${accessToken.split('.')[2]}`, 'garbage']) {
      const res = await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      assert.equal(res.status, 401, token)
    }
  })

  test('logout revokes the session and returns the IdP end-session URL', async () => {
    const { b } = await ssoLogin('z5300001')
    const res = await b.go(`${API}/api/auth/logout`, { method: 'POST', headers: { 'x-requested-with': 'loop' } })
    const body = (await res.json()) as any
    assert.match(body.logoutUrl, new RegExp(`^${IDP}/logout`))
    assert.equal((await refresh(b)).status, 401)
  })
})

// --- Product behaviour ------------------------------------------------------

describe('matching', () => {
  test('a solo right-swipe forms a squad with the best-fitting students', async () => {
    const { api } = await signIn('z5300001')
    await api('/me', { method: 'PATCH', body: JSON.stringify({ interests: ['COMP1511', 'Hackathons', 'Board games'], mode: 'solo' }) })

    const deck = await api('/events/deck')
    assert.ok(deck.body.events.some((e: any) => e.id === 'comp1511-sprint'))
    assert.ok(!deck.body.events.some((e: any) => e.id === 'bouldering'), 'group-only events hidden from solos')

    const { status, body } = await api('/swipes', { method: 'POST', body: JSON.stringify({ eventId: 'comp1511-sprint', direction: 'right' }) })
    assert.equal(status, 201)
    assert.equal(body.matched, true)
    assert.equal(body.squad.others.length, 2)
    // Mei and Ethan share COMP1511 + Hackathons + Board games with Maya: the strongest overlap.
    assert.deepEqual(body.squad.others.map((m: any) => m.name).sort(), ['Ethan', 'Mei'])
    assert.equal(body.squad.myStatus, 'pending')
    assert.ok(body.squad.fit >= 72 && body.squad.fit <= 99)

    const confirmed = await api(`/squads/${body.squad.id}/confirm`, { method: 'POST' })
    assert.equal(confirmed.body.myStatus, 'confirmed')

    const again = await api('/swipes', { method: 'POST', body: JSON.stringify({ eventId: 'comp1511-sprint', direction: 'right' }) })
    assert.equal(again.status, 409)
  })

  test('undo withdraws the pending squad', async () => {
    const { api } = await signIn('z5300001')
    const swipe = await api('/swipes', { method: 'POST', body: JSON.stringify({ eventId: 'film-night', direction: 'right' }) })
    assert.equal(swipe.body.matched, true)
    const undo = await api('/swipes/undo', { method: 'POST' })
    assert.equal(undo.body.eventId, 'film-night')
    const squads = await api('/squads')
    assert.ok(!squads.body.some((s: any) => s.event.id === 'film-night'))
  })

  test('a group looking for another group gets matched with one', async () => {
    const { api } = await signIn('z5300001')
    await api('/me', { method: 'PATCH', body: JSON.stringify({ mode: 'group' }) })

    const missing = await api('/me/group/members', { method: 'POST', body: JSON.stringify({ zid: 'z5300010' }) })
    assert.equal(missing.status, 404, 'Ellie has never signed in to Loop')

    const taken = await api('/me/group/members', { method: 'POST', body: JSON.stringify({ zid: 'z5300004' }) })
    assert.equal(taken.status, 409, 'Priya is already in Kingsford Crew')

    const added = await api('/me/group/members', { method: 'POST', body: JSON.stringify({ zid: 'z5300008' }) })
    assert.equal(added.status, 201)
    assert.deepEqual(added.body.group.members.map((m: any) => m.name), ['Maya Chen', 'Sofia Rossi'])

    await api('/me/group', { method: 'PATCH', body: JSON.stringify({ name: 'The Pod Squad', lookingFor: 'group' }) })
    const { body } = await api('/swipes', { method: 'POST', body: JSON.stringify({ eventId: 'boba-run', direction: 'right' }) })
    assert.equal(body.matched, true)
    assert.deepEqual(body.squad.others.map((m: any) => m.name).sort(), ['Josh', 'Priya']) // Kingsford Crew
    assert.deepEqual(body.squad.mine.map((m: any) => m.name), ['Maya', 'Sofia'])
  })

  test('input is validated and unknown fields are rejected', async () => {
    const { api } = await signIn('z5300001')
    assert.equal((await api('/me', { method: 'PATCH', body: JSON.stringify({ mode: 'admin' }) })).status, 400)
    assert.equal((await api('/me', { method: 'PATCH', body: JSON.stringify({ is_demo: 1 }) })).status, 400)
    assert.equal((await api('/swipes', { method: 'POST', body: JSON.stringify({ eventId: 'nope', direction: 'right' }) })).status, 404)
    assert.equal((await api('/squads/999999/confirm', { method: 'POST' })).status, 404)
  })

  test("students can't act on squads they aren't part of", async () => {
    const maya = await signIn('z5300001')
    const squads = await maya.api('/squads')
    const mine = squads.body[0]
    const liam = await signIn('z5300007') // only swiped on bouldering, so never in Maya's squads
    assert.ok(![...mine.others, ...mine.mine].some((m: any) => m.name === 'Liam'))
    assert.equal((await liam.api(`/squads/${mine.id}/decline`, { method: 'POST' })).status, 404)
    assert.equal((await maya.api('/squads')).body[0].myStatus, 'pending', "Maya's squad is untouched")
  })
})
