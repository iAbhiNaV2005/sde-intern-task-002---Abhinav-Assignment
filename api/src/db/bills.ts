import { splitCents } from '../domain/split'
import type { BillResponse, BillRow, MemberRow, ShareResponse, ShareRow } from '../types'

export async function createBillWithShares(
  db: D1Database,
  homeId: string,
  title: string,
  totalCents: number,
  members: MemberRow[],
): Promise<BillResponse> {
  const amounts = splitCents(totalCents, members.length)
  const billId = crypto.randomUUID()

  const shares: ShareResponse[] = members.map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents: amounts[index] as number,
    paidAt: null,
  }))

  const billInsert = db
    .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
    .bind(billId, homeId, title, totalCents)

  const shareInserts = shares.map((share) =>
    db
      .prepare('INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)')
      .bind(share.id, billId, share.memberId, share.amountCents),
  )

  await db.batch([billInsert, ...shareInserts])

  return {
    id: billId,
    homeId,
    title,
    totalCents,
    shares,
  }
}

export async function listBillsByHome(db: D1Database, homeId: string): Promise<BillResponse[]> {
  const billsResult = await db
    .prepare(
      'SELECT id, home_id, title, total_cents, created_at FROM bills WHERE home_id = ? ORDER BY rowid DESC',
    )
    .bind(homeId)
    .all<BillRow>()

  const bills = billsResult.results
  if (bills.length === 0) {
    return []
  }

  const sharesResult = await db
    .prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, s.payment_key
       FROM shares s
       JOIN bills b ON s.bill_id = b.id
       JOIN members m ON s.member_id = m.id
       WHERE b.home_id = ?
       ORDER BY m.seq ASC`,
    )
    .bind(homeId)
    .all<ShareRow>()

  const sharesByBill: Record<string, ShareResponse[]> = {}
  for (const s of sharesResult.results) {
    if (!sharesByBill[s.bill_id]) {
      sharesByBill[s.bill_id] = []
    }
    sharesByBill[s.bill_id]?.push({
      id: s.id,
      memberId: s.member_id,
      amountCents: s.amount_cents,
      paidAt: s.paid_at,
    })
  }

  return bills.map((b) => ({
    id: b.id,
    homeId: b.home_id,
    title: b.title,
    totalCents: b.total_cents,
    shares: sharesByBill[b.id] ?? [],
  }))
}

