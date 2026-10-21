import React, { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Shell from "@/components/console/Shell"
import {
  BenchEmpty,
  BenchError,
  BenchLoading,
  Specimen,
  Stamp,
  ToleranceBand,
  Verdict,
} from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { fmtCost, fmtDateTime, fmtLatency } from "@/lib/format"
import * as api from "@/api"

export default function Compare() {
  const [params] = useSearchParams()
  const { data: runs, loading: loadingRuns } = useAsync(() => api.fetchRuns(), [])

  const [baseline, setBaseline] = useState("")
  const [candidate, setCandidate] = useState(params.get("candidate") || "")
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Default to the two most recent runs on the same dataset — the comparison
  // people nearly always want.
  useEffect(() => {
    if (!runs?.length) return
    const cand = candidate || runs[0].id
    const candRun = runs.find((r) => r.id === cand)
    const base =
      baseline ||
      runs.find((r) => r.id !== cand && r.dataset_id === candRun?.dataset_id)?.id ||
      runs.find((r) => r.id !== cand)?.id ||
      ""
    setCandidate(cand)
    setBaseline(base)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs])

  const run = async () => {
    if (!baseline || !candidate) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.compareRuns(baseline, candidate))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const baseRun = runs?.find((r) => r.id === baseline)
  const candRun = runs?.find((r) => r.id === candidate)
  const mismatched = baseRun && candRun && baseRun.dataset_id !== candRun.dataset_id

  return (
    <Shell
      title="Compare runs"
      lede="Measure a candidate against a known-good baseline"
      actions={
        <Button size="sm" onClick={run} disabled={busy || !baseline || !candidate || baseline === candidate}>
          {busy ? "Measuring" : "Measure"}
        </Button>
      }
    >
      {loadingRuns && !runs && <BenchLoading rows={5} />}

      {runs && runs.length < 2 && (
        <BenchEmpty
          title="Two runs are needed to compare"
          action={
            <Button asChild size="sm">
              <Link to="/app/playground">Grade a prompt</Link>
            </Button>
          }
        >
          Record a baseline run first, then grade the change you want to ship
          and measure one against the other.
        </BenchEmpty>
      )}

      {runs && runs.length >= 2 && (
        <div className="space-y-6">
          <Specimen id="setup" title="Which two runs">
            <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <RunPicker
                id="cmp-baseline"
                label="Baseline, the run you trust"
                runs={runs}
                value={baseline}
                onChange={setBaseline}
              />
              <span className="hidden pb-2.5 text-ink-faint md:block">
                <ArrowRight size={16} />
              </span>
              <RunPicker
                id="cmp-candidate"
                label="Candidate, the change"
                runs={runs}
                value={candidate}
                onChange={setCandidate}
              />
            </div>
            {mismatched && (
              <p className="border-t border-rule bg-[#fdf6e6] px-4 py-2.5 text-[12.5px] text-[#7a5200]">
                These runs used different datasets, so the per-case diff will be
                empty. The headline metrics still compare.
              </p>
            )}
          </Specimen>

          {error && <BenchError error={error} onRetry={run} />}

          {result && <Result result={result} />}

          {!result && !error && !busy && (
            <div className="border border-dashed border-rule bg-plane/60 px-6 py-12 text-center">
              <p className="text-[13.5px] text-ink-soft">
                Pick a baseline and a candidate, then measure. You get a verdict
                per gate and a per-case diff.
              </p>
            </div>
          )}
        </div>
      )}
    </Shell>
  )
}

function RunPicker({ id, label, runs, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12.5px] text-ink-faint">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full [&>span]:min-w-0 [&>span]:truncate">
          <SelectValue placeholder="Pick a run" />
        </SelectTrigger>
        <SelectContent className="max-w-[min(26rem,calc(100vw-2rem))]">
          {runs.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="block truncate">{r.name}</span>
              <span className="block truncate text-[11.5px] text-ink-faint">
                {r.dataset_name}, {fmtDateTime(r.created_at)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* ---------------------------------------------------------------- result - */

const GATES = [
  { key: "quality_regression", name: "Quality", unit: "pts", format: (v) => v.toFixed(1) },
  { key: "latency_regression", name: "Latency", unit: "", format: (v) => fmtLatency(v) },
  { key: "cost_regression", name: "Cost per case", unit: "", format: (v) => fmtCost(v) },
]

function Result({ result }) {
  const regressed = result.item_diffs.filter((d) => d.has_regression)

  return (
    <div className="space-y-6">
      {/* ------------------------------ verdict --------------------------- */}
      <section className="plane flex flex-wrap items-center justify-between gap-6 px-6 py-6">
        <div className="min-w-0">
          <p className="num text-[12px] text-ink-faint">
            {result.candidate_run_name} measured against {result.baseline_run_name}
          </p>
          <h2 className="display-md mt-2">
            {result.overall_status === "PASSED"
              ? "Every gate is inside tolerance"
              : result.overall_status === "WARNING"
                ? "One gate needs a human"
                : "A gate rejected this change"}
          </h2>
          <p className="measure mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            {result.overall_status === "FAILED"
              ? "Something crossed a critical threshold. The explanations below say which gate and by how much."
              : result.overall_status === "WARNING"
                ? "Nothing is critical, but at least one reading moved past its tolerance. Read the gate before shipping."
                : "Quality, latency and cost all sit inside the tolerances set for this run."}
          </p>
        </div>
        <Stamp verdict={result.overall_status} size="lg" strike />
      </section>

      {/* ------------------------------- gates ---------------------------- */}
      <div className="grid gap-4 md:grid-cols-3">
        {GATES.map((gate) => {
          const m = result[gate.key]
          const tone =
            m.severity === "critical"
              ? "fail"
              : m.severity === "warning"
                ? "warn"
                : m.severity === "improvement"
                  ? "pass"
                  : "pass"
          return (
            <Specimen key={gate.key} id={gate.name.toLowerCase()} title={gate.name}>
              <div className="px-4 py-4">
                <div className="flex items-baseline gap-3">
                  <span className="num text-[13px] text-ink-faint">{gate.format(m.baseline_val)}</span>
                  <span className="h-px w-4 shrink-0 bg-rule" />
                  <span className="num text-[20px] font-medium">{gate.format(m.candidate_val)}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span
                    className="num text-[13px] font-medium"
                    style={{
                      color:
                        m.severity === "critical"
                          ? "#a9201a"
                          : m.severity === "warning"
                            ? "#7a5200"
                            : m.severity === "improvement"
                              ? "#006300"
                              : "#46585f",
                    }}
                  >
                    {m.delta_val > 0 ? "+" : ""}
                    {gate.key === "quality_regression" ? m.delta_val : m.delta_percent + "%"}
                  </span>
                  <Verdict state={tone}>
                    {m.severity === "none" ? "in tolerance" : m.severity}
                  </Verdict>
                </div>
                <ToleranceBand
                  className="mt-3"
                  value={Math.max(-100, Math.min(100, m.delta_percent))}
                  min={-100}
                  max={100}
                  okFrom={-100}
                  okTo={gate.key === "latency_regression" ? 25 : gate.key === "cost_regression" ? 20 : 100}
                />
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{m.explanation}</p>
              </div>
            </Specimen>
          )
        })}
      </div>

      {/* ------------------------------- diffs ---------------------------- */}
      {result.item_diffs.length > 0 && (
        <Specimen
          id="per case"
          title={`Case by case, ${regressed.length} regressed`}
        >
          <ul className="divide-y divide-rule-soft">
            {result.item_diffs.map((diff) => {
              const delta = (diff.candidate?.score ?? 0) - (diff.baseline?.score ?? 0)
              return (
                <li
                  key={diff.test_case_id}
                  className={diff.has_regression ? "bg-[#fbeeed]" : undefined}
                >
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {diff.test_case_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      <span className="num text-[12px] text-ink-faint">
                        {diff.baseline ? diff.baseline.score : "—"}
                      </span>
                      <span className="h-px w-3 bg-rule" />
                      <span className="num text-[12px]">{diff.candidate.score}</span>
                      <span
                        className="num w-[42px] text-right text-[12px] font-medium"
                        style={{
                          color: delta > 0 ? "#006300" : delta < 0 ? "#a9201a" : "#74858a",
                        }}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    </span>
                    <Verdict state={diff.candidate.passed ? "pass" : "fail"} />
                  </div>
                  {diff.regressions.length > 0 && (
                    <ul className="px-4 pb-2.5 pl-4">
                      {diff.regressions.map((reason) => (
                        <li key={reason} className="text-[12px] text-[#a9201a]">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </Specimen>
      )}
    </div>
  )
}
