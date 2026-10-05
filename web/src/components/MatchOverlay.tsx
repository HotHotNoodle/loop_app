import type { Squad } from '../types'
import { Avatar } from './Avatar'
import { PrimaryButton } from './Chrome'

/** Celebration shown right after a right-swipe forms a squad. */
export function MatchOverlay({ squad, onSee, onKeepSwiping }: { squad: Squad; onSee: () => void; onKeepSwiping: () => void }) {
  const people = [...squad.others, ...squad.mine]
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-teal-dark/95 px-8 text-center text-white backdrop-blur-sm animate-rise">
      <span className="text-6xl animate-pop">{squad.event.emoji}</span>
      <h2 className="mt-4 text-[34px] font-extrabold tracking-tight">You're in the loop!</h2>
      <p className="mt-2 max-w-[280px] text-[15px] text-white/75">
        {people.length} students are keen for <b className="text-white">{squad.event.title.toLowerCase()}</b>.
      </p>
      <div className="mt-7 flex">
        {people.map((s, i) => (
          <Avatar key={s.id} tone={s.tone} size={64} className={`animate-pop ${i ? '-ml-4' : ''}`} />
        ))}
      </div>
      <div className="mt-10 w-full max-w-[300px]">
        <PrimaryButton onClick={onSee}>See your squad</PrimaryButton>
        <button onClick={onKeepSwiping} className="mt-3 w-full py-2 text-[14px] font-semibold text-white/70 hover:text-white">
          Keep swiping
        </button>
      </div>
    </div>
  )
}
