import React from "react"
import { cn } from "cn"
import { AlertTriangle, Check, Minus, X } from "lucide-react"

/* ===========================================================================
   Bench primitives

   The pieces that carry this product's voice, as opposed to the shadcn
   primitives in ./ui which carry its behaviour. Everything here is drawn:
   rules, ticks, needles and ink. Nothing floats.
   =========================================================================== */

/* ------------------------------------------------------------------ mark -- */

export function Mark({ size = 26, withName = true, className }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect x="0.5" y="0.5" width="31" height="31" rx="2.5" fill="#fbfbfa" stroke="#c6d0d2" />
        <path d="M4 25.5h24" stroke="#0d1a22" strokeWidth="1.5" />
        <path
          d="M7 25.5v-4M12 25.5v-7M17 25.5v-3M22 25.5v-9M27 25.5v-5"
          stroke="#c6d0d2"
          strokeWidth="1.3"
        />
        <path
          d="M5.5 17 10 10.5l5 5.5 5.5-9 6 7"
          fill="none"
          stroke="#15427a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21.5" cy="7" r="2.3" fill="#a9201a" />
      </svg>
      {withName && (
        <span className="font-display text-[16px] font-semibold leading-none tracking-[-0.01em]">
          LangSmith<span className="text-ink-faint font-medium"> Lite</span>
        </span>
      )}
    </span>
  )
}

/* ----------------------------------------------------------------- stamp -- */

/**
 * The verdict stamp — the one loud element in the product. Struck off-square
 * with mottled ink, the way a rubber stamp lands on an inspection sheet.
 */
export function Stamp({ verdict, note, strike = false, size = "md", className }) {
  const copy = {
    PASSED: { label: "Passed", tone: "stamp-pass" },
    WARNING: { label: "Review", tone: "stamp-reject" },
    FAILED: { label: "Rejected", tone: "stamp-reject" },
  }[verdict] || { label: verdict, tone: "stamp-reject" }

  const scale =
    size === "lg"
      ? "text-[30px] px-6 py-2.5"
      : size === "sm"
        ? "text-[15px] px-3 py-1"
        : "text-[21px] px-4 py-1.5"

  return (
    <span
      className={cn("stamp", copy.tone, scale, strike && "stamp-strike", className)}
      role="status"
    >
      <span className="leading-none">{copy.label}</span>
      {note && (
        <span className="font-mono text-[9px] font-medium tracking-[0.08em] opacity-80">
          {note}
        </span>
      )}
    </span>
  )
}

/* --------------------------------------------------------------- verdict -- */

const VERDICT_STYLE = {
  pass: "border-[#9ec79e] bg-[#eef5ee] text-[#006300]",
  fail: "border-[#e3b3b0] bg-[#fbeeed] text-[#a9201a]",
  warn: "border-[#e5cd92] bg-[#fdf6e6] text-[#7a5200]",
  none: "border-rule bg-paper-sunk text-ink-soft",
}

/** Pass/fail always ships a glyph and a word — colour never carries it alone. */
export function Verdict({ state, children, className }) {
  const Icon = state === "pass" ? Check : state === "fail" ? X : state === "warn" ? AlertTriangle : Minus
  const label = children ?? (state === "pass" ? "in tolerance" : state === "fail" ? "rejected" : state === "warn" ? "review" : "not run")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-[1px] text-[11.5px] font-medium whitespace-nowrap",
        VERDICT_STYLE[state] || VERDICT_STYLE.none,
        className,
      )}
    >
      <Icon size={11} strokeWidth={2.8} className="shrink-0" />
      {label}
    </span>
  )
}

/* --------------------------------------------------------------- reading -- */

/**
 * A measured value with its label. Numerals wear mono so columns of readings
 * align; the label stays in sans.
 */
