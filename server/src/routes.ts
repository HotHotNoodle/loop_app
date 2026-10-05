import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth/middleware.ts'
import { parse } from './http.ts'
import { deckFor } from './services/events.ts'
import { listSquads, respondToSquad, swipe, undoLastSwipe } from './services/squads.ts'
import { addGroupMember, loadUser, removeGroupMember, updateGroup, updateProfile } from './services/users.ts'

export const apiRouter = Router()
apiRouter.use(requireAuth)

const text = (max: number) => z.string().trim().min(1).max(max)
const id = z.coerce.number().int().positive()

// --- Me & group -------------------------------------------------------------

apiRouter.get('/me', (req, res) => {
  res.json(loadUser(req.userId))
})

apiRouter.patch('/me', (req, res) => {
  const body = parse(
    z.strictObject({
      name: text(60).optional(),
      degree: text(40).optional(),
      year: z.enum(['1st yr', '2nd yr', '3rd yr', '4th yr', 'Postgrad']).optional(),
      interests: z.array(text(30)).max(20).optional(),
      mode: z.enum(['solo', 'group']).optional(),
    }),
    req.body,
  )
  res.json(updateProfile(req.userId, body))
})

apiRouter.patch('/me/group', (req, res) => {
  const body = parse(z.strictObject({ name: text(40).optional(), lookingFor: z.enum(['group', 'plusOne']).optional() }), req.body)
  res.json(updateGroup(req.userId, body))
})

apiRouter.post('/me/group/members', (req, res) => {
  const { zid } = parse(z.strictObject({ zid: z.string().trim().regex(/^z\d{7}$/i, 'Enter a zID like z5300002') }), req.body)
  res.status(201).json(addGroupMember(req.userId, zid))
})

apiRouter.delete('/me/group/members/:memberId', (req, res) => {
  res.json(removeGroupMember(req.userId, parse(id, req.params.memberId)))
})

// --- Discover ---------------------------------------------------------------

apiRouter.get('/events/deck', (req, res) => {
  res.json(deckFor(req.userId))
})

apiRouter.post('/swipes', (req, res) => {
  const { eventId, direction } = parse(
    z.strictObject({ eventId: text(64), direction: z.enum(['left', 'right']) }),
    req.body,
  )
  const squad = swipe(req.userId, eventId, direction)
  res.status(201).json({ matched: !!squad, squad })
})

apiRouter.post('/swipes/undo', (req, res) => {
  res.json(undoLastSwipe(req.userId))
})

// --- Squads -----------------------------------------------------------------

apiRouter.get('/squads', (req, res) => {
  res.json(listSquads(req.userId))
})

apiRouter.post('/squads/:squadId/confirm', (req, res) => {
  res.json(respondToSquad(req.userId, parse(id, req.params.squadId), 'confirmed'))
})

apiRouter.post('/squads/:squadId/decline', (req, res) => {
  res.json(respondToSquad(req.userId, parse(id, req.params.squadId), 'declined'))
})
