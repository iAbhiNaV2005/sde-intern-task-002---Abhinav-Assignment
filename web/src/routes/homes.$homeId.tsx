import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../lib/api'
import { formatCents, parseDollarsToCents } from '../lib/money'
import type { Balance, Bill, HomeDetail, Share } from '../lib/types'

export const Route = createFileRoute('/homes/$homeId')({
  component: HomeDetailPage,
})

function HomeDetailPage() {
  const { homeId } = Route.useParams()

  // Data states
  const [home, setHome] = useState<HomeDetail | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  // Loading & error states
  const [loadingHome, setLoadingHome] = useState(true)
  const [loadingBills, setLoadingBills] = useState(true)
  const [loadingBalances, setLoadingBalances] = useState(true)

  const [homeError, setHomeError] = useState<string | null>(null)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [balancesError, setBalancesError] = useState<string | null>(null)

  // Forms
  const [newMemberName, setNewMemberName] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberFormError, setMemberFormError] = useState<string | null>(null)

  const [billTitle, setBillTitle] = useState('')
  const [billAmountDollars, setBillAmountDollars] = useState('')
  const [isCreatingBill, setIsCreatingBill] = useState(false)
  const [billFormError, setBillFormError] = useState<string | null>(null)

  // Fetch functions
  const fetchHome = useCallback(async () => {
    setLoadingHome(true)
    setHomeError(null)
    try {
      const data = await api.getHome(homeId)
      setHome(data)
    } catch (err) {
      setHomeError(err instanceof Error ? err.message : 'Failed to load home details')
    } finally {
      setLoadingHome(false)
    }
  }, [homeId])

  const fetchBalances = useCallback(async () => {
    setLoadingBalances(true)
    setBalancesError(null)
    try {
      const data = await api.getBalances(homeId)
      setBalances(data.balances)
    } catch (err) {
      setBalancesError(err instanceof Error ? err.message : 'Failed to load balances')
    } finally {
      setLoadingBalances(false)
    }
  }, [homeId])

  const fetchBills = useCallback(async () => {
    setLoadingBills(true)
    setBillsError(null)
    try {
      const data = await api.getBills(homeId)
      setBills(data.bills)
    } catch (err) {
      setBillsError(err instanceof Error ? err.message : 'Failed to load bills')
    } finally {
      setLoadingBills(false)
    }
  }, [homeId])

  useEffect(() => {
    fetchHome()
    fetchBalances()
    fetchBills()
  }, [fetchHome, fetchBalances, fetchBills])

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newMemberName.trim()
    if (!trimmed) {
      setMemberFormError('Member name cannot be blank')
      return
    }

    setIsAddingMember(true)
    setMemberFormError(null)
    try {
      await api.addMember(homeId, trimmed)
      setNewMemberName('')
      await Promise.all([fetchHome(), fetchBalances()])
    } catch (err) {
      setMemberFormError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setIsAddingMember(false)
    }
  }

  // Create Bill
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = billTitle.trim()
    if (!trimmedTitle) {
      setBillFormError('Bill title cannot be blank')
      return
    }

    const cents = parseDollarsToCents(billAmountDollars)
    if (cents === null || cents <= 0) {
      setBillFormError('Enter a valid positive dollar amount (e.g. 15.00)')
      return
    }

    if (!home || home.members.length === 0) {
      setBillFormError('You must add at least one member before splitting a bill')
      return
    }

    setIsCreatingBill(true)
    setBillFormError(null)
    try {
      await api.createBill(homeId, trimmedTitle, cents)
      setBillTitle('')
      setBillAmountDollars('')
      await Promise.all([fetchBills(), fetchBalances()])
    } catch (err) {
      setBillFormError(err instanceof Error ? err.message : 'Failed to create bill')
    } finally {
      setIsCreatingBill(false)
    }
  }

  // Callback when a share is paid
  const handleSharePaymentSuccess = async () => {
    await Promise.all([fetchBills(), fetchBalances()])
  }

  // Helper map from memberId to member name
  const memberNameMap = new Map<string, string>()
  if (home?.members) {
    for (const m of home.members) {
      memberNameMap.set(m.id, m.name)
    }
  }

  return (
    <main className="container">
      {/* Home Header */}
      <section className="panel">
        {loadingHome ? (
          <div>
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ) : homeError ? (
          <div className="error-banner">
            <div>
              <div className="error-text">Failed to load home details: {homeError}</div>
              <p style={{ fontSize: '0.82rem', marginTop: 4 }}>
                The home might not exist or the server could be temporarily unavailable.
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchHome}>
              Retry
            </button>
          </div>
        ) : home ? (
          <div>
            <div className="panel-header" style={{ marginBottom: 12 }}>
              <div>
                <h1>{home.name}</h1>
                <p className="subtitle">ID: {home.id}</p>
              </div>
            </div>

            <div>
              <span className="form-label">Members ({home.members.length}):</span>
              {home.members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No members added yet. Add housemates below to start splitting bills.
                </p>
              ) : (
                <div className="members-chips">
                  {home.members.map((m, idx) => (
                    <span key={m.id} className="member-chip">
                      #{idx + 1} {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add Member Form */}
            <form
              onSubmit={handleAddMember}
              style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}
            >
              <input
                type="text"
                className="input"
                style={{ maxWidth: 260 }}
                placeholder="New member name (e.g. Alex)"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                disabled={isAddingMember}
              />
              <button type="submit" className="btn btn-primary" disabled={isAddingMember}>
                {isAddingMember ? 'Adding...' : 'Add Member'}
              </button>
            </form>
            {memberFormError && (
              <p className="share-error" style={{ marginTop: 6 }}>
                {memberFormError}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {/* Balances Section */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Member Balances</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchBalances}
            disabled={loadingBalances}
          >
            Refresh
          </button>
        </div>

        {loadingBalances ? (
          <div className="balances-grid">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : balancesError ? (
          <div className="error-banner">
            <span className="error-text">Error loading balances: {balancesError}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchBalances}>
              Retry
            </button>
          </div>
        ) : balances.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <div className="empty-title">No members in this home</div>
            <div className="empty-desc">Add members above to see who owes what.</div>
          </div>
        ) : (
          <div className="balances-grid">
            {balances.map((b) => (
              <div key={b.memberId} className="balance-card">
                <div className="balance-card-header">
                  <span className="balance-name">{b.name}</span>
                  <span
                    className={`balance-badge ${b.outstandingCents === 0 ? 'settled' : 'owing'}`}
                  >
                    {b.outstandingCents === 0 ? 'All Settled' : 'Unpaid Balance'}
                  </span>
                </div>
                <div className="balance-amount">{formatCents(b.outstandingCents)}</div>
                <span className="balance-label">Total outstanding share</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Bill Form */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Split a New Bill</h2>
        </div>
        <form onSubmit={handleCreateBill}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <div className="form-group">
              <label htmlFor="bill-title" className="form-label">
                Bill Title
              </label>
              <input
                id="bill-title"
                type="text"
                className="input"
                placeholder="e.g. Wi-Fi, Electricity, Dinner"
                value={billTitle}
                onChange={(e) => setBillTitle(e.target.value)}
                disabled={isCreatingBill}
              />
            </div>
            <div className="form-group">
              <label htmlFor="bill-amount" className="form-label">
                Total Amount ($ USD)
              </label>
              <input
                id="bill-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                placeholder="0.00"
                value={billAmountDollars}
                onChange={(e) => setBillAmountDollars(e.target.value)}
                disabled={isCreatingBill}
              />
            </div>
          </div>

          {billFormError && (
            <div className="share-error" style={{ marginBottom: 12 }}>
              {billFormError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isCreatingBill || (home?.members.length ?? 0) === 0}
          >
            {isCreatingBill ? 'Splitting Bill...' : 'Create & Split Bill'}
          </button>
          {(home?.members.length ?? 0) === 0 && (
            <span style={{ marginLeft: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              (Requires at least 1 member)
            </span>
          )}
        </form>
      </section>

      {/* Bills List Section */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Bills & Shares</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchBills}
            disabled={loadingBills}
          >
            Refresh Bills
          </button>
        </div>

        {loadingBills ? (
          <div>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : billsError ? (
          <div className="error-banner">
            <span className="error-text">Failed to load bills: {billsError}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchBills}>
              Retry
            </button>
          </div>
        ) : bills.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🧾</span>
            <div className="empty-title">No bills yet</div>
            <div className="empty-desc">
              Add your first shared expense above. Shares will be automatically split between all
              home members!
            </div>
          </div>
        ) : (
          <div>
            {bills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                memberNameMap={memberNameMap}
                onPaymentSuccess={handleSharePaymentSuccess}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function BillCard({
  bill,
  memberNameMap,
  onPaymentSuccess,
}: {
  bill: Bill
  memberNameMap: Map<string, string>
  onPaymentSuccess: () => void
}) {
  const paidCount = bill.shares.filter((s) => s.paidAt !== null).length
  const totalCount = bill.shares.length

  return (
    <article className="bill-card">
      <div className="bill-card-header">
        <div>
          <div className="bill-title">{bill.title}</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {paidCount} of {totalCount} shares paid
          </span>
        </div>
        <div className="bill-total">{formatCents(bill.totalCents)}</div>
      </div>

      <div className="shares-list">
        {bill.shares.map((share) => (
          <ShareRowItem
            key={share.id}
            billId={bill.id}
            share={share}
            memberName={
              memberNameMap.get(share.memberId) ?? `Member (${share.memberId.slice(0, 6)}...)`
            }
            onPaymentSuccess={onPaymentSuccess}
          />
        ))}
      </div>
    </article>
  )
}

function ShareRowItem({
  billId,
  share,
  memberName,
  onPaymentSuccess,
}: {
  billId: string
  share: Share
  memberName: string
  onPaymentSuccess: () => void
}) {
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  // Critical requirement: Stable Idempotency-Key per payment intent.
  // Re-uses the EXACT same key across retries if a payment fails!
  const idempotencyKeyRef = useRef<string | null>(null)
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = crypto.randomUUID()
  }

  const handlePay = async () => {
    setIsPaying(true)
    setPayError(null)

    const key = idempotencyKeyRef.current as string
    try {
      await api.payShare(billId, share.id, key)
      // Success!
      onPaymentSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already paid elsewhere
        setPayError('Share is already paid')
        onPaymentSuccess()
      } else {
        // Unpaid state preserved; retry button reuses the exact same key!
        setPayError(err instanceof Error ? err.message : 'Payment failed. Please retry.')
      }
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="share-row">
      <div>
        <div className="share-member">{memberName}</div>
        {payError && <div className="share-error">{payError}</div>}
      </div>

      <div className="share-actions">
        <span className="share-amount">{formatCents(share.amountCents)}</span>
        {share.paidAt ? (
          <span className="paid-badge">✓ Paid</span>
        ) : (
          <button
            type="button"
            className="btn btn-pay"
            onClick={handlePay}
            disabled={isPaying}
            aria-busy={isPaying}
          >
            {isPaying ? 'Paying...' : payError ? 'Retry Pay' : 'Pay Share'}
          </button>
        )}
      </div>
    </div>
  )
}
