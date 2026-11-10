import type { Balance, Bill, HomeDetail, Member, Share } from './types'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  // Chain external signal if provided
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    const text = await response.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Request failed with status ${response.status}`
      throw new ApiError(response.status, message)
    }

    return data as T
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out after 10 seconds. Please try again.')
    }
    const message = err instanceof Error ? err.message : 'Network error occurred'
    throw new ApiError(0, message)
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  createHome: (name: string) =>
    request<{ id: string; name: string }>('/api/homes', {
      method: 'POST',
      body: { name },
    }),

  getHome: (homeId: string, signal?: AbortSignal) =>
    request<HomeDetail>(`/api/homes/${homeId}`, { signal }),

  addMember: (homeId: string, name: string) =>
    request<Member>(`/api/homes/${homeId}/members`, {
      method: 'POST',
      body: { name },
    }),

  getBills: (homeId: string, signal?: AbortSignal) =>
    request<{ bills: Bill[] }>(`/api/homes/${homeId}/bills`, { signal }),

  createBill: (homeId: string, title: string, totalCents: number) =>
    request<Bill>(`/api/homes/${homeId}/bills`, {
      method: 'POST',
      body: { title, totalCents },
    }),

  payShare: (billId: string, shareId: string, idempotencyKey: string) =>
    request<Share>(`/api/bills/${billId}/shares/${shareId}/pay`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  getBalances: (homeId: string, signal?: AbortSignal) =>
    request<{ balances: Balance[] }>(`/api/homes/${homeId}/balances`, { signal }),
}
