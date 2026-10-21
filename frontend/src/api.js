const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
const TOKEN_KEY = "langsmith_jwt_token";

export { API_BASE };

/* ------------------------------ token ------------------------------ */

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked (private mode) — the session simply won't persist */
  }
}

export function authHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/* ------------------------------ core ------------------------------- */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** FastAPI returns validation problems as a list under `detail`. */
function readDetail(body, fallback) {
  const detail = body?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (!first) return fallback;
    const field = Array.isArray(first.loc) ? first.loc.slice(1).join(".") : "";
    return field ? `${field}: ${first.msg}` : first.msg || fallback;
  }
  return fallback;
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      "Cannot reach the API. Start the backend with `python -m uvicorn main:app --port 8000` in the backend folder.",
      0,
      null,
    );
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      readDetail(parsed, `Request failed (${res.status} ${res.statusText})`),
      res.status,
      parsed,
    );
  }
  return parsed;
}

/* ---------------------------- system ------------------------------- */

export const fetchHealth = () => request("/health");
export const fetchModels = () => request("/models");
export const fetchStats = () => request("/stats");

/* ------------------------------ auth ------------------------------- */

export async function loginUser(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (data?.token) setStoredToken(data.token);
  return data;
}

export async function registerUser(email, password, name) {
  const data = await request("/auth/register", {
    method: "POST",
    body: { email, password, name },
  });
  if (data?.token) setStoredToken(data.token);
  return data;
}

export async function googleSignIn(email, name, avatar) {
  const data = await request("/auth/google", {
    method: "POST",
    body: { email, name, avatar },
  });
  if (data?.token) setStoredToken(data.token);
  return data;
}

export async function fetchCurrentUser() {
  if (!getStoredToken()) return null;
  try {
    return await request("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) setStoredToken(null);
    return null;
  }
}

export const fetchSentEmails = () => request("/auth/emails");
export const logoutUser = () => setStoredToken(null);

/* ---------------------------- datasets ----------------------------- */

export const fetchDatasets = (search) =>
  request(`/datasets${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const fetchDataset = (id) => request(`/datasets/${id}`);

export const createDataset = (payload) =>
  request("/datasets", { method: "POST", body: payload });

export const updateDataset = (id, payload) =>
  request(`/datasets/${id}`, { method: "PATCH", body: payload });

export const importDataset = (payload) =>
  request("/datasets/import", { method: "POST", body: payload });

export const deleteDataset = (id) =>
  request(`/datasets/${id}`, { method: "DELETE" });

export const addTestCase = (datasetId, payload) =>
  request(`/datasets/${datasetId}/test-cases`, { method: "POST", body: payload });

export const updateTestCase = (datasetId, caseId, payload) =>
  request(`/datasets/${datasetId}/test-cases/${caseId}`, {
    method: "PATCH",
    body: payload,
  });

export const deleteTestCase = (datasetId, caseId) =>
  request(`/datasets/${datasetId}/test-cases/${caseId}`, { method: "DELETE" });

/* ------------------------- runs & evaluation ----------------------- */

export const fetchRuns = (datasetId = null) =>
  request(`/runs${datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : ""}`);

export const fetchRun = (runId) => request(`/runs/${runId}`);

export const deleteRun = (runId) => request(`/runs/${runId}`, { method: "DELETE" });

export const DEFAULT_GRADER = {
  use_llm_judge: true,
  llm_judge_rubric:
    "Score 0-100 on factual accuracy, completeness against the expected output, helpfulness and tone. Penalise hallucinated specifics.",
  judge_model: "mock-fast-eval",
  use_semantic_match: true,
  semantic_threshold: 0.4,
  use_json_validation: false,
  max_latency_budget_ms: 45000,
  max_cost_budget_usd: 0.01,
};

export const DEFAULT_PROMPT = {
  system_prompt:
    "You are a precise, helpful assistant. Answer directly and never invent specifics you were not given.",
  template: "{query}",
  model: "mock-fast-eval",
  temperature: 0.2,
  max_tokens: 320,
  execution_mode: "mock",
};

/** Starts an evaluation as a background job and returns its JobStatus. */
export const startEvaluation = (payload) =>
  request("/evaluations/start", { method: "POST", body: payload });

export const fetchJob = (jobId, opts) => request(`/evaluations/jobs/${jobId}`, opts);

export const fetchJobs = () => request("/evaluations/jobs");

/** Runs an evaluation synchronously (used by scripts, not the UI). */
export const runEvaluationSync = (payload) =>
  request("/evaluations/run", { method: "POST", body: payload });

export const testSinglePrompt = (payload) =>
  request("/evaluations/single", { method: "POST", body: payload });

export const compareRuns = (baselineId, candidateId) =>
  request(
    `/compare?baseline_id=${encodeURIComponent(baselineId)}&candidate_id=${encodeURIComponent(candidateId)}`,
  );

/**
 * Polls a job until it finishes. `onTick` receives each JobStatus so the UI can
 * show live progress; the resolved value is the terminal status.
 */
export async function pollJob(jobId, onTick, { interval = 900, signal } = {}) {
  for (;;) {
    const job = await fetchJob(jobId, { signal });
    onTick?.(job);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, interval));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }
}
