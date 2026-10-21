import React, { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Download, Play, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Shell from "@/components/console/Shell"
import { BenchEmpty, BenchError, BenchLoading, Reading, Specimen } from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { downloadJson, fmtDateTime } from "@/lib/format"
import * as api from "@/api"

export default function DatasetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => api.fetchDataset(id), [id])
  const { data: runs } = useAsync(() => api.fetchRuns(id), [id])
  const [adding, setAdding] = useState(false)

  const removeCase = async (testCase) => {
    if (!window.confirm(`Remove "${testCase.name}" from this dataset?`)) return
    try {
      await api.deleteTestCase(id, testCase.id)
      toast.success("Case removed", { description: testCase.name })
      reload()
    } catch (err) {
      toast.error("Could not remove the case", { description: err.message })
    }
  }

  return (
    <Shell
      title={data?.name || "Dataset"}
      lede={data ? `${data.test_cases.length} cases, created ${fmtDateTime(data.created_at)}` : "Reading the dataset"}
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/datasets">
              <ArrowLeft size={13} />
              All datasets
            </Link>
          </Button>
          {data && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJson(`${data.id}.json`, data)}
              >
                <Download size={13} />
                Export
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={13} />
                Add case
              </Button>
            </>
          )}
        </>
      }
    >
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !data && <BenchLoading rows={6} />}

      {data && (
        <div className="space-y-6">
          {data.description && (
            <p className="measure text-[14px] leading-relaxed text-ink-soft">{data.description}</p>
          )}

          <section className="plane grid grid-cols-2 divide-rule md:grid-cols-4 md:divide-x">
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading label="cases" value={data.test_cases.length} />
            </div>
            <div className="border-b border-rule px-5 py-4 md:border-b-0">
              <Reading label="runs against it" value={runs?.length ?? "—"} />
            </div>
            <div className="px-5 py-4">
              <Reading
                label="input variables"
                value={
                  new Set(data.test_cases.flatMap((tc) => Object.keys(tc.inputs))).size || "—"
                }
                note={[...new Set(data.test_cases.flatMap((tc) => Object.keys(tc.inputs)))]
                  .slice(0, 4)
                  .join(", ")}
              />
            </div>
            <div className="flex items-center px-5 py-4">
              <Button asChild size="sm" className="w-full">
                <Link to={`/app/playground?dataset=${data.id}`}>
                  <Play size={13} />
                  Grade a prompt
                </Link>
              </Button>
            </div>
          </section>

          {data.test_cases.length === 0 ? (
            <BenchEmpty
              title="This set has no cases yet"
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  Add the first case
                </Button>
              }
            >
              A case is an input, and the answer you expect back. The graders
              measure every candidate prompt against that expectation.
            </BenchEmpty>
          ) : (
            <div className="space-y-3">
              {data.test_cases.map((testCase, idx) => (
                <Specimen
                  key={testCase.id}
                  id={`${String(idx + 1).padStart(2, "0")} / ${testCase.id}`}
                  title={testCase.name}
                  actions={
                    <button
                      type="button"
                      onClick={() => removeCase(testCase)}
                      aria-label={`Remove ${testCase.name}`}
                      className="grid size-6 place-items-center text-ink-faint transition-colors hover:text-[#a9201a]"
                    >
                      <Trash2 size={13} />
                    </button>
                  }
                >
                  <div className="grid divide-rule md:grid-cols-2 md:divide-x">
                    <div className="border-b border-rule px-4 py-3 md:border-b-0">
                      <p className="mb-2 text-[11px] text-ink-faint">inputs</p>
                      <dl className="space-y-1.5">
                        {Object.entries(testCase.inputs).map(([key, value]) => (
                          <div key={key} className="flex gap-2.5">
                            <dt className="num shrink-0 text-[11.5px] text-ink-faint">{key}</dt>
                            <dd className="min-w-0 text-[12.5px] leading-snug text-ink-soft">
                              {String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="px-4 py-3">
                      <p className="mb-2 text-[11px] text-ink-faint">expected output</p>
                      <p className="text-[12.5px] leading-relaxed text-ink-soft">
                        {testCase.expected_output || (
                          <span className="text-ink-faint">none recorded</span>
                        )}
                      </p>
                      {testCase.tags?.length > 0 && (
                        <p className="mt-2.5 flex flex-wrap gap-1">
                          {testCase.tags.map((tag) => (
                            <span
                              key={tag}
                              className="border border-rule bg-paper-sunk px-1.5 text-[11px] text-ink-soft"
                            >
                              {tag}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                </Specimen>
              ))}
            </div>
          )}

          {runs && runs.length > 0 && (
            <Specimen id="history" title="Runs against this set">
              <ul className="divide-y divide-rule-soft">
                {runs.slice(0, 8).map((run) => (
                  <li key={run.id}>
                    <Link
                      to={`/app/runs/${run.id}`}
                      className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 transition-colors hover:bg-paper-sunk/60"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">{run.name}</span>
                      <span className="num text-[12px] text-ink-soft">
                        {run.pass_rate}% passed
                      </span>
                      <span className="num text-[12px] text-ink-soft">score {run.avg_score}</span>
                      <span className="num text-[11.5px] text-ink-faint">
                        {fmtDateTime(run.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Specimen>
          )}
        </div>
      )}

      <AddCaseDialog open={adding} onOpenChange={setAdding} datasetId={id} onDone={reload} />
    </Shell>
  )
}

/* ------------------------------------------------------------ add case --- */

function AddCaseDialog({ open, onOpenChange, datasetId, onDone }) {
  const [name, setName] = useState("")
  const [variables, setVariables] = useState([{ key: "query", value: "" }])
  const [expected, setExpected] = useState("")
  const [tags, setTags] = useState("")
  const [busy, setBusy] = useState(false)

  const setVar = (idx, patch) =>
    setVariables((list) => list.map((v, i) => (i === idx ? { ...v, ...patch } : v)))

  const submit = async (event) => {
    event.preventDefault()
    const inputs = {}
    variables.forEach((v) => {
      if (v.key.trim()) inputs[v.key.trim()] = v.value
    })
    if (!Object.keys(inputs).length) {
      toast.error("A case needs at least one input variable")
      return
    }

    setBusy(true)
    try {
      await api.addTestCase(datasetId, {
        name: name.trim(),
        inputs,
        expected_output: expected,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      toast.success("Case added", { description: name })
      setName("")
      setVariables([{ key: "query", value: "" }])
      setExpected("")
      setTags("")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error("Could not add the case", { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a case</DialogTitle>
            <DialogDescription>
              Variables here fill the placeholders in your prompt template, so
              a name of <code className="num">query</code> matches{" "}
              <code className="num">{"{query}"}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="tc-name">What this case checks</Label>
              <Input
                id="tc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="refund inside 30 days"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Input variables</Label>
              {variables.map((variable, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={variable.key}
                    onChange={(e) => setVar(idx, { key: e.target.value })}
                    placeholder="query"
                    className="num w-36 shrink-0"
                    aria-label={`Variable ${idx + 1} name`}
                  />
                  <Input
                    value={variable.value}
                    onChange={(e) => setVar(idx, { value: e.target.value })}
                    placeholder="Can I return these headphones?"
                    aria-label={`Variable ${idx + 1} value`}
                  />
                  {variables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVariables((l) => l.filter((_, i) => i !== idx))}
                      aria-label="Remove variable"
                      className="grid size-8 shrink-0 place-items-center text-ink-faint hover:text-[#a9201a]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setVariables((l) => [...l, { key: "", value: "" }])}
              >
                <Plus size={12} />
                Another variable
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tc-expected">Expected output</Label>
              <Textarea
                id="tc-expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="Confirm the 30-day window and send the return link for the order."
                rows={3}
              />
              <p className="text-[11.5px] text-ink-faint">
                Describe the answer you wanted. The judge scores against this,
                so it does not need to be word-for-word.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tc-tags">Tags</Label>
              <Input
                id="tc-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="refunds, policy"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Adding" : "Add case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
