import { db, tx, type Row } from '../db/db.ts'
import { HttpError, notFound } from '../http.ts'
import { getEvent, recordSwipe, type EventDto } from './events.ts'
import { getUserRow, groupOf } from './users.ts'

const TZ = 'Australia/Sydney'

interface Candidate {
  id: number
  name: string
  year: string
  degree: string
  interests: string[]
  groupId: number | null
  isDemo: boolean
  score: number
}

const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x))

/**
 * The matcher. When you (or your group) swipe right on an event, we look at everyone else who
 * swiped right on it and pick the people who share the most interests with you:
 *   - solo            → you + the best 2 students
 *   - group, +1       → your group + the best 1 student
 *   - group, group    → your group + the best-fitting *other group* (falls back to 2 students)
 */
function findMatch(userId: number, event: EventDto) {
  const me = getUserRow(userId)
  const myGroup = me.mode === 'group' ? groupOf(userId) : null
  const teamIds = myGroup ? myGroup.members.map((m) => m.id) : [userId]

  const teamInterests = [
    ...new Set(
      (db.prepare(`SELECT interests FROM users WHERE id IN (${teamIds.map(() => '?').join(',')})`).all(...teamIds) as { interests: string }[]).flatMap(
        (r) => JSON.parse(r.interests) as string[],
      ),
    ),
  ]

  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.year, u.degree, u.interests, u.is_demo, gm.group_id
         FROM swipes s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN group_members gm ON gm.user_id = u.id
        WHERE s.event_id = ? AND s.direction = 'right'
          AND u.id NOT IN (${teamIds.map(() => '?').join(',')})`,
    )
    .all(event.id, ...teamIds) as Row[]

  const candidates: Candidate[] = rows
    .map((r) => {
      const interests = JSON.parse(r.interests as string) as string[]
      const score = shared(interests, teamInterests).length + (r.year === me.year ? 0.5 : 0) + Number(r.id) * 1e-6 // stable tiebreak
      return {
        id: Number(r.id),
        name: r.name as string,
        year: r.year as string,
        degree: r.degree as string,
        interests,
        groupId: (r.group_id as number | null) ?? null,
        isDemo: r.is_demo === 1,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  let others: Candidate[] = []
  if (myGroup?.lookingFor === 'group') {
    const byGroup = Map.groupBy(
      candidates.filter((c) => c.groupId !== null),
      (c) => c.groupId!,
    )
    const best = [...byGroup.values()].sort(
      (a, b) => b.reduce((s, c) => s + c.score, 0) / b.length - a.reduce((s, c) => s + c.score, 0) / a.length,
    )[0]
    others = best ?? candidates.slice(0, 2)
  } else {
    others = candidates.slice(0, myGroup ? 1 : 2)
  }
  if (others.length === 0) return null

  return { me, myGroup, teamIds, teamInterests, others }
}

function explain(event: EventDto, match: NonNullable<ReturnType<typeof findMatch>>) {
  const { me, others, teamInterests } = match
  const everyone = [{ year: me.year, degree: me.degree }, ...others]
  const common = others.reduce((acc, o) => shared(acc, o.interests), teamInterests).filter((i) => i !== event.interestTag)
  const avgShared = others.reduce((s, o) => s + shared(o.interests, teamInterests).length, 0) / others.length
  const sameYear = everyone.every((p) => p.year === everyone[0].year)

  const start = new Date(event.startsAt)
  const day = start.toLocaleDateString('en-AU', { weekday: 'long', timeZone: TZ })
  const hour = Number(start.toLocaleString('en-AU', { hour: 'numeric', hour12: false, timeZone: TZ }))
  const part = hour < 12 ? 'mornings' : hour < 17 ? 'afternoons' : 'evenings'
  const fmt = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toUpperCase()

  const degrees = [...new Set(everyone.map((p) => p.degree).filter((d) => d !== 'Undeclared'))]
  const reasons = [
    {
      title: `Everyone's into ${event.interestTag}`,
      detail: common.length ? `Also in common: ${common.slice(0, 3).join(', ')}` : 'You all swiped right on this one',
    },
    { title: `All free ${day} ${part}`, detail: `Target slot: ${fmt(start)} – ${fmt(new Date(event.endsAt))}` },
    sameYear
      ? { title: `All ${everyone[0].year}s`, detail: 'Same stage of uni, same deadlines' }
      : degrees.length > 1
        ? { title: 'A mix of degrees', detail: `${degrees.slice(0, 3).join(', ')} — fresh perspectives` }
        : { title: 'Different stages of uni', detail: 'Mix of years — someone has done this before' },
  ]
  const fit = Math.min(99, Math.round(72 + avgShared * 7 + (sameYear ? 5 : 0)))
  return { reasons, fit }
}

