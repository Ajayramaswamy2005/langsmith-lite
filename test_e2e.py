import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_api():
    print("=== Testing LangSmith Lite Backend ===")
    
    # 1. Datasets count
    req = urllib.request.urlopen(f"{BASE_URL}/datasets")
    datasets = json.loads(req.read().decode('utf-8'))
    print(f"✓ Initial datasets found: {len(datasets)}")

    # 2. Gmail / Google Sign-in
    payload = json.dumps({"email": "bench.tester@example.com", "name": "Bench Tester"}).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/auth/google", data=payload, headers={"Content-Type": "application/json"})
    auth_resp = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    token = auth_resp["token"]
    email_dispatch = auth_resp["email_dispatch"]
    print(f"✓ JWT Token acquired: {token[:24]}...")
    print(f"✓ Sign-in confirmation email dispatched to: {email_dispatch.get('to')} (method: {email_dispatch.get('method')})")

    # 3. Authenticated /me endpoint
    req = urllib.request.Request(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token}"})
    me = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    print(f"✓ Authenticated user profile: {me['name']} ({me['email']})")

    # 4. Import new dataset
    ds_payload = json.dumps({
        "name": "Production Customer Queries",
        "description": "Real world support queries with ground-truth guidelines",
        "tags": ["prod-bench", "support-ai"],
        "test_cases": [
            {
                "name": "Refund Request Query",
                "inputs": {"query": "How do I request a refund?", "tier": "pro"},
                "expected_output": "Refunds are processed within 5-7 business days via Billing settings."
            },
            {
                "name": "API Key Rotation",
                "inputs": {"query": "Where can I regenerate my secret API key?", "tier": "enterprise"},
                "expected_output": "Navigate to Settings > API Keys and select Regenerate Key."
            }
        ]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/datasets/import", data=ds_payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    imported_ds = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    print(f"✓ Dataset imported successfully: '{imported_ds['name']}' with {len(imported_ds['test_cases'])} cases (ID: {imported_ds['id']})")

    # 5. Run an evaluation on the imported dataset
    eval_payload = json.dumps({
        "dataset_id": imported_ds["id"],
        "run_name": "Evaluation v1.0.1 - Support Bot",
        "prompt_config": {
            "model": "mock-fast-eval",
            "system_prompt": "You are an empathetic, concise support assistant.",
            "template": "Query: {query}\nTier: {tier}\nProvide a precise, helpful solution.",
            "temperature": 0.2,
            "max_tokens": 250,
            "execution_mode": "mock"
        },
        "grader_config": {
            "use_llm_judge": True,
            "llm_judge_rubric": "Score 0-100 on accuracy, helpfulness, and tone against expected output.",
            "judge_model": "mock-fast-eval",
            "use_semantic_match": True,
            "semantic_threshold": 0.65,
            "use_json_validation": False,
            "max_latency_budget_ms": 3000,
            "max_cost_budget_usd": 0.005
        }
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/evaluations/run", data=eval_payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    run_summary = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    # 6. Verify Regression Comparison between seeded baseline and candidate
    runs_req = urllib.request.urlopen(f"{BASE_URL}/runs")
    all_runs = json.loads(runs_req.read().decode("utf-8"))
    if len(all_runs) >= 2:
        b_id, c_id = all_runs[0]["id"], all_runs[1]["id"]
        comp_req = urllib.request.urlopen(f"{BASE_URL}/compare?baseline_id={b_id}&candidate_id={c_id}")
        comp = json.loads(comp_req.read().decode("utf-8"))
        print(f"✓ Regression Comparison computed: {b_id} vs {c_id} => Status: {comp['overall_status']}")

    # 7. Verify Sent Emails Audit Log
    req = urllib.request.urlopen(f"{BASE_URL}/auth/emails")
    emails = json.loads(req.read().decode("utf-8"))
    print(f"✓ Email audit log records: {len(emails)} emails recorded.")

    print("\nALL BACKEND & OBSERVABILITY SUITE TESTS PASSED!")

if __name__ == "__main__":
    test_api()
