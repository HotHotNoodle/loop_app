export type Tab = 'discover' | 'squads' | 'profile'

/** How the current user is registered: on their own, or as an existing group. */
export type Mode = 'solo' | 'group'

/** When registered as a group: merge with another group, or add just one more friend. */
export type GroupTarget = 'group' | 'plusOne'

export type Tone = 'teal' | 'orange' | 'lilac'

export interface Group {
  id: number
  name: string
  lookingFor: GroupTarget
  members: { id: number; name: string; zid: string | null; isYou: boolean }[]
}

export interface User {
  id: number
  name: string
  email: string
  zid: string | null
  degree: string
  year: string
  interests: string[]
  mode: Mode
  tone: Tone
  group: Group | null
}

export interface LoopEvent {
  id: string
  title: string
  cohort: string
  emoji: string
  accent: string
  gradient: string
  duration: string
  tags: string[]
  openTo: Mode[]
  startsAt: string
  endsAt: string
  location: string
  locationDetail: string
  focus: string
  focusDetail: string
  interestTag: string
  interested: number
}

export interface Member {
  id: number
  name: string
  year: string
  degree: string
  tag: string
  tone: Tone
  status: 'pending' | 'confirmed' | 'declined'
  isYou: boolean
  isTeammate: boolean
}

export interface MatchReason {
  title: string
  detail: string
}

/** A squad formed after the user (or their group) joins an event. */
export interface Squad {
  id: number
  event: LoopEvent
  fit: number
  reasons: MatchReason[]
  myStatus: 'pending' | 'confirmed' | 'declined'
  /** You + your group. */
  mine: Member[]
  /** The people Loop matched you with. */
  others: Member[]
  createdAt: string
}
