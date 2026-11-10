/**
 * Splits total cents as evenly as possible across memberCount members.
 * Extra remainder cents are distributed one-by-one to members in join order (index 0..remainder-1).
 *
 * Invariant: sum(shares) === totalCents
 */
export function splitCents(totalCents: number, memberCount: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error('totalCents must be a positive safe integer')
  }
  if (!Number.isInteger(memberCount) || memberCount <= 0) {
    throw new Error('memberCount must be a positive integer')
  }

  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents % memberCount

  const shares: number[] = new Array(memberCount)
  let sum = 0

  for (let i = 0; i < memberCount; i++) {
    const amount = i < remainder ? base + 1 : base
    shares[i] = amount
    sum += amount
  }

  if (sum !== totalCents) {
    throw new Error(`Split invariant violation: sum (${sum}) !== total (${totalCents})`)
  }

  return shares
}
