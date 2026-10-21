import React, { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Download, GitCompare } from "lucide-react"
import { Button } from "@/components/ui/button"
import Shell from "@/components/console/Shell"
import {
  BenchError,
  BenchLoading,
  Reading,
  ScoreCell,
  SpanKey,
  Specimen,
  Verdict,
  Waterfall,
} from "@/components/bench"
import { Dial, Figure, ScoreSpectrum } from "@/components/figures"
import { useAsync } from "@/lib/hooks"
import { downloadJson, fmtCost, fmtDateTime, fmtLatency, fmtNumber, fmtPct } from "@/lib/format"
import * as api from "@/api"

export default function RunDetail() {
  const { id } = useParams()
  const { data: run, loading, error, reload } = useAsync(() => api.fetchRun(id), [id])
  const [openCase, setOpenCase] = useState(null)

  return (
    <Shell
      title={run?.name || "Run"}
      lede={
        run
          ? `${run.dataset_name}, ${run.total_cases} cases, ${fmtDateTime(run.created_at)}`
          : "Reading the run"
      }
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/runs">
              <ArrowLeft size={13} />
              All runs
            </Link>
          </Button>
          {run && (
            <>
              <Button variant="outline" size="sm" onClick={() => downloadJson(`${run.id}.json`, run)}>
                <Download size={13} />
                Export
              </Button>
              <Button asChild size="sm">
                <Link to={`/app/compare?candidate=${run.id}`}>
                  <GitCompare size={13} />
                  Compare
                </Link>
              </Button>
            </>
          )}
        </>
      }
    >
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !run && <BenchLoading rows={8} />}

      {run && (
        <div className="space-y-6">
          {/* ----------------------------- readings ---------------------- */}
          <section className="plane flex flex-wrap items-center gap-x-10 gap-y-5 px-5 py-5">
            <Dial score={run.avg_score} label="mean judge score" />
            <Reading
              label="pass rate"
              value={fmtPct(run.pass_rate)}
              note={`${run.passed_cases} of ${run.total_cases} in tolerance`}
            />
            <Reading label="mean latency" value={fmtLatency(run.avg_latency_ms)} note={`p95 ${fmtLatency(run.p95_latency_ms)}`} />
            <Reading label="total cost" value={fmtCost(run.total_cost_usd)} note={`${fmtNumber(run.total_tokens)} tokens`} />
            <Reading
              label="engine"
              value={run.live_calls > 0 ? "live" : "simulator"}
              size="sm"
              tone={run.fallback_calls > 0 && run.live_calls > 0 ? "warn" : "ink"}
              note={
                run.live_calls > 0
                  ? `${run.live_calls} live, ${run.fallback_calls} fell back`
                  : "no provider call made"
              }
            />
            <div className="ml-auto">
              <Verdict
                state={run.pass_rate >= 80 ? "pass" : run.pass_rate >= 50 ? "warn" : "fail"}
              >
                {run.pass_rate >= 80
                  ? "within tolerance"
                  : run.pass_rate >= 50
                    ? "needs review"
                    : "rejected"}
              </Verdict>
            </div>
          </section>

          {/* ------------------------------ config ------------------------ */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Specimen id="prompt" title="What was run">
              <dl className="divide-y divide-rule-soft">
                <Row label="model" value={run.prompt_config.model} mono />
                <Row label="mode" value={run.prompt_config.execution_mode} mono />
                <Row label="temperature" value={run.prompt_config.temperature} mono />
                <Row label="answer budget" value={`${run.prompt_config.max_tokens} tokens`} mono />
                <Row label="system prompt" value={run.prompt_config.system_prompt || "none"} />
                <Row label="template" value={run.prompt_config.template} mono />
              </dl>
            </Specimen>

            <Specimen id="graders" title="How it was graded">
              <dl className="divide-y divide-rule-soft">
                <Row
                  label="judge"
                  value={run.grader_config.use_llm_judge ? run.grader_config.judge_model : "off"}
                  mono
                />
                <Row label="rubric" value={run.grader_config.llm_judge_rubric} />
                <Row
                  label="semantic match"
                  value={
                    run.grader_config.use_semantic_match
                      ? `threshold ${run.grader_config.semantic_threshold}`
                      : "off"
                  }
                  mono
                />
                <Row
                  label="schema check"
                  value={run.grader_config.use_json_validation ? "on" : "off"}
                  mono
                />
                <Row
                  label="latency ceiling"
                  value={fmtLatency(run.grader_config.max_latency_budget_ms)}
                  mono
                />
                <Row
                  label="cost ceiling"
                  value={fmtCost(run.grader_config.max_cost_budget_usd)}
                  mono
                />
              </dl>
            </Specimen>
          </div>

          {/* ----------------------------- spectrum ----------------------- */}
          <Specimen id="fig 1" title="Score by case">
            <div className="px-4 py-4">
              <Figure
                caption="Judge score for each case, in dataset order"
                note="dashed line marks the 70-point pass threshold; every value is repeated in the table below"
              >
                <ScoreSpectrum items={run.items} />
              </Figure>
            </div>
          </Specimen>

          {/* ------------------------------ cases ------------------------- */}
          <div className="space-y-2">
            {run.items.map((item, idx) => (
              <CaseRow
                key={item.item_id}
                item={item}
                index={idx + 1}
                open={openCase === item.item_id}
                onToggle={() => setOpenCase(openCase === item.item_id ? null : item.item_id)}
              />
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-[118px] shrink-0 text-[11.5px] text-ink-faint">{label}</dt>
      <dd
        className={`min-w-0 flex-1 text-[12.5px] leading-relaxed break-words ${mono ? "num" : "text-ink-soft"}`}
      >
        {String(value)}
      </dd>
    </div>
  )
}

/* -------------------------------------------------------------- a case --- */

function CaseRow({ item, index, open, onToggle }) {
  const spans = (item.spans || []).map((s, i) => ({
    id: s.span_id || String(i),
    name: s.name,
    type: s.span_type,
    start: (s.start_time - item.spans[0].start_time) * 1000,
    dur: s.duration_ms,
    depth: i === 0 ? 0 : 1,
  }))
  const total = spans.reduce((max, s) => Math.max(max, s.start + s.dur), 1)

  return (
    <div className="plane overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-left transition-colors hover:bg-paper-sunk/50"
      >
        <span className="num shrink-0 text-[11px] text-ink-faint">
          {String(index).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{item.test_case_name}</span>
        <ScoreCell score={item.scores?.llm_judge} />
        <span className="num w-[62px] text-right text-[11.5px] text-ink-soft">
          {fmtLatency(item.latency_ms)}
        </span>
        <span className="num w-[72px] text-right text-[11.5px] text-ink-soft">
          {fmtCost(item.cost_usd)}
        </span>
        <Verdict state={item.passed ? "pass" : "fail"} />
      </button>

      {open && (
        <div className="border-t border-rule">
          {item.regression_flags?.length > 0 && (
            <ul className="border-b border-rule bg-[#fbeeed] px-4 py-2.5">
              {item.regression_flags.map((flag) => (
                <li key={flag} className="text-[12.5px] leading-relaxed text-[#a9201a]">
                  {flag}
                </li>
              ))}
            </ul>
          )}

          <div className="grid divide-rule md:grid-cols-2 md:divide-x">
            <div className="border-b border-rule px-4 py-3 md:border-b-0">
              <p className="mb-2 text-[11px] text-ink-faint">expected</p>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                {item.expected_output || "none recorded"}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="mb-2 text-[11px] text-ink-faint">what came back</p>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
                {item.model_output}
              </p>
            </div>
          </div>

          {item.judge_reasoning && (
            <div className="border-t border-rule bg-paper-sunk/40 px-4 py-3">
              <p className="mb-1 text-[11px] text-ink-faint">judge reasoning</p>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{item.judge_reasoning}</p>
            </div>
          )}

          <div className="border-t border-rule px-4 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[11px] text-ink-faint">
                spans, {fmtNumber(item.total_tokens)} tokens
              </p>
              <SpanKey />
            </div>
            <Waterfall spans={spans} total={total} compact />
          </div>

          <p className="border-t border-rule px-4 py-2 text-[11.5px] text-ink-faint">
            Served by <span className="num">{item.engine}</span>
            {item.judge_engine && (
              <>
                , graded by <span className="num">{item.judge_engine}</span>
              </>
            )}
            {item.engine_note && <>. {item.engine_note}</>}
          </p>
        </div>
      )}
    </div>
  )
}
