import React from "react"
import { Link, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Mark } from "@/components/bench"
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Overview from "@/pages/Overview"
import Datasets from "@/pages/Datasets"
import DatasetDetail from "@/pages/DatasetDetail"
import Playground from "@/pages/Playground"
import Runs from "@/pages/Runs"
import RunDetail from "@/pages/RunDetail"
import Compare from "@/pages/Compare"
import Settings from "@/pages/Settings"

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule">
        <div className="sheet flex h-14 items-center">
          <Link to="/" aria-label="LangSmith Lite home">
            <Mark />
          </Link>
        </div>
      </header>
      <main className="sheet flex flex-1 flex-col justify-center py-20">
        <p className="num text-[12px] text-ink-faint">404</p>
        <h1 className="display-lg mt-3 max-w-[20ch]">That page is not on the bench</h1>
        <p className="measure mt-3 text-[14px] leading-relaxed text-ink-soft">
          The link may be stale, or the run or dataset it pointed at was deleted.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/app">Go to the overview</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to the front page</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Overview />} />
        <Route path="/app/datasets" element={<Datasets />} />
        <Route path="/app/datasets/:id" element={<DatasetDetail />} />
        <Route path="/app/playground" element={<Playground />} />
        <Route path="/app/runs" element={<Runs />} />
        <Route path="/app/runs/:id" element={<RunDetail />} />
        <Route path="/app/compare" element={<Compare />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  )
}
