import { db, tx } from '../db/db.ts'
import { HttpError, notFound } from '../http.ts'

export type Mode = 'solo' | 'group'
export type GroupTarget = 'group' | 'plusOne'
export type Tone = 'teal' | 'orange' | 'lilac'

interface UserRow {
  id: number
  email: string
  zid: string | null
  name: string
  degree: string
  year: string
  interests: string
  mode: Mode
  tone: Tone
  is_demo: number
}

export function getUserRow(id: number) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw notFound('User')
  return row
}

export function groupOf(userId: number) {
  const g = db
    .prepare(
      `SELECT g.id, g.name, g.looking_for AS lookingFor
         FROM groups g JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?`,
    )
    .get(userId) as { id: number; name: string; lookingFor: GroupTarget } | undefined
  if (!g) return null
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.zid FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ? ORDER BY u.id = ? DESC, u.name`,
    )
    .all(g.id, userId) as { id: number; name: string; zid: string | null }[]
  return { ...g, members: members.map((m) => ({ ...m, isYou: m.id === userId })) }
}

/** The public shape of the signed-in student, as returned by /api/me. */
export function loadUser(id: number) {
  const u = getUserRow(id)
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    zid: u.zid,
    degree: u.degree,
    year: u.year,
    interests: JSON.parse(u.interests) as string[],
    mode: u.mode,
    tone: u.tone,
    group: groupOf(id),
  }
}

export function updateProfile(
  id: number,
  patch: Partial<{ name: string; degree: string; year: string; interests: string[]; mode: Mode }>,
) {
  tx(() => {
    const sets: string[] = []
    const values: (string | number)[] = []
    for (const key of ['name', 'degree', 'year', 'mode'] as const) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`)
        values.push(patch[key])
      }
    }
    if (patch.interests) {
      sets.push('interests = ?')
      values.push(JSON.stringify([...new Set(patch.interests)]))
    }
    if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)

    // Switching to group mode gives you a group to start inviting friends into.
    if (patch.mode === 'group' && !groupOf(id)) {
      const first = getUserRow(id).name.split(' ')[0]
      createGroup(id, `${first}'s crew`)
    }
  })
  return loadUser(id)
}

function createGroup(ownerId: number, name: string) {
  const g = db.prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)').run(name, ownerId)
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(g.lastInsertRowid, ownerId)
}

export function updateGroup(userId: number, patch: { name?: string; lookingFor?: GroupTarget }) {
  const g = groupOf(userId)
  if (!g) throw new HttpError(409, 'no_group', 'Switch to group mode first')
  if (patch.name !== undefined) db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(patch.name, g.id)
  if (patch.lookingFor !== undefined) db.prepare('UPDATE groups SET looking_for = ? WHERE id = ?').run(patch.lookingFor, g.id)
  return loadUser(userId)
}

/** Friends are added by zID — they must already have signed in to Loop once via SSO. */
export function addGroupMember(userId: number, zid: string) {
  const g = groupOf(userId)
  if (!g) throw new HttpError(409, 'no_group', 'Switch to group mode first')
  const friend = db.prepare('SELECT id FROM users WHERE zid = ?').get(zid.toLowerCase()) as { id: number } | undefined
  if (!friend) throw new HttpError(404, 'student_not_found', `No Loop account for ${zid} yet — ask them to sign in once`)
  if (friend.id === userId) throw new HttpError(409, 'is_you', "That's you!")
  if (groupOf(friend.id)) throw new HttpError(409, 'already_in_group', 'That student is already in a group')
  if (g.members.length >= 6) throw new HttpError(409, 'group_full', 'Groups can have at most 6 members')

  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(g.id, friend.id)
  return loadUser(userId)
}

export function removeGroupMember(userId: number, memberId: number) {
  const g = groupOf(userId)
  if (!g || !g.members.some((m) => m.id === memberId)) throw notFound('Group member')
  if (memberId === userId) throw new HttpError(409, 'is_you', 'Switch to solo mode to leave your group')
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(g.id, memberId)
  return loadUser(userId)
}
