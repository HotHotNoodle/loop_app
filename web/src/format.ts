// Events happen on campus, so always show Sydney time regardless of the viewer's device.
const TZ = 'Australia/Sydney'

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', timeZone: TZ })

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toUpperCase()

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
