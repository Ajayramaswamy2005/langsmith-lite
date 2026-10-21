import React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "cn"
import { fmtCost, fmtLatency } from "@/lib/format"

/* ===========================================================================
   Figures

   The documented light categorical palette, validated against this product's
   #fbfbfa measurement plane. Slots 3–5 fall below 3:1 against that plane, so
   every figure here ships direct labels, a reading beside it, or the table it
   summarises — the relief rule, satisfied by construction.
   =========================================================================== */

export const SERIES = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  violet: "#6250d6",
}

export const STATUS = {
  good: "#0ca30c",
  warn: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
}

const GRID = "#d9e0e0"
const AXIS = "#74858a"
const RULE = "#c6d0d2"

const axis = {
  stroke: RULE,
  tick: { fill: AXIS, fontSize: 10.5, fontFamily: "IBM Plex Mono, monospace" },
  tickLine: { stroke: RULE },
  axisLine: { stroke: RULE },
}

/* ---------------------------------------------------------------- tooltip - */

function Readout({ active, payload, label, format, heading }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[170px] border border-rule bg-plane px-3 py-2">
      <p className="mb-1.5 truncate text-[11.5px] font-medium">
        {heading ? heading(payload[0]?.payload, label) : label}
      </p>
      <dl className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-baseline justify-between gap-5">
            <dt className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <span
                className="size-2 shrink-0 rounded-[1px]"
                style={{ background: entry.color || entry.fill }}
              />
              {entry.name}
            </dt>
            <dd className="num text-[11.5px]">
              {format ? format(entry.value, entry.dataKey, entry.payload) : entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ----------------------------------------------------------- figure frame - */

/**
 * A figure carries its own caption and key. A single-series figure gets no
 * key — the caption names it.
 */
export function Figure({ caption, note, keyItems, children, className }) {
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
        <span className="text-[12.5px] font-medium">{caption}</span>
        {keyItems ? <FigureKey items={keyItems} /> : note ? (
          <span className="text-[11px] text-ink-faint">{note}</span>
        ) : null}
      </figcaption>
      {children}
      {keyItems && note && <p className="mt-2 text-[11px] text-ink-faint">{note}</p>}
    </figure>
  )
}

export function FigureKey({ items, className }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span
            className="h-[3px] w-3.5 shrink-0"
            style={{
              background: item.dashed
                ? `repeating-linear-gradient(90deg,${item.color} 0 4px,transparent 4px 7px)`
                : item.color,
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------- quality trend - */

/** Pass rate and judge score are both 0–100, so one axis serves both. */
export function QualityTrend({ data, height = 216 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="fig-pass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={SERIES.blue} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="idx" {...axis} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} width={38} />
          <ReferenceLine y={70} stroke={RULE} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={
              <Readout
                heading={(row) => row?.name || "Run"}
                format={(v) => Number(v).toFixed(1)}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="pass_rate"
            name="pass rate"
            stroke={SERIES.blue}
            strokeWidth={2}
            fill="url(#fig-pass)"
            dot={{ r: 2, fill: SERIES.blue, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "#fbfbfa", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="avg_score"
            name="judge score"
            stroke={SERIES.orange}
            strokeWidth={2}
            dot={{ r: 2, fill: SERIES.orange, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "#fbfbfa", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------------------------------------------------- latency trend - */

export function LatencyTrend({ data, height = 216 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="idx" {...axis} />
          <YAxis
            {...axis}
            width={52}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}`)}
          />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={<Readout heading={(row) => row?.name || "Run"} format={(v) => fmtLatency(v)} />}
          />
          <Line
            type="monotone"
            dataKey="avg_latency_ms"
            name="mean"
            stroke={SERIES.aqua}
            strokeWidth={2}
            dot={{ r: 2, fill: SERIES.aqua, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "#fbfbfa", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="p95_latency_ms"
            name="p95"
            stroke={SERIES.violet}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4, stroke: "#fbfbfa", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------- cost trend - */

export function CostTrend({ data, height = 180 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -2 }} barCategoryGap="34%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="idx" {...axis} />
          <YAxis
            {...axis}
            width={64}
            // Per-case cost is often well under a cent; 4dp collapses every
            // tick to the same label.
            tickFormatter={(v) => (v === 0 ? "$0" : `$${Number(v).toFixed(5)}`)}
          />
          <Tooltip
            cursor={{ fill: "rgba(13,26,34,0.045)" }}
            content={<Readout heading={(row) => row?.name || "Run"} format={(v) => fmtCost(v)} />}
          />
          <Bar
            dataKey="cost_per_case_usd"
            name="cost per case"
            fill={SERIES.yellow}
            radius={[2, 2, 0, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --------------------------------------------------------- score spectrum - */

/**
 * Per-case judge scores, tinted by the band each one lands in. The case name
 * and verdict ride along in the tooltip, and the table below the figure
 * repeats every value — so the tint is never the only cue.
 */
export function ScoreSpectrum({ items, threshold = 70, height = 196 }) {
  const data = items.map((item, idx) => ({
    idx: idx + 1,
    name: item.test_case_name,
    score: item.scores?.llm_judge ?? Math.round((item.scores?.semantic_similarity ?? 0) * 100),
    passed: item.passed,
  }))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }} barCategoryGap="26%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="idx" {...axis} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} width={36} />
          <ReferenceLine
            y={threshold}
            stroke="#0d1a22"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
          <Tooltip
            cursor={{ fill: "rgba(13,26,34,0.045)" }}
            content={
              <Readout
                heading={(row) => row?.name}
                format={(v, _k, row) => `${v} / 100 · ${row?.passed ? "in tolerance" : "rejected"}`}
              />
            }
          />
          <Bar dataKey="score" name="judge score" radius={[2, 2, 0, 0]} maxBarSize={26}>
            {data.map((row) => (
              <Cell
                key={row.idx}
                fill={row.score >= 85 ? STATUS.good : row.score >= threshold ? STATUS.warn : STATUS.critical}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------- sparkline -- */

export function Trace({ values, color = SERIES.blue, width = 86, height = 24 }) {
  if (!values?.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)])
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  )
}

/* ------------------------------------------------------------- dial ------- */

/** A gauge needle on a 0–100 arc. Reads as an instrument, not a donut. */
export function Dial({ score, size = 92, label }) {
  const value = Math.max(0, Math.min(100, score ?? 0))
  const r = size / 2 - 9
  const cx = size / 2
  const cy = size / 2 + 2
  const start = Math.PI
  const angle = start - (value / 100) * Math.PI
  const ink = value >= 85 ? "#006300" : value >= 70 ? "#7a5200" : "#a9201a"

  const arc = (from, to, radius) => {
    const a1 = start - (from / 100) * Math.PI
    const a2 = start - (to / 100) * Math.PI
    return [
      `M ${cx + radius * Math.cos(a1)} ${cy - radius * Math.sin(a1)}`,
      `A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(a2)} ${cy - radius * Math.sin(a2)}`,
    ].join(" ")
  }

  return (
    <div className="inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`}>
        <path d={arc(0, 100, r)} fill="none" stroke="#d9e0e0" strokeWidth="6" />
        <path d={arc(70, 100, r)} fill="none" stroke="rgba(12,163,12,0.3)" strokeWidth="6" />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = start - (t / 100) * Math.PI
          return (
            <line
              key={t}
              x1={cx + (r - 5) * Math.cos(a)}
              y1={cy - (r - 5) * Math.sin(a)}
              x2={cx + (r + 5) * Math.cos(a)}
              y2={cy - (r + 5) * Math.sin(a)}
              stroke="#c6d0d2"
              strokeWidth="1"
            />
          )
        })}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 2) * Math.cos(angle)}
          y2={cy - (r - 2) * Math.sin(angle)}
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transition: "all 0.7s cubic-bezier(0.2,0.9,0.3,1)" }}
        />
        <circle cx={cx} cy={cy} r="2.6" fill="#0d1a22" />
      </svg>
      <p className="num -mt-1 text-[17px] font-medium leading-none" style={{ color: ink }}>
        {Math.round(value)}
      </p>
      {label && <p className="mt-1 text-[11px] text-ink-faint">{label}</p>}
    </div>
  )
}

/* ------------------------------------------------------------ ranked bars - */

/** Ranked counts, each row directly labelled — no key needed. */
export function RankedBars({ rows, formatValue, className }) {
  const ceiling = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <span className="truncate text-[12.5px] text-ink-soft">{row.label}</span>
            <span className="num shrink-0 text-[11.5px] text-ink-faint">
              {formatValue ? formatValue(row.value) : row.value}
            </span>
          </div>
          <div className="h-[5px] w-full bg-paper-sunk">
            <div
              className="h-full transition-[width] duration-500 ease-out"
              style={{
                width: `${(row.value / ceiling) * 100}%`,
                background: row.color || SERIES.orange,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
