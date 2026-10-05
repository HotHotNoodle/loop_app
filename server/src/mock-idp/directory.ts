/**
 * The mock university's student directory. In real life this is the university's
 * identity provider (e.g. Microsoft Entra ID) — Loop never sees passwords.
 *
 * `loop` = a Loop profile to pre-seed (demo students who are already active on the app).
 * Students without it (like Maya) get a fresh account on first SSO login.
 */
export interface DirectoryEntry {
  sub: string
  zid: string
  email: string
  name: string
  loop?: {
    degree: string
    year: string
    interests: string[]
    tone: 'teal' | 'orange' | 'lilac'
    group?: string
  }
}

export const DEMO_PASSWORD = 'loop-demo'

const unsw = (zid: string) => `${zid}@ad.unsw.edu.au`

export const DIRECTORY: DirectoryEntry[] = [
  { sub: 'a1f3c2d0-0001', zid: 'z5300001', email: unsw('z5300001'), name: 'Maya Chen' },
  { sub: 'a1f3c2d0-0010', zid: 'z5300010', email: unsw('z5300010'), name: 'Ellie Hart' },
  {
    sub: 'a1f3c2d0-0002', zid: 'z5300002', email: unsw('z5300002'), name: 'Mei Lin',
    loop: { degree: 'CSE', year: '1st yr', interests: ['COMP1511', 'Boba', 'Hackathons', 'Board games'], tone: 'teal' },
  },
  {
    sub: 'a1f3c2d0-0003', zid: 'z5300003', email: unsw('z5300003'), name: 'Tomas Silva',
    loop: { degree: 'Data', year: '1st yr', interests: ['COMP1511', 'Gym', 'Running', 'Hackathons'], tone: 'orange' },
  },
  {
    sub: 'a1f3c2d0-0004', zid: 'z5300004', email: unsw('z5300004'), name: 'Priya Nair',
    loop: { degree: 'Design', year: '2nd yr', interests: ['Boba', 'Photography', 'Film', 'K-pop'], tone: 'orange', group: 'Kingsford Crew' },
  },
  {
    sub: 'a1f3c2d0-0005', zid: 'z5300005', email: unsw('z5300005'), name: 'Josh Taylor',
    loop: { degree: 'Commerce', year: '1st yr', interests: ['Boba', 'Startups', 'Hackathons', 'Live music'], tone: 'teal', group: 'Kingsford Crew' },
  },
  {
    sub: 'a1f3c2d0-0006', zid: 'z5300006', email: unsw('z5300006'), name: 'Aiko Tanaka',
    loop: { degree: 'Media', year: '3rd yr', interests: ['Film', 'Photography', 'Bouldering', 'Cooking'], tone: 'teal', group: 'Climb Club' },
  },
  {
    sub: 'a1f3c2d0-0007', zid: 'z5300007', email: unsw('z5300007'), name: "Liam O'Brien",
    loop: { degree: 'Science', year: '2nd yr', interests: ['Bouldering', 'Running', 'Gym', 'Board games'], tone: 'orange', group: 'Climb Club' },
  },
  {
    sub: 'a1f3c2d0-0008', zid: 'z5300008', email: unsw('z5300008'), name: 'Sofia Rossi',
    loop: { degree: 'Law', year: '1st yr', interests: ['Film', 'Cooking', 'Live music', 'Boba'], tone: 'lilac' },
  },
  {
    sub: 'a1f3c2d0-0009', zid: 'z5300009', email: unsw('z5300009'), name: 'Ethan Wong',
    loop: { degree: 'CSE', year: '2nd yr', interests: ['COMP1511', 'Hackathons', 'Startups', 'Board games'], tone: 'teal' },
  },
  // Not a UNSW student — the IdP will authenticate them, but Loop must refuse them.
  { sub: 'b7e9-usyd-0001', zid: 'jpar1234', email: 'jamie.park@uni.sydney.edu.au', name: 'Jamie Park' },
]
