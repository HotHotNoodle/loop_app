import { Avatar } from '../components/Avatar'
import { Header, PrimaryButton } from '../components/Chrome'
import { CheckIcon, PinIcon, SparkleIcon, UsersIcon } from '../components/Icons'
import { formatShortDate, formatTime } from '../format'
import type { Squad, Tone } from '../types'

const DOT: Record<Tone, string> = { teal: 'bg-teal', orange: 'bg-orange-dark', lilac: 'bg-[#4a4f7a]' }

interface SquadsProps {
  squads: Squad[]
  onConfirm: (id: number) => void
  onDecline: (id: number) => void
  onOpen: (id: number) => void
  onDiscover: () => void
  onProfile: () => void
}

export function Squads({ squads, onConfirm, onDecline, onOpen, onDiscover, onProfile }: SquadsProps) {
  const pending = squads.find((s) => s.myStatus === 'pending')
  const confirmed = squads.filter((s) => s.myStatus === 'confirmed')
  const morePending = squads.filter((s) => s.myStatus === 'pending').length - 1

  return (
    <>
      <Header title="Squads" onProfile={onProfile} />
      <div className="flex flex-1 flex-col px-5 pb-8">
        {pending && (
          <SquadReady key={pending.id} squad={pending} onConfirm={() => onConfirm(pending.id)} onDecline={() => onDecline(pending.id)} />
        )}
        {morePending > 0 && (
          <p className="mt-3 text-center text-[12px] font-semibold text-muted">
            +{morePending} more squad{morePending === 1 ? '' : 's'} waiting for you
          </p>
        )}

        {confirmed.length > 0 && (
          <section className={pending ? 'mt-10' : 'mt-2'}>
            <h2 className="mb-3 text-[11px] font-bold tracking-wider text-muted uppercase">Upcoming sessions</h2>
            <div className="space-y-3">
              {confirmed.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  className="flex w-full items-center gap-4 rounded-3xl bg-card p-3 text-left shadow-sm ring-1 ring-line transition hover:shadow-md"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: s.event.gradient }}>
                    {s.event.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{s.event.title}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {formatShortDate(s.event.startsAt)}, {formatTime(s.event.startsAt)} · {s.event.location.split(',')[0]}
                    </span>
                  </span>
                  <span className="flex -space-x-3">
                    {[...s.others, ...s.mine].slice(0, 3).map((m) => (
                      <Avatar key={m.id} tone={m.tone} size={30} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!pending && confirmed.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-teal-soft text-teal">
              <UsersIcon width={34} height={34} />
            </div>
            <h2 className="mt-5 text-xl font-extrabold">No squads yet</h2>
            <p className="mt-1.5 max-w-[260px] text-[14px] text-muted">
              Swipe right on an event in Discover and we'll match you with students who share your vibe.
            </p>
            <button
              onClick={onDiscover}
              className="mt-6 rounded-full bg-teal px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-teal/25 transition hover:bg-teal-dark"
            >
              Start discovering
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function subtitle(squad: Squad) {
  const n = squad.others.length
  if (squad.mine.length === 1) {
    return `We matched you with ${n} fellow student${n === 1 ? '' : 's'} who share your interests and schedule.`
  }
  if (n === 1) return 'We found 1 more friend for your group who shares your interests and schedule.'
  return `We matched your group with another crew of ${n} who share your interests and schedule.`
}

function SquadReady({ squad, onConfirm, onDecline }: { squad: Squad; onConfirm: () => void; onDecline: () => void }) {
  const { event } = squad
  const everyone = [...squad.others, ...squad.mine]
  const [place, ...area] = event.location.split(',')

  return (
    <div className="animate-rise">
      <div className="text-center">
        <h2 className="text-[26px] font-extrabold tracking-tight text-teal">Your squad is ready</h2>
        <p className="mx-auto mt-1.5 max-w-[300px] text-[14px] leading-snug text-muted">{subtitle(squad)}</p>
      </div>

      <div className="mt-5 rounded-[28px] bg-card p-4 shadow-[0_10px_30px_-12px_rgba(40,30,20,0.18)] ring-1 ring-line">
        <div className="flex justify-center pt-2">
          {everyone.map((m, i) => (
            <Avatar
              key={m.id}
              tone={m.tone}
              size={everyone.length > 4 ? 56 : 68}
              label={m.isYou ? 'YOU' : m.tag}
              labelDark={m.isYou}
              className={`animate-pop ${i > 0 ? '-ml-4' : ''}`}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {everyone.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-[12px]">
              <span className={`h-1.5 w-1.5 rounded-full ${DOT[m.tone]}`} />
              <b className="font-bold">{m.name}</b>
              <span className="text-muted">
                · {m.isYou ? <span className="font-semibold text-ink">you</span> : m.isTeammate ? 'your group' : m.year}
              </span>
            </span>
          ))}
        </div>

        <hr className="my-4 border-line" />

        <div className="rounded-2xl bg-teal-mist p-3">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal uppercase">
              <SparkleIcon width={14} height={14} />
              Why you matched
            </span>
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">{squad.fit}% Fit</span>
          </div>
          <ul className="space-y-2">
            {squad.reasons.map((r) => (
              <li key={r.title} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
                  <CheckIcon width={14} height={14} strokeWidth={3} />
                </span>
                <span>
                  <span className="block text-[14px] font-bold">{r.title}</span>
                  <span className="block text-[12px] text-muted">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-sand px-3 py-3 text-[13px]">
          <PinIcon width={16} height={16} className="text-orange-dark" />
          <span className="flex-1">
            <b className="font-bold">{place}</b>
            {area.length > 0 && `,${area.join(',')}`}
          </span>
          <span className="text-[11px] font-bold tracking-wider text-teal">SUGGESTED</span>
        </div>
      </div>

      <PrimaryButton onClick={onConfirm} className="mt-5">
        <SparkleIcon width={18} height={18} />
        Looks good
      </PrimaryButton>
      <button onClick={onDecline} className="mt-3 w-full py-2 text-[13px] font-semibold text-muted hover:text-ink">
        Not this time
      </button>
    </div>
  )
}
