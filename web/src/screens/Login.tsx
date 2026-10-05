import { signIn } from '../api'
import { Avatar } from '../components/Avatar'
import { ShieldIcon } from '../components/Icons'

const AUTH_ERRORS: Record<string, string> = {
  not_a_student: 'Loop is only for current UNSW students. That account isn’t from a UNSW email domain.',
  cancelled: 'Sign-in was cancelled.',
  session_expired: 'Your sign-in took too long. Please try again.',
  state_mismatch: 'We couldn’t verify that sign-in attempt. Please try again.',
  token_invalid: 'The university login could not be verified. Please try again.',
  idp_unreachable: 'University SSO is unreachable right now. Is the identity provider running?',
}

export function LoopLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 64 40" aria-label="Loop">
      <circle cx="22" cy="20" r="14" fill="none" stroke="var(--color-teal)" strokeWidth="7" />
      <circle cx="42" cy="20" r="14" fill="none" stroke="var(--color-orange)" strokeWidth="7" />
      {/* re-draw the top-right arc of the teal ring over the orange one to interlock */}
      <path d="M 30.6 9 A 14 14 0 0 1 36 20" fill="none" stroke="var(--color-teal)" strokeWidth="7" />
    </svg>
  )
}

export function Login({ error }: { error: string | null }) {
  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto px-6 pt-[max(env(safe-area-inset-top),36px)] pb-8">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-soft/80 blur-3xl" />

      <div className="relative flex items-center gap-2.5 animate-rise">
        <LoopLogo size={26} />
        <span className="text-[22px] font-extrabold tracking-tight text-teal">loop</span>
      </div>

      {/* Hero collage */}
      <div className="relative mx-auto mt-10 h-56 w-full max-w-[320px] animate-rise" style={{ animationDelay: '80ms' }}>
        <div
          className="absolute top-2 left-4 grid h-36 w-28 -rotate-6 place-items-center rounded-3xl text-5xl shadow-xl"
          style={{ background: 'linear-gradient(140deg, #1d1a26, #3b2b3a)' }}
        >
          🧋
        </div>
        <div
          className="absolute top-0 right-4 grid h-36 w-28 rotate-6 place-items-center rounded-3xl text-5xl shadow-xl"
          style={{ background: 'linear-gradient(140deg, #16323a, #2c7380)' }}
        >
          💻
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-fit items-center rounded-full bg-white p-1.5 pr-4 shadow-lg ring-1 ring-line">
          <Avatar tone="teal" size={40} />
          <Avatar tone="orange" size={40} className="-ml-3" />
          <Avatar tone="lilac" size={40} className="-ml-3" />
          <span className="ml-2.5 text-[13px] font-bold">Squad of 3 · 98% fit</span>
        </div>
      </div>

      <div className="relative mt-10 animate-rise" style={{ animationDelay: '160ms' }}>
        <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-tight">
          Find your people
          <br />
          <span className="text-teal">at uni.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-snug text-muted">
          Swipe on study sessions, boba runs and hackathons. Loop matches you — or your whole friend group — with students who share
          your interests.
        </p>
      </div>

      <div className="relative mt-auto pt-8 animate-rise" style={{ animationDelay: '240ms' }}>
        {error && (
          <div role="alert" className="mb-4 rounded-2xl bg-[#fdecec] px-4 py-3 text-[13px] font-medium text-pass">
            {AUTH_ERRORS[error] ?? 'Sign-in failed. Please try again.'}
          </div>
        )}

        <button
          onClick={() => signIn()}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-teal py-4 text-[15px] font-bold text-white shadow-lg shadow-teal/30 transition hover:bg-teal-dark active:scale-[0.98]"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[#f5c518] text-[12px] font-extrabold text-[#1d2b4f]">U</span>
          Sign in with UNSW SSO
        </button>
        <button onClick={() => signIn({ switchAccount: true })} className="mt-2 w-full py-2 text-[13px] font-semibold text-muted hover:text-ink">
          Use a different account
        </button>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-teal-mist p-3.5">
          <ShieldIcon width={18} height={18} className="mt-0.5 shrink-0 text-teal" />
          <p className="text-[12px] leading-snug text-teal">
            Single sign-on through your university. Loop never sees your password, and only verified UNSW students can join.
          </p>
        </div>
      </div>
    </div>
  )
}
