import { useState, type ReactNode } from 'react'
import { api, signOut } from '../api'
import { Avatar } from '../components/Avatar'
import { Header } from '../components/Chrome'
import { CheckIcon, PlusIcon, UserIcon, UsersIcon, XIcon } from '../components/Icons'
import { INTEREST_OPTIONS, YEARS } from '../data'
import type { User } from '../types'

interface ProfileProps {
  user: User
  /** Runs an API call that returns the updated user; resolves false (and shows a toast) on error. */
  update: (fn: () => Promise<User>) => Promise<boolean>
}

export function Profile({ user, update }: ProfileProps) {
  const [newMember, setNewMember] = useState('')
  const [adding, setAdding] = useState(false)
  const group = user.mode === 'group' ? user.group : null

  const toggleInterest = (i: string) =>
    update(() => api.updateMe({ interests: user.interests.includes(i) ? user.interests.filter((x) => x !== i) : [...user.interests, i] }))

  const addMember = async () => {
    const zid = newMember.trim()
    if (!zid) return
    setAdding(true)
    if (await update(() => api.addMember(zid))) setNewMember('')
    setAdding(false)
  }

  return (
    <>
      <Header title="Profile" />
      <div className="space-y-6 px-5 pb-10 animate-rise">
        <div className="rounded-[28px] bg-card p-4 shadow-sm ring-1 ring-line">
          <div className="flex items-center gap-4">
            <Avatar tone={user.tone} size={72} />
            <div className="min-w-0 flex-1">
              <BlurInput
                value={user.name}
                onCommit={(name) => update(() => api.updateMe({ name }))}
                className="w-full bg-transparent text-xl font-extrabold outline-none"
                aria-label="Your name"
              />
              <p className="truncate text-[13px] text-muted">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">
                <CheckIcon width={12} height={12} strokeWidth={3} /> Verified via UNSW SSO
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Degree</span>
              <BlurInput
                value={user.degree}
                onCommit={(degree) => update(() => api.updateMe({ degree }))}
                className="mt-1 w-full rounded-xl bg-sand px-3 py-2 text-[14px] font-semibold outline-none ring-teal/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Year</span>
              <select
                value={user.year}
                onChange={(e) => update(() => api.updateMe({ year: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-sand px-3 py-2 text-[14px] font-semibold outline-none ring-teal/30 focus:ring-2"
              >
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <Section title="How you're registered">
          <div className="grid grid-cols-2 gap-2.5">
            <ModeCard
              active={user.mode === 'solo'}
              onClick={() => user.mode !== 'solo' && update(() => api.updateMe({ mode: 'solo' }))}
              icon={<UserIcon />}
              title="Solo"
              desc="Get matched into a squad"
            />
            <ModeCard
              active={user.mode === 'group'}
              onClick={() => user.mode !== 'group' && update(() => api.updateMe({ mode: 'group' }))}
              icon={<UsersIcon />}
              title="As a group"
              desc="Find another group or +1"
            />
          </div>

          {group && (
            <div className="mt-3 space-y-3 rounded-2xl bg-teal-mist p-4 animate-rise">
              <label className="block">
                <span className="text-[11px] font-bold tracking-wider text-teal uppercase">Group name</span>
                <BlurInput
                  value={group.name}
                  onCommit={(name) => update(() => api.updateGroup({ name }))}
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-[14px] font-semibold outline-none ring-teal/30 focus:ring-2"
                />
              </label>

              <div>
                <span className="text-[11px] font-bold tracking-wider text-teal uppercase">Members</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.members.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-white py-1 pr-1.5 pl-3 text-[13px] font-semibold">
                      {m.name.split(' ')[0]}
                      {m.isYou ? (
                        <span className="ml-1 pr-1 text-[11px] text-orange-dark">you</span>
                      ) : (
                        <button
                          aria-label={`Remove ${m.name}`}
                          onClick={() => update(() => api.removeMember(m.id))}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-sand"
                        >
                          <XIcon width={12} height={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMember()}
                    placeholder="Friend's zID, e.g. z5300008"
                    className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-[14px] outline-none ring-teal/30 focus:ring-2"
                  />
                  <button
                    onClick={addMember}
                    disabled={adding}
                    aria-label="Add member"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white transition hover:bg-teal-dark disabled:opacity-50"
                  >
                    <PlusIcon width={18} height={18} />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-teal/70">Friends need to have signed in to Loop once.</p>
              </div>

              <div>
                <span className="text-[11px] font-bold tracking-wider text-teal uppercase">Looking for</span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-white/60 p-1">
                  {(
                    [
                      ['group', 'Another group'],
                      ['plusOne', '+1 friend'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => update(() => api.updateGroup({ lookingFor: id }))}
                      className={`rounded-lg py-2 text-[13px] font-bold transition ${
                        group.lookingFor === id ? 'bg-white text-teal shadow-sm' : 'text-teal/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Your interests" hint={`${user.interests.length} selected`}>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((i) => {
              const on = user.interests.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  aria-pressed={on}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    on ? 'bg-teal text-white shadow-sm shadow-teal/30' : 'bg-white text-ink ring-1 ring-line hover:bg-sand'
                  }`}
                >
                  {i}
                </button>
              )
            })}
          </div>
          {user.interests.length === 0 && (
            <p className="mt-2 text-[12px] text-orange-dark">Pick a few — they're how Loop finds your people.</p>
          )}
        </Section>

        <button
          onClick={signOut}
          className="w-full rounded-2xl border border-line bg-white py-3 text-[14px] font-bold text-pass transition hover:bg-[#fdecec]"
        >
          Sign out
        </button>
      </div>
    </>
  )
}

/** Text input that saves on blur / Enter rather than on every keystroke. */
function BlurInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    // the server value changed (e.g. after a save) — adopt it
    setSynced(value)
    setDraft(value)
  }
  const commit = () => {
    const v = draft.trim()
    if (v && v !== value) onCommit(v)
    else setDraft(value)
  }
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[11px] font-bold tracking-wider text-muted uppercase">{title}</h2>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl p-3.5 text-left transition ${
        active ? 'bg-teal text-white shadow-md shadow-teal/30' : 'bg-white text-ink ring-1 ring-line hover:bg-sand'
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-white/15' : 'bg-teal-soft text-teal'}`}>{icon}</span>
      <span className="mt-2 block text-[15px] font-bold">{title}</span>
      <span className={`block text-[12px] ${active ? 'text-white/75' : 'text-muted'}`}>{desc}</span>
    </button>
  )
}
