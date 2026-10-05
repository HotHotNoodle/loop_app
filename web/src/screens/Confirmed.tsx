import type { ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { Header, Pill, PrimaryButton } from '../components/Chrome'
import { BookIcon, CalendarIcon, CheckIcon, ClockIcon, PinIcon, ShieldIcon } from '../components/Icons'
import { formatDay, formatTime } from '../format'
import type { Squad } from '../types'

function toIcsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Builds a .ics file so the session can be added to Apple / Google / Outlook calendars. */
function downloadIcs(squad: Squad) {
  const { event } = squad
  const names = [...squad.others, ...squad.mine].map((m) => m.name).join(', ')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Loop//Squad Session//EN',
    'BEGIN:VEVENT',
    `UID:loop-squad-${squad.id}@loop.app`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(event.startsAt)}`,
    `DTEND:${toIcsDate(event.endsAt)}`,
    `SUMMARY:Loop · ${event.title}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:${event.focus} — ${event.focusDetail}\\nSquad: ${names}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `loop-${event.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function DetailRow({ icon, tone, label, title, sub }: { icon: ReactNode; tone: 'teal' | 'orange'; label: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
          tone === 'teal' ? 'bg-teal-soft text-teal' : 'bg-orange-soft text-orange-dark'
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-bold tracking-wider text-muted uppercase">{label}</p>
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-[13px] text-muted">{sub}</p>
      </div>
    </div>
  )
}

export function Confirmed({ squad, onBack, onProfile }: { squad: Squad; onBack: () => void; onProfile: () => void }) {
  const { event } = squad
  const members = [...squad.others, ...squad.mine]
  const confirmedCount = members.filter((m) => m.status === 'confirmed').length

  return (
    <>
      <Header title="Confirmed" onBack={onBack} onProfile={onProfile} />
      <div className="flex flex-1 flex-col px-5 pb-8 animate-rise">
        <div className="text-center">
          <Pill>
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            Session confirmed
          </Pill>
          <h2 className="mt-3 text-[30px] leading-tight font-extrabold tracking-tight">
            {formatDay(event.startsAt)}, {formatTime(event.startsAt)}
          </h2>
          <p className="mt-1 text-[14px] text-muted">You're locked in! Your squad is ready to roll.</p>
        </div>

        <div className="mt-6 rounded-[28px] bg-card p-5 shadow-[0_10px_30px_-12px_rgba(40,30,20,0.18)] ring-1 ring-line">
          <div className="space-y-4">
            <DetailRow icon={<PinIcon width={20} height={20} />} tone="teal" label="Location" title={event.location} sub={event.locationDetail} />
            <DetailRow
              icon={<ClockIcon width={20} height={20} />}
              tone="orange"
              label="Estimated duration"
              title={event.duration}
              sub={`${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`}
            />
            <DetailRow icon={<BookIcon width={20} height={20} />} tone="teal" label="Focus" title={event.focus} sub={event.focusDetail} />
          </div>

          <hr className="my-5 border-line" />

          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[17px] font-extrabold">Your Squad</h3>
            <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold text-muted">{confirmedCount} of {members.length} Confirmed</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {members.map((s) => (
              <div key={s.id} className="flex flex-col items-center rounded-2xl bg-sand px-2 py-3.5 text-center">
                <div className="relative">
                  <Avatar tone={s.tone} size={54} />
                  <span
                    title={s.status === 'confirmed' ? 'Confirmed' : 'Waiting to confirm'}
                    className={`absolute -right-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-sand text-white ${
                      s.status === 'confirmed' ? 'bg-join' : 'bg-orange'
                    }`}
                  >
                    {s.status === 'confirmed' ? <CheckIcon width={10} height={10} strokeWidth={4} /> : <ClockIcon width={10} height={10} strokeWidth={3} />}
                  </span>
                </div>
                <p className="mt-2 text-[14px] font-bold">{s.name}</p>
                <p className={`text-[11px] ${s.isYou ? 'font-bold text-orange-dark' : 'text-muted'}`}>
                  {s.isYou ? 'You' : s.isTeammate ? 'Your group' : `${s.year.replace(' yr', ' Yr')} ${s.degree}`}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-teal-mist p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
              <ShieldIcon width={18} height={18} />
            </span>
            <p className="text-[13px] leading-snug text-teal">Public campus venue. Everyone is an active, verified UNSW student.</p>
          </div>
        </div>

        <PrimaryButton onClick={() => downloadIcs(squad)} className="mt-5">
          <CalendarIcon width={18} height={18} />
          Add to Calendar
        </PrimaryButton>
      </div>
    </>
  )
}
