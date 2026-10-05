import type { ReactNode } from 'react'
import type { Tab } from '../types'
import { ChevronLeftIcon, CompassIcon, UserCircleIcon, UserIcon, UsersIcon } from './Icons'

interface HeaderProps {
  title: string
  onBack?: () => void
  onProfile?: () => void
  right?: ReactNode
}

export function Header({ title, onBack, onProfile, right }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-cream/85 px-5 pt-[max(env(safe-area-inset-top),14px)] pb-3 backdrop-blur-md">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="-ml-1.5 grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-sand"
        >
          <ChevronLeftIcon width={24} height={24} />
        </button>
      )}
      <h1 className="flex-1 text-[19px] font-bold tracking-tight">{title}</h1>
      {right}
      {onProfile && (
        <button
          onClick={onProfile}
          aria-label="Open profile"
          className="grid h-10 w-10 place-items-center rounded-full bg-teal text-white shadow-md shadow-teal/25 transition active:scale-95"
        >
          <UserIcon width={18} height={18} />
        </button>
      )}
    </header>
  )
}

const TABS: { id: Tab; label: string; Icon: typeof CompassIcon }[] = [
  { id: 'discover', label: 'Discover', Icon: CompassIcon },
  { id: 'squads', label: 'Squads', Icon: UsersIcon },
  { id: 'profile', label: 'Profile', Icon: UserCircleIcon },
]

export function BottomNav({ tab, onChange, badge }: { tab: Tab; onChange: (t: Tab) => void; badge?: boolean }) {
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-3 border-t border-line bg-cream/95 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur-md">
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`relative flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition ${
              active ? 'text-teal' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon width={22} height={22} />
            {label}
            {badge && id === 'squads' && !active && (
              <span className="absolute top-0.5 left-1/2 ml-2 h-2.5 w-2.5 rounded-full border-2 border-cream bg-orange" />
            )}
          </button>
        )
      })}
    </nav>
  )
}

export function Pill({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'teal' | 'sand' }) {
  const styles = {
    orange: 'bg-orange-soft text-orange-dark',
    teal: 'bg-teal-soft text-teal',
    sand: 'bg-sand text-muted',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase ${styles}`}>
      {children}
    </span>
  )
}

export function PrimaryButton({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-orange py-4 text-[15px] font-bold text-white shadow-lg shadow-orange/30 transition hover:bg-orange-dark active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  )
}
