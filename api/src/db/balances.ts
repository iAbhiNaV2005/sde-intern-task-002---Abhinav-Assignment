import { AppError } from '../lib/errors'
import type { BalanceItem, BalanceRow } from '../types'
import { findHomeById } from './homes'

export async function getBalancesByHome(db: D1Database, homeId: string): Promise<BalanceItem[]> {
  const home = await findHomeById(db, homeId)
  if (!home) {
    throw new AppError(404, 'Home not found')
  }

  const result = await db
    .prepare(
      `SELECT 
         m.id AS member_id,
         m.name,
         COALESCE(SUM(CASE WHEN s.paid_at IS NULL AND s.id IS NOT NULL THEN s.amount_cents ELSE 0 END), 0) AS outstanding_cents
       FROM members m
       LEFT JOIN shares s ON s.member_id = m.id
       WHERE m.home_id = ?
       GROUP BY m.id, m.name, m.seq
       ORDER BY m.seq ASC`,
    )
    .bind(homeId)
    .all<BalanceRow>()

  return result.results.map((r) => ({
    memberId: r.member_id,
    name: r.name,
    outstandingCents: Number(r.outstanding_cents),
  }))
}
