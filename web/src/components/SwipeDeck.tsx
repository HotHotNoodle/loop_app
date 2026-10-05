import { useEffect, useRef, useState } from 'react'
import type { LoopEvent, Mode } from '../types'
import { CheckIcon, UndoIcon, UsersIcon, XIcon } from './Icons'

export type SwipeDir = 'left' | 'right'

const SWIPE_THRESHOLD = 110
const EXIT_MS = 320

interface CardProps {
  event: LoopEvent
  depth: number
  exitDir: SwipeDir | null
  onDecide: (dir: SwipeDir) => void
  onExited: () => void
}

function SwipeCard({ event, depth, exitDir, onDecide, onExited }: CardProps) {
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const isTop = depth === 0
  const exitedRef = useRef(onExited)
  exitedRef.current = onExited

  // A decision was made (by drag release or by button): fly the card off screen.
  useEffect(() => {
    if (!exitDir) return
    setDragging(false)
    setDrag((d) => ({ x: (exitDir === 'right' ? 1 : -1) * 560, y: d.y + 40 }))
    const t = setTimeout(() => exitedRef.current(), EXIT_MS)
    return () => clearTimeout(t)
  }, [exitDir])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop || exitDir) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.4 })
  }
  const onPointerUp = () => {
    if (!start.current) return
    start.current = null
    if (Math.abs(drag.x) > SWIPE_THRESHOLD) {
      onDecide(drag.x > 0 ? 'right' : 'left')
    } else {
      setDragging(false)
      setDrag({ x: 0, y: 0 })
    }
  }

  // Cards behind the top one peek out rotated, like the stacked look in the mockup.
  const rest = depth === 1 ? 'translate(18px, 10px) rotate(4deg) scale(0.95)' : 'translate(30px, 18px) rotate(7deg) scale(0.9)'
  const transform = isTop ? `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 14 - 2}deg)` : rest
  const passOpacity = Math.min(Math.max(-drag.x / SWIPE_THRESHOLD, 0), 1)
  const joinOpacity = Math.min(Math.max(drag.x / SWIPE_THRESHOLD, 0), 1)

  return (
    <article
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute inset-0 flex touch-none flex-col overflow-hidden rounded-[28px] bg-card shadow-[0_18px_40px_-12px_rgba(40,30,20,0.28)] select-none ${
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      }`}
      style={{
        transform,
        zIndex: 10 - depth,
        opacity: depth > 1 ? 0.6 : 1,
        transition: dragging ? 'none' : `transform ${EXIT_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s`,
      }}
    >
      {/* Illustration */}
      <div className="relative h-[52%] shrink-0 overflow-hidden" style={{ background: event.gradient }}>
        <div className="absolute -top-10 -right-8 h-40 w-40 rounded-full opacity-25" style={{ background: event.accent }} />
        <div className="absolute bottom-6 -left-10 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute top-1/2 left-[62%] h-14 w-14 rounded-full bg-white/10" />
        <span className="absolute inset-0 grid place-items-center text-[96px] drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)]">
          {event.emoji}
        </span>
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 py-1 text-[10px] font-bold tracking-wider text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: event.accent }} />
          {event.cohort}
        </span>

        <span
          className="absolute top-5 right-5 rotate-[10deg] rounded-xl border-[3px] border-pass bg-white/90 px-3 py-1 text-xl font-extrabold tracking-wider text-pass"
          style={{ opacity: passOpacity }}
        >
          PASS
        </span>
        <span
          className="absolute top-5 left-5 -rotate-[10deg] rounded-xl border-[3px] border-join bg-white/90 px-3 py-1 text-xl font-extrabold tracking-wider text-join"
          style={{ opacity: joinOpacity }}
        >
          JOIN
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col px-5 pt-5 pb-4">
        <h2 className="text-[22px] leading-tight font-extrabold tracking-tight">{event.title}</h2>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[14px] text-muted">{event.duration}</p>
          <OpenToBadge openTo={event.openTo} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {event.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-teal-soft px-3.5 py-1.5 text-[13px] font-semibold text-teal">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-[13px] text-muted">
          <UsersIcon width={16} height={16} className="text-teal" />
          <span>
            <b className="font-semibold text-ink">{event.interested}</b> students interested this week
          </span>
        </div>
      </div>
    </article>
  )
}

function OpenToBadge({ openTo }: { openTo: Mode[] }) {
  const label = openTo.length === 2 ? 'Solo + groups' : openTo[0] === 'group' ? 'Groups only' : 'Solo only'
  return <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-muted uppercase">{label}</span>
}

interface DeckProps {
  events: LoopEvent[]
  onSwipe: (event: LoopEvent, dir: SwipeDir) => void
  onUndo?: () => void
  canUndo: boolean
}

export function SwipeDeck({ events, onSwipe, onUndo, canUndo }: DeckProps) {
  const [exitDir, setExitDir] = useState<SwipeDir | null>(null)
  const top = events[0]

  const decide = (dir: SwipeDir) => {
    if (!top || exitDir) return
    setExitDir(dir)
  }

  const handleExited = () => {
    const dir = exitDir
    setExitDir(null)
    if (top && dir) onSwipe(top, dir)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') decide('left')
      if (e.key === 'ArrowRight') decide('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mx-auto w-full max-w-[340px] flex-1" style={{ minHeight: 400, maxHeight: 500 }}>
        {events
          .slice(0, 3)
          .map((ev, i) => (
            <SwipeCard
              key={ev.id}
              event={ev}
              depth={i}
              exitDir={i === 0 ? exitDir : null}
              onDecide={decide}
              onExited={handleExited}
            />
          ))
          .reverse()}
      </div>

      <div className="mt-6 flex items-center justify-center gap-5">
        <RoundButton label="Undo" size={46} onClick={onUndo} disabled={!canUndo} className="text-muted">
          <UndoIcon width={18} height={18} />
        </RoundButton>
        <RoundButton label="Pass" size={64} onClick={() => decide('left')} disabled={!top} className="text-pass">
          <XIcon width={28} height={28} strokeWidth={2.6} />
        </RoundButton>
        <RoundButton
          label="Join"
          size={64}
          onClick={() => decide('right')}
          disabled={!top}
          filled
        >
          <CheckIcon width={28} height={28} strokeWidth={2.6} />
        </RoundButton>
      </div>
    </div>
  )
}

function RoundButton({
  children,
  label,
  size,
  onClick,
  disabled,
  filled,
  className = '',
}: {
  children: React.ReactNode
  label: string
  size: number
  onClick?: () => void
  disabled?: boolean
  filled?: boolean
  className?: string
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{ width: size, height: size }}
      className={`grid place-items-center rounded-full shadow-lg transition ${
        filled ? 'bg-teal text-white shadow-teal/30 hover:bg-teal-dark' : 'border border-line bg-white shadow-black/5'
      } hover:-translate-y-0.5 active:scale-90 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}
