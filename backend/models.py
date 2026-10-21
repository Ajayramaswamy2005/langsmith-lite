from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator

class TestCase(BaseModel):
    id: str
    name: str
    inputs: Dict[str, Any]
    expected_output: str
    tags: List[str] = []
    metadata: Dict[str, Any] = {}

class Dataset(BaseModel):
    id: str
    name: str
    description: str
    tags: List[str] = []
    created_at: str
    test_cases: List[TestCase] = []

class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    tags: List[str] = []

class DatasetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    tags: Optional[List[str]] = None

class DatasetImport(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    tags: List[str] = []
    test_cases: List[Dict[str, Any]] = []

class TestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inputs: Dict[str, Any]
    expected_output: str = ""
    tags: List[str] = []
    metadata: Dict[str, Any] = {}

class TestCaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    inputs: Optional[Dict[str, Any]] = None
    expected_output: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class PromptConfig(BaseModel):
    system_prompt: str = ""
    template: str = "{query}"
    model: str = "z-ai/glm-5.3"
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=256, ge=16, le=4096)
    execution_mode: str = "live"  # "live" (NVIDIA NIM) or "mock" (local simulator)

    @field_validator("execution_mode")
    @classmethod
    def _valid_mode(cls, v: str) -> str:
        if v not in ("live", "mock"):
            raise ValueError('execution_mode must be "live" or "mock"')
        return v

class GraderConfig(BaseModel):
    use_llm_judge: bool = True
    llm_judge_rubric: str = "Score 0-100 on accuracy, helpfulness, tone, and conciseness against expected output."
    judge_model: str = "z-ai/glm-5.3"
    use_semantic_match: bool = True
    # Character-level similarity between differently-phrased but correct answers
    # rarely clears 0.5, so the default threshold is a loose sanity check rather
    # than a strict gate.
    semantic_threshold: float = Field(default=0.40, ge=0.0, le=1.0)
    use_json_validation: bool = False
    # Reasoning models routinely take tens of seconds; a 2s budget failed every
    # live case regardless of quality.
    max_latency_budget_ms: int = Field(default=45000, ge=1)
    max_cost_budget_usd: float = Field(default=0.01, ge=0.0)

class TraceSpan(BaseModel):
    span_id: str
    parent_id: Optional[str] = None
    name: str
    span_type: str  # 'chain', 'llm', 'grader', 'tool'
    start_time: float
    end_time: float
    duration_ms: float
    status: str = "success"
    input_data: Any = None
    output_data: Any = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    attributes: Dict[str, Any] = {}

class RunItemResult(BaseModel):
    item_id: str
    test_case_id: str
    test_case_name: str
    inputs: Dict[str, Any]
    expected_output: str
    formatted_prompt: str
    model_output: str
    latency_ms: float
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    passed: bool
    scores: Dict[str, Any]  # {"llm_judge": 88, "semantic_similarity": 0.92, ...}
    judge_reasoning: Optional[str] = None
    spans: List[TraceSpan] = []
    regression_flags: List[str] = []
    # Which engine actually produced the completion / the grade.
    engine: str = "unknown"          # "nvidia" | "simulator"
    judge_engine: Optional[str] = None  # "llm-judge" | "heuristic"
    engine_note: Optional[str] = None   # why a live call fell back, if it did

class RunSummary(BaseModel):
    id: str
    name: str
    dataset_id: str
    dataset_name: str
    status: str  # "running", "completed", "failed"
    prompt_config: PromptConfig
    grader_config: GraderConfig
    created_at: str
    total_cases: int = 0
    passed_cases: int = 0
    pass_rate: float = 0.0
    avg_score: float = 0.0
    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    duration_ms: float = 0.0
    live_calls: int = 0
    fallback_calls: int = 0
    items: List[RunItemResult] = []

class RegressionMetric(BaseModel):
    is_regression: bool
    severity: str  # "none", "warning", "critical", "improvement"
    baseline_val: float
    candidate_val: float
    delta_val: float
    delta_percent: float
    explanation: str

class RunComparison(BaseModel):
    baseline_run_id: str
    baseline_run_name: str
    candidate_run_id: str
    candidate_run_name: str
    dataset_id: str
    quality_regression: RegressionMetric
    latency_regression: RegressionMetric
    cost_regression: RegressionMetric
    overall_status: str  # "PASSED", "WARNING", "FAILED"
    item_diffs: List[Dict[str, Any]] = []

class StartEvaluationRequest(BaseModel):
    dataset_id: str
    run_name: str = ""
    prompt_config: PromptConfig = PromptConfig()
    grader_config: GraderConfig = GraderConfig()

class SingleEvalRequest(BaseModel):
    name: str = "Playground Test"
    inputs: Dict[str, Any] = {}
    expected_output: str = ""
    prompt_config: PromptConfig = PromptConfig()
    grader_config: GraderConfig = GraderConfig()

class JobStatus(BaseModel):
    job_id: str
    status: str  # "queued" | "running" | "completed" | "failed"
    run_id: Optional[str] = None
    run_name: str = ""
    dataset_id: str = ""
    dataset_name: str = ""
    total: int = 0
    completed: int = 0
    progress: float = 0.0
    current_case: Optional[str] = None
    error: Optional[str] = None
    started_at: str = ""
    finished_at: Optional[str] = None
