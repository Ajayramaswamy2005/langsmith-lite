import time
import uuid
from collections import Counter
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import (
    CORS_ORIGINS,
    EVAL_CONCURRENCY,
    LIVE_MODE_AVAILABLE,
    MODEL_COSTS,
)
from models import (
    Dataset,
    DatasetCreate,
    DatasetImport,
    DatasetUpdate,
    JobStatus,
    RunComparison,
    RunSummary,
    SingleEvalRequest,
    StartEvaluationRequest,
    TestCase,
    TestCaseCreate,
    TestCaseUpdate,
)
from storage import storage
from seed_data import seed_database
from evaluator import compare_runs, evaluate_test_case, execute_run
from jobs import jobs
from auth import (
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    create_access_token,
    find_user_by_email,
    get_current_user,
    public_user,
    send_welcome_signin_email,
    _load_emails,
    _load_users,
    _save_users,
)
from security import hash_password, is_hashed, verify_password

SERVICE_STARTED_AT = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    yield


app = FastAPI(
    title="LangSmith Lite API",
    description="LLM evaluation, automated graders, tracing and regression detection.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- SYSTEM -----------------

@app.get("/api/health")
def health():
    datasets = storage.get_datasets()
    runs = storage.get_runs()
    return {
        "status": "ok",
        "version": app.version,
        "uptime_seconds": round(time.time() - SERVICE_STARTED_AT, 1),
        "live_inference": LIVE_MODE_AVAILABLE,
        "engine": "NVIDIA NIM" if LIVE_MODE_AVAILABLE else "Local simulator",
        "eval_concurrency": EVAL_CONCURRENCY,
        "counts": {
            "datasets": len(datasets),
            "test_cases": sum(len(d.test_cases) for d in datasets),
            "runs": len(runs),
        },
    }


@app.get("/api/models")
def get_models():
    return [
        {
            "id": "z-ai/glm-5.3",
            "name": "GLM-5.3",
            "label": "Reasoning & production",
            "provider": "NVIDIA NIM",
            "context_window": "128k",
            "cost_per_1m": MODEL_COSTS["z-ai/glm-5.3"],
            "status": "ready" if LIVE_MODE_AVAILABLE else "needs_api_key",
        },
        {
            "id": "z-ai/glm-5.3-flash",
            "name": "GLM-5.3 Flash",
            "label": "High throughput",
            "provider": "NVIDIA NIM",
            "context_window": "128k",
            "cost_per_1m": MODEL_COSTS["z-ai/glm-5.3-flash"],
            "status": "ready" if LIVE_MODE_AVAILABLE else "needs_api_key",
        },
        {
            "id": "mock-fast-eval",
            "name": "Fast Simulator",
            "label": "Local & instant",
            "provider": "Built-in",
            "context_window": "32k",
            "cost_per_1m": MODEL_COSTS["mock-fast-eval"],
            "status": "ready",
        },
    ]


FLAG_CATEGORIES = (
    ("judge", "LLM judge below threshold"),
    ("semantic", "Semantic similarity below threshold"),
    ("json", "Output was not valid JSON"),
    ("latency", "Latency budget exceeded"),
    ("cost", "Cost budget exceeded"),
    ("execution error", "Execution error"),
    ("dropped", "Quality dropped against baseline"),
    ("slower", "Slower than baseline"),
)


def _flag_category(flag: str) -> str:
    lowered = flag.lower()
    for needle, label in FLAG_CATEGORIES:
        if needle in lowered:
            return label
    return flag[:60]


@app.get("/api/stats")
def get_stats():
    """Aggregates everything the dashboard needs in a single round-trip."""
    datasets = storage.get_datasets()
    runs = storage.get_runs()
    completed = [r for r in runs if r.status == "completed" and r.total_cases]

    total_cases_run = sum(r.total_cases for r in completed)
    total_passed = sum(r.passed_cases for r in completed)

    flag_counter: Counter = Counter()
    for run in completed:
        for item in run.items:
            for flag in item.regression_flags:
                flag_counter[_flag_category(flag)] += 1

    # Oldest → newest so the chart reads left to right.
    trend = [
        {
            "run_id": r.id,
            "name": r.name,
            "created_at": r.created_at,
            "pass_rate": r.pass_rate,
            "avg_score": r.avg_score,
            "avg_latency_ms": r.avg_latency_ms,
            "p95_latency_ms": r.p95_latency_ms,
            "cost_per_case_usd": round(r.total_cost_usd / r.total_cases, 6)
            if r.total_cases
            else 0.0,
            "dataset_name": r.dataset_name,
            "model": r.prompt_config.model,
        }
        for r in reversed(completed)
    ]

    by_dataset = []
    for ds in datasets:
        ds_runs = [r for r in completed if r.dataset_id == ds.id]
        by_dataset.append(
            {
                "dataset_id": ds.id,
                "name": ds.name,
                "test_cases": len(ds.test_cases),
                "runs": len(ds_runs),
                "latest_pass_rate": ds_runs[0].pass_rate if ds_runs else None,
                "latest_avg_score": ds_runs[0].avg_score if ds_runs else None,
            }
        )

    latest = completed[0] if completed else None
    previous = completed[1] if len(completed) > 1 else None

    return {
        "totals": {
            "datasets": len(datasets),
            "test_cases": sum(len(d.test_cases) for d in datasets),
            "runs": len(runs),
            "cases_evaluated": total_cases_run,
            "pass_rate": round(total_passed / total_cases_run * 100, 1)
            if total_cases_run
            else 0.0,
            "total_cost_usd": round(sum(r.total_cost_usd for r in completed), 6),
            "total_tokens": sum(
                r.total_tokens or sum(i.total_tokens for i in r.items)
                for r in completed
            ),
            "avg_latency_ms": round(
                sum(r.avg_latency_ms for r in completed) / len(completed), 1
            )
            if completed
            else 0.0,
        },
        "latest": {
            "run_id": latest.id,
            "name": latest.name,
            "pass_rate": latest.pass_rate,
            "avg_score": latest.avg_score,
            "avg_latency_ms": latest.avg_latency_ms,
            "total_cost_usd": latest.total_cost_usd,
            "created_at": latest.created_at,
        }
        if latest
        else None,
        "deltas": {
            "pass_rate": round(latest.pass_rate - previous.pass_rate, 1),
            "avg_score": round(latest.avg_score - previous.avg_score, 1),
            "avg_latency_ms": round(latest.avg_latency_ms - previous.avg_latency_ms, 1),
        }
        if latest and previous
        else None,
        "trend": trend,
        "by_dataset": by_dataset,
        "top_failures": [
            {"reason": reason, "count": count}
            for reason, count in flag_counter.most_common(6)
        ],
    }


# ----------------- DATASETS -----------------

@app.get("/api/datasets", response_model=List[Dataset])
def get_datasets(search: Optional[str] = Query(None)):
    datasets = storage.get_datasets()
    if search:
        needle = search.strip().lower()
        datasets = [
            d
            for d in datasets
            if needle in d.name.lower()
            or needle in d.description.lower()
            or any(needle in t.lower() for t in d.tags)
        ]
    return datasets


@app.get("/api/datasets/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: str):
    ds = storage.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


@app.post("/api/datasets", response_model=Dataset, status_code=201)
def create_dataset(payload: DatasetCreate):
    dataset = Dataset(
        id=f"ds-{uuid.uuid4().hex[:8]}",
        name=payload.name.strip(),
        description=payload.description.strip(),
        tags=payload.tags,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        test_cases=[],
    )
    storage.save_dataset(dataset)
    return dataset


@app.patch("/api/datasets/{dataset_id}", response_model=Dataset)
def update_dataset(dataset_id: str, payload: DatasetUpdate):
    ds = storage.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if payload.name is not None:
        ds.name = payload.name.strip()
    if payload.description is not None:
        ds.description = payload.description.strip()
    if payload.tags is not None:
        ds.tags = payload.tags
    storage.save_dataset(ds)
    return ds


@app.post("/api/datasets/import", response_model=Dataset, status_code=201)
def import_dataset(payload: DatasetImport):
    test_cases: List[TestCase] = []
    for idx, tc in enumerate(payload.test_cases):
        if not isinstance(tc, dict):
            raise HTTPException(
                status_code=422,
                detail=f"Test case #{idx + 1} must be an object",
            )
        inputs = tc.get("inputs") or {}
        if not isinstance(inputs, dict):
            inputs = {"input": str(inputs)}
        test_cases.append(
            TestCase(
                id=f"tc-{uuid.uuid4().hex[:8]}",
                name=str(tc.get("name") or f"Test case #{idx + 1}"),
                inputs=inputs,
                expected_output=str(tc.get("expected_output", "")),
                tags=[str(t) for t in (tc.get("tags") or [])],
                metadata=tc.get("metadata") or {},
            )
        )

    dataset = Dataset(
        id=f"ds-{uuid.uuid4().hex[:8]}",
        name=payload.name.strip(),
        description=payload.description.strip()
        or f"Imported dataset with {len(test_cases)} cases",
        tags=payload.tags or ["imported"],
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        test_cases=test_cases,
    )
    storage.save_dataset(dataset)
    return dataset


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    if not storage.delete_dataset(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"status": "deleted", "id": dataset_id}


@app.post(
    "/api/datasets/{dataset_id}/test-cases", response_model=TestCase, status_code=201
)
def add_test_case(dataset_id: str, payload: TestCaseCreate):
    ds = storage.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not payload.inputs:
        raise HTTPException(
            status_code=422, detail="A test case needs at least one input variable"
        )

    test_case = TestCase(
        id=f"tc-{uuid.uuid4().hex[:8]}",
        name=payload.name.strip(),
        inputs=payload.inputs,
        expected_output=payload.expected_output,
        tags=payload.tags,
        metadata=payload.metadata,
    )
    ds.test_cases.append(test_case)
    storage.save_dataset(ds)
    return test_case


@app.patch(
    "/api/datasets/{dataset_id}/test-cases/{case_id}", response_model=TestCase
)
def update_test_case(dataset_id: str, case_id: str, payload: TestCaseUpdate):
    ds = storage.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    target = next((tc for tc in ds.test_cases if tc.id == case_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Test case not found")

    if payload.name is not None:
        target.name = payload.name.strip()
    if payload.inputs is not None:
        target.inputs = payload.inputs
    if payload.expected_output is not None:
        target.expected_output = payload.expected_output
    if payload.tags is not None:
        target.tags = payload.tags
    if payload.metadata is not None:
        target.metadata = payload.metadata

    storage.save_dataset(ds)
    return target


@app.delete("/api/datasets/{dataset_id}/test-cases/{case_id}")
def delete_test_case(dataset_id: str, case_id: str):
    ds = storage.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    remaining = [tc for tc in ds.test_cases if tc.id != case_id]
    if len(remaining) == len(ds.test_cases):
        raise HTTPException(status_code=404, detail="Test case not found")
    ds.test_cases = remaining
    storage.save_dataset(ds)
    return {"status": "deleted", "id": case_id}


# ----------------- EVALUATION RUNS -----------------

@app.get("/api/runs", response_model=List[RunSummary])
def get_runs(
    dataset_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return storage.get_runs(dataset_id=dataset_id)[:limit]


@app.get("/api/runs/{run_id}", response_model=RunSummary)
def get_run(run_id: str):
    run = storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    if not storage.delete_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "deleted", "id": run_id}


def _default_run_name(dataset_name: str, model: str) -> str:
    return f"{model.split('/')[-1]} on {dataset_name}, {time.strftime('%H:%M')}"


@app.post("/api/evaluations/run", response_model=RunSummary)
def run_evaluation(payload: StartEvaluationRequest):
    """Runs an evaluation synchronously and returns the finished summary."""
    ds = storage.get_dataset(payload.dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not ds.test_cases:
        raise HTTPException(
            status_code=400, detail="Dataset has no test cases to evaluate"
        )

    summary = execute_run(
        run_id=f"run-{uuid.uuid4().hex[:8]}",
        run_name=payload.run_name.strip()
        or _default_run_name(ds.name, payload.prompt_config.model),
        dataset=ds,
        prompt_config=payload.prompt_config,
        grader_config=payload.grader_config,
    )
    storage.save_run(summary)
    return summary


@app.post("/api/evaluations/start", response_model=JobStatus, status_code=202)
def start_evaluation(payload: StartEvaluationRequest, background: BackgroundTasks):
    """Queues an evaluation and returns a job to poll for live progress."""
    ds = storage.get_dataset(payload.dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not ds.test_cases:
        raise HTTPException(
            status_code=400, detail="Dataset has no test cases to evaluate"
        )

    run_name = payload.run_name.strip() or _default_run_name(
        ds.name, payload.prompt_config.model
    )
    job = jobs.create(
        run_name=run_name,
        dataset_id=ds.id,
        dataset_name=ds.name,
        total=len(ds.test_cases),
    )

    def _work():
        jobs.update(job.job_id, status="running")
        try:
            summary = execute_run(
                run_id=f"run-{uuid.uuid4().hex[:8]}",
                run_name=run_name,
                dataset=ds,
                prompt_config=payload.prompt_config,
                grader_config=payload.grader_config,
                on_progress=lambda done, total, name: jobs.update(
                    job.job_id, completed=done, total=total, current_case=name
                ),
            )
            storage.save_run(summary)
            jobs.update(
                job.job_id,
                status="completed",
                run_id=summary.id,
                completed=summary.total_cases,
                current_case=None,
                finished_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )
        except Exception as exc:
            jobs.update(
                job.job_id,
                status="failed",
                error=f"{type(exc).__name__}: {exc}",
                finished_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

    background.add_task(_work)
    return job


@app.get("/api/evaluations/jobs", response_model=List[JobStatus])
def list_jobs():
    return jobs.list()


@app.get("/api/evaluations/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/evaluations/single")
def test_single_prompt(payload: SingleEvalRequest):
    """Runs one ad-hoc case for rapid playground iteration."""
    if not payload.inputs:
        raise HTTPException(
            status_code=422, detail="Provide at least one input variable"
        )
    test_case = TestCase(
        id="quick-test",
        name=payload.name,
        inputs=payload.inputs,
        expected_output=payload.expected_output,
        tags=[],
    )
    return evaluate_test_case(test_case, payload.prompt_config, payload.grader_config)


# ----------------- REGRESSION COMPARISON -----------------

@app.get("/api/compare", response_model=RunComparison)
def compare_evaluation_runs(
    baseline_id: str = Query(..., description="ID of the baseline run"),
    candidate_id: str = Query(..., description="ID of the candidate run"),
):
    baseline = storage.get_run(baseline_id)
    candidate = storage.get_run(candidate_id)
    if not baseline:
        raise HTTPException(
            status_code=404, detail=f"Baseline run {baseline_id} not found"
        )
    if not candidate:
        raise HTTPException(
            status_code=404, detail=f"Candidate run {candidate_id} not found"
        )
    if baseline.id == candidate.id:
        raise HTTPException(
            status_code=400, detail="Pick two different runs to compare"
        )
    return compare_runs(baseline, candidate)


# ----------------- AUTHENTICATION -----------------

@app.post("/api/auth/register")
def register_user(payload: RegisterRequest):
    users = _load_users()
    if find_user_by_email(users, payload.email):
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        )

    now_str = time.strftime("%Y-%m-%d %H:%M:%S")
    name = (payload.name or "").strip() or payload.email.split("@")[0].capitalize()
    user_id = f"usr-{uuid.uuid4().hex[:8]}"

    new_user = {
        "id": user_id,
        "email": payload.email,
        "password": hash_password(payload.password),
        "name": name,
        "avatar": f"https://api.dicebear.com/7.x/bottts/svg?seed={payload.email}",
        "provider": "email",
        "created_at": now_str,
        "last_login": now_str,
    }
    users[user_id] = new_user
    _save_users(users)

    return {
        "token": create_access_token(new_user),
        "user": public_user(new_user),
        "email_dispatch": send_welcome_signin_email(
            payload.email, name, provider="email"
        ),
    }


@app.post("/api/auth/login")
def login_user(payload: LoginRequest):
    users = _load_users()
    found_user = find_user_by_email(users, payload.email)

    if not found_user or not verify_password(
        payload.password, found_user.get("password", "")
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Upgrade any legacy plain-text credential now that we have the password.
    if not is_hashed(found_user.get("password", "")):
        found_user["password"] = hash_password(payload.password)

    found_user["last_login"] = time.strftime("%Y-%m-%d %H:%M:%S")
    _save_users(users)

    return {
        "token": create_access_token(found_user),
        "user": public_user(found_user),
        "email_dispatch": send_welcome_signin_email(
            found_user["email"], found_user["name"], provider="email"
        ),
    }


@app.post("/api/auth/google")
def google_signin(payload: GoogleLoginRequest):
    users = _load_users()
    found_user = find_user_by_email(users, payload.email)
    now_str = time.strftime("%Y-%m-%d %H:%M:%S")

    if not found_user:
        user_id = f"usr-{uuid.uuid4().hex[:8]}"
        found_user = {
            "id": user_id,
            "email": payload.email,
            "name": (payload.name or "").strip()
            or payload.email.split("@")[0].capitalize(),
            "avatar": payload.avatar
            or f"https://api.dicebear.com/7.x/avataaars/svg?seed={payload.email}",
            "provider": "gmail",
            "created_at": now_str,
            "last_login": now_str,
        }
        users[user_id] = found_user
    else:
        found_user["last_login"] = now_str
        if payload.name:
            found_user["name"] = payload.name.strip()
        if payload.avatar:
            found_user["avatar"] = payload.avatar

    _save_users(users)

    return {
        "token": create_access_token(found_user),
        "user": {**public_user(found_user), "provider": "gmail"},
        "email_dispatch": send_welcome_signin_email(
            found_user["email"], found_user["name"], provider="gmail"
        ),
    }


@app.get("/api/auth/me")
def get_auth_me(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user


@app.get("/api/auth/emails")
def get_sent_emails(limit: int = Query(50, ge=1, le=100)):
    return _load_emails()[:limit]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
