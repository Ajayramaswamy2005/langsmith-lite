import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { GitCompare, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Cell,
  DataRow,
  DataSheet,
  ScoreCell,
  Verdict,
} from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { fmtCost, fmtLatency, fmtPct, fmtRelative } from "@/lib/format"
import * as api from "@/api"

export default function Runs() {
  const { data, loading, error, reload } = useAsync(() => api.fetchRuns(), [])
  const { data: datasets } = useAsync(() => api.fetchDatasets(), [])
  const [query, setQuery] = useState("")
  const [datasetId, setDatasetId] = useState("all")

  const rows = useMemo(() => {
    let list = data || []
    if (datasetId !== "all") list = list.filter((r) => r.dataset_id === datasetId)
    const needle = query.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.dataset_name.toLowerCase().includes(needle) ||
          r.prompt_config.model.toLowerCase().includes(needle),
      )
    }
    return list
  }, [data, datasetId, query])

  const remove = async (run) => {
    if (!window.confirm(`Delete "${run.name}"? Any comparison that used it as a baseline will stop working.`)) return
    try {
      await api.deleteRun(run.id)
      toast.success("Run deleted", { description: run.name })
      reload()
    } catch (err) {
      toast.error("Could not delete the run", { description: err.message })
    }
  }

  return (
    <Shell
      title="Runs"
      lede={data ? `${data.length} recorded` : "Reading the bench"}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/compare">
              <GitCompare size={13} />
              Compare
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/playground">
              <Play size={13} />
              New run
            </Link>
          </Button>
        </>
      }
    >
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !data && <BenchLoading rows={8} />}

      {data && data.length === 0 && (
        <BenchEmpty
          title="No runs recorded"
          action={
            <Button asChild size="sm">
              <Link to="/app/playground">Grade a prompt</Link>
            </Button>
          }
        >
          A run grades every case in a golden set and keeps the result, so the
          next change has something to be measured against.
        </BenchEmpty>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by run, dataset or model"
              className="max-w-xs"
              aria-label="Filter runs"
            />
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger className="w-[230px]" aria-label="Filter by dataset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every dataset</SelectItem>
                {(datasets || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="plane overflow-hidden">
            <DataSheet
              minWidth={900}
              columns={[
                { label: "run" },
                { label: "pass rate", align: "right", width: 92 },
                { label: "score", align: "right", width: 92 },
                { label: "latency", align: "right", width: 84 },
                { label: "cost", align: "right", width: 88 },
                { label: "engine", width: 96 },
                { label: "finished", align: "right", width: 104 },
                { label: "", width: 44 },
              ]}
            >
              {rows.map((run) => (
                <DataRow key={run.id}>
                  <Cell className="max-w-[300px]">
                    <Link
                      to={`/app/runs/${run.id}`}
                      className="block truncate text-[13.5px] font-medium transition-colors hover:text-signal"
                    >
                      {run.name}
                    </Link>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                      {run.dataset_name}
                      <span className="num ml-2">{run.prompt_config.model}</span>
                    </p>
                  </Cell>
                  <Cell align="right">
                    <span className="inline-flex items-center gap-2">
                      <span className="num text-[12.5px]">{fmtPct(run.pass_rate)}</span>
                      <Verdict
                        state={run.pass_rate >= 80 ? "pass" : run.pass_rate >= 50 ? "warn" : "fail"}
                      >
                        {run.passed_cases}/{run.total_cases}
                      </Verdict>
                    </span>
                  </Cell>
                  <Cell align="right">
                    <ScoreCell score={run.avg_score} />
                  </Cell>
                  <Cell align="right" mono className="text-ink-soft">
                    {fmtLatency(run.avg_latency_ms)}
                  </Cell>
                  <Cell align="right" mono className="text-ink-soft">
                    {fmtCost(run.total_cost_usd)}
                  </Cell>
                  <Cell>
                    {run.live_calls > 0 ? (
                      <span className="num text-[11.5px] text-ink-soft">
                        {run.live_calls} live
                        {run.fallback_calls > 0 && (
                          <span className="text-[#7a5200]"> / {run.fallback_calls} sim</span>
                        )}
                      </span>
                    ) : (
                      <span className="num text-[11.5px] text-ink-faint">simulator</span>
                    )}
                  </Cell>
                  <Cell align="right" className="text-[11.5px] text-ink-faint">
                    {fmtRelative(run.created_at)}
                  </Cell>
                  <Cell align="right">
                    <button
                      type="button"
                      onClick={() => remove(run)}
                      aria-label={`Delete ${run.name}`}
                      className="grid size-7 place-items-center text-ink-faint transition-colors hover:text-[#a9201a]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Cell>
                </DataRow>
              ))}
            </DataSheet>
            {rows.length === 0 && (
              <p className="px-4 py-10 text-center text-[13px] text-ink-faint">
                No run matches that filter.
              </p>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
