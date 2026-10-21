import React, { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Shell from "@/components/console/Shell"
import {
  BenchError,
  Reading,
  ScoreCell,
  SpanKey,
  Specimen,
  Verdict,
  Waterfall,
} from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { fmtCost, fmtLatency } from "@/lib/format"
import * as api from "@/api"

export default function Playground() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const { data: datasets } = useAsync(() => api.fetchDatasets(), [])
  const { data: models } = useAsync(() => api.fetchModels(), [])
  const { data: health } = useAsync(() => api.fetchHealth(), [])

  const [datasetId, setDatasetId] = useState(params.get("dataset") || "")
  const [model, setModel] = useState("mock-fast-eval")
  const [systemPrompt, setSystemPrompt] = useState(api.DEFAULT_PROMPT.system_prompt)
  const [template, setTemplate] = useState("{query}")
  const [temperature, setTemperature] = useState(0.2)
  const [maxTokens, setMaxTokens] = useState(320)
  const [rubric, setRubric] = useState(api.DEFAULT_GRADER.llm_judge_rubric)
  const [useJudge, setUseJudge] = useState(true)
  const [useSemantic, setUseSemantic] = useState(true)
  const [useJson, setUseJson] = useState(false)
  const [latencyBudget, setLatencyBudget] = useState(45000)
  const [costBudget, setCostBudget] = useState(0.01)
  const [runName, setRunName] = useState("")

  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [probe, setProbe] = useState(null)
  const [probing, setProbing] = useState(false)
  const abort = useRef(null)

  const dataset = useMemo(
    () => (datasets || []).find((d) => d.id === datasetId),
    [datasets, datasetId],
  )
  const live = model !== "mock-fast-eval"
  const mode = live ? "live" : "mock"

  useEffect(() => {
    if (!datasetId && datasets?.length) setDatasetId(datasets[0].id)
  }, [datasets, datasetId])

  // Case variables drive the template, so suggest one that actually resolves.
  useEffect(() => {
    const first = dataset?.test_cases?.[0]
    if (!first) return
    const keys = Object.keys(first.inputs)
    if (keys.length && !keys.some((k) => template.includes(`{${k}}`))) {
      setTemplate(keys.map((k) => `${k}: {${k}}`).join("\n"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id])

  const promptConfig = () => ({
    system_prompt: systemPrompt,
    template,
    model,
    temperature,
    max_tokens: maxTokens,
    execution_mode: mode,
  })

  const graderConfig = () => ({
    use_llm_judge: useJudge,
    llm_judge_rubric: rubric,
    judge_model: model,
    use_semantic_match: useSemantic,
    semantic_threshold: 0.4,
    use_json_validation: useJson,
    max_latency_budget_ms: Number(latencyBudget),
    max_cost_budget_usd: Number(costBudget),
  })

  /* One case, run immediately — the fast loop while you shape a prompt. */
  const runOne = async () => {
    const first = dataset?.test_cases?.[0]
    if (!first) {
      toast.error("This dataset has no cases to try")
      return
    }
    setProbing(true)
    setProbe(null)
    setError(null)
    try {
      const result = await api.testSinglePrompt({
        name: first.name,
        inputs: first.inputs,
        expected_output: first.expected_output,
        prompt_config: promptConfig(),
        grader_config: graderConfig(),
      })
      setProbe(result)
      if (result.engine === "simulator" && live) {
        toast.warning("Served by the local simulator", { description: result.engine_note })
      }
    } catch (err) {
      setError(err)
    } finally {
      setProbing(false)
    }
  }

  /* The whole set, as a background job with live progress. */
  const runAll = async () => {
    if (!dataset) return
    setBusy(true)
    setError(null)
    setJob(null)
    const controller = new AbortController()
    abort.current = controller

    try {
      const started = await api.startEvaluation({
        dataset_id: dataset.id,
        run_name: runName.trim(),
        prompt_config: promptConfig(),
        grader_config: graderConfig(),
      })
      setJob(started)

      const finished = await api.pollJob(started.job_id, setJob, {
        signal: controller.signal,
      })

      if (finished.status === "completed") {
        toast.success("Run finished", {
          description: finished.run_name,
          action: {
            label: "Open",
            onClick: () => navigate(`/app/runs/${finished.run_id}`),
          },
        })
        navigate(`/app/runs/${finished.run_id}`)
      } else {
        setError(new Error(finished.error || "The run failed"))
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError(err)
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  const stop = () => {
    abort.current?.abort()
    setBusy(false)
    toast.info("Stopped watching", {
      description: "The run keeps going on the server and will appear under Runs.",
    })
  }

  return (
    <Shell
      title="Playground"
      lede="Shape a prompt on one case, then grade the whole set"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={runOne} disabled={probing || !dataset}>
            {probing ? "Running" : "Try one case"}
          </Button>
          {busy ? (
            <Button variant="outline" size="sm" onClick={stop}>
              <Square size={12} />
              Stop watching
            </Button>
          ) : (
            <Button size="sm" onClick={runAll} disabled={!dataset?.test_cases?.length}>
              <Play size={13} />
              Grade the set
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ------------------------------ config -------------------------- */}
        <div className="space-y-4">
          <Specimen id="setup" title="What to run">
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="pg-dataset">Golden set</Label>
                <Select value={datasetId} onValueChange={setDatasetId}>
                  <SelectTrigger id="pg-dataset" className="w-full">
                    <SelectValue placeholder="Pick a dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {(datasets || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.test_cases.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dataset && dataset.test_cases.length === 0 && (
                  <p className="text-[11.5px] text-[#a9201a]">
                    This set has no cases.{" "}
                    <Link to={`/app/datasets/${dataset.id}`} className="underline">
                      Add one first
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pg-model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="pg-model" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(models || []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] text-ink-faint">
                  {live
                    ? health?.live_inference
                      ? "Reasoning models think before answering, so expect tens of seconds per case."
                      : "No API key is configured, so this will fall back to the simulator."
                    : "The local simulator answers instantly and costs nothing."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pg-run-name">Run name</Label>
                <Input
                  id="pg-run-name"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="prompt-v4"
                />
              </div>
            </div>
          </Specimen>

          <Specimen id="prompt" title="The prompt">
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="pg-system">System prompt</Label>
                <Textarea
                  id="pg-system"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-template">Template</Label>
                <Textarea
                  id="pg-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  className="num !text-[12.5px]"
                />
                <p className="text-[11.5px] text-ink-faint">
                  {dataset?.test_cases?.[0]
                    ? `Available: ${Object.keys(dataset.test_cases[0].inputs)
                        .map((k) => `{${k}}`)
                        .join("  ")}`
                    : "Placeholders are filled from each case's inputs."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="pg-temp">Temperature</Label>
                    <span className="num text-[12px] text-ink-soft">{temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    id="pg-temp"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[temperature]}
                    onValueChange={([v]) => setTemperature(v)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="pg-tokens">Answer budget</Label>
                    <span className="num text-[12px] text-ink-soft">{maxTokens} tokens</span>
                  </div>
                  <Slider
                    id="pg-tokens"
                    min={64}
                    max={1024}
                    step={32}
                    value={[maxTokens]}
                    onValueChange={([v]) => setMaxTokens(v)}
                  />
                </div>
              </div>
            </div>
          </Specimen>

          <Specimen id="graders" title="How to grade it">
            <div className="space-y-4 px-4 py-4">
              <GraderToggle
                id="g-judge"
                checked={useJudge}
                onChange={setUseJudge}
                label="LLM judge"
                hint="Scores 0–100 against your rubric and writes down why."
              />
              {useJudge && (
                <Textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  rows={3}
                  aria-label="Judge rubric"
                />
              )}
              <GraderToggle
                id="g-semantic"
                checked={useSemantic}
                onChange={setUseSemantic}
                label="Semantic match"
                hint="Character similarity to the expected output, threshold 0.40."
              />
              <GraderToggle
                id="g-json"
                checked={useJson}
                onChange={setUseJson}
                label="Schema check"
                hint="Rejects a case whose output does not parse as JSON."
              />

              <div className="grid gap-4 border-t border-rule-soft pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="g-latency">Latency ceiling</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="g-latency"
                      type="number"
                      min={1}
                      value={latencyBudget}
                      onChange={(e) => setLatencyBudget(e.target.value)}
                      className="num"
                    />
                    <span className="text-[12px] text-ink-faint">ms</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-cost">Cost ceiling</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-ink-faint">$</span>
                    <Input
                      id="g-cost"
                      type="number"
                      step="0.001"
                      min={0}
                      value={costBudget}
                      onChange={(e) => setCostBudget(e.target.value)}
                      className="num"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Specimen>
        </div>

        {/* ------------------------------ result -------------------------- */}
        <div className="space-y-4">
          {error && <BenchError error={error} />}

          {busy && job && (
            <Specimen id="in progress" title={job.run_name}>
              <div className="px-4 py-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] text-ink-soft">
                    {job.current_case ? `Grading ${job.current_case}` : "Starting"}
                  </p>
                  <p className="num text-[13px]">
                    {job.completed} / {job.total}
                  </p>
                </div>
                <div className="mt-3 h-[6px] w-full bg-paper-sunk">
                  <div
                    className="h-full bg-signal transition-[width] duration-500 ease-out"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="mt-3 text-[11.5px] text-ink-faint">
                  Cases run concurrently. You can leave this page; the run finishes
                  on the server and appears under Runs.
                </p>
              </div>
            </Specimen>
          )}

          {probe ? (
            <ProbeResult result={probe} />
          ) : (
            !busy && (
              <div className="border border-dashed border-rule bg-plane/60 px-6 py-12 text-center">
                <p className="text-[13.5px] text-ink-soft">
                  Try one case to see the output, its score and its trace before
                  you commit to grading the whole set.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </Shell>
  )
}

function GraderToggle({ id, checked, onChange, label, hint }) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-[13.5px]">
          {label}
        </Label>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{hint}</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- probe result - */

function ProbeResult({ result }) {
  const spans = (result.spans || []).map((s, idx) => ({
    id: s.span_id || String(idx),
    name: s.name,
    type: s.span_type,
    start: (s.start_time - result.spans[0].start_time) * 1000,
    dur: s.duration_ms,
    depth: s.span_type === "chain" && idx === 0 ? 0 : 1,
  }))
  const total = spans.reduce((max, s) => Math.max(max, s.start + s.dur), 1)

  return (
    <>
      <Specimen
        id="one case"
        title={result.test_case_name}
        actions={<Verdict state={result.passed ? "pass" : "fail"} />}
      >
        <div className="grid grid-cols-2 divide-x divide-rule border-b border-rule md:grid-cols-4">
          <div className="px-4 py-3">
            <Reading label="judge" value={result.scores?.llm_judge ?? "—"} size="sm" />
          </div>
          <div className="px-4 py-3">
            <Reading
              label="similarity"
              value={result.scores?.semantic_similarity ?? "—"}
              size="sm"
            />
          </div>
          <div className="px-4 py-3">
            <Reading label="latency" value={fmtLatency(result.latency_ms)} size="sm" />
          </div>
          <div className="px-4 py-3">
            <Reading label="cost" value={fmtCost(result.cost_usd)} size="sm" />
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="mb-2 text-[11px] text-ink-faint">output</p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{result.model_output}</p>
        </div>

        {result.judge_reasoning && (
          <div className="border-t border-rule bg-paper-sunk/40 px-4 py-3">
            <p className="mb-1 text-[11px] text-ink-faint">why the judge scored it that way</p>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{result.judge_reasoning}</p>
          </div>
        )}

        {result.regression_flags?.length > 0 && (
          <ul className="border-t border-rule bg-[#fbeeed] px-4 py-3">
            {result.regression_flags.map((flag) => (
              <li key={flag} className="text-[12.5px] leading-relaxed text-[#a9201a]">
                {flag}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-rule px-4 py-2 text-[11.5px] text-ink-faint">
          Served by{" "}
          <span className="num">{result.engine === "nvidia" ? "NVIDIA NIM" : result.engine}</span>
          {result.judge_engine && (
            <>
              , graded by <span className="num">{result.judge_engine}</span>
            </>
          )}
          {result.engine_note && <>. {result.engine_note}</>}
        </div>
      </Specimen>

      {spans.length > 0 && (
        <Specimen id="trace" title="Spans">
          <div className="flex justify-end border-b border-rule px-4 py-2">
            <SpanKey />
          </div>
          <div className="p-2">
            <Waterfall spans={spans} total={total} compact />
          </div>
        </Specimen>
      )}
    </>
  )
}
