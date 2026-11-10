import { Hono } from 'hono'
import { AppError } from './lib/errors'
import { balancesRouter } from './routes/balances'
import { billsRouter } from './routes/bills'
import { homesRouter } from './routes/homes'
import type { AppEnv } from './types'

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // Mount routers
  app.route('/', homesRouter)
  app.route('/', billsRouter)
  app.route('/', balancesRouter)

  // 404 handler: every unknown route returns JSON
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  // Global error handler: catches AppError and crashes, returns JSON { "error": "message" }
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.status)
    }
    console.error('Unhandled server exception:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
