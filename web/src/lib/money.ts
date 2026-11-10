const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats integer cents into standard USD string for display (e.g. 1000 -> "$10.00").
 * Only used at the view boundary.
 */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00'
  return currencyFormatter.format(cents / 100)
}

/**
 * Safely parses user dollar input (e.g. "25", "10.50") into integer cents (2500, 1050).
 * Returns null if input is invalid or <= 0.
 */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Accepts numbers with optional two decimal places
  const num = Number(trimmed)
  if (Number.isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return null
  }

  const cents = Math.round(num * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null
  }

  return cents
}
