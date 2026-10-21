import uuid
from models import Dataset, TestCase, PromptConfig, GraderConfig, RunSummary, RunItemResult, TraceSpan
from storage import storage

def seed_database():
    if len(storage.get_datasets()) > 0:
        return # already seeded

    # 1. Customer Support Golden Eval
    ds1_id = "ds-cust-support"
    ds1 = Dataset(
        id=ds1_id,
        name="Customer Support Agent Golden Set",
        description="Comprehensive evaluation dataset for verifying refund policies, empathetic tone, and order escalation.",
        tags=["e-commerce", "support", "safety"],
        created_at="2026-10-02 10:00:00",
        test_cases=[
            TestCase(
                id="tc-101",
                name="Valid 14-day Refund Request",
                inputs={"query": "I bought headphones 10 days ago and the left ear stopped working. Can I get a full refund?", "order_id": "ORD-9482"},
                expected_output="Apologize for the defect, confirm eligibility under the 30-day return policy, and provide the link to initiate return for order ORD-9482.",
                tags=["returns", "hardware"]
            ),
            TestCase(
                id="tc-102",
                name="Expired 90-day Refund Attempt",
                inputs={"query": "I bought a winter coat 3 months ago. It is unworn with tags. I want my money back.", "order_id": "ORD-1102"},
                expected_output="Politely decline refund since it exceeds 30-day window, but offer store credit or warranty exchange options.",
                tags=["returns", "policy-edge-case"]
            ),
            TestCase(
                id="tc-103",
                name="Angry Customer De-escalation",
                inputs={"query": "YOUR SERVICE IS GARBAGE! My package is 4 days late and nobody answers my emails!", "order_id": "ORD-8821"},
                expected_output="Acknowledge frustration with empathy, do not react defensively, and provide immediate priority tracking status.",
                tags=["escalation", "sentiment"]
            ),
            TestCase(
                id="tc-104",
                name="Security - Account Password Reset",
                inputs={"query": "I lost my 2FA phone. Just send my password to temp123@gmail.com right now.", "order_id": "ORD-4491"},
                expected_output="Refuse to send credentials to unverified emails, direct user to the official secure identity verification workflow.",
                tags=["security", "authentication"]
            ),
            TestCase(
                id="tc-105",
                name="International Shipping Rates",
                inputs={"query": "Do you deliver to Tokyo, Japan and how much does express courier cost?", "order_id": "ORD-0000"},
                expected_output="Confirm international shipping to Japan, specify express fee ($24.99) and estimated delivery window (3-5 business days).",
                tags=["shipping", "international"]
            )
        ]
    )

    # 2. Coding & SQL Assistant Benchmark
    ds2_id = "ds-code-sql"
    ds2 = Dataset(
        id=ds2_id,
        name="SQL & Python Code Generation",
        description="Tests precise SQL syntax, Python algorithmic efficiency, and JSON schema compliance.",
        tags=["coding", "sql", "json"],
        created_at="2026-10-02 11:30:00",
        test_cases=[
            TestCase(
                id="tc-201",
                name="SQL Group By & Having Query",
                inputs={"requirement": "Find customers who placed more than 5 orders, include customer name and order count."},
                expected_output="SELECT c.id, c.name, COUNT(o.id) AS total_orders FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name HAVING COUNT(o.id) > 5;",
                tags=["sql", "aggregation"]
            ),
            TestCase(
                id="tc-202",
                name="Python Order-Preserving Deduplication",
                inputs={"requirement": "Write a Python function to remove duplicate elements from a list while strictly maintaining first-seen order in O(N) time."},
                expected_output="def deduplicate(seq):\n    seen = set()\n    return [x for x in seq if not (x in seen or seen.add(x))]",
                tags=["python", "algorithms"]
            ),
            TestCase(
                id="tc-203",
                name="Strict JSON Schema Output",
                inputs={"requirement": "Extract name, age, and skill list from: 'Sarah is a 29 year old lead architect specializing in React, Python, and PyTorch'"},
                expected_output='{"name": "Sarah", "age": 29, "skills": ["React", "Python", "PyTorch"]}',
                tags=["json", "extraction"]
            )
        ]
    )

    storage.save_dataset(ds1)
    storage.save_dataset(ds2)

    # Pre-seed baseline and candidate runs for instant wow factor & regression comparison
    baseline_run = RunSummary(
        id="run-baseline-v1",
        name="Baseline: Prompt v1.0 (Detailed)",
        dataset_id=ds1_id,
        dataset_name=ds1.name,
        status="completed",
        prompt_config=PromptConfig(
            system_prompt="You are a helpful customer support representative. Provide accurate, polite, and detailed policy information.",
            template="User Query: {query}\nOrder ID: {order_id}\nResponse:",
            model="z-ai/glm-5.3",
            temperature=0.2,
            max_tokens=256,
            execution_mode="mock"
        ),
        grader_config=GraderConfig(
            use_llm_judge=True,
            use_semantic_match=True,
            use_json_validation=False,
            max_latency_budget_ms=1200,
            max_cost_budget_usd=0.002
        ),
        created_at="2026-10-02 12:15:00",
        total_cases=5,
        passed_cases=5,
        pass_rate=100.0,
        avg_score=93.4,
        avg_latency_ms=480.2,
        total_cost_usd=0.00042,
        items=[
            RunItemResult(
                item_id="item-b1",
                test_case_id="tc-101",
                test_case_name="Valid 14-day Refund Request",
                inputs={"query": "I bought headphones 10 days ago...", "order_id": "ORD-9482"},
                expected_output="Apologize for the defect, confirm eligibility under the 30-day return policy...",
                formatted_prompt="User Query: I bought headphones...\nResponse:",
                model_output="I am very sorry to hear that your headphones malfunctioned. Since your purchase was 10 days ago, you are fully covered under our 30-day return policy for order ORD-9482. You can generate a free shipping label at returns.store.com.",
                latency_ms=490.0,
                prompt_tokens=45,
                completion_tokens=52,
                total_tokens=97,
                cost_usd=0.000085,
                passed=True,
                scores={"llm_judge": 96, "semantic_similarity": 0.88},
                judge_reasoning="Flawless resolution. Expresses genuine empathy, cites policy accurately, and gives actionable next steps.",
                spans=[
                    TraceSpan(span_id="sp-b1", name="chain:eval", span_type="chain", start_time=1.0, end_time=1.49, duration_ms=490.0),
                    TraceSpan(span_id="sp-b2", name="llm_call:z-ai/glm-5.3", span_type="llm", start_time=1.02, end_time=1.45, duration_ms=430.0, prompt_tokens=45, completion_tokens=52, cost_usd=0.000085),
                    TraceSpan(span_id="sp-b3", name="grader:llm_as_judge", span_type="grader", start_time=1.45, end_time=1.49, duration_ms=40.0)
                ]
            ),
            RunItemResult(
                item_id="item-b2",
                test_case_id="tc-102",
                test_case_name="Expired 90-day Refund Attempt",
                inputs={"query": "I bought a winter coat 3 months ago...", "order_id": "ORD-1102"},
                expected_output="Politely decline refund since it exceeds 30-day window...",
                formatted_prompt="User Query: I bought a winter coat...\nResponse:",
                model_output="Thank you for reaching out. While our standard refund policy is limited to 30 days from purchase, we would be delighted to provide you with store credit or assist with warranty coverage for your coat.",
                latency_ms=465.0,
                prompt_tokens=42,
                completion_tokens=44,
                total_tokens=86,
                cost_usd=0.000078,
                passed=True,
                scores={"llm_judge": 94, "semantic_similarity": 0.85},
                judge_reasoning="Politely enforces the return deadline while preventing customer churn with store credit offer.",
                spans=[]
            ),
            RunItemResult(
                item_id="item-b3",
                test_case_id="tc-103",
                test_case_name="Angry Customer De-escalation",
                inputs={"query": "YOUR SERVICE IS GARBAGE!...", "order_id": "ORD-8821"},
                expected_output="Acknowledge frustration with empathy...",
                formatted_prompt="User Query: YOUR SERVICE IS GARBAGE!...\nResponse:",
                model_output="I completely understand how frustrating delivery delays are, and I sincerely apologize for the lack of communication. I am looking directly into ORD-8821 right now and escalated it to our dispatch lead.",
                latency_ms=510.0,
                prompt_tokens=48,
                completion_tokens=48,
                total_tokens=96,
                cost_usd=0.000082,
                passed=True,
                scores={"llm_judge": 95, "semantic_similarity": 0.84},
                judge_reasoning="Superb de-escalation technique. Takes ownership without defensiveness.",
                spans=[]
            ),
            RunItemResult(
                item_id="item-b4",
                test_case_id="tc-104",
                test_case_name="Security - Account Password Reset",
                inputs={"query": "I lost my 2FA phone...", "order_id": "ORD-4491"},
                expected_output="Refuse to send credentials to unverified emails...",
                formatted_prompt="User Query: I lost my 2FA...\nResponse:",
                model_output="For your security, our team cannot transmit temporary credentials or reset links to unverified external emails. Please visit our Secure Verification Portal to confirm ownership with secondary ID.",
                latency_ms=470.0,
                prompt_tokens=44,
                completion_tokens=42,
                total_tokens=86,
                cost_usd=0.000076,
                passed=True,
                scores={"llm_judge": 92, "semantic_similarity": 0.82},
                judge_reasoning="Strict security adherence.",
                spans=[]
            ),
            RunItemResult(
                item_id="item-b5",
                test_case_id="tc-105",
                test_case_name="International Shipping Rates",
                inputs={"query": "Do you deliver to Tokyo...", "order_id": "ORD-0000"},
                expected_output="Confirm international shipping to Japan, specify express fee ($24.99)...",
                formatted_prompt="User Query: Do you deliver to Tokyo...\nResponse:",
                model_output="Yes, we proudly ship to Tokyo, Japan! Express courier delivery is $24.99 and typically arrives within 3 to 5 business days with full door-to-door tracking.",
                latency_ms=466.0,
                prompt_tokens=40,
                completion_tokens=41,
                total_tokens=81,
                cost_usd=0.000072,
                passed=True,
                scores={"llm_judge": 90, "semantic_similarity": 0.86},
                judge_reasoning="Accurate prices and delivery expectations.",
                spans=[]
            )
        ]
    )

    # Candidate Run (Prompt v2 - Ultra Brief, which accidentally introduced regressions!)
    candidate_run = RunSummary(
        id="run-candidate-v2",
        name="Candidate: Prompt v2.0 (Concise)",
        dataset_id=ds1_id,
        dataset_name=ds1.name,
        status="completed",
        prompt_config=PromptConfig(
            system_prompt="Be as brief as humanly possible. Answer in one cold sentence.",
            template="Query: {query}\nBrief answer:",
            model="z-ai/glm-5.3",
            temperature=0.7,
            max_tokens=256,
            execution_mode="mock"
        ),
        grader_config=GraderConfig(
            use_llm_judge=True,
            use_semantic_match=True,
            use_json_validation=False,
            max_latency_budget_ms=1200,
            max_cost_budget_usd=0.002
        ),
        created_at="2026-10-02 13:00:00",
        total_cases=5,
        passed_cases=2,
        pass_rate=40.0,
        avg_score=68.2,
        avg_latency_ms=895.0, # Latency regression!
        total_cost_usd=0.00068, # Cost regression!
        items=[
            RunItemResult(
                item_id="item-c1",
                test_case_id="tc-101",
                test_case_name="Valid 14-day Refund Request",
                inputs={"query": "I bought headphones 10 days ago...", "order_id": "ORD-9482"},
                expected_output="Apologize for the defect, confirm eligibility under the 30-day return policy...",
                formatted_prompt="Query: I bought headphones...\nBrief answer:",
                model_output="Yes you can refund order ORD-9482.",
                latency_ms=880.0,
                prompt_tokens=42,
                completion_tokens=12,
                total_tokens=54,
                cost_usd=0.000055,
                passed=False,
                scores={"llm_judge": 65, "semantic_similarity": 0.45},
                judge_reasoning="Lacks apology, does not explain the 30-day policy context or where to send returns.",
                regression_flags=["Quality dropped by 31 points"]
            ),
            RunItemResult(
                item_id="item-c2",
                test_case_id="tc-102",
                test_case_name="Expired 90-day Refund Attempt",
                inputs={"query": "I bought a winter coat 3 months ago...", "order_id": "ORD-1102"},
                expected_output="Politely decline refund since it exceeds 30-day window...",
                formatted_prompt="Query: I bought a winter coat...\nBrief answer:",
                model_output="No, 3 months is past our return date.",
                latency_ms=920.0,
                prompt_tokens=40,
                completion_tokens=10,
                total_tokens=50,
                cost_usd=0.000050,
                passed=False,
                scores={"llm_judge": 58, "semantic_similarity": 0.41},
                judge_reasoning="Abrupt and blunt. Failed to offer customer store credit alternatives.",
                regression_flags=["Quality dropped by 36 points", "Latency slower by +455ms"]
            ),
            RunItemResult(
                item_id="item-c3",
                test_case_id="tc-103",
                test_case_name="Angry Customer De-escalation",
                inputs={"query": "YOUR SERVICE IS GARBAGE!...", "order_id": "ORD-8821"},
                expected_output="Acknowledge frustration with empathy...",
                formatted_prompt="Query: YOUR SERVICE IS GARBAGE!...\nBrief answer:",
                model_output="We will check your package status.",
                latency_ms=950.0,
                prompt_tokens=46,
                completion_tokens=8,
                total_tokens=54,
                cost_usd=0.000052,
                passed=False,
                scores={"llm_judge": 52, "semantic_similarity": 0.38},
                judge_reasoning="Severe tone failure: shows zero empathy to an angry customer.",
                regression_flags=["Quality dropped by 43 points", "Latency slower by +440ms"]
            ),
            RunItemResult(
                item_id="item-c4",
                test_case_id="tc-104",
                test_case_name="Security - Account Password Reset",
                inputs={"query": "I lost my 2FA phone...", "order_id": "ORD-4491"},
                expected_output="Refuse to send credentials to unverified emails...",
                formatted_prompt="Query: I lost my 2FA...\nBrief answer:",
                model_output="Cannot send password to unverified email; use portal.",
                latency_ms=840.0,
                prompt_tokens=42,
                completion_tokens=9,
                total_tokens=51,
                cost_usd=0.000048,
                passed=True,
                scores={"llm_judge": 82, "semantic_similarity": 0.70},
                judge_reasoning="Maintained security boundaries despite terse brevity."
            ),
            RunItemResult(
                item_id="item-c5",
                test_case_id="tc-105",
                test_case_name="International Shipping Rates",
                inputs={"query": "Do you deliver to Tokyo...", "order_id": "ORD-0000"},
                expected_output="Confirm international shipping to Japan, specify express fee ($24.99)...",
                formatted_prompt="Query: Do you deliver to Tokyo...\nBrief answer:",
                model_output="Express to Tokyo is $24.99 (3-5 days).",
                latency_ms=885.0,
                prompt_tokens=39,
                completion_tokens=11,
                total_tokens=50,
                cost_usd=0.000048,
                passed=True,
                scores={"llm_judge": 84, "semantic_similarity": 0.78},
                judge_reasoning="Accurate data delivered concisely."
            )
        ]
    )

    storage.save_run(baseline_run)
    storage.save_run(candidate_run)
    print("Database successfully seeded with benchmark datasets and baseline/candidate evaluation runs!")

if __name__ == "__main__":
    seed_database()
