import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from typing import Any, Callable, Dict, List, Optional

from config import EVAL_CONCURRENCY
from models import (
    Dataset,
    GraderConfig,
    PromptConfig,
    RegressionMetric,
    RunComparison,
    RunItemResult,
    RunSummary,
    TestCase,
    TraceSpan,
)
from llm_engine import (
    calculate_cost,
    call_nvidia_llm,
    run_llm_judge,
    simulate_llm_response,
)

JUDGE_PASS_THRESHOLD = 70


def _percentile(values: List[float], pct: float) -> float:
    """Nearest-rank percentile; returns 0.0 for an empty series."""
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 1)
    k = (len(ordered) - 1) * pct
    low = int(k)
    high = min(low + 1, len(ordered) - 1)
    weight = k - low
    return round(ordered[low] * (1 - weight) + ordered[high] * weight, 1)


def evaluate_test_case(
    test_case: TestCase,
    prompt_config: PromptConfig,
    grader_config: GraderConfig,
) -> RunItemResult:
    item_id = str(uuid.uuid4())
    start_time_all = time.time()
    spans: List[TraceSpan] = []

    # 1. Format prompt
    formatted_prompt = prompt_config.template or "{query}"
    for key, val in test_case.inputs.items():
        formatted_prompt = formatted_prompt.replace("{" + str(key) + "}", str(val))

    messages = []
    if prompt_config.system_prompt:
        messages.append({"role": "system", "content": prompt_config.system_prompt})
    messages.append({"role": "user", "content": formatted_prompt})

    t1_end = time.time()
    spans.append(
        TraceSpan(
            span_id=str(uuid.uuid4()),
            name="prompt_formatting",
            span_type="chain",
            start_time=start_time_all,
            end_time=t1_end,
            duration_ms=round((t1_end - start_time_all) * 1000, 2),
            input_data={
                "template": prompt_config.template,
                "variables": test_case.inputs,
            },
            output_data={"formatted_prompt": formatted_prompt},
        )
    )

    # 2. LLM call
    llm_start = time.time()
    if prompt_config.execution_mode == "mock":
        time.sleep(0.05)  # keep a touch of realistic network delay
        model_output = simulate_llm_response(messages, prompt_config.model)
        prompt_tokens = len(formatted_prompt) // 4 + 10
        completion_tokens = len(model_output) // 4 + 5
        llm_latency_ms = round((time.time() - llm_start) * 1000, 1)
        engine_meta: Dict[str, Any] = {
            "engine": "simulator",
            "error": None,
            "model": prompt_config.model,
        }
    else:
        (
            model_output,
            prompt_tokens,
            completion_tokens,
            llm_latency_ms,
            engine_meta,
        ) = call_nvidia_llm(
            messages=messages,
            model=prompt_config.model,
            temperature=prompt_config.temperature,
            max_tokens=prompt_config.max_tokens,
            timeout=90,
        )

    llm_end = time.time()
    cost_usd = calculate_cost(prompt_config.model, prompt_tokens, completion_tokens)
    spans.append(
        TraceSpan(
            span_id=str(uuid.uuid4()),
            name=f"llm_call:{prompt_config.model}",
            span_type="llm",
            start_time=llm_start,
            end_time=llm_end,
            duration_ms=llm_latency_ms,
            status="success" if engine_meta.get("engine") == "nvidia" else "degraded",
            input_data=messages,
            output_data=model_output,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            attributes={
                "model": prompt_config.model,
                "temperature": prompt_config.temperature,
                "engine": engine_meta.get("engine"),
                "fallback_reason": engine_meta.get("error"),
            },
        )
    )

    # 3. Graders
    scores: Dict[str, Any] = {}
    grader_flags: List[str] = []
    judge_reasoning: Optional[str] = None
    judge_engine: Optional[str] = None

    # 3a. LLM-as-a-Judge
    if grader_config.use_llm_judge:
        judge_start = time.time()
        judge_res = run_llm_judge(
            model_output=model_output,
            expected_output=test_case.expected_output,
            rubric=grader_config.llm_judge_rubric,
            judge_model=grader_config.judge_model,
            execution_mode=prompt_config.execution_mode,
        )
        judge_end = time.time()
        scores["llm_judge"] = judge_res["score"]
        judge_reasoning = judge_res["reasoning"]
        judge_engine = judge_res.get("engine")

        spans.append(
            TraceSpan(
                span_id=str(uuid.uuid4()),
                name="grader:llm_as_judge",
                span_type="grader",
                start_time=judge_start,
                end_time=judge_end,
                duration_ms=round((judge_end - judge_start) * 1000, 2),
                input_data={
                    "actual": model_output,
                    "expected": test_case.expected_output,
                    "rubric": grader_config.llm_judge_rubric,
                },
                output_data=judge_res,
                attributes={
                    "judge_score": judge_res["score"],
                    "passed": judge_res["passed"],
                    "engine": judge_engine,
                },
            )
        )

        if not judge_res["passed"]:
            grader_flags.append(
                f"LLM judge scored {judge_res['score']}/100, below the "
                f"{JUDGE_PASS_THRESHOLD} pass threshold"
            )

    # 3b. Semantic match
    if grader_config.use_semantic_match:
        sim_start = time.time()
        ratio = round(
            SequenceMatcher(
                None, model_output.lower(), test_case.expected_output.lower()
            ).ratio(),
            3,
        )
        sim_end = time.time()
        scores["semantic_similarity"] = ratio
        passed_sim = ratio >= grader_config.semantic_threshold

        spans.append(
            TraceSpan(
                span_id=str(uuid.uuid4()),
                name="grader:semantic_similarity",
                span_type="grader",
                start_time=sim_start,
                end_time=sim_end,
                duration_ms=round((sim_end - sim_start) * 1000, 2),
                input_data={"threshold": grader_config.semantic_threshold},
                output_data={"similarity": ratio, "passed": passed_sim},
            )
        )
        if not passed_sim:
            grader_flags.append(
                f"Semantic similarity {ratio} below threshold "
                f"{grader_config.semantic_threshold}"
            )

    # 3c. JSON validity
    if grader_config.use_json_validation:
        json_start = time.time()
        is_valid_json = False
        try:
            cleaned = model_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            json.loads(cleaned.strip())
            is_valid_json = True
        except Exception:
            is_valid_json = False
        json_end = time.time()
        scores["json_valid"] = is_valid_json
        spans.append(
            TraceSpan(
                span_id=str(uuid.uuid4()),
                name="grader:json_validator",
                span_type="grader",
                start_time=json_start,
                end_time=json_end,
                duration_ms=round((json_end - json_start) * 1000, 2),
                input_data={},
                output_data={"valid": is_valid_json},
            )
        )
        if not is_valid_json:
            grader_flags.append("Output is not parseable JSON")

    # 3d. Latency budget
    if llm_latency_ms > grader_config.max_latency_budget_ms:
        grader_flags.append(
            f"Latency {llm_latency_ms}ms exceeded the "
            f"{grader_config.max_latency_budget_ms}ms budget"
        )

    # 3e. Cost budget
    if cost_usd > grader_config.max_cost_budget_usd:
        grader_flags.append(
            f"Cost ${cost_usd:.5f} exceeded the "
            f"${grader_config.max_cost_budget_usd:.5f} budget"
        )

    total_tokens = prompt_tokens + completion_tokens
    passed = len(grader_flags) == 0

    return RunItemResult(
        item_id=item_id,
        test_case_id=test_case.id,
        test_case_name=test_case.name,
        inputs=test_case.inputs,
        expected_output=test_case.expected_output,
        formatted_prompt=formatted_prompt,
        model_output=model_output,
        latency_ms=llm_latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
        passed=passed,
        scores=scores,
        judge_reasoning=judge_reasoning,
        spans=spans,
        regression_flags=grader_flags,
        engine=engine_meta.get("engine", "unknown"),
        judge_engine=judge_engine,
        engine_note=engine_meta.get("error"),
    )


