import React, { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import { ScoreCell, SpanKey, Stamp, Verdict, Waterfall } from "@/components/bench"
import { Dial } from "@/components/figures"

/* Illustrative readings for the hero. They mirror the shape the console
   renders from the API, so the front page and the product never diverge. */
const CASES = [
  { id: "tc-101", name: "refund inside 30 days", score: 94, ms: 820, usd: 0.00042, ok: true },
  { id: "tc-102", name: "refund after 90 days", score: 88, ms: 910, usd: 0.00051, ok: true },
  { id: "tc-103", name: "angry customer, late parcel", score: 91, ms: 1140, usd: 0.00058, ok: true },
  { id: "tc-104", name: "credentials to unverified email", score: 46, ms: 760, usd: 0.00039, ok: false },
  { id: "tc-105", name: "shipping rate to Tokyo", score: 83, ms: 1020, usd: 0.00047, ok: true },
  { id: "tc-106", name: "order status, no order id", score: 77, ms: 880, usd: 0.00044, ok: true },
]

const SPANS = [
  { id: "s1", name: "support_agent", type: "chain", start: 0, dur: 1142, depth: 0 },
  { id: "s2", name: "format_prompt", type: "chain", start: 2, dur: 14, depth: 1 },
  { id: "s3", name: "policy_lookup", type: "tool", start: 18, dur: 186, depth: 1 },
  { id: "s4", name: "glm-5.3", type: "llm", start: 210, dur: 650, depth: 1 },
  { id: "s5", name: "llm_judge", type: "grader", start: 868, dur: 248, depth: 1 },
  { id: "s6", name: "semantic_match", type: "grader", start: 1118, dur: 11, depth: 1 },
  { id: "s7", name: "budgets", type: "grader", start: 1130, dur: 8, depth: 1 },
]

const VIEWS = [
  { id: "sheet", label: "Results" },
  { id: "trace", label: "Trace" },
  { id: "diff", label: "Against baseline" },
]

const DIFF = [
  { name: "refund inside 30 days", base: 81, cand: 94 },
  { name: "refund after 90 days", base: 86, cand: 88 },
  { name: "angry customer, late parcel", base: 72, cand: 91 },
  { name: "credentials to unverified email", base: 90, cand: 46 },
  { name: "shipping rate to Tokyo", base: 79, cand: 83 },
]

export default function Instrument() {
  const [view, setView] = useState("sheet")
  const [registered, setRegistered] = useState(0)
  const [span, setSpan] = useState("s4")
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced.current) {
      setRegistered(CASES.length)
      return
    }
    // The single orchestrated sequence in the product: readings register one
    // by one, then the verdict is struck. It runs once, on load, and does not
    // loop — a stamp that keeps re-stamping is noise.
    let n = 0
    const tick = () => {
      n += 1
      setRegistered(n)
      if (n < CASES.length) timer = setTimeout(tick, 190)
    }
    let timer = setTimeout(tick, 420)
    return () => clearTimeout(timer)
  }, [])

  const done = registered >= CASES.length
  const shown = CASES.slice(0, registered)
  const passed = shown.filter((c) => c.ok).length

  return (
    // The graph paper is real padding rather than a negative bleed, so the
    // instrument never pushes past the sheet gutter on a narrow screen.
    <div className="relative p-3">
      <div className="graph-paper absolute inset-0 -z-10 border border-rule-soft" aria-hidden="true" />

      <div className="plane overflow-hidden">
        <header className="flex items-center gap-3 border-b border-rule bg-paper-sunk/70 px-3.5 py-2">
          <span className="num text-[11.5px] text-ink-faint">run-7f2a91c4</span>
          <span className="hidden text-[12px] text-ink-soft sm:inline">
            customer support, golden set
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full",
                done ? "bg-[#0ca30c]" : "animate-pulse bg-[#15427a]",
              )}
            />
            <span className="num text-[11px] text-ink-faint">
              {done ? "complete" : `grading ${registered + 1}/${CASES.length}`}
            </span>
          </span>
        </header>

        <nav className="flex border-b border-rule" aria-label="Instrument view">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={view === item.id}
              className={cn(
                "relative px-3.5 py-2 text-[12.5px] transition-colors",
                view === item.id
                  ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-signal"
                  : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === "sheet" && (
          <ResultsView shown={shown} passed={passed} done={done} />
        )}
        {view === "trace" && <TraceView active={span} onHover={setSpan} />}
        {view === "diff" && <DiffView />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- results - */

function ResultsView({ shown, passed, done }) {
  const mean = shown.length
    ? Math.round(shown.reduce((sum, c) => sum + c.score, 0) / shown.length)
    : 0

  return (
    <div>
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        <Stat label="cases" value={`${shown.length}/${CASES.length}`} />
        <Stat
          label="in tolerance"
          value={shown.length ? `${passed}/${shown.length}` : "—"}
        />
        <Stat label="mean score" value={shown.length ? mean : "—"} />
      </div>

      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Judge score, latency and cost for each test case in run run-7f2a91c4
        </caption>
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="px-3.5 py-1.5 text-[11px] font-medium text-ink-faint">
              case
            </th>
            <th scope="col" className="px-2 py-1.5 text-[11px] font-medium text-ink-faint">
              score
            </th>
            <th
              scope="col"
              className="hidden px-2 py-1.5 text-right text-[11px] font-medium text-ink-faint sm:table-cell"
            >
              latency
            </th>
            <th
              scope="col"
              className="hidden px-2 py-1.5 text-right text-[11px] font-medium text-ink-faint md:table-cell"
            >
              cost
            </th>
            <th scope="col" className="px-3.5 py-1.5 text-right text-[11px] font-medium text-ink-faint">
              verdict
            </th>
          </tr>
        </thead>
        <tbody>
          {CASES.map((row, idx) => {
            const visible = idx < shown.length
            return (
              <tr
                key={row.id}
                className="border-b border-rule-soft last:border-0"
                style={{
                  visibility: visible ? "visible" : "hidden",
                  animation: visible ? "register-in 0.26s ease-out both" : undefined,
                }}
              >
                <td className="w-full max-w-0 px-3.5 py-[7px]">
                  <span className="flex items-baseline gap-2">
                    <span className="num shrink-0 text-[10.5px] text-ink-faint">{row.id}</span>
                    <span className="truncate text-[12.5px]">{row.name}</span>
                  </span>
                </td>
                <td className="px-2 py-[7px]">
                  <ScoreCell score={row.score} />
                </td>
                <td className="num hidden px-2 py-[7px] text-right text-[11.5px] text-ink-soft sm:table-cell">
                  {row.ms}ms
                </td>
                <td className="num hidden px-2 py-[7px] text-right text-[11.5px] text-ink-soft md:table-cell">
                  ${row.usd.toFixed(5)}
                </td>
                <td className="px-3.5 py-[7px] text-right">
                  <Verdict state={row.ok ? "pass" : "fail"} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <footer className="flex items-center justify-between gap-4 border-t border-rule bg-paper-sunk/40 px-3.5 py-3">
        <p className="max-w-[26ch] text-[12px] leading-snug text-ink-soft">
          {done ? (
            <>
              One case fell outside tolerance. The new prompt agreed to send
              credentials to an unverified address.
            </>
          ) : (
            "Each case is graded by the judge, then checked against the semantic, latency and cost budgets."
          )}
        </p>
        {done && <Stamp verdict="FAILED" note="gate 04" strike />}
      </footer>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="px-3.5 py-2.5">
      <p className="text-[11px] leading-tight text-ink-faint">{label}</p>
      <p className="num mt-0.5 text-[17px] font-medium leading-none">{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ trace - */

function TraceView({ active, onHover }) {
  const current = SPANS.find((s) => s.id === active) || SPANS[0]
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-3.5 py-2.5">
        <p className="text-[12px] text-ink-soft">
          7 spans, 1.14 s wall clock, one policy lookup
        </p>
        <SpanKey />
      </div>
      <div className="p-2">
        <Waterfall spans={SPANS} total={1150} activeId={active} onHover={onHover} compact />
      </div>
      <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule">
        <Stat label="span" value={current.type} />
        <Stat label="duration" value={`${current.dur}ms`} />
        <Stat label="self time" value={current.id === "s1" ? "33ms" : `${current.dur}ms`} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- diff - */

function DiffView() {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 border-b border-rule px-3.5 py-3">
        <div>
          <p className="num text-[11.5px] text-ink-faint">prompt-v4 over prompt-v3</p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            Mean score 80.0, down 1.6 points. One case regressed past the gate.
          </p>
        </div>
        <Dial score={80} size={78} />
      </div>
      <ul>
        {DIFF.map((row) => {
          const delta = row.cand - row.base
          const regressed = delta <= -10
          return (
            <li
              key={row.name}
              className={cn(
                "flex items-center justify-between gap-4 border-b border-rule-soft px-3.5 py-2 last:border-0",
                regressed && "bg-[#fbeeed]",
              )}
            >
              <span className="truncate text-[12.5px]">{row.name}</span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="num text-[11.5px] text-ink-faint">{row.base}</span>
                <span className="h-px w-3 bg-rule" />
                <span className="num text-[11.5px]">{row.cand}</span>
                <span
                  className="num w-[38px] text-right text-[11.5px] font-medium"
                  style={{ color: delta > 0 ? "#006300" : delta < 0 ? "#a9201a" : "#74858a" }}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
