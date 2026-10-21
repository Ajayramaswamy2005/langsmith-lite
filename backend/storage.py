import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Dict, List, Optional

from models import Dataset, RunSummary
from config import DATA_DIR

DATASETS_FILE = DATA_DIR / "datasets.json"
RUNS_FILE = DATA_DIR / "runs.json"


def atomic_write_json(path: Path, payload) -> None:
    """Write JSON through a temp file + replace so a crash can't truncate the store."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


class Storage:
    def __init__(self):
        self._lock = threading.RLock()
        self.datasets: Dict[str, Dataset] = {}
        self.runs: Dict[str, RunSummary] = {}
        self.load_all()

    def load_all(self):
        if DATASETS_FILE.exists():
            try:
                with open(DATASETS_FILE, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                self.datasets = {k: Dataset(**v) for k, v in raw.items()}
            except Exception as e:
                print(f"Error loading datasets: {e}")
                self.datasets = {}

        if RUNS_FILE.exists():
            try:
                with open(RUNS_FILE, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                loaded = {}
                for k, v in raw.items():
                    try:
                        loaded[k] = RunSummary(**v)
                    except Exception as e:
                        print(f"Skipping unreadable run {k}: {e}")
                self.runs = loaded
            except Exception as e:
                print(f"Error loading runs: {e}")
                self.runs = {}

    def save_datasets(self):
        with self._lock:
            atomic_write_json(
                DATASETS_FILE, {k: v.model_dump() for k, v in self.datasets.items()}
            )

    def save_runs(self):
        with self._lock:
            atomic_write_json(
                RUNS_FILE, {k: v.model_dump() for k, v in self.runs.items()}
            )

    # ---------- datasets ----------

    def get_datasets(self) -> List[Dataset]:
        with self._lock:
            return sorted(
                self.datasets.values(), key=lambda d: d.created_at, reverse=True
            )

    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        with self._lock:
            return self.datasets.get(dataset_id)

    def save_dataset(self, dataset: Dataset):
        with self._lock:
            self.datasets[dataset.id] = dataset
            self.save_datasets()

    def delete_dataset(self, dataset_id: str) -> bool:
        with self._lock:
            if dataset_id not in self.datasets:
                return False
            del self.datasets[dataset_id]
            self.save_datasets()
            return True

    # ---------- runs ----------

    def get_runs(self, dataset_id: Optional[str] = None) -> List[RunSummary]:
        with self._lock:
            runs = list(self.runs.values())
        if dataset_id:
            runs = [r for r in runs if r.dataset_id == dataset_id]
        runs.sort(key=lambda r: r.created_at, reverse=True)
        return runs

    def get_run(self, run_id: str) -> Optional[RunSummary]:
        with self._lock:
            return self.runs.get(run_id)

    def save_run(self, run: RunSummary):
        with self._lock:
            self.runs[run.id] = run
            self.save_runs()

    def delete_run(self, run_id: str) -> bool:
        with self._lock:
            if run_id not in self.runs:
                return False
            del self.runs[run_id]
            self.save_runs()
            return True


storage = Storage()
