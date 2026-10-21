import React, { useEffect, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { cn } from "cn"
import {
  Beaker,
  Database,
  GitCompare,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Mark } from "@/components/bench"
import { useAuth } from "@/context/AuthContext"
import { useAsync } from "@/lib/hooks"
import * as api from "@/api"

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/app/datasets", label: "Datasets", icon: Database },
  { to: "/app/playground", label: "Playground", icon: Beaker },
  { to: "/app/runs", label: "Runs", icon: ListChecks },
  { to: "/app/compare", label: "Compare", icon: GitCompare },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
]

/**
 * The console frame: a recessed rail on the left, a title block across the
 * top naming the sheet you are on, and the work on paper in the middle.
 */
export default function Shell({ title, lede, actions, children }) {
  const [railOpen, setRailOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()
  const { data: health } = useAsync(() => api.fetchHealth(), [])

  useEffect(() => {
    setRailOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (title) document.title = `${title} — LangSmith Lite`
  }, [title])

  return (
    <div className="flex min-h-screen">
      {/* --------------------------------- rail -------------------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[228px] shrink-0 flex-col border-r border-rule bg-paper-sunk transition-transform lg:static lg:translate-x-0",
          railOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-rule px-4">
          <Link to="/" aria-label="LangSmith Lite home">
            <Mark size={22} />
          </Link>
          <button
            type="button"
            onClick={() => setRailOpen(false)}
            aria-label="Close navigation"
            className="grid size-7 place-items-center text-ink-faint lg:hidden"
          >
            <X size={15} />
          </button>
        </div>

        <nav className="flex-1 p-2" aria-label="Console">
          <ul className="space-y-px">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-[2px] px-2.5 py-[7px] text-[13px] transition-colors",
                      isActive
                        ? "bg-plane font-medium text-ink shadow-[inset_2px_0_0_var(--color-signal)]"
                        : "text-ink-soft hover:bg-plane/60 hover:text-ink",
                    )
                  }
                >
                  <item.icon size={14.5} strokeWidth={1.9} className="shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Engine readout: says plainly whether live inference is available. */}
        <div className="border-t border-rule px-4 py-3">
          <p className="text-[11px] text-ink-faint">engine</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px]">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                health?.live_inference ? "bg-[#0ca30c]" : "bg-[#fab219]",
              )}
            />
            {health ? (health.live_inference ? "NVIDIA NIM" : "simulator only") : "checking"}
          </p>
          {health && (
            <p className="num mt-2 text-[10.5px] leading-relaxed text-ink-faint">
              {health.counts.datasets} sets / {health.counts.test_cases} cases /{" "}
              {health.counts.runs} runs
            </p>
          )}
        </div>

        <div className="border-t border-rule px-4 py-3">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">{user.name}</p>
                <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="grid size-7 shrink-0 place-items-center text-ink-faint transition-colors hover:text-ink"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </aside>

      {railOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setRailOpen(false)}
          className="fixed inset-0 z-40 bg-ink/25 lg:hidden"
        />
      )}

      {/* --------------------------------- work --------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-[2px]">
          <div className="flex min-h-14 flex-wrap items-center gap-3 px-5 py-3 lg:px-8">
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              aria-label="Open navigation"
              className="grid size-8 shrink-0 place-items-center border border-rule text-ink-soft lg:hidden"
            >
              <Menu size={15} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="display-md truncate">{title}</h1>
              {lede && <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">{lede}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
