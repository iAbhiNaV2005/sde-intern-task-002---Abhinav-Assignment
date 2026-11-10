import type { HomeRow, MemberRow } from '../types'

export async function createHome(db: D1Database, name: string): Promise<HomeRow> {
  const id = crypto.randomUUID()
  const created = await db
    .prepare('INSERT INTO homes (id, name) VALUES (?, ?) RETURNING id, name, created_at')
    .bind(id, name)
    .first<HomeRow>()

  if (!created) {
    throw new Error('Failed to create home')
  }
  return created
}

export async function findHomeById(db: D1Database, homeId: string): Promise<HomeRow | null> {
  return db
    .prepare('SELECT id, name, created_at FROM homes WHERE id = ?')
    .bind(homeId)
    .first<HomeRow>()
}

export async function createMember(
  db: D1Database,
  homeId: string,
  name: string,
): Promise<MemberRow> {
  const id = crypto.randomUUID()
  const created = await db
    .prepare(
      'INSERT INTO members (id, home_id, name) VALUES (?, ?, ?) RETURNING seq, id, home_id, name, created_at',
    )
    .bind(id, homeId, name)
    .first<MemberRow>()

  if (!created) {
    throw new Error('Failed to create member')
  }
  return created
}

export async function listMembersByHome(db: D1Database, homeId: string): Promise<MemberRow[]> {
  const result = await db
    .prepare(
      'SELECT seq, id, home_id, name, created_at FROM members WHERE home_id = ? ORDER BY seq ASC',
    )
    .bind(homeId)
    .all<MemberRow>()

  return result.results
}
