import { AppError } from '../lib/errors'
import type { ShareResponse, ShareRow } from '../types'

export async function payShare(
  db: D1Database,
  billId: string,
  shareId: string,
  idempotencyKey: string,
): Promise<ShareResponse> {
  // Step 1: Atomic conditional update
  const updated = await db
    .prepare(
      `UPDATE shares
       SET paid_at = datetime('now'), payment_key = ?
       WHERE id = ? AND bill_id = ? AND paid_at IS NULL
       RETURNING id, member_id, amount_cents, paid_at`,
    )
    .bind(idempotencyKey, shareId, billId)
    .first<{
      id: string
      member_id: string
      amount_cents: number
      paid_at: string
    }>()

  if (updated) {
    return {
      id: updated.id,
      memberId: updated.member_id,
      amountCents: updated.amount_cents,
      paidAt: updated.paid_at,
    }
  }

  // Step 2: No row was updated; find out why
  const existing = await db
    .prepare(
      `SELECT id, bill_id, member_id, amount_cents, paid_at, payment_key
       FROM shares
       WHERE id = ? AND bill_id = ?`,
    )
    .bind(shareId, billId)
    .first<ShareRow>()

  if (!existing) {
    throw new AppError(404, 'Share or bill not found')
  }

  if (existing.payment_key === idempotencyKey) {
    // Replay with identical key: idempotent success with original timestamp
    return {
      id: existing.id,
      memberId: existing.member_id,
      amountCents: existing.amount_cents,
      paidAt: existing.paid_at,
    }
  }

  // Already paid with another key
  throw new AppError(409, 'Share has already been paid with a different idempotency key')
}