/** Records a swipe; on a right swipe, tries to form a squad. Returns the new squad (if any). */
export function swipe(userId: number, eventId: string, direction: 'left' | 'right') {
  return tx(() => {
    recordSwipe(userId, eventId, direction)
    if (direction === 'left') return null

    const event = getEvent(eventId)
    const match = findMatch(userId, event)
    if (!match) return null

    const { reasons, fit } = explain(event, match)
    const squad = db
      .prepare('INSERT INTO squads (event_id, created_by, fit, reasons) VALUES (?, ?, ?, ?)')
      .run(eventId, userId, fit, JSON.stringify(reasons))
    const squadId = Number(squad.lastInsertRowid)

    const addMember = db.prepare('INSERT INTO squad_members (squad_id, user_id, status) VALUES (?, ?, ?)')
    const isDemo = db.prepare('SELECT is_demo FROM users WHERE id = ?')
    for (const id of match.teamIds) {
      // Seeded demo students accept instantly so the showcase feels alive; real students must confirm.
      const demo = (isDemo.get(id) as { is_demo: number }).is_demo === 1
      addMember.run(squadId, id, id !== userId && demo ? 'confirmed' : 'pending')
    }
    for (const o of match.others) addMember.run(squadId, o.id, o.isDemo ? 'confirmed' : 'pending')

    return getSquad(squadId, userId)
  })
}

/** Undo the most recent swipe, withdrawing any still-pending squad it created. */
export function undoLastSwipe(userId: number) {
  return tx(() => {
    const last = db
      .prepare('SELECT event_id FROM swipes WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get(userId) as { event_id: string } | undefined
    if (!last) throw new HttpError(409, 'nothing_to_undo', 'No swipes to undo')

    db.prepare('DELETE FROM swipes WHERE user_id = ? AND event_id = ?').run(userId, last.event_id)
    db.prepare(
      `DELETE FROM squads WHERE event_id = ? AND created_by = ?
         AND EXISTS (SELECT 1 FROM squad_members WHERE squad_id = squads.id AND user_id = ? AND status = 'pending')`,
    ).run(last.event_id, userId, userId)
    return { eventId: last.event_id }
  })
}

const initials = (degree: string) => degree.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'UNI'

export function getSquad(squadId: number, viewerId: number) {
  const squad = db.prepare('SELECT * FROM squads WHERE id = ?').get(squadId) as Row | undefined
  if (!squad) throw notFound('Squad')

  const members = db
    .prepare(
      `SELECT u.id, u.name, u.year, u.degree, u.tone, sm.status
         FROM squad_members sm JOIN users u ON u.id = sm.user_id
        WHERE sm.squad_id = ?`,
    )
    .all(squadId) as Row[]

  const me = members.find((m) => m.id === viewerId)
  if (!me) throw notFound('Squad') // don't reveal squads you're not in

  const myGroupIds = new Set(groupOf(viewerId)?.members.map((m) => m.id) ?? [])
  const toMember = (m: Row) => ({
    id: Number(m.id),
    name: (m.name as string).split(' ')[0],
    year: m.year as string,
    degree: m.degree as string,
    tag: initials(m.degree as string),
    tone: m.tone as string,
    status: m.status as string,
    isYou: m.id === viewerId,
    isTeammate: m.id !== viewerId && myGroupIds.has(Number(m.id)),
  })
  const all = members.map(toMember)

  return {
    id: squadId,
    event: getEvent(squad.event_id as string),
    fit: Number(squad.fit),
    reasons: JSON.parse(squad.reasons as string) as { title: string; detail: string }[],
    myStatus: me.status as string,
    // "mine" = you + your group; "others" = who Loop matched you with
    mine: all.filter((m) => m.isYou || m.isTeammate).sort((a, b) => Number(b.isYou) - Number(a.isYou)),
    others: all.filter((m) => !m.isYou && !m.isTeammate),
    createdAt: squad.created_at as string,
  }
}

export function listSquads(userId: number) {
  const ids = db
    .prepare(
      `SELECT s.id FROM squads s JOIN squad_members sm ON sm.squad_id = s.id
        WHERE sm.user_id = ? AND sm.status != 'declined'
        ORDER BY s.created_at DESC, s.id DESC`,
    )
    .all(userId) as { id: number }[]
  return ids.map(({ id }) => getSquad(id, userId))
}

export function respondToSquad(userId: number, squadId: number, status: 'confirmed' | 'declined') {
  const squad = getSquad(squadId, userId) // also checks membership
  if (squad.myStatus === 'declined') throw new HttpError(409, 'already_declined', 'You already left this squad')
  db.prepare('UPDATE squad_members SET status = ? WHERE squad_id = ? AND user_id = ?').run(status, squadId, userId)
  return getSquad(squadId, userId)
}
