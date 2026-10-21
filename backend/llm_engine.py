import json
import re
import time
from difflib import SequenceMatcher
from typing import Any, Dict, Tuple

import requests

from config import (
    LIVE_MODE_AVAILABLE,
    MODEL_COSTS,
    NVIDIA_API_KEY,
    NVIDIA_BASE_URL,
)

JUDGE_SYSTEM_PROMPT = (
    "You are an expert AI evaluator and LLM-as-a-judge. "
    "Evaluate the actual MODEL OUTPUT against the EXPECTED OUTPUT according to the provided RUBRIC. "
    "You MUST respond ONLY with a valid JSON object with the format: "
    '{"score": <integer 0-100>, "reasoning": "<concise explanation>", "passed": <true/false>}'
)


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    rates = MODEL_COSTS.get(model, MODEL_COSTS["z-ai/glm-5.3"])
    prompt_cost = (prompt_tokens / 1_000_000.0) * rates["prompt"]
    completion_cost = (completion_tokens / 1_000_000.0) * rates["completion"]
    return round(prompt_cost + completion_cost, 6)


# GLM-5.3 is a reasoning model: it spends completion tokens on a private
# chain of thought before writing any answer, and those tokens come out of the
# same max_tokens budget. With a small budget the whole allowance is consumed by
# reasoning, the response arrives with finish_reason "length" and
# message.content set to null, and nothing usable comes back. These models get
# an explicit reasoning headroom on top of the caller's answer budget, and
# thinking is switched off where the template supports it.
REASONING_MODEL_PREFIXES = ("z-ai/",)
REASONING_HEADROOM_TOKENS = 512


def _is_reasoning_model(model: str) -> bool:
    return model.startswith(REASONING_MODEL_PREFIXES)


def call_nvidia_llm(
    messages: list,
    model: str = "z-ai/glm-5.3",
    temperature: float = 0.2,
    max_tokens: int = 256,
    timeout: int = 90,
) -> Tuple[str, int, int, float, Dict[str, Any]]:
    """
    Calls the NVIDIA NIM chat-completions endpoint.

    Returns (output_text, prompt_tokens, completion_tokens, latency_ms, meta).
    meta["engine"] is "nvidia" for a real completion or "simulator" when the
    request could not be made, so the UI never presents simulated text as live
    inference. meta["error"] carries the reason for any fallback.
    """
    start_time = time.time()

    def _simulated(reason: str) -> Tuple[str, int, int, float, Dict[str, Any]]:
        text = simulate_llm_response(messages, model)
        latency = round((time.time() - start_time) * 1000.0, 1)
        return (
            text,
            len(str(messages)) // 4 + 12,
            len(text) // 4 + 8,
            latency,
            {"engine": "simulator", "model": model, "error": reason},
        )

    if not LIVE_MODE_AVAILABLE:
        return _simulated("NVIDIA_API_KEY is not configured")

    url = f"{NVIDIA_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if _is_reasoning_model(model):
        payload["max_tokens"] = max_tokens + REASONING_HEADROOM_TOKENS
        payload["chat_template_kwargs"] = {"thinking": False}

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        latency_ms = round((time.time() - start_time) * 1000.0, 1)

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        finish_reason = choice.get("finish_reason")
        content = (message.get("content") or "").strip()
        note = None

        if not content:
            # A reasoning model that ran out of budget mid-thought leaves the
            # answer empty. Surface the chain of thought rather than nothing,
            # and say why the answer is missing.
            reasoning = (message.get("reasoning_content") or "").strip()
            if reasoning:
                content = reasoning
                note = (
                    "model exhausted its token budget while reasoning "
                    "(showing reasoning trace; raise max tokens for a final answer)"
                )
            elif finish_reason == "length":
                return _simulated(
                    "model hit the token limit before producing an answer"
                )
            else:
                return _simulated("provider returned an empty completion")

        usage = data.get("usage") or {}
        prompt_tokens = usage.get("prompt_tokens") or len(str(messages)) // 4
        completion_tokens = usage.get("completion_tokens") or len(content) // 4
        reasoning_tokens = (usage.get("completion_tokens_details") or {}).get(
            "reasoning_tokens"
        ) or 0

        return (
            content,
            int(prompt_tokens),
            int(completion_tokens),
            latency_ms,
            {
                "engine": "nvidia",
                "model": data.get("model", model),
                "finish_reason": finish_reason,
                "reasoning_tokens": int(reasoning_tokens),
                "error": note,
            },
        )
    except requests.Timeout:
        return _simulated(f"provider timed out after {timeout}s")
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        return _simulated(f"provider returned HTTP {status}")
    except Exception as exc:
        return _simulated(f"{type(exc).__name__}: {exc}")