export function Reading({ label, value, unit, note, tone = "ink", size = "md", className }) {
  const tones = {
    ink: "text-ink",
    pass: "text-[#006300]",
    fail: "text-[#a9201a]",
    warn: "text-[#7a5200]",
    faint: "text-ink-faint",
  }
  const sizes = {
    sm: "text-[15px]",
    md: "text-[20px]",
    lg: "text-[28px]",
  }

  return (
    <div className={className}>
      <p className="text-[11.5px] leading-tight text-ink-faint">{label}</p>
      <p className={cn("num mt-1 leading-none font-medium", sizes[size], tones[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-[0.56em] font-normal text-ink-faint">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-[11px] leading-tight text-ink-faint">{note}</p>}
    </div>
  )
}

/* ------------------------------------------------------------ tolerance --- */

/**
 * A tolerance band with a needle at the reading. The shaded span is the
 * acceptable range; the needle is where this run landed.
 */
export function ToleranceBand({ value, min, max, okFrom, okTo, className }) {
  const span = max - min || 1
  const pct = (v) => `${Math.max(0, Math.min(100, ((v - min) / span) * 100))}%`

  return (
    <div className={cn("band", className)}>
      <span
        className="band-ok"
        style={{ left: pct(okFrom), right: `${100 - parseFloat(pct(okTo))}%` }}
      />
      <span className="band-needle" style={{ left: pct(value) }} />
    </div>
  )
}

/* ------------------------------------------------------------ title block - */

/**
 * A section heading sitting astride a full-bleed rule, the way a drawing
 * sheet's title block interrupts its border. Replaces the usual
 * label-above-centred-heading arrangement.
 */
export function TitleBlock({ index, title, children, aside, className }) {
  return (
    <div className={cn("relative", className)}>
      <div className="h-px w-full bg-rule" />
      <div className="flex flex-col gap-4 pt-5 md:flex-row md:items-start md:justify-between md:gap-10">
        <div className="flex items-start gap-4">
          {index && (
            <span className="num mt-[5px] shrink-0 text-[12px] text-ink-faint">{index}</span>
          )}
          <div>
            <h2 className="display-lg max-w-[22ch]">{title}</h2>
            {children && (
              <p className="measure mt-3 text-[15px] leading-relaxed text-ink-soft">{children}</p>
            )}
          </div>
        </div>
        {aside && <div className="shrink-0 md:pt-1">{aside}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- specimen -- */

/** A measurement plane with a ruled header strip carrying its identifier. */
export function Specimen({ id, title, actions, children, footer, className }) {
  return (
    <section className={cn("plane overflow-hidden", className)}>
      <header className="flex items-center gap-3 border-b border-rule bg-paper-sunk/60 px-3.5 py-2">
        {id && <span className="num shrink-0 text-[11.5px] text-ink-faint">{id}</span>}
        {title && (
          <h3 className="min-w-0 truncate font-sans text-[12.5px] font-medium tracking-normal">
            {title}
          </h3>
        )}
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      {children}
      {footer && (
        <footer className="border-t border-rule bg-paper-sunk/40 px-3.5 py-2 text-[11.5px] text-ink-faint">
          {footer}
        </footer>
      )}
    </section>
  )
}

/* ------------------------------------------------------------- score cell - */

/** A 0–100 reading with its band. Used in every table of results. */
export function ScoreCell({ score, threshold = 70, className }) {
  if (score == null) return <span className="num text-[12.5px] text-ink-faint">—</span>
  const tone = score >= 85 ? "#006300" : score >= threshold ? "#7a5200" : "#a9201a"

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="num w-[26px] text-right text-[12.5px] font-medium" style={{ color: tone }}>
        {Math.round(score)}
      </span>
      <span className="relative hidden h-[4px] w-10 overflow-hidden rounded-[1px] bg-paper-sunk sm:block">
        <span
          className="absolute inset-y-0 left-0 rounded-[1px]"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: tone }}
        />
        <span
          className="absolute inset-y-[-2px] w-px bg-ink/35"
          style={{ left: `${threshold}%` }}
        />
      </span>
    </span>
  )
}

/* -------------------------------------------------------------- waterfall - */

export const SPAN_INK = {
  chain: "#6250d6",
  llm: "#2a78d6",
  tool: "#1baf7a",
  grader: "#eda100",
}

/**
 * Span waterfall. Each bar is directly labelled with its name and duration, so
 * the span-type colours never have to carry meaning on their own.
 */
export function Waterfall({ spans, total, activeId, onHover, compact = false, className }) {
  const span = total || Math.max(...spans.map((s) => s.start + s.dur), 1)

  return (
    <div className={cn("space-y-[3px]", className)}>
      {spans.map((row) => {
        const active = activeId === row.id
        return (
          <div
            key={row.id}
            onMouseEnter={() => onHover?.(row.id)}
            onFocus={() => onHover?.(row.id)}
            tabIndex={onHover ? 0 : undefined}
            className={cn(
              "grid items-center gap-3 rounded-[2px] px-2 py-[3px] transition-colors",
              compact
                ? "grid-cols-[minmax(84px,132px)_1fr_48px]"
                : "grid-cols-[minmax(96px,180px)_1fr_54px]",
              onHover && "cursor-default",
              active ? "bg-signal-wash" : onHover && "hover:bg-paper-sunk",
            )}
          >
            <span
              className="num truncate text-[11px] text-ink-soft"
              style={{ paddingLeft: (row.depth || 0) * 9 }}
              title={row.name}
            >
              {row.name}
            </span>
            <span className="relative h-[13px] rounded-[2px] bg-paper-sunk">
              <span
                className="absolute inset-y-0 rounded-[2px] ring-1 ring-plane"
                style={{
                  left: `${(row.start / span) * 100}%`,
                  width: `max(3px, ${(row.dur / span) * 100}%)`,
                  background: SPAN_INK[row.type] || SPAN_INK.chain,
                  opacity: active ? 1 : 0.82,
                }}
              />
            </span>
            <span className="num text-right text-[11px] text-ink-faint">
              {Math.round(row.dur)}ms
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SpanKey({ className }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1", className)}>
      {Object.entries(SPAN_INK).map(([type, ink]) => (
        <li key={type} className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className="size-2 rounded-[1px]" style={{ background: ink }} />
          {type}
        </li>
      ))}
    </ul>
  )
}

/* ----------------------------------------------------------------- states - */

export function BenchEmpty({ title, children, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-dashed border-rule bg-plane/60 px-6 py-10",
        className,
      )}
    >
      <h4 className="display-md">{title}</h4>
      {children && (
        <p className="measure text-[14px] leading-relaxed text-ink-soft">{children}</p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

export function BenchError({ error, onRetry, className }) {
  return (
    <div
      className={cn(
        "border-l-2 border-[#a9201a] bg-[#fbeeed] px-5 py-4",
        className,
      )}
      role="alert"
    >
      <p className="font-display text-[15px] font-semibold text-[#a9201a]">
        The bench could not read that
      </p>
      <p className="measure mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
        {error?.message || "Unexpected error."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 border-b border-signal/40 text-[13px] font-medium text-signal transition-colors hover:border-signal"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function BenchLoading({ rows = 5, className }) {
  return (
    <div className={cn("space-y-px", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse bg-paper-sunk"
          style={{ animationDelay: `${i * 110}ms`, opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- data table - */

/**
 * The table shell every listing uses. Rules between rows, no zebra striping,
 * header in small sans — a spec sheet, not a spreadsheet.
 */
export function DataSheet({ columns, children, minWidth, className }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table
        className="w-full border-collapse text-left"
        style={minWidth ? { minWidth } : undefined}
      >
        <thead>
          <tr className="border-b border-rule">
            {columns.map((col) => (
              <th
                key={col.key ?? col.label}
                scope="col"
                className={cn(
                  "px-3.5 py-2 text-[11.5px] font-medium whitespace-nowrap text-ink-faint",
                  col.align === "right" && "text-right",
                  col.className,
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function DataRow({ children, onClick, active, className }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-rule-soft last:border-0",
        onClick && "cursor-pointer",
        active ? "bg-signal-wash" : onClick && "hover:bg-paper-sunk/70",
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Cell({ children, align, mono, className, ...rest }) {
  return (
    <td
      className={cn(
        "px-3.5 py-2.5 text-[13px] align-middle",
        align === "right" && "text-right",
        mono && "num text-[12.5px]",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}
