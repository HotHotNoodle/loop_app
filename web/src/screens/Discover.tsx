import { Header } from '../components/Chrome'
import { SwipeDeck, type SwipeDir } from '../components/SwipeDeck'
import { SparkleIcon } from '../components/Icons'
import type { GroupTarget, LoopEvent, User } from '../types'

interface DiscoverProps {
  user: User
  /** null while loading */
  deck: LoopEvent[] | null
  total: number
  onSwipe: (event: LoopEvent, dir: SwipeDir) => void
  onUndo: () => void
  onProfile: () => void
  onGroupTarget: (t: GroupTarget) => void
}

export function Discover({ user, deck, total, onSwipe, onUndo, onProfile, onGroupTarget }: DiscoverProps) {
  const seen = total - (deck?.length ?? total)
  const group = user.mode === 'group' ? user.group : null

  return (
    <>
      <Header title="Discover" onProfile={onProfile} />

      <div className="flex flex-1 flex-col px-5 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-muted uppercase">
            <span className="h-2 w-2 rounded-full bg-orange" />
            Active events
          </span>
          {total > 0 && (
            <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold text-muted">
              {Math.min(seen + 1, total)} of {total}
            </span>
          )}
        </div>

        {group && (
          <div className="mb-5 rounded-2xl bg-teal-mist p-1.5">
            <p className="px-2 pt-1 pb-2 text-[12px] text-teal">
              Swiping as <b className="font-bold">{group.name}</b> · {group.members.length} member{group.members.length === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['group', 'Find another group'],
                  ['plusOne', 'Find +1 friend'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => onGroupTarget(id)}
                  className={`rounded-xl py-2 text-[13px] font-bold transition ${
                    group.lookingFor === id ? 'bg-white text-teal shadow-sm' : 'text-teal/70 hover:text-teal'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {deck === null ? (
          <div className="mx-auto w-full max-w-[340px] flex-1 animate-pulse rounded-[28px] bg-sand" style={{ minHeight: 400, maxHeight: 500 }} />
        ) : deck.length > 0 ? (
          <SwipeDeck events={deck} onSwipe={onSwipe} onUndo={onUndo} canUndo={seen > 0} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-orange-soft text-orange-dark">
              <SparkleIcon width={34} height={34} />
            </div>
            <h2 className="mt-5 text-xl font-extrabold">You're all caught up</h2>
            <p className="mt-1.5 max-w-[260px] text-[14px] text-muted">
              New events drop every morning. Check your Squads tab for matches.
            </p>
            {seen > 0 && (
              <button
                onClick={onUndo}
                className="mt-6 rounded-full border border-line bg-white px-5 py-2.5 text-[13px] font-bold text-teal shadow-sm transition hover:bg-sand"
              >
                Undo last swipe
              </button>
            )}
          </div>
        )}

        {deck && deck.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-muted">Drag the card, tap the buttons, or use ← → keys</p>
        )}
      </div>
    </>
  )
}
