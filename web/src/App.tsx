import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, onSessionEnded, refreshSession } from './api'
import { BottomNav } from './components/Chrome'
import { MatchOverlay } from './components/MatchOverlay'
import type { SwipeDir } from './components/SwipeDeck'
import { Confirmed } from './screens/Confirmed'
import { Discover } from './screens/Discover'
import { Login, LoopLogo } from './screens/Login'
import { Profile } from './screens/Profile'
import { Squads } from './screens/Squads'
import type { LoopEvent, Squad, Tab, User } from './types'

function readAuthError() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('auth_error')
  if (error) window.history.replaceState(null, '', window.location.pathname) // keep the URL clean
  return error
}

/** Phone-sized frame on desktop, full-bleed on mobile. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center sm:p-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-cream sm:h-[880px] sm:max-h-[calc(100dvh-48px)] sm:max-w-[420px] sm:rounded-[44px] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] sm:ring-8 sm:ring-[#232838]">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-soft/70 blur-3xl" />
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'signedIn'>('loading')
  const [authError] = useState(readAuthError)

  useEffect(() => {
    onSessionEnded(() => {
      setUser(null)
      setStatus('signedOut')
    })
    // The httpOnly refresh cookie (if any) is our session — trade it for an access token.
    refreshSession().then((u) => {
      setUser(u)
      setStatus(u ? 'signedIn' : 'signedOut')
    })
  }, [])

  return (
    <Frame>
      {status === 'loading' && (
        <div className="grid flex-1 place-items-center">
          <div className="animate-pulse">
            <LoopLogo size={36} />
          </div>
        </div>
      )}
      {status === 'signedOut' && <Login error={authError} />}
      {status === 'signedIn' && user && <LoopApp user={user} setUser={setUser} />}
    </Frame>
  )
}

function LoopApp({ user, setUser }: { user: User; setUser: (u: User) => void }) {
  const [tab, setTab] = useState<Tab>('discover')
  const [deck, setDeck] = useState<LoopEvent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [squads, setSquads] = useState<Squad[]>([])
  const [openSquadId, setOpenSquadId] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState<Squad | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const scrollRef = useRef<HTMLElement>(null)

  const showError = useCallback((err: unknown) => {
    setToast(err instanceof ApiError ? err.message : 'Something went wrong — check your connection')
  }, [])

  const loadDeck = useCallback(async () => {
    try {
      const d = await api.deck()
      setDeck(d.events)
      setTotal(d.total)
    } catch (err) {
      showError(err)
    }
  }, [showError])

  const loadSquads = useCallback(async () => {
    try {
      setSquads(await api.squads())
    } catch (err) {
      showError(err)
    }
  }, [showError])

  useEffect(() => {
    loadDeck()
    loadSquads()
  }, [loadDeck, loadSquads])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [tab, openSquadId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const goTab = (t: Tab) => {
    setOpenSquadId(null)
    setTab(t)
  }

  const handleSwipe = async (event: LoopEvent, dir: SwipeDir) => {
    setDeck((d) => d?.filter((e) => e.id !== event.id) ?? null) // optimistic: the card already flew away
    try {
      const res = await api.swipe(event.id, dir)
      if (res.squad) {
        setSquads((s) => [res.squad!, ...s])
        setCelebrate(res.squad)
      } else if (dir === 'right') {
        setToast(`You're on the list for ${event.title.toLowerCase()} — we'll find your squad soon`)
      }
    } catch (err) {
      showError(err)
      loadDeck()
    }
  }

  const handleUndo = async () => {
    try {
      await api.undo()
      await Promise.all([loadDeck(), loadSquads()])
    } catch (err) {
      showError(err)
    }
  }

  const updateUser = async (fn: () => Promise<User>) => {
    try {
      const prevMode = user.mode
      const next = await fn()
      setUser(next)
      if (next.mode !== prevMode) loadDeck() // solo and group see different events
      return true
    } catch (err) {
      showError(err)
      return false
    }
  }

  const respond = async (id: number, action: 'confirm' | 'decline') => {
    try {
      const updated = action === 'confirm' ? await api.confirmSquad(id) : await api.declineSquad(id)
      setSquads((s) => (action === 'confirm' ? s.map((x) => (x.id === id ? updated : x)) : s.filter((x) => x.id !== id)))
      if (action === 'confirm') setOpenSquadId(id)
    } catch (err) {
      showError(err)
    }
  }

  const openSquad = squads.find((s) => s.id === openSquadId) ?? null

  let screen
  if (openSquad) {
    screen = <Confirmed squad={openSquad} onBack={() => setOpenSquadId(null)} onProfile={() => goTab('profile')} />
  } else if (tab === 'discover') {
    screen = (
      <Discover
        user={user}
        deck={deck}
        total={total}
        onSwipe={handleSwipe}
        onUndo={handleUndo}
        onProfile={() => goTab('profile')}
        onGroupTarget={(lookingFor) => updateUser(() => api.updateGroup({ lookingFor }))}
      />
    )
  } else if (tab === 'squads') {
    screen = (
      <Squads
        squads={squads}
        onConfirm={(id) => respond(id, 'confirm')}
        onDecline={(id) => respond(id, 'decline')}
        onOpen={setOpenSquadId}
        onDiscover={() => goTab('discover')}
        onProfile={() => goTab('profile')}
      />
    )
  } else {
    screen = <Profile user={user} update={updateUser} />
  }

  return (
    <>
      <main ref={scrollRef} className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {screen}
      </main>

      <BottomNav tab={tab} onChange={goTab} badge={squads.some((s) => s.myStatus === 'pending')} />

      {toast && (
        <div
          role="status"
          className="absolute inset-x-4 bottom-24 z-40 rounded-2xl bg-ink/90 px-4 py-3 text-center text-[13px] font-medium text-white shadow-lg backdrop-blur animate-rise"
        >
          {toast}
        </div>
      )}

      {celebrate && (
        <MatchOverlay
          squad={celebrate}
          onSee={() => {
            setCelebrate(null)
            goTab('squads')
          }}
          onKeepSwiping={() => setCelebrate(null)}
        />
      )}
    </>
  )
}
