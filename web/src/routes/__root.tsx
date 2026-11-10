import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <header className="site-header">
        <div className="nav-container">
          <Link to="/" className="brand">
            <span>Bill Splitter</span>
            <span className="brand-badge">Split & Pay</span>
          </Link>
          <nav>
            <Link to="/" className="btn btn-secondary btn-sm">
              Home Directory
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </>
  )
}
