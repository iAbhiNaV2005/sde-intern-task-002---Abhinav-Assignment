import { Hono } from 'hono'
import { createHome, createMember, findHomeById, listMembersByHome } from '../db/homes'
import { AppError } from '../lib/errors'
import { parseJsonBody, validateName } from '../lib/validate'
import type { AppEnv } from '../types'

export const homesRouter = new Hono<AppEnv>()

homesRouter.post('/api/homes', async (c) => {
  const body = await parseJsonBody(c)
  const name = validateName(body.name)
  const home = await createHome(c.env.DB, name)

  return c.json(
    {
      id: home.id,
      name: home.name,
    },
    201,
  )
})

homesRouter.post('/api/homes/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHomeById(c.env.DB, homeId)
  if (!home) {
    throw new AppError(404, 'Home not found')
  }

  const body = await parseJsonBody(c)
  const name = validateName(body.name)
  const member = await createMember(c.env.DB, homeId, name)

  return c.json(
    {
      id: member.id,
      homeId: member.home_id,
      name: member.name,
    },
    201,
  )
})

homesRouter.get('/api/homes/:homeId', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHomeById(c.env.DB, homeId)
  if (!home) {
    throw new AppError(404, 'Home not found')
  }

  const members = await listMembersByHome(c.env.DB, homeId)

  return c.json({
    id: home.id,
    name: home.name,
    members: members.map((m) => ({ id: m.id, name: m.name })),
  })
})
