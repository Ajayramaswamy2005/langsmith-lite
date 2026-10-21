import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "cn"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Mark } from "@/components/bench"
import { useAuth } from "@/context/AuthContext"

const LINKS = [
  { label: "What it measures", href: "#measures" },
  { label: "Traces", href: "#traces" },
  { label: "How it runs", href: "#sequence" },
  { label: "Pricing", href: "#pricing" },
  { label: "Questions", href: "#questions" },
]

/** A title-block bar: drawn on a hairline, flat on the paper, never glassy. */
export default function TopBar() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-[2px]">
      <div className="sheet flex h-14 items-center justify-between gap-6">
        <Link to="/" aria-label="LangSmith Lite home">
          <Mark />
        </Link>

        <nav className="hidden lg:block" aria-label="Sections">
          <ul className="flex items-center gap-7">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-[13px] text-ink-soft transition-colors hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link to="/app">Open the bench</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/login?mode=signup">Start a run</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-8 place-items-center border border-rule text-ink-soft lg:hidden"
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-rule bg-paper lg:hidden" aria-label="Sections">
          <ul className="sheet divide-y divide-rule-soft py-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[15px] text-ink-soft"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link to="/login" onClick={() => setOpen(false)} className="block py-3 text-[15px]">
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
