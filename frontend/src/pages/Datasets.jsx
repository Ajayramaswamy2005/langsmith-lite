import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Search, Trash2, Upload } from "lucide-react"
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
import { BenchEmpty, BenchError, BenchLoading, Cell, DataRow, DataSheet } from "@/components/bench"
import { useAsync } from "@/lib/hooks"
import { fmtRelative } from "@/lib/format"
import * as api from "@/api"

const SAMPLE_IMPORT = `{
  "name": "Support golden set",
  "description": "Cases a customer already hit in production",
  "tags": ["support"],
  "test_cases": [
    {
      "name": "refund inside 30 days",
      "inputs": { "query": "Can I return these headphones?" },
      "expected_output": "Confirm the 30-day window and send the return link."
    }
  ]
}`

export default function Datasets() {
  const { data, loading, error, reload } = useAsync(() => api.fetchDatasets(), [])
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const rows = useMemo(() => {
    const list = data || []
    const needle = query.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(needle) ||
        d.description.toLowerCase().includes(needle) ||
        d.tags.some((t) => t.toLowerCase().includes(needle)),
    )
  }, [data, query])

  const remove = async (dataset) => {
    if (!window.confirm(`Delete "${dataset.name}" and its ${dataset.test_cases.length} cases? Runs already recorded against it are kept.`)) return
    try {
      await api.deleteDataset(dataset.id)
      toast.success("Dataset deleted", { description: dataset.name })
      reload()
    } catch (err) {
      toast.error("Could not delete the dataset", { description: err.message })
    }
  }

  return (
    <Shell
      title="Datasets"
      lede={data ? `${data.length} golden set${data.length === 1 ? "" : "s"} on the bench` : "Reading the bench"}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <Upload size={13} />
            Import JSON
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} />
            New dataset
          </Button>
        </>
      }
    >
      {error && <BenchError error={error} onRetry={reload} />}
      {loading && !data && <BenchLoading rows={6} />}

      {data && data.length === 0 && (
        <BenchEmpty
          title="No golden sets yet"
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              Create the first one
            </Button>
          }
        >
          A golden set is the list of cases a prompt change must not break.
          Start with the bugs you have already shipped: the input that went
          wrong and the answer you actually wanted.
        </BenchEmpty>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, description or tag"
              className="pl-9"
              aria-label="Filter datasets"
            />
          </div>

          <div className="plane overflow-hidden">
            <DataSheet
              minWidth={760}
              columns={[
                { label: "dataset" },
                { label: "tags" },
                { label: "cases", align: "right", width: 80 },
                { label: "created", align: "right", width: 120 },
                { label: "", width: 48 },
              ]}
            >
              {rows.map((dataset) => (
                <DataRow key={dataset.id}>
                  <Cell className="max-w-[340px]">
                    <Link
                      to={`/app/datasets/${dataset.id}`}
                      className="block truncate text-[13.5px] font-medium transition-colors hover:text-signal"
                    >
                      {dataset.name}
                    </Link>
                    {dataset.description && (
                      <p className="mt-0.5 max-w-[52ch] truncate text-[12px] text-ink-faint">
                        {dataset.description}
                      </p>
                    )}
                    <p className="num mt-0.5 text-[10.5px] text-ink-faint">{dataset.id}</p>
                  </Cell>
                  <Cell>
                    <span className="flex flex-wrap gap-1">
                      {dataset.tags.length ? (
                        dataset.tags.map((tag) => (
                          <span
                            key={tag}
                            className="border border-rule bg-paper-sunk px-1.5 text-[11px] text-ink-soft"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[12px] text-ink-faint">none</span>
                      )}
                    </span>
                  </Cell>
                  <Cell align="right" mono>
                    {dataset.test_cases.length}
                  </Cell>
                  <Cell align="right" className="text-[12px] text-ink-faint">
                    {fmtRelative(dataset.created_at)}
                  </Cell>
                  <Cell align="right">
                    <button
                      type="button"
                      onClick={() => remove(dataset)}
                      aria-label={`Delete ${dataset.name}`}
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
                No dataset matches “{query}”.
              </p>
            )}
          </div>
        </div>
      )}

      <CreateDialog open={creating} onOpenChange={setCreating} onDone={reload} />
      <ImportDialog open={importing} onOpenChange={setImporting} onDone={reload} />
    </Shell>
  )
}

/* ------------------------------------------------------------- create ---- */

function CreateDialog({ open, onOpenChange, onDone }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const created = await api.createDataset({
        name: name.trim(),
        description: description.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      toast.success("Dataset created", { description: created.name })
      setName("")
      setDescription("")
      setTags("")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error("Could not create the dataset", { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New dataset</DialogTitle>
            <DialogDescription>
              An empty golden set. You add cases to it on the next screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="ds-name">Name</Label>
              <Input
                id="ds-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support golden set"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-desc">What it covers</Label>
              <Textarea
                id="ds-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Refund policy, escalation tone, and the safety probes we must never regress."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-tags">Tags</Label>
              <Input
                id="ds-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="support, safety"
              />
              <p className="text-[11.5px] text-ink-faint">Separate with commas.</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating" : "Create dataset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------- import ---- */

function ImportDialog({ open, onOpenChange, onDone }) {
  const [text, setText] = useState(SAMPLE_IMPORT)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setProblem(null)

    let payload
    try {
      payload = JSON.parse(text)
    } catch (err) {
      setProblem(`That is not valid JSON: ${err.message}`)
      return
    }
    if (!payload.name) {
      setProblem("The object needs a name.")
      return
    }

    setBusy(true)
    try {
      const created = await api.importDataset(payload)
      toast.success("Dataset imported", {
        description: `${created.name}, ${created.test_cases.length} cases`,
      })
      onOpenChange(false)
      onDone()
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  const readFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setText(await file.text())
    setProblem(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Import a dataset</DialogTitle>
            <DialogDescription>
              Paste the JSON or pick a file. Each case needs inputs and the
              output you expected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-5">
            <input
              type="file"
              accept="application/json,.json"
              onChange={readFile}
              className="block w-full text-[12.5px] text-ink-soft file:mr-3 file:border file:border-rule file:bg-paper-sunk file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink"
              aria-label="Choose a JSON file"
            />
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setProblem(null)
              }}
              rows={14}
              spellCheck={false}
              className="code-sheet !text-[12px]"
              aria-label="Dataset JSON"
            />
            {problem && (
              <p className="border-l-2 border-[#a9201a] bg-[#fbeeed] px-3 py-2 text-[12.5px] text-ink-soft">
                {problem}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Importing" : "Import dataset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
