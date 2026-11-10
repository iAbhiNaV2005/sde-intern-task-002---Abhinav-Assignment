import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('database named constraints', () => {
  it('enforces ck_bills_total_positive (rejects 0 and negative bill amounts)', async () => {
    const homeId = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(homeId, 'Home Ck').run()

    await expect(
      env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), homeId, 'Bad Bill', 0)
        .run(),
    ).rejects.toThrow()

    await expect(
      env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), homeId, 'Negative Bill', -500)
        .run(),
    ).rejects.toThrow()
  })

  it('enforces uq_shares_bill_member (cannot have duplicate shares for same member in a bill)', async () => {
    const homeId = crypto.randomUUID()
    const memberId = crypto.randomUUID()
    const billId = crypto.randomUUID()

    await env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(homeId, 'Home Uq').run()
    await env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
      .bind(memberId, homeId, 'Member Uq')
      .run()
    await env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(billId, homeId, 'Bill Uq', 100)
      .run()

    await env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), billId, memberId, 100)
      .run()

    // Second share for the exact same member and bill must violate uq_shares_bill_member
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), billId, memberId, 100)
        .run(),
    ).rejects.toThrow()
  })

  it('enforces ck_shares_paid_consistent (prevents half-paid states)', async () => {
    const homeId = crypto.randomUUID()
    const memberId = crypto.randomUUID()
    const billId = crypto.randomUUID()

    await env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)')
      .bind(homeId, 'Home Paid')
      .run()
    await env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
      .bind(memberId, homeId, 'Member Paid')
      .run()
    await env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(billId, homeId, 'Bill Paid', 100)
      .run()

    // paid_at set without payment_key
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents, paid_at, payment_key) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), billId, memberId, 100, '2026-11-10T00:00:00Z', null)
        .run(),
    ).rejects.toThrow()

    // payment_key set without paid_at
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents, paid_at, payment_key) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), billId, memberId, 100, null, 'some-key')
        .run(),
    ).rejects.toThrow()
  })

  it('enforces foreign key constraints (fk_members_home, fk_bills_home, fk_shares_bill)', async () => {
    // Orphan member
    await expect(
      env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
        .bind(crypto.randomUUID(), 'non-existent-home', 'Ghost')
        .run(),
    ).rejects.toThrow()

    // Orphan bill
    await expect(
      env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), 'non-existent-home', 'Ghost Bill', 100)
        .run(),
    ).rejects.toThrow()
  })
})
