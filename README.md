# LangSmith Lite

A test bench for LLM prompt changes. Build a golden set of cases, grade every
output against your rubric, trace each span, and read a verdict before the
change ships.

Evaluation is really metrology: you measure a specimen against a tolerance and
read off a result. The interface is built that way — drafting paper, drawn
hairlines, tolerance bands, and an inked verdict stamp.

---

## Run it

Two commands. The backend seeds itself with sample datasets and runs on first
start.

```bash
# API — http://127.0.0.1:8000
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

# Console — http://localhost:5173
cd frontend
npm install
npm run dev
```

Browsable API docs: <http://127.0.0.1:8000/docs>

### Provider key (optional)

Without a key everything still works — a local simulator answers instantly and
costs nothing, which is the default. To grade against a real model, copy
`backend/.env.example` to `backend/.env` and fill in:

```ini
NVIDIA_API_KEY=nvapi-...
JWT_SECRET=something-random
EVAL_CONCURRENCY=6
```

Keys are read from `.env` only, never from source. `.env` is gitignored.

> GLM-5.3 is a reasoning model: it spends completion tokens thinking before it
> answers. Expect roughly 60–90 s per case on live inference, and a second round
> trip for the judge. Cases run concurrently and a run executes as a background
> job you poll, so this is survivable — but the simulator is the right default
> while you are shaping a prompt.

---

## What it measures

Five graders run on every case. A case passes only when every grader it runs
clears.

| Grader | What it measures | Reading |
|---|---|---|
| LLM judge | Did it answer correctly, in the right tone? | 0–100 plus written reasoning |
| Semantic match | How close is the wording to the reference? | 0.00–1.00 ratio |
| Schema check | Does the output parse as the JSON you asked for? | valid / invalid |
| Latency budget | Did the call return inside its time budget? | ms against a ceiling |
| Cost budget | Did this case cost more than you allow? | USD against a ceiling |

Three gates classify a candidate run against a baseline — **quality**,
**latency** and **cost** — each with a severity (`none`, `warning`,
`critical`, `improvement`). The run-level `overall_status` is `PASSED`,
`WARNING` or `FAILED`, and that is the value CI reads.

---

## The loop

```python
import httpx
API = "http://localhost:8000/api"

# 1. grade the candidate prompt against the golden set
job = httpx.post(f"{API}/evaluations/start", json={
    "dataset_id": "ds-cust-support",
    "run_name": "prompt-v4",
    "prompt_config": {"model": "z-ai/glm-5.3", "template": "Query: {query}"},
    "grader_config": {"llm_judge_rubric": "Score accuracy, tone, policy citation."},
}).json()

# 2. poll until every case has been graded
run = wait_for(job["job_id"])

# 3. stop the build on a regression
diff = httpx.get(f"{API}/compare", params={
    "baseline_id": BASELINE, "candidate_id": run["run_id"],
}).json()
assert diff["overall_status"] != "FAILED", diff["quality_regression"]["explanation"]
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | engine, counts, concurrency |
| `GET` | `/api/stats` | everything the overview needs, in one call |
| `GET` | `/api/models` | available models and their pricing |
| `GET/POST` | `/api/datasets` | list and create golden sets |
| `PATCH/DELETE` | `/api/datasets/{id}` | rename, retag, remove |
| `POST` | `/api/datasets/import` | import a set from JSON |
| `POST/PATCH/DELETE` | `/api/datasets/{id}/test-cases` | manage cases |
| `POST` | `/api/evaluations/start` | queue a run, returns a job to poll |
| `GET` | `/api/evaluations/jobs/{id}` | live progress |
| `POST` | `/api/evaluations/run` | run synchronously (scripts) |
| `POST` | `/api/evaluations/single` | one ad-hoc case, for the playground |
| `GET` | `/api/runs`, `/api/runs/{id}` | recorded runs |
| `GET` | `/api/compare` | gate verdict and per-case diff |
| `POST` | `/api/auth/register`, `/login`, `/google` | accounts |

---

## How it is built

```
backend/
  main.py        FastAPI routes
  evaluator.py   runs cases concurrently, builds spans, compares runs
  llm_engine.py  provider calls, judge, local simulator
  jobs.py        in-process registry for background runs
  storage.py     atomic JSON persistence
  security.py    PBKDF2 password hashing
frontend/
  src/components/bench.jsx    stamps, readings, tolerance bands, waterfalls
  src/components/figures.jsx  charts, on a CVD-validated palette
  src/components/ui/          shadcn (radix base), restyled onto bench tokens
  src/pages/                  landing, login, console
```

**Notes on behaviour worth knowing**

- Simulated output is never passed off as live. Each result records the `engine`
  that produced it and why it fell back, the span is marked `degraded`, and the
  run summary counts live calls against fallbacks.
- Runs are concurrent (`EVAL_CONCURRENCY`) because each case is an independent
  network-bound call.
- Storage is JSON under `backend/data`, written through a temp file and
  `os.replace` so a crash cannot truncate the store. Account and email-delivery
  records stay local and are gitignored.
- Chart colours are checked against the rendering surface for lightness,
  chroma, colour-vision separation and contrast; status is always carried by an
  icon and a word, never by colour alone.

---

## Licence

MIT
