import React from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import Shell from "@/components/console/Shell"
import {
  BenchEmpty,
  BenchError,
  BenchLoading,
  Reading,
  Specimen,
  Verdict,
} from "@/components/bench"
import {
  CostTrend,
  Figure,
  LatencyTrend,
  QualityTrend,
  RankedBars,
  SERIES,
  STATUS,
} from "@/components/figures"
import { useAsync } from "@/lib/hooks"
import { fmtCost, fmtLatency, fmtNumber, fmtPct, fmtRelative } from "@/lib/format"
import * as api from "@/api"

export default function Overview() {
  const { data, loading, error, reload } = useAsync(() => api.fetchStats(), [])

  const trend = (data?.trend || []).map((row, idx) => ({ ...row, idx: idx + 1 }))
  const totals = data?.totals
  const deltas = data?.deltas

  return (
    <Shell
      title="Overview"
      lede={data ? `${fmtNumber(totals.cases_evaluated)} cases graded across ${totals.runs} runs` : "Reading the bench"}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RotateCw size={13} className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link to="/app/playground">Start a run</Link>
          </Button>
        </>
      }
    >
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !data && <BenchLoading rows={6} />}

      {data && totals.runs === 0 && (
        <BenchEmpty
          title="Nothing has been measured yet"
          action={
            <Button asChild size="sm">
              <Link to="/app/datasets">Build a golden set</Link>
            </Button>
          }
        >
          Create a dataset of cases, then grade a prompt against it. The first
          completed run becomes the baseline everything else is measured
          against.
        </BenchEmpty>
      )}

      {data && totals.runs > 0 && (
        <div className="space-y-6">
          {/* ----------------------- headline readings ---------------------- */}
          <section className="plane grid grid-cols-2 divide-rule md:grid-cols-4 md:divide-x">
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading
                label="pass rate, all runs"
                value={fmtPct(totals.pass_rate)}
                note={
                  deltas
                    ? `latest run ${deltas.pass_rate >= 0 ? "+" : ""}${deltas.pass_rate} pts on the one before`
                    : undefined
                }
              />
            </div>
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading
                label="mean latency"
                value={fmtLatency(totals.avg_latency_ms)}
                note={
                  deltas
                    ? `latest ${deltas.avg_latency_ms >= 0 ? "+" : ""}${Math.round(deltas.avg_latency_ms)}ms`
                    : undefined
                }
              />
            </div>
            <div className="px-5 py-4">
              <Reading label="spend to date" value={fmtCost(totals.total_cost_usd)} note={`${fmtNumber(totals.total_tokens)} tokens`} />
            </div>
            <div className="px-5 py-4">
              <Reading label="golden sets" value={totals.datasets} note={`${totals.test_cases} cases on the bench`} />
            </div>
          </section>

          {/* ------------------------------ figures ------------------------- */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Specimen id="fig 1" title="Quality across runs, oldest to newest">
              <div className="px-4 py-4">
                <Figure
                  caption="Pass rate and mean judge score"
                  note="dashed line marks the 70-point judge threshold"
                  keyItems={[
                    { label: "pass rate", color: SERIES.blue },
                    { label: "judge score", color: SERIES.orange },
                  ]}
                >
                  <QualityTrend data={trend} />
                </Figure>
              </div>
            </Specimen>

            <Specimen id="fig 2" title="Why cases were rejected">
              <div className="px-4 py-4">
                {data.top_failures?.length ? (
                  <Figure caption="Rejections by grader" note="every completed run">
                    <RankedBars
                      rows={data.top_failures.map((row, idx) => ({
                        label: row.reason,
                        value: row.count,
                        color: [STATUS.critical, SERIES.orange, STATUS.warn, SERIES.blue, SERIES.aqua, SERIES.violet][idx % 6],
                      }))}
                      formatValue={(v) => `${v} case${v === 1 ? "" : "s"}`}
                    />
                  </Figure>
                ) : (
                  <p className="py-8 text-center text-[13px] text-ink-faint">
                    No case has been rejected yet.
                  </p>
                )}
              </div>
            </Specimen>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Specimen id="fig 3" title="Latency across runs">
              <div className="px-4 py-4">
                <Figure
                  caption="Mean and p95 wall clock per case"
                  keyItems={[
                    { label: "mean", color: SERIES.aqua },
                    { label: "p95", color: SERIES.violet, dashed: true },
                  ]}
                >
                  <LatencyTrend data={trend} />
                </Figure>
              </div>
            </Specimen>

            <Specimen id="fig 4" title="Cost across runs">
              <div className="px-4 py-4">
                <Figure caption="Token spend per case" note="normalised across run sizes">
                  <CostTrend data={trend} />
                </Figure>
              </div>
            </Specimen>
          </div>

          {/* ----------------------------- by dataset ----------------------- */}
          <Specimen
            id="sheet 1"
            title="Golden sets"
            actions={
              <Button asChild variant="ghost" size="xs">
                <Link to="/app/datasets">
                  All datasets <ArrowUpRight size={12} />
                </Link>
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className="px-3.5 py-2 text-[11.5px] font-medium text-ink-faint">
                      dataset
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right text-[11.5px] font-medium text-ink-faint">
                      cases
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right text-[11.5px] font-medium text-ink-faint">
                      runs
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right text-[11.5px] font-medium text-ink-faint">
                      latest pass rate
                    </th>
                    <th scope="col" className="px-3.5 py-2 text-right text-[11.5px] font-medium text-ink-faint">
                      latest score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_dataset.map((row) => (
                    <tr key={row.dataset_id} className="border-b border-rule-soft last:border-0">
                      <td className="px-3.5 py-2.5">
                        <Link
                          to={`/app/datasets/${row.dataset_id}`}
                          className="text-[13px] transition-colors hover:text-signal"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="num px-3.5 py-2.5 text-right text-[12.5px] text-ink-soft">
                        {row.test_cases}
                      </td>
                      <td className="num px-3.5 py-2.5 text-right text-[12.5px] text-ink-soft">
                        {row.runs}
                      </td>
                      <td className="num px-3.5 py-2.5 text-right text-[12.5px]">
                        {row.latest_pass_rate == null ? (
                          <span className="text-ink-faint">not run</span>
                        ) : (
                          fmtPct(row.latest_pass_rate)
                        )}
                      </td>
                      <td className="num px-3.5 py-2.5 text-right text-[12.5px]">
                        {row.latest_avg_score == null ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          row.latest_avg_score
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Specimen>

          {/* ------------------------------ latest -------------------------- */}
          {data.latest && (
            <Specimen id="last run" title={data.latest.name}>
              <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-5 py-4">
                <Reading label="pass rate" value={fmtPct(data.latest.pass_rate)} size="sm" />
                <Reading label="mean score" value={data.latest.avg_score} size="sm" />
                <Reading label="mean latency" value={fmtLatency(data.latest.avg_latency_ms)} size="sm" />
                <Reading label="cost" value={fmtCost(data.latest.total_cost_usd)} size="sm" />
                <Reading label="finished" value={fmtRelative(data.latest.created_at)} size="sm" />
                <div className="ml-auto flex items-center gap-3">
                  <Verdict state={data.latest.pass_rate >= 80 ? "pass" : data.latest.pass_rate >= 50 ? "warn" : "fail"} />
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/runs/${data.latest.run_id}`}>Open the run</Link>
                  </Button>
                </div>
              </div>
            </Specimen>
          )}
        </div>
      )}
    </Shell>
  )
}
