export function fmtLatency(ms) {
  if (ms == null) return "—";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
  const mins = Math.floor(ms / 60000);
  return `${mins}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function fmtCost(usd) {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function fmtTokens(n) {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function fmtPct(value, digits = 1) {
  if (value == null) return "—";
  return `${Number(value).toFixed(digits)}%`;
}

export function fmtDelta(value, suffix = "") {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

export function fmtNumber(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

/** Backend timestamps are "YYYY-MM-DD HH:MM:SS" in local server time. */
export function parseTs(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDateTime(value) {
  const date = parseTs(value);
  if (!date) return value || "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtRelative(value) {
  const date = parseTs(value);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortId(id, keep = 8) {
  if (!id) return "—";
  return id.length <= keep + 4 ? id : `${id.slice(0, keep)}…`;
}

/** Green above 85, amber 70–85, red below — matches the judge pass threshold. */
export function scoreTone(score) {
  if (score == null) return "muted";
  if (score >= 85) return "good";
  if (score >= 70) return "warn";
  return "critical";
}

export function severityTone(severity) {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warn";
    case "improvement":
      return "good";
    default:
      return "muted";
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
