import type { Tone } from '../types'

const TONES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  teal: { bg: '#bfe6ee', fg: '#1f5a66', ring: '#9fd6e2' },
  orange: { bg: '#fbd3b4', fg: '#9a4b16', ring: '#f6b98c' },
  lilac: { bg: '#d9dcf5', fg: '#4a4f7a', ring: '#c3c7ef' },
}

interface AvatarProps {
  tone: Tone
  size?: number
  label?: string
  labelDark?: boolean
  className?: string
}

/** Soft circular avatar with a person silhouette, matching the Loop mockups. */
export function Avatar({ tone, size = 56, label, labelDark, className = '' }: AvatarProps) {
  const t = TONES[tone]
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-end justify-center overflow-hidden rounded-full border-[3px] border-white shadow-sm"
        style={{ background: t.bg }}
      >
        <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72} aria-hidden>
          <circle cx="20" cy="15" r="7.5" fill={t.fg} />
          <path d="M6 40c0-8 6.3-13 14-13s14 5 14 13z" fill={t.fg} />
        </svg>
      </div>
      {label && (
        <span
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide ${
            labelDark ? 'bg-teal text-white' : 'bg-white/90 text-ink'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  )
}
