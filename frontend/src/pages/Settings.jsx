import React from "react"
import Shell from "@/components/console/Shell"
import { BenchError, BenchLoading, Reading, Specimen, Verdict } from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { fmtDateTime, fmtRelative } from "@/lib/format"
import * as api from "@/api"

export default function Settings() {
  const { data: health, loading, error, reload } = useAsync(() => api.fetchHealth(), [])
  const { data: models } = useAsync(() => api.fetchModels(), [])
  const { data: emails } = useAsync(() => api.fetchSentEmails(), [])

  return (
    <Shell title="Settings" lede="How this bench is wired up">
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !health && <BenchLoading rows={5} />}

      {health && (
        <div className="space-y-6">
          <section className="plane grid grid-cols-2 divide-rule md:grid-cols-4 md:divide-x">
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading
                label="inference"
                value={health.live_inference ? "live" : "simulator"}
                tone={health.live_inference ? "pass" : "warn"}
                note={health.engine}
                size="sm"
              />
            </div>
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading label="api version" value={health.version} size="sm" />
            </div>
            <div className="px-5 py-4">
              <Reading
                label="cases run at once"
                value={health.eval_concurrency}
                size="sm"
                note="EVAL_CONCURRENCY"
              />
            </div>
            <div className="px-5 py-4">
              <Reading
                label="uptime"
                value={`${Math.round(health.uptime_seconds / 60)}m`}
                size="sm"
              />
            </div>
          </section>

          {!health.live_inference && (
            <div className="border-l-2 border-[#fab219] bg-[#fdf6e6] px-5 py-4">
              <p className="font-display text-[15px] font-semibold text-[#7a5200]">
                No provider key is configured
              </p>
              <p className="measure mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                Every run will be served by the local simulator. Put{" "}
                <code className="num">NVIDIA_API_KEY=...</code> in{" "}
                <code className="num">backend/.env</code> and restart the API to
                grade against a real model.
              </p>
            </div>
          )}

          <Specimen id="models" title="Models this bench can call">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    {["model", "provider", "context", "per 1M prompt", "per 1M answer", "status"].map(
                      (label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-4 py-2 text-[11.5px] font-medium text-ink-faint"
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(models || []).map((model) => (
                    <tr key={model.id} className="border-b border-rule-soft last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="text-[13px] font-medium">{model.name}</span>
                        <span className="num mt-0.5 block text-[11px] text-ink-faint">
                          {model.id}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-soft">{model.provider}</td>
                      <td className="num px-4 py-2.5 text-[12px] text-ink-soft">
                        {model.context_window}
                      </td>
                      <td className="num px-4 py-2.5 text-[12px] text-ink-soft">
                        ${model.cost_per_1m?.prompt?.toFixed(2)}
                      </td>
                      <td className="num px-4 py-2.5 text-[12px] text-ink-soft">
                        ${model.cost_per_1m?.completion?.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Verdict state={model.status === "ready" ? "pass" : "warn"}>
                          {model.status === "ready" ? "ready" : "needs a key"}
                        </Verdict>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Specimen>

          <Specimen id="storage" title="Where things are kept">
            <dl className="divide-y divide-rule-soft">
              {[
                ["datasets", `${health.counts.datasets} sets, ${health.counts.test_cases} cases`],
                ["runs", `${health.counts.runs} recorded`],
                ["on disk", "backend/data/*.json, written atomically"],
                ["secrets", "backend/.env, never read from source"],
                ["api docs", "http://127.0.0.1:8000/docs"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 px-4 py-2.5">
                  <dt className="w-[110px] shrink-0 text-[11.5px] text-ink-faint">{label}</dt>
                  <dd className="num min-w-0 flex-1 text-[12.5px] break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Specimen>

          {emails?.length > 0 && (
            <Specimen
              id="notices"
              title="Sign-in notices"
              footer="Delivery is logged locally unless GMAIL_USER and GMAIL_APP_PASSWORD are set."
            >
              <ul className="divide-y divide-rule-soft">
                {emails.slice(0, 8).map((mail) => (
                  <li key={mail.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5">
                    <span className="num min-w-0 flex-1 truncate text-[12.5px]">{mail.to}</span>
                    <span className="text-[12px] text-ink-soft">{mail.provider}</span>
                    <span className="num text-[11.5px] text-ink-faint">{mail.method}</span>
                    <span className="num text-[11.5px] text-ink-faint">{mail.timestamp}</span>
                  </li>
                ))}
              </ul>
            </Specimen>
          )}
        </div>
      )}
    </Shell>
  )
}