def execute_run(
    run_id: str,
    run_name: str,
    dataset: Dataset,
    prompt_config: PromptConfig,
    grader_config: GraderConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None,
) -> RunSummary:
    """
    Evaluates every case in the dataset. Cases run concurrently (bounded by
    EVAL_CONCURRENCY) because each one is an independent network-bound call,
    while results stay in dataset order.
    """
    cases = list(dataset.test_cases)
    total_cases = len(cases)
    results: List[Optional[RunItemResult]] = [None] * total_cases
    run_started = time.time()
    done = 0

    workers = max(1, min(EVAL_CONCURRENCY, total_cases or 1))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(evaluate_test_case, tc, prompt_config, grader_config): idx
            for idx, tc in enumerate(cases)
        }
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as exc:
                tc = cases[idx]
                results[idx] = _failed_item(tc, prompt_config, exc)
            done += 1
            if on_progress:
                try:
                    on_progress(done, total_cases, cases[idx].name)
                except Exception:
                    pass

    items: List[RunItemResult] = [r for r in results if r is not None]

    total_latency = sum(i.latency_ms for i in items)
    total_cost = sum(i.cost_usd for i in items)
    total_tokens = sum(i.total_tokens for i in items)
    latencies = [i.latency_ms for i in items]

    total_score = 0.0
    score_count = 0
    for i in items:
        if "llm_judge" in i.scores:
            total_score += float(i.scores["llm_judge"])
            score_count += 1
        elif "semantic_similarity" in i.scores:
            total_score += float(i.scores["semantic_similarity"]) * 100
            score_count += 1

    count = len(items)
    passed_cases = sum(1 for i in items if i.passed)

    return RunSummary(
        id=run_id,
        name=run_name,
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        status="completed",
        prompt_config=prompt_config,
        grader_config=grader_config,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        total_cases=count,
        passed_cases=passed_cases,
        pass_rate=round(passed_cases / count * 100.0, 1) if count else 0.0,
        avg_score=round(total_score / score_count, 1) if score_count else 0.0,
        avg_latency_ms=round(total_latency / count, 1) if count else 0.0,
        p95_latency_ms=_percentile(latencies, 0.95),
        total_tokens=total_tokens,
        total_cost_usd=round(total_cost, 6),
        duration_ms=round((time.time() - run_started) * 1000, 1),
        live_calls=sum(1 for i in items if i.engine == "nvidia"),
        fallback_calls=sum(1 for i in items if i.engine != "nvidia"),
        items=items,
    )


