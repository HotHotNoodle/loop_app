import { db, tx } from './db.ts'
import { DIRECTORY } from '../mock-idp/directory.ts'

const TZ = 'Australia/Sydney'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** ISO timestamp (with Sydney offset) for the next given weekday at hh:mm, Sydney time. */
function next(weekday: string, hh: number, mm = 0, weeksAhead = 0) {
  const now = new Date()
  const today = DAYS.indexOf(now.toLocaleDateString('en-AU', { weekday: 'long', timeZone: TZ }))
  const ahead = ((DAYS.indexOf(weekday) - today + 7) % 7 || 7) + weeksAhead * 7
  const day = new Date(now.getTime() + ahead * 86_400_000)
  const ymd = day.toLocaleDateString('en-CA', { timeZone: TZ })
  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
      .formatToParts(day)
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+10:00'
  return `${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00${offset}`
}

const EVENTS = [
  {
    id: 'comp1511-sprint', title: 'COMP1511 study sprint', cohort: '1ST YR COHORT', emoji: '💻', accent: '#7dd3c0',
    gradient: 'linear-gradient(140deg, #16323a 0%, #1f5a66 60%, #2c7380 100%)', duration: 'About 3 hours',
    tags: ['Law Library', 'Quiet', 'Small group'], open_to: 'both', starts: next('Tuesday', 14), ends: next('Tuesday', 17),
    location: 'Law Library, Level 2', location_detail: 'Quiet study zone · Pod 4B',
    focus: 'COMP1511 Assignment 2', focus_detail: 'Linked lists, pointers & debugging', interest_tag: 'COMP1511',
  },
  {
    id: 'boba-run', title: 'Midnight boba run', cohort: 'UNSW COHORT', emoji: '🧋', accent: '#f0913a',
    gradient: 'linear-gradient(140deg, #1d1a26 0%, #2a2333 55%, #3b2b3a 100%)', duration: 'About 2 hours',
    tags: ['Kingsford', 'Big group', 'Chill'], open_to: 'both', starts: next('Friday', 21), ends: next('Friday', 23),
    location: 'Gong Cha, Kingsford', location_detail: 'Meet at the Anzac Pde entrance',
    focus: 'Late-night hangout', focus_detail: 'Boba, snacks & a walk back to campus', interest_tag: 'Boba',
  },
  {
    id: 'bouldering', title: 'Beginner bouldering', cohort: 'CLUB COHORT', emoji: '🧗', accent: '#f6b26b',
    gradient: 'linear-gradient(140deg, #2b2116 0%, #4a3220 55%, #6b4527 100%)', duration: 'About 2 hours',
    tags: ['Alexandria', 'Active', 'Beginner'], open_to: 'group', starts: next('Saturday', 10), ends: next('Saturday', 12),
    location: 'Nomad Bouldering, Alexandria', location_detail: 'Shoe hire included · Student rate',
    focus: 'First-timer session', focus_detail: 'V0–V2 walls, intro from staff', interest_tag: 'Bouldering',
  },
  {
    id: 'hackathon', title: 'Hackathon team-up', cohort: 'CSESOC COHORT', emoji: '🚀', accent: '#a5b4fc',
    gradient: 'linear-gradient(140deg, #171a33 0%, #252a52 55%, #34397a 100%)', duration: 'Full weekend',
    tags: ['K17', 'Team of 4', 'Prizes'], open_to: 'both', starts: next('Saturday', 9, 0, 1), ends: next('Saturday', 18, 0, 1),
    location: 'K17 Building, Level 3', location_detail: 'CSESoc Hack Room',
    focus: 'Build something in 48h', focus_detail: 'Frontend + backend + design mix', interest_tag: 'Hackathons',
  },
  {
    id: 'film-night', title: 'Ghibli film night', cohort: 'UNSW COHORT', emoji: '🎬', accent: '#86efac',
    gradient: 'linear-gradient(140deg, #13261d 0%, #1e3d2d 55%, #2c5a40 100%)', duration: 'About 3 hours',
    tags: ['Roundhouse', 'Cosy', 'Snacks'], open_to: 'both', starts: next('Thursday', 18, 30), ends: next('Thursday', 21, 30),
    location: 'Roundhouse, Lower Level', location_detail: 'Big screen room · BYO blanket',
    focus: 'Spirited Away + Totoro', focus_detail: 'Double feature, pizza at intermission', interest_tag: 'Film',
  },
]

export function seed() {
  tx(() => {
    const insertEvent = db.prepare(
      `INSERT OR REPLACE INTO events (id, title, cohort, emoji, accent, gradient, duration, tags, open_to, starts_at, ends_at,
         location, location_detail, focus, focus_detail, interest_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const e of EVENTS) {
      insertEvent.run(e.id, e.title, e.cohort, e.emoji, e.accent, e.gradient, e.duration, JSON.stringify(e.tags), e.open_to,
        e.starts, e.ends, e.location, e.location_detail, e.focus, e.focus_detail, e.interest_tag)
    }

    // Demo students who are already on Loop, swiping right on events that match their interests.
    const groups = new Map<string, number>()
    for (const s of DIRECTORY) {
      if (!s.loop) continue
      const u = db
        .prepare(
          `INSERT INTO users (sso_sub, email, zid, name, degree, year, interests, mode, tone, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        )
        .run(s.sub, s.email, s.zid, s.name, s.loop.degree, s.loop.year, JSON.stringify(s.loop.interests),
          s.loop.group ? 'group' : 'solo', s.loop.tone)
      const userId = Number(u.lastInsertRowid)

      if (s.loop.group) {
        if (!groups.has(s.loop.group)) {
          const g = db.prepare('INSERT INTO groups (name, looking_for, created_by) VALUES (?, ?, ?)').run(s.loop.group, 'group', userId)
          groups.set(s.loop.group, Number(g.lastInsertRowid))
        }
        db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groups.get(s.loop.group)!, userId)
      }

      for (const e of EVENTS) {
        if (s.loop.interests.includes(e.interest_tag)) {
          db.prepare("INSERT INTO swipes (user_id, event_id, direction) VALUES (?, ?, 'right')").run(userId, e.id)
        }
      }
    }
  })
}

// `npm run db:reset` — wipe everything and re-seed.
if (process.argv.includes('--reset')) {
  db.exec(`DELETE FROM refresh_tokens; DELETE FROM squad_members; DELETE FROM squads; DELETE FROM swipes;
           DELETE FROM group_members; DELETE FROM groups; DELETE FROM users; DELETE FROM events;`)
  seed()
  console.log('🌱 Database reset and seeded.')
}
