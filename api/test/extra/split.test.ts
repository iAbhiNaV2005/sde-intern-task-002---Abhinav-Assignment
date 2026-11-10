import { describe, expect, it } from 'vitest'
import { splitCents } from '../../src/domain/split'

describe('splitCents domain logic', () => {
  it('handles standard and edge-case splits from the table', () => {
    // 1000 / 3
    expect(splitCents(1000, 3)).toEqual([334, 333, 333])
    // 1000 / 4
    expect(splitCents(1000, 4)).toEqual([250, 250, 250, 250])
    // 1 / 3
    expect(splitCents(1, 3)).toEqual([1, 0, 0])
    // 2 / 3
    expect(splitCents(2, 3)).toEqual([1, 1, 0])
    // 100 / 1
    expect(splitCents(100, 1)).toEqual([100])
  })

  it('preserves invariant across a wide range of amounts and member counts', () => {
    for (let members = 1; members <= 10; members++) {
      for (const total of [1, 2, 5, 7, 10, 99, 100, 333, 1000, 9999, 100001]) {
        const shares = splitCents(total, members)

        // Count matches members
        expect(shares).toHaveLength(members)

        // Sum invariant
        const sum = shares.reduce((acc, v) => acc + v, 0)
        expect(sum).toBe(total)

        // Non-negative
        for (const share of shares) {
          expect(share).toBeGreaterThanOrEqual(0)
        }

        // Shares differ by at most 1
        const min = Math.min(...shares)
        const max = Math.max(...shares)
        expect(max - min).toBeLessThanOrEqual(1)

        // Extras go to the earliest members
        const remainder = total % members
        const base = Math.floor(total / members)
        for (let i = 0; i < members; i++) {
          if (i < remainder) {
            expect(shares[i]).toBe(base + 1)
          } else {
            expect(shares[i]).toBe(base)
          }
        }
      }
    }
  })

  it('rejects invalid inputs', () => {
    expect(() => splitCents(0, 3)).toThrow()
    expect(() => splitCents(-50, 3)).toThrow()
    expect(() => splitCents(10.5, 3)).toThrow()
    expect(() => splitCents(100, 0)).toThrow()
    expect(() => splitCents(100, -2)).toThrow()
    expect(() => splitCents(100, 1.5)).toThrow()
  })
})

