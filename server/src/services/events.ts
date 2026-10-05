import { db, type Row } from '../db/db.ts'
import { HttpError, notFound } from '../http.ts'
import { getUserRow, type Mode } from './users.ts'

export function toEventDto(r: Row) {
  return {
    id: r.id as string,
    title: r.title as string,
    cohort: r.cohort as string,
    emoji: r.emoji as string,
    accent: r.accent as string,
    gradient: r.gradient as string,
    duration: r.duration as string,
    tags: JSON.parse(r.tags as string) as string[],
    openTo: (r.open_to === 'both' ? ['solo', 'group'] : [r.open_to]) as Mode[],
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    location: r.location as string,
    locationDetail: r.location_detail as string,
    focus: r.focus as string,
    focusDetail: r.focus_detail as string,
    interestTag: r.interest_tag as string,
    interested: Number(r.interested ?? 0),
  }
}
export type EventDto = ReturnType<typeof toEventDto>

const INTERESTED = `(SELECT COUNT(*) FROM swipes s WHERE s.event_id = e.id AND s.direction = 'right') AS interested`

export function getEvent(id: string) {
  const row = db.prepare(`SELECT e.*, ${INTERESTED} FROM events e WHERE e.id = ?`).get(id) as Row | undefined
  if (!row) throw notFound('Event')
  return toEventDto(row)
}

/** Events the student can still swipe on, for their current mode (solo vs group). */
export function deckFor(userId: number) {
  const { mode } = getUserRow(userId)
  const eligible = `e.open_to IN ('both', ?)`
  const rows = db
    .prepare(
      `SELECT e.*, ${INTERESTED} FROM events e
        WHERE ${eligible}
          AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.event_id = e.id AND s.user_id = ?)
        ORDER BY e.starts_at`,
    )
    .all(mode, userId) as Row[]
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM events e WHERE ${eligible}`).get(mode) as { total: number }
  return { events: rows.map(toEventDto), total }
}

export function recordSwipe(userId: number, eventId: string, direction: 'left' | 'right') {
  getEvent(eventId)
  const exists = db.prepare('SELECT 1 FROM swipes WHERE user_id = ? AND event_id = ?').get(userId, eventId)
  if (exists) throw new HttpError(409, 'already_swiped', 'You already swiped on this event')
  db.prepare('INSERT INTO swipes (user_id, event_id, direction) VALUES (?, ?, ?)').run(userId, eventId, direction)
}