def simulate_llm_response(messages: list, model: str) -> str:
    """Deterministic local stand-in so the platform stays usable offline."""
    user_prompt = ""
    system_prompt = ""
    for m in messages:
        if m.get("role") == "user":
            user_prompt = m.get("content", "")
        elif m.get("role") == "system":
            system_prompt = m.get("content", "")

    if "expert AI evaluator" in system_prompt or "LLM-as-a-judge" in system_prompt:
        return (
            '{\n  "score": 92,\n  "reasoning": "The response accurately covers the key '
            "requirements, maintains a polite and concise tone, and aligns well with the "
            'expected ground truth without extraneous hallucinated details.",\n  "passed": true\n}'
        )

    lower = user_prompt.lower()
    if "refund" in lower or "return" in lower:
        if "30" in lower or "policy" in lower:
            return (
                "Our refund policy allows full returns within 30 days of purchase in original "
                "condition. To start your return, please submit your order number in our portal."
            )
        return (
            "I would be happy to help check the status of your refund. Please provide your "
            "order ID so I can verify eligibility."
        )
    if "sql" in lower or "select" in lower:
        return (
            "SELECT c.id, c.name, COUNT(o.id) AS total_orders\n"
            "FROM customers c\n"
            "JOIN orders o ON c.id = o.customer_id\n"
            "GROUP BY c.id, c.name\n"
            "HAVING COUNT(o.id) > 5;"
        )
    if "json" in lower:
        return (
            '{\n  "status": "success",\n  "message": "Processed successfully",\n'
            '  "timestamp": "2026-10-02T22:30:00Z"\n}'
        )
    if "python" in lower or "deduplicate" in lower:
        return (
            "def deduplicate_preserve_order(seq):\n"
            "    seen = set()\n"
            "    return [x for x in seq if not (x in seen or seen.add(x))]"
        )
    if "dose" in lower or "medication" in lower or "doctor" in lower:
        return (
            "Disclaimer: I am an AI, not a doctor. Please consult a licensed healthcare "
            "professional. Never change your medication dosage without direct guidance from "
            "your prescribing physician."
        )
    return (
        f"Processed query with {model}: The requested task has been analyzed according to "
        "system instructions. All key conditions are met."
    )


def run_llm_judge(
    model_output: str,
    expected_output: str,
    rubric: str,
    judge_model: str = "z-ai/glm-5.3",
    execution_mode: str = "live",
) -> Dict[str, Any]:
    """LLM-as-a-Judge: scores quality 0-100 and returns its rationale."""
    user_prompt = (
        "EXPECTED OUTPUT:\n"
        f"{expected_output}\n\n"
        "ACTUAL MODEL OUTPUT:\n"
        f"{model_output}\n\n"
        "EVALUATION RUBRIC:\n"
        f"{rubric}\n\n"
        "Return strict JSON only."
    )
    messages = [
        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    if execution_mode == "mock" or not LIVE_MODE_AVAILABLE:
        result = compute_simulated_judge(model_output, expected_output, rubric)
        result["engine"] = "heuristic"
        return result

    raw_output, _, _, _, meta = call_nvidia_llm(
        messages=messages,
        model=judge_model,
        temperature=0.0,
        max_tokens=256,
        timeout=90,
    )

    if meta.get("engine") == "nvidia":
        try:
            json_match = re.search(r"\{.*\}", raw_output, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                score = int(round(float(parsed.get("score", 0))))
                score = max(0, min(100, score))
                return {
                    "score": score,
                    "reasoning": str(
                        parsed.get("reasoning", "Evaluated against ground truth criteria.")
                    ),
                    "passed": bool(parsed.get("passed", score >= 70)),
                    "engine": "llm-judge",
                }
        except Exception as exc:
            meta["error"] = f"judge returned unparseable JSON ({type(exc).__name__})"

    result = compute_simulated_judge(model_output, expected_output, rubric)
    result["engine"] = "heuristic"
    result["fallback_reason"] = meta.get("error")
    return result


def compute_simulated_judge(
    model_output: str, expected_output: str, rubric: str
) -> Dict[str, Any]:
    ratio = SequenceMatcher(None, model_output.lower(), expected_output.lower()).ratio()

    base_score = int(ratio * 70) + 25
    base_score = min(98, max(45, base_score))

    expected_words = set(re.findall(r"\b\w+\b", expected_output.lower()))
    model_words = set(re.findall(r"\b\w+\b", model_output.lower()))
    if expected_words:
        overlap = len(expected_words & model_words) / len(expected_words)
        base_score = int(base_score * 0.4 + (overlap * 100) * 0.6)

    base_score = min(100, max(20, base_score))
    passed = base_score >= 70

    if base_score >= 85:
        reasoning = (
            f"High quality output ({base_score}/100): matches the key semantic criteria, "
            "avoids hallucination, and adheres closely to the expected instructions."
        )
    elif base_score >= 70:
        reasoning = (
            f"Acceptable output ({base_score}/100): satisfies the core requirements with "
            "minor stylistic differences from the reference output."
        )
    else:
        reasoning = (
            f"Quality failure ({base_score}/100): missing key factual points or deviating "
            "in tone/formatting from the expected output."
        )

    return {"score": base_score, "reasoning": reasoning, "passed": passed}
