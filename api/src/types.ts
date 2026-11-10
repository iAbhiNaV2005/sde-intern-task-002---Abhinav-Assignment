export type AppEnv = {
  Bindings: Env
}

export type HomeRow = {
  id: string
  name: string
  created_at: string
}

export type MemberRow = {
  seq: number
  id: string
  home_id: string
  name: string
  created_at: string
}

export type BillRow = {
  id: string
  home_id: string
  title: string
  total_cents: number
  created_at: string
}

export type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  payment_key: string | null
}

export type BalanceRow = {
  member_id: string
  name: string
  outstanding_cents: number
}

export type ShareResponse = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

export type BillResponse = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: ShareResponse[]
}

export type MemberResponse = {
  id: string
  homeId: string
  name: string
}

export type HomeDetailMember = {
  id: string
  name: string
}

export type HomeDetailResponse = {
  id: string
  name: string
  members: HomeDetailMember[]
}

export type BalanceItem = {
  memberId: string
  name: string
  outstandingCents: number
}

export type BalanceResponse = {
  balances: BalanceItem[]
}
