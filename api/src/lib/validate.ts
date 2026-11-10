import type { Context } from 'hono'
import { AppError } from './errors'

export async function parseJsonBody(c: Context): Promise<Record<string, unknown>> {
  let raw: string
  try {
    raw = await c.req.text()
  } catch {
    throw new AppError(400, 'Failed to read request body')
  }

  if (!raw.trim()) {
    throw new AppError(400, 'Request body cannot be empty')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AppError(400, 'Malformed JSON body')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AppError(400, 'Request body must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

export function validateName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError(422, 'Name must be a string')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new AppError(422, 'Name cannot be blank')
  }
  if (trimmed.length > 100) {
    throw new AppError(422, 'Name must not exceed 100 characters')
  }
  return trimmed
}

export function validateTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError(422, 'Title must be a string')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new AppError(422, 'Title cannot be blank')
  }
  if (trimmed.length > 200) {
    throw new AppError(422, 'Title must not exceed 200 characters')
  }
  return trimmed
}

export function validateTotalCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new AppError(422, 'Total cents must be a positive safe integer')
  }
  return value
}

export function validateIdempotencyKey(header: string | undefined): string {
  if (!header || typeof header !== 'string') {
    throw new AppError(400, 'Missing Idempotency-Key header')
  }
  const trimmed = header.trim()
  if (trimmed.length === 0) {
    throw new AppError(400, 'Idempotency-Key header cannot be blank')
  }
  if (trimmed.length > 255) {
    throw new AppError(400, 'Idempotency-Key header is too long')
  }
  return trimmed
}
