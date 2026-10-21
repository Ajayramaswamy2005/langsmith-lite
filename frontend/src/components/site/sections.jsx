import React, { useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "cn"
import { Check, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Mark, SpanKey, TitleBlock, ToleranceBand, Verdict, Waterfall } from "@/components/bench"
import { Figure, RankedBars, STATUS } from "@/components/figures"

/* ======================================================= tolerance strip == */

const GATES = [
  {
    gate: "Quality",
    tolerance: "±5 points",
    reading: "−1.6",
    value: -1.6,
    min: -20,
    max: 20,
    state: "pass",
    detail: "Mean judge score against the baseline run.",
  },
  {
    gate: "Latency",
    tolerance: "+25%",
    reading: "+38%",
    value: 38,
    min: -50,
    max: 60,
    state: "warn",
    detail: "Mean and p95 wall clock per case.",
  },
  {
    gate: "Cost",
    tolerance: "+20%",
    reading: "+16%",
    value: 16,
    min: -40,
    max: 40,
    state: "pass",
    detail: "Token spend per case, normalised across run sizes.",
  },
]

/** The factual anchor under the hero: what the bench measures, and against what. */
export function ToleranceStrip() {
  return (
    <section className="border-y border-rule bg-plane" aria-label="Gate tolerances">
      <div className="sheet grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {GATES.map((gate) => (
          <div key={gate.gate} className="py-6 md:px-7 md:first:pl-0 md:last:pr-0">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-sans text-[13px] font-medium tracking-normal">{gate.gate}</h3>
              <span className="num text-[11.5px] text-ink-faint">
                tolerance {gate.tolerance}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="num text-[22px] font-medium leading-none"
                style={{ color: gate.state === "warn" ? "#7a5200" : "#006300" }}
              >
                {gate.reading}
              </span>
              <Verdict state={gate.state}>
                {gate.state === "warn" ? "over tolerance" : "in tolerance"}
              </Verdict>
            </div>
            <ToleranceBand
              className="mt-3"
              value={gate.value}
              min={gate.min}
              max={gate.max}
              okFrom={gate.min}
              okTo={gate.gate === "Quality" ? 20 : gate.gate === "Latency" ? 25 : 20}
            />
            <p className="mt-2.5 text-[12.5px] leading-snug text-ink-soft">{gate.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============================================================== measures == */

const GRADERS = [
  {
    name: "LLM judge",
    measures: "Did it answer correctly, in the right tone?",
    output: "0–100 plus written reasoning",
    kind: "model",
    config: "your rubric, temperature 0",
  },
  {
    name: "Semantic match",
    measures: "How close is the wording to the reference?",
    output: "0.00–1.00 ratio",
    kind: "deterministic",
    config: "threshold, default 0.40",
  },
  {
    name: "Schema check",
    measures: "Does the output parse as the JSON you asked for?",
    output: "valid or invalid",
    kind: "deterministic",
    config: "strict parse, fences stripped",
  },
  {
    name: "Latency budget",
    measures: "Did the call come back inside its time budget?",
    output: "milliseconds against a ceiling",
    kind: "deterministic",
    config: "per-case ceiling in ms",
  },
  {
    name: "Cost budget",
    measures: "Did this case cost more than you allow?",
    output: "USD against a ceiling",
    kind: "deterministic",
    config: "per-case ceiling in USD",
  },
]

export function Measures() {
  return (
    <section id="measures" className="sheet scroll-mt-16 py-16 md:py-24">
      <TitleBlock
        title="Five graders run on every case"
        aside={
          <div className="flex max-w-[20ch] flex-col gap-1 border-l-2 border-signal pl-3 text-[12.5px] leading-snug text-ink-soft">
            <span>A case passes only when every grader it runs clears.</span>
          </div>
        }
      >
        One of them asks a model for a judgement and writes down its reasoning.
        The other four are arithmetic. A failing case tells you which grader
        rejected it, so you know whether you have a prompt problem or a budget
        problem.
      </TitleBlock>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            The five graders, what each measures, and what it returns
          </caption>
          <thead>
            <tr className="border-y border-rule bg-plane">
              <th scope="col" className="px-4 py-2.5 text-[11.5px] font-medium text-ink-faint">
                grader
              </th>
              <th scope="col" className="px-4 py-2.5 text-[11.5px] font-medium text-ink-faint">
                what it measures
              </th>
              <th scope="col" className="px-4 py-2.5 text-[11.5px] font-medium text-ink-faint">
                reading
              </th>
              <th scope="col" className="px-4 py-2.5 text-[11.5px] font-medium text-ink-faint">
                you configure
              </th>
            </tr>
          </thead>
          <tbody>
            {GRADERS.map((row) => (
              <tr key={row.name} className="border-b border-rule-soft bg-plane">
                <th scope="row" className="px-4 py-3 align-top">
                  <span className="text-[13.5px] font-medium">{row.name}</span>
                  <span className="mt-1 block text-[11px] text-ink-faint">{row.kind}</span>
                </th>
                <td className="px-4 py-3 align-top text-[13px] text-ink-soft">{row.measures}</td>
                <td className="num px-4 py-3 align-top text-[12px] text-ink-soft">{row.output}</td>
                <td className="px-4 py-3 align-top text-[12.5px] text-ink-soft">{row.config}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="measure mt-6 text-[13.5px] leading-relaxed text-ink-soft">
        When the provider is slow or down, the run still finishes. The case is
        marked as served by the local simulator, the span is flagged degraded,
        and the run summary counts live calls against fallbacks, so simulated
        text is never mistaken for live inference.
      </p>
    </section>
  )
}

/* ================================================================ traces == */

const SPANS = [
  { id: "a", name: "rag_support_agent", type: "chain", start: 0, dur: 1456, depth: 0, tokens: 684, usd: 0.00061, self: 43 },
  { id: "b", name: "format_prompt", type: "chain", start: 3, dur: 12, depth: 1, tokens: 0, usd: 0, self: 12 },
  { id: "c", name: "policy_index", type: "tool", start: 18, dur: 214, depth: 1, tokens: 0, usd: 0, self: 214 },
  { id: "d", name: "glm-5.3", type: "llm", start: 238, dur: 918, depth: 1, tokens: 684, usd: 0.00061, self: 918 },
  { id: "e", name: "llm_judge", type: "grader", start: 1162, dur: 262, depth: 1, tokens: 301, usd: 0.00028, self: 262 },
  { id: "f", name: "semantic_match", type: "grader", start: 1426, dur: 9, depth: 1, tokens: 0, usd: 0, self: 9 },
  { id: "g", name: "budgets", type: "grader", start: 1437, dur: 6, depth: 1, tokens: 0, usd: 0, self: 6 },
]

export function Traces() {
  const [active, setActive] = useState("d")
  const span = SPANS.find((s) => s.id === active) || SPANS[0]

  return (
    <section id="traces" className="scroll-mt-16 border-y border-rule bg-plane py-16 md:py-24">
      <div className="sheet">
        <TitleBlock title="A score says something moved. A trace says where.">
          Every case records its own waterfall: prompt assembly, retrieval, the
          model call, and each grader as a separate span with tokens and cost
          attached. Hover a span to read it.
        </TitleBlock>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <span className="num text-[11.5px] text-ink-faint">run-7f2a91c4 / tc-101</span>
              <SpanKey />
            </div>
            <div className="border border-rule bg-paper/40 p-2">
              <Waterfall spans={SPANS} total={1460} activeId={active} onHover={setActive} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 self-start border-l border-rule pl-6 lg:max-w-[260px] lg:grid-cols-1 lg:gap-y-4">
            {[
              ["span", span.name],
              ["kind", span.type],
              ["wall clock", `${span.dur} ms`],
              ["self time", `${span.self} ms`],
              ["tokens", span.tokens ? span.tokens.toLocaleString() : "none"],
              ["cost", span.usd ? `$${span.usd.toFixed(5)}` : "none"],
            ].map(([label, value]) => (
              <div key={label} className="lg:flex lg:items-baseline lg:justify-between lg:gap-4">
                <dt className="text-[11.5px] text-ink-faint">{label}</dt>
                <dd className="num mt-0.5 text-[13.5px] lg:mt-0">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/* ============================================================== sequence == */

const SNIPPETS = {
  python: `import httpx

API = "http://localhost:8000/api"

# 1. grade the candidate prompt against the golden set
job = httpx.post(f"{API}/evaluations/start", json={
    "dataset_id": "ds-cust-support",
    "run_name": "prompt-v4",
    "prompt_config": {
        "model": "z-ai/glm-5.3",
        "system_prompt": SYSTEM,
        "template": "Query: {query}\\nOrder: {order_id}",
    },
    "grader_config": {
        "llm_judge_rubric": "Score accuracy, tone, policy citation.",
        "max_latency_budget_ms": 45000,
    },
}).json()

# 2. poll until every case has been graded
run = wait_for(job["job_id"])

# 3. read the verdict and stop the build on a rejection
diff = httpx.get(f"{API}/compare", params={
    "baseline_id": BASELINE,
    "candidate_id": run["run_id"],
}).json()

assert diff["overall_status"] != "FAILED", (
    diff["quality_regression"]["explanation"]
)`,
  curl: `# 1. build a golden set from the bugs you have already shipped
curl -X POST localhost:8000/api/datasets/import \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Support golden set",
    "test_cases": [{
      "name": "refund inside 30 days",
      "inputs": { "query": "Can I return these headphones?" },
      "expected_output": "Confirm the 30-day window, send the return link."
    }]
  }'

# 2. grade a prompt against it
curl -X POST localhost:8000/api/evaluations/start \\
  -H 'Content-Type: application/json' \\
  -d '{ "dataset_id": "ds-cust-support",
        "prompt_config": { "model": "z-ai/glm-5.3" } }'

# 3. read the verdict
curl 'localhost:8000/api/compare?baseline_id=run-a&candidate_id=run-b'`,
  ci: `name: prompt-eval
on: [pull_request]

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Grade the prompt against the golden set
        run: python scripts/evaluate.py --dataset ds-cust-support

      - name: Stop on a quality, latency or cost regression
        run: python scripts/gate.py --baseline \${{ vars.BASELINE_RUN }}
        # exits non-zero when overall_status is FAILED`,
}

const TABS = [
  { id: "python", label: "Python" },
  { id: "curl", label: "curl" },
  { id: "ci", label: "GitHub Actions" },
]

const STEPS = [
  {
    n: "01",
    title: "Capture the cases that matter",
    body: "Start with the bugs you have already shipped. Each case carries its inputs and the answer you actually wanted.",
  },
  {
    n: "02",
    title: "Grade every candidate the same way",
    body: "One dataset, one rubric, one grader stack. Model, prompt and temperature are the only things that change between runs.",
  },
  {
    n: "03",
    title: "Read the verdict in CI",
    body: "Compare against the baseline. Review asks for a human; Rejected stops the merge.",
  },
]

export function Sequence() {
  const [tab, setTab] = useState("python")

  return (
    <section id="sequence" className="sheet scroll-mt-16 py-16 md:py-24">
      <TitleBlock title="Three calls from a prompt change to a verdict">
        Plain REST over JSON. No SDK to install, no agent framework to adopt,
        nothing sitting in the path of your production traffic.
      </TitleBlock>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
        <ol className="space-y-7">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="num shrink-0 pt-[3px] text-[12px] text-ink-faint">{step.n}</span>
              <div className="border-l border-rule pl-4">
                <h3 className="display-md">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="min-w-0 border border-rule bg-plane">
          <div className="flex border-b border-rule" role="tablist" aria-label="Example language">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative px-3.5 py-2 text-[12.5px] transition-colors",
                  tab === item.id
                    ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-signal"
                    : "text-ink-faint hover:text-ink-soft",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <pre className="code-sheet max-h-[480px] overflow-auto px-4 py-4 text-ink-soft">
            {SNIPPETS[tab]}
          </pre>
        </div>
      </div>
    </section>
  )
}

/* =========================================================== earns keep === */

const JOBS = [
  {
    title: "Safety probes that must never regress",
    body: "Keep a set of cases whose answers are not allowed to change: credentials, medical advice, refunds outside policy. One critical drop stops the change, however good the rest of the run looks.",
  },
  {
    title: "Moving between models",
    body: "Run the same golden set against both providers and read the quality, latency and cost deltas side by side. The decision stops being a vibe check.",
  },
  {
    title: "Trimming what a case costs",
    body: "Try the smaller model, the shorter prompt, the tighter token cap. The bench tells you exactly what each saving costs you in quality.",
  },
]

export function EarnsKeep() {
  return (
    <section className="border-t border-rule bg-plane py-16 md:py-24">
      <div className="sheet">
        <TitleBlock title="Built for the changes that scare you" />

        <div className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-3">
          {JOBS.map((job) => (
            <article key={job.title} className="border-t-2 border-ink pt-4">
              <h3 className="display-md max-w-[20ch]">{job.title}</h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">{job.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-14 grid gap-10 border-t border-rule pt-10 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
          <div>
            <h3 className="display-md max-w-[26ch]">
              Every rejected case is filed under the grader that rejected it
            </h3>
            <p className="measure mt-3 text-[13.5px] leading-relaxed text-ink-soft">
              Which means the first thing you learn about a bad run is whether
              to go and edit the prompt or go and raise a budget. Counts below
              are from one 30-case golden set across six runs.
            </p>
          </div>
          <Figure caption="Rejections by grader" note="30 cases, 6 runs">
            <RankedBars
              rows={[
                { label: "Judge below threshold", value: 14, color: STATUS.critical },
                { label: "Semantic mismatch", value: 9, color: "#eb6834" },
                { label: "Latency budget", value: 5, color: STATUS.warn },
                { label: "Invalid JSON", value: 2, color: "#2a78d6" },
              ]}
              formatValue={(v) => `${v} cases`}
            />
          </Figure>
        </div>
      </div>
    </section>
  )
}

/* ================================================================ pricing = */

const ROWS = [
  ["Datasets, cases and runs", "unlimited", "unlimited", "unlimited"],
  ["All five graders", true, true, true],
  ["Span tracing", true, true, true],
  ["Regression gates and run diffs", true, true, true],
  ["Shared datasets and baselines", false, true, true],
  ["Sign-in notifications and audit log", false, true, true],
  ["Per-user API tokens", false, true, true],
  ["Your own inference endpoint", false, false, true],
  ["Runs inside your network", false, false, true],
  ["Storage", "JSON files", "JSON files", "your database"],
]

const PLANS = [
  { name: "On your machine", price: "Free", note: "no account needed", cta: "Open the bench", to: "/app" },
  { name: "Shared", price: "Free", note: "while in preview", cta: "Start a run", to: "/login?mode=signup", featured: true },
  { name: "Self-managed", price: "Talk to us", note: "your network", cta: "Read the setup", to: "/app/settings" },
]

export function Pricing() {
  return (
    <section id="pricing" className="sheet scroll-mt-16 py-16 md:py-24">
      <TitleBlock title="Start on your laptop, move it inside your network">
        Inference is billed by whichever provider you point the bench at. This
        never sits in the path of your production traffic, so there is nothing
        here to meter.
      </TitleBlock>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr>
              <td className="w-[38%]" />
              {PLANS.map((plan) => (
                <th
                  key={plan.name}
                  scope="col"
                  className={cn(
                    "border-b-2 px-4 pb-4 align-bottom",
                    plan.featured ? "border-signal bg-signal-wash/50" : "border-rule",
                  )}
                >
                  <span className="block font-sans text-[13px] font-medium tracking-normal">
                    {plan.name}
                  </span>
                  <span className="mt-2 block font-display text-[26px] font-semibold leading-none">
                    {plan.price}
                  </span>
                  <span className="mt-1.5 block text-[11.5px] font-normal text-ink-faint">
                    {plan.note}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]} className="border-b border-rule-soft">
                <th scope="row" className="py-2.5 pr-4 text-left text-[13px] font-normal text-ink-soft">
                  {row[0]}
                </th>
                {row.slice(1).map((cell, idx) => (
                  <td
                    key={idx}
                    className={cn(
                      "px-4 py-2.5 text-[12.5px]",
                      PLANS[idx].featured && "bg-signal-wash/30",
                    )}
                  >
                    {cell === true ? (
                      <>
                        <Check size={14} strokeWidth={2.6} className="text-[#006300]" aria-hidden="true" />
                        <span className="sr-only">included</span>
                      </>
                    ) : cell === false ? (
                      <>
                        <Minus size={14} strokeWidth={2.4} className="text-ink-faint" aria-hidden="true" />
                        <span className="sr-only">not included</span>
                      </>
                    ) : (
                      <span className="num text-ink-soft">{cell}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {PLANS.map((plan) => (
                <td
                  key={plan.name}
                  className={cn("px-4 pt-5", plan.featured && "bg-signal-wash/30")}
                >
                  <Button asChild variant={plan.featured ? "default" : "outline"} size="sm" className="w-full">
                    <Link to={plan.to}>{plan.cta}</Link>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ============================================================== questions = */

const QUESTIONS = [
  {
    q: "How is this different from the eval script I would write myself?",
    a: "It is that script, plus the parts people skip: a stored baseline to measure against, severity bands so a one-point wobble is not treated like a forty-point drop, span traces that explain the drop, and budgets for latency and cost. The API is plain REST, so your script can still drive the whole thing.",
  },
  {
    q: "Which models can it grade?",
    a: "Anything behind an OpenAI-compatible chat-completions endpoint. It ships configured for NVIDIA NIM with GLM-5.3 and GLM-5.3 Flash, and includes a local simulator so you can build datasets and explore the bench with no API key and no spend.",
  },
  {
    q: "Can I trust the LLM judge?",
    a: "Treat it as one reading with its reasoning attached, not an oracle. It runs at temperature zero against a rubric you write, alongside four deterministic checks, so a judge wobble on its own cannot flip a verdict. Every score records which engine produced it.",
  },
  {
    q: "What happens when the provider is slow or down?",
    a: "The run finishes with a degraded span rather than crashing. The case records that the simulator served it and why, and the run summary counts live calls against fallbacks.",
  },
  {
    q: "Where does my data live?",
    a: "In JSON files under backend/data, on whatever machine runs the API. Nothing is reported anywhere. Provider keys are read from backend/.env, never from source.",
  },
  {
    q: "Is a reasoning model going to be slow?",
    a: "Yes, and the bench is built for it. GLM-5.3 spends tens of seconds thinking before it answers, so cases run concurrently, runs execute as background jobs you poll for progress, and the default latency budget is 45 seconds rather than two.",
  },
]

export function Questions() {
  return (
    <section id="questions" className="scroll-mt-16 border-t border-rule bg-plane py-16 md:py-24">
      <div className="sheet grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <TitleBlock title="Questions worth asking">
            The whole thing runs locally in two commands, so the fastest way to
            judge it is to point it at a dataset you already have.
          </TitleBlock>
        </div>

        <Accordion type="single" collapsible defaultValue="q-0" className="lg:pt-6">
          {QUESTIONS.map((item, idx) => (
            <AccordionItem key={item.q} value={`q-${idx}`} className="border-b border-rule">
              <AccordionTrigger className="py-4 text-left text-[15px] font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-[13.5px] leading-relaxed text-ink-soft">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

/* ================================================================ closing = */

export function Closing() {
  return (
    <section className="border-t border-rule py-20 md:py-28">
      <div className="sheet ruled">
        <div>
          <h2 className="display-xl max-w-[18ch]">Measure it before you ship it.</h2>
          <p className="measure mt-5 text-[16px] leading-relaxed text-ink-soft">
            Build the golden set once. Grade every change against it. Ship when
            the bench says the change is within tolerance.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login?mode=signup">Start a run</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/app">Open the bench</Link>
            </Button>
          </div>
          <p className="num mt-5 text-[11.5px] text-ink-faint">
            no card, no framework, two commands
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================= footer = */

const GROUPS = [
  {
    title: "The bench",
    links: [
      { label: "Overview", to: "/app" },
      { label: "Datasets", to: "/app/datasets" },
      { label: "Playground", to: "/app/playground" },
      { label: "Runs", to: "/app/runs" },
      { label: "Compare runs", to: "/app/compare" },
    ],
  },
  {
    title: "This page",
    links: [
      { label: "What it measures", href: "#measures" },
      { label: "Traces", href: "#traces" },
      { label: "How it runs", href: "#sequence" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "API docs", href: "http://127.0.0.1:8000/docs" },
      { label: "OpenAPI schema", href: "http://127.0.0.1:8000/openapi.json" },
      { label: "Settings and keys", to: "/app/settings" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-rule bg-paper-sunk">
      <div className="sheet py-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Mark />
            <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-ink-soft">
              A test bench for LLM prompt changes. Golden sets, auditable
              graders, span traces, and a verdict you can put in CI.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-sans text-[12.5px] font-medium tracking-normal">
                {group.title}
              </h2>
              <ul className="mt-3.5 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-[13px] text-ink-soft transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target={link.href?.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer"
                        className="text-[13px] text-ink-soft transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
          <p className="text-[12px] text-ink-faint">
            © {new Date().getFullYear()} LangSmith Lite
          </p>
          <p className="text-[12px] text-ink-faint">
            Inference billed by your provider. Data stays on your machine.
          </p>
        </div>
      </div>
    </footer>
  )
}
