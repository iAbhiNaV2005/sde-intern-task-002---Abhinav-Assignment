import { Hono } from 'hono'
import { createBillWithShares, listBillsByHome } from '../db/bills'
import { findHomeById, listMembersByHome } from '../db/homes'
import { payShare } from '../db/shares'
import { AppError } from '../lib/errors'
import {
  parseJsonBody,
  validateIdempotencyKey,
  validateTitle,
  validateTotalCents,
} from '../lib/validate'
import type { AppEnv } from '../types'

export const billsRouter = new Hono<AppEnv>()

billsRouter.post('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await parseJsonBody(c)
  const totalCents = validateTotalCents(body.totalCents)
  const title = validateTitle(body.title)

  const home = await findHomeById(c.env.DB, homeId)
  if (!home) {
    throw new AppError(404, 'Home not found')
  }

  const members = await listMembersByHome(c.env.DB, homeId)
  if (members.length === 0) {
    throw new AppError(422, 'Cannot split bill: home has no members')
  }

  const bill = await createBillWithShares(c.env.DB, homeId, title, totalCents, members)
  return c.json(bill, 201)
})

billsRouter.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')
  const key = validateIdempotencyKey(c.req.header('Idempotency-Key'))

  const paidShare = await payShare(c.env.DB, billId, shareId, key)
  return c.json(paidShare, 200)
})

billsRouter.get('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHomeById(c.env.DB, homeId)
  if (!home) {
    throw new AppError(404, 'Home not found')
  }

  const bills = await listBillsByHome(c.env.DB, homeId)
  return c.json({ bills }, 200)
})

