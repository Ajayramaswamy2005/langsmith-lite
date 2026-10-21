"""In-process registry for long-running evaluation jobs.

A full evaluation can take a while (one network round-trip per test case, plus a
judge call each). Rather than holding an HTTP request open for the whole thing,
the API starts a job, returns its id immediately, and the client polls for
progress.
"""

import threading
import time
import uuid
from typing import Dict, List, Optional

from models import JobStatus

MAX_RETAINED_JOBS = 60


class JobRegistry:
    def __init__(self):
        self._lock = threading.RLock()
        self._jobs: Dict[str, JobStatus] = {}
        self._order: List[str] = []

    def create(self, run_name: str, dataset_id: str, dataset_name: str, total: int) -> JobStatus:
        job_id = f"job-{uuid.uuid4().hex[:10]}"
        job = JobStatus(
            job_id=job_id,
            status="queued",
            run_name=run_name,
            dataset_id=dataset_id,
            dataset_name=dataset_name,
            total=total,
            completed=0,
            progress=0.0,
            started_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        )
        with self._lock:
            self._jobs[job_id] = job
            self._order.append(job_id)
            while len(self._order) > MAX_RETAINED_JOBS:
                stale = self._order.pop(0)
                self._jobs.pop(stale, None)
        return job

    def update(self, job_id: str, **fields) -> Optional[JobStatus]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            for key, value in fields.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            if job.total:
                job.progress = round(job.completed / job.total * 100, 1)
            return job

    def get(self, job_id: str) -> Optional[JobStatus]:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> List[JobStatus]:
        with self._lock:
            return [self._jobs[j] for j in reversed(self._order) if j in self._jobs]


jobs = JobRegistry()
