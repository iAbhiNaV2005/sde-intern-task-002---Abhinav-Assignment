import { Hono } from 'hono'
import { getBalancesByHome } from '../db/balances'
import type { AppEnv } from '../types'

export const balancesRouter = new Hono<AppEnv>()

balancesRouter.get('/api/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')
  const balances = await getBalancesByHome(c.env.DB, homeId)

  return c.json({ balances }, 200)
})
