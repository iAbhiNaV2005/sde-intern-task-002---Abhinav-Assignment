import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export const Route = createFileRoute('/')({
  component: HomePage,
})

type SavedHome = {
  id: string
  name: string
  visitedAt: number
}

function HomePage() {
  const navigate = useNavigate()

  const [homeName, setHomeName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [lookupId, setLookupId] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bill_splitter_homes')
      if (stored) {
        setSavedHomes(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
  }, [])

  const saveHomeToStorage = (id: string, name: string) => {
    try {
      const existing = savedHomes.filter((h) => h.id !== id)
      const updated = [{ id, name, visitedAt: Date.now() }, ...existing].slice(0, 5)
      setSavedHomes(updated)
      localStorage.setItem('bill_splitter_homes', JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = homeName.trim()
    if (!trimmed) {
      setCreateError('Home name cannot be blank')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    try {
      const created = await api.createHome(trimmed)
      saveHomeToStorage(created.id, created.name)
      navigate({ to: '/homes/$homeId', params: { homeId: created.id } })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create home')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenExisting = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = lookupId.trim()
    if (!trimmed) {
      setLookupError('Please enter a valid Home ID')
      return
    }
    navigate({ to: '/homes/$homeId', params: { homeId: trimmed } })
  }

  return (
    <main className="container">
      <div style={{ maxWidth: 640, margin: '40px auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: '2.1rem', marginBottom: 8 }}>Shared Bill Splitter</h1>
          <p className="subtitle" style={{ fontSize: '1.05rem' }}>
            Split rent, utilities, and house expenses evenly with exact cent precision.
          </p>
        </div>

        {/* Create Home Panel */}
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Create a New Home</h2>
          </div>
          <form onSubmit={handleCreateHome}>
            <div className="form-group">
              <label htmlFor="home-name" className="form-label">
                Home or Apartment Name
              </label>
              <input
                id="home-name"
                type="text"
                className="input"
                placeholder="e.g. Flat 4B, Elm Street Villa"
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            {createError && (
              <div className="share-error" style={{ marginBottom: 12 }}>
                {createError}
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={isCreating}
            >
              {isCreating ? 'Creating Home...' : 'Create Home & Continue →'}
            </button>
          </form>
        </section>

        {/* Open Existing Home */}
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Open Existing Home</h2>
          </div>
          <form onSubmit={handleOpenExisting}>
            <div className="form-group">
              <label htmlFor="lookup-id" className="form-label">
                Home UUID
              </label>
              <input
                id="lookup-id"
                type="text"
                className="input"
                placeholder="Paste home ID"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
            </div>
            {lookupError && (
              <div className="share-error" style={{ marginBottom: 12 }}>
                {lookupError}
              </div>
            )}
            <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
              Open Home
            </button>
          </form>
        </section>

        {/* Recently Visited */}
        {savedHomes.length > 0 && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Recent Homes</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedHomes.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => navigate({ to: '/homes/$homeId', params: { homeId: h.id } })}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                >
                  <span style={{ fontWeight: 600 }}>{h.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {h.id.slice(0, 8)}...
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