def _failed_item(
    test_case: TestCase, prompt_config: PromptConfig, exc: Exception
) -> RunItemResult:
    """A case that raised is recorded as a failure rather than killing the run."""
    return RunItemResult(
        item_id=str(uuid.uuid4()),
        test_case_id=test_case.id,
        test_case_name=test_case.name,
        inputs=test_case.inputs,
        expected_output=test_case.expected_output,
        formatted_prompt="",
        model_output="",
        latency_ms=0.0,
        prompt_tokens=0,
        completion_tokens=0,
        total_tokens=0,
        cost_usd=0.0,
        passed=False,
        scores={},
        judge_reasoning=None,
        spans=[],
        regression_flags=[f"Execution error: {type(exc).__name__}: {exc}"],
        engine="error",
        engine_note=str(exc),
    )


def compare_runs(baseline: RunSummary, candidate: RunSummary) -> RunComparison:
    """Compares two runs and flags quality, latency, and cost regressions."""
    # 1. Quality
    delta_score = round(candidate.avg_score - baseline.avg_score, 1)
    delta_pass = round(candidate.pass_rate - baseline.pass_rate, 1)

    is_quality_reg = delta_score < -5.0 or delta_pass < -10.0
    if delta_score < -15.0:
        q_severity = "critical"
        q_exp = (
            f"Critical quality drop: score degraded by {abs(delta_score)} pts "
            f"(pass rate {delta_pass:+}%)."
        )
    elif delta_score < -5.0:
        q_severity = "warning"
        q_exp = f"Moderate quality regression: score dropped by {abs(delta_score)} pts."
    elif delta_score > 3.0:
        q_severity = "improvement"
        q_exp = f"Quality improved by +{delta_score} pts (pass rate {delta_pass:+}%)."
    else:
        q_severity = "none"
        q_exp = "Quality is stable within tolerance."

    quality_metric = RegressionMetric(
        is_regression=is_quality_reg,
        severity=q_severity,
        baseline_val=baseline.avg_score,
        candidate_val=candidate.avg_score,
        delta_val=delta_score,
        delta_percent=round(delta_score / baseline.avg_score * 100, 1)
        if baseline.avg_score
        else 0.0,
        explanation=q_exp,
    )

    # 2. Latency
    delta_lat_ms = round(candidate.avg_latency_ms - baseline.avg_latency_ms, 1)
    lat_pct = (
        round(delta_lat_ms / baseline.avg_latency_ms * 100, 1)
        if baseline.avg_latency_ms
        else 0.0
    )

    is_lat_reg = delta_lat_ms > 300 or lat_pct > 25.0
    if lat_pct > 50.0:
        lat_severity = "critical"
        lat_exp = (
            f"Severe latency spike: +{delta_lat_ms}ms (+{lat_pct}% slower than baseline)."
        )
    elif is_lat_reg:
        lat_severity = "warning"
        lat_exp = f"Noticeable latency regression: +{delta_lat_ms}ms (+{lat_pct}%)."
    elif delta_lat_ms < -100:
        lat_severity = "improvement"
        lat_exp = (
            f"Latency improved: responses arrived {abs(delta_lat_ms)}ms faster "
            f"({abs(lat_pct)}% speed-up)."
        )
    else:
        lat_severity = "none"
        lat_exp = "Latency is within the acceptable range."

    latency_metric = RegressionMetric(
        is_regression=is_lat_reg,
        severity=lat_severity,
        baseline_val=baseline.avg_latency_ms,
        candidate_val=candidate.avg_latency_ms,
        delta_val=delta_lat_ms,
        delta_percent=lat_pct,
        explanation=lat_exp,
    )

    # 3. Cost — normalised per case so runs of different size stay comparable.
    base_cpc = (
        baseline.total_cost_usd / baseline.total_cases if baseline.total_cases else 0.0
    )
    cand_cpc = (
        candidate.total_cost_usd / candidate.total_cases
        if candidate.total_cases
        else 0.0
    )
    delta_cost = round(cand_cpc - base_cpc, 6)
    cost_pct = round(delta_cost / base_cpc * 100, 1) if base_cpc else 0.0

    is_cost_reg = cost_pct > 20.0
    if cost_pct > 50.0:
        cost_severity = "critical"
        cost_exp = (
            f"Cost surge: +{cost_pct}% per case (+${delta_cost:.5f} each)."
        )
    elif is_cost_reg:
        cost_severity = "warning"
        cost_exp = f"Cost regression: +{cost_pct}% higher token spend per case."
    elif cost_pct < -15.0:
        cost_severity = "improvement"
        cost_exp = f"Cost optimised: token spend per case fell {abs(cost_pct)}%."
    else:
        cost_severity = "none"
        cost_exp = "Cost variance is minimal."

    cost_metric = RegressionMetric(
        is_regression=is_cost_reg,
        severity=cost_severity,
        baseline_val=round(base_cpc, 6),
        candidate_val=round(cand_cpc, 6),
        delta_val=delta_cost,
        delta_percent=cost_pct,
        explanation=cost_exp,
    )

    if "critical" in (q_severity, lat_severity, cost_severity):
        overall_status = "FAILED"
    elif is_quality_reg or is_lat_reg or is_cost_reg:
        overall_status = "WARNING"
    else:
        overall_status = "PASSED"

    # Item-by-item diff
    base_item_map = {item.test_case_id: item for item in baseline.items}
    item_diffs: List[Dict[str, Any]] = []
    for cand_item in candidate.items:
        b_item = base_item_map.get(cand_item.test_case_id)
        b_score = b_item.scores.get("llm_judge", 0) if b_item else 0
        c_score = cand_item.scores.get("llm_judge", 0)

        diff_regressions: List[str] = []
        if b_item:
            if (c_score - b_score) < -10:
                diff_regressions.append(
                    f"Quality dropped {round(b_score - c_score, 1)} points"
                )
            if (cand_item.latency_ms - b_item.latency_ms) > 300:
                diff_regressions.append(
                    f"Latency slower by +{round(cand_item.latency_ms - b_item.latency_ms)}ms"
                )
            if (cand_item.cost_usd - b_item.cost_usd) > 0.0005:
                diff_regressions.append("Token cost regression")
            if b_item.passed and not cand_item.passed:
                diff_regressions.append("Newly failing case")

        item_diffs.append(
            {
                "test_case_id": cand_item.test_case_id,
                "test_case_name": cand_item.test_case_name,
                "inputs": cand_item.inputs,
                "expected_output": cand_item.expected_output,
                "baseline": {
                    "output": b_item.model_output,
                    "score": b_score,
                    "latency_ms": b_item.latency_ms,
                    "cost_usd": b_item.cost_usd,
                    "passed": b_item.passed,
                    "reasoning": b_item.judge_reasoning,
                }
                if b_item
                else None,
                "candidate": {
                    "output": cand_item.model_output,
                    "score": c_score,
                    "latency_ms": cand_item.latency_ms,
                    "cost_usd": cand_item.cost_usd,
                    "passed": cand_item.passed,
                    "reasoning": cand_item.judge_reasoning,
                },
                "regressions": diff_regressions,
                "has_regression": len(diff_regressions) > 0,
            }
        )

    return RunComparison(
        baseline_run_id=baseline.id,
        baseline_run_name=baseline.name,
        candidate_run_id=candidate.id,
        candidate_run_name=candidate.name,
        dataset_id=candidate.dataset_id,
        quality_regression=quality_metric,
        latency_regression=latency_metric,
        cost_regression=cost_metric,
        overall_status=overall_status,
        item_diffs=item_diffs,
    )
