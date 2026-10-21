import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

ENV_FILE = BASE_DIR / ".env"


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so secrets live outside source control."""
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception as exc:  # pragma: no cover
        print(f"[config] Could not read .env: {exc}")


_load_dotenv(ENV_FILE)

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "z-ai/glm-5.3")
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "z-ai/glm-5.3-flash")

# Highest number of test cases evaluated concurrently inside one run.
EVAL_CONCURRENCY = max(1, int(os.getenv("EVAL_CONCURRENCY", "6")))

# Browser origins allowed to call this API. "*" is rejected by browsers when
# credentials are enabled, so the allowed origins are listed explicitly.
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

LIVE_MODE_AVAILABLE = bool(NVIDIA_API_KEY)

# Pricing estimations ($ per 1M tokens) for observability & cost tracking
MODEL_COSTS = {
    "z-ai/glm-5.3": {"prompt": 0.50, "completion": 1.50},
    "z-ai/glm-5.3-flash": {"prompt": 0.15, "completion": 0.30},
    "mock-fast-eval": {"prompt": 0.05, "completion": 0.10},
}

if not LIVE_MODE_AVAILABLE:
    print(
        "[config] NVIDIA_API_KEY is not set — live evaluation will fall back to the "
        "local simulator. Add it to backend/.env to enable live inference."
    )
