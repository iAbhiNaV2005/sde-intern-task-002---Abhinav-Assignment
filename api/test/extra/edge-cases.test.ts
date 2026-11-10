import { describe, expect, it } from 'vitest'
import { type Bill, call, createBill, createHome, type Share } from '../helpers'

describe('edge cases and robustness', () => {
  it('handles 10 concurrent payments on the same share with different keys', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const bill = await createBill(homeId, 1000)
    const share = bill.body.shares[0]
    if (!share) throw new Error('Share missing')

    const attempts = Array.from({ length: 10 }, () =>
      call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    )

    const results = await Promise.all(attempts)
    const successes = results.filter((r) => r.status === 200)
    const conflicts = results.filter((r) => r.status === 409)

    expect(successes).toHaveLength(1)
    expect(conflicts).toHaveLength(9)

    for (const conf of conflicts) {
      const errBody = conf.body as unknown as { error: string }
      expect(errBody.error).toBeDefined()
    }
  })

  it('handles 10 concurrent payments on the same share with the SAME key', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const bill = await createBill(homeId, 1000)
    const share = bill.body.shares[0]
    if (!share) throw new Error('Share missing')

    const key = crypto.randomUUID()
    const attempts = Array.from({ length: 10 }, () =>
      call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
        headers: { 'Idempotency-Key': key },
      }),
    )

    const results = await Promise.all(attempts)
    expect(results.every((r) => r.status === 200)).toBe(true)

    const firstPaidAt = results[0]?.body.paidAt
    expect(firstPaidAt).toBeDefined()
    expect(results.every((r) => r.body.paidAt === firstPaidAt)).toBe(true)
  })

  it('rejects malformed or empty JSON bodies with 400 JSON error', async () => {
    const badJson = await call('POST', '/api/homes', {
      headers: { 'content-type': 'application/json' },
      body: undefined,
    })
    expect(badJson.status).toBe(400)
    expect(badJson.body).toEqual({ error: expect.any(String) })
  })

  it('rejects blank and non-string member/home names with 422', async () => {
    const blankHome = await call('POST', '/api/homes', { body: { name: '   ' } })
    expect(blankHome.status).toBe(422)

    const nonStringHome = await call('POST', '/api/homes', { body: { name: 12345 } })
    expect(nonStringHome.status).toBe(422)

    const { homeId } = await createHome(['Valid Member'])
    const blankMember = await call('POST', `/api/homes/${homeId}/members`, {
      body: { name: ' \t ' },
    })
    expect(blankMember.status).toBe(422)
  })

  it('returns JSON error on unknown routes', async () => {
    const res = await call('GET', '/api/unknown-route')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('supports GET /api/homes/:homeId and GET /api/homes/:homeId/bills', async () => {
    const { homeId } = await createHome(['Alice', 'Bob'])
    await createBill(homeId, 1500)

    const homeRes = await call<{
      id: string
      name: string
      members: { id: string; name: string }[]
    }>('GET', `/api/homes/${homeId}`)
    expect(homeRes.status).toBe(200)
    expect(homeRes.body.members).toHaveLength(2)
    expect(homeRes.body.members[0]?.name).toBe('Alice')
    expect(homeRes.body.members[1]?.name).toBe('Bob')

    const billsRes = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(billsRes.status).toBe(200)
    expect(billsRes.body.bills).toHaveLength(1)
    expect(billsRes.body.bills[0]?.totalCents).toBe(1500)
    expect(billsRes.body.bills[0]?.shares).toHaveLength(2)
  })
})
