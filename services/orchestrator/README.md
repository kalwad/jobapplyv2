# services/orchestrator

Local orchestrator: canonical data, migrations, encryption, document
processing, matching, AI pipelines, validation, tracker events, and
application plans, exposed over versioned loopback APIs
(docs/MASTER_IMPLEMENTATION_SPEC.md §5.3).

Created as an empty Python 3.12 workspace member in M00-W02. The FastAPI
service skeleton arrives in M03-W02; nothing here implements service
behavior yet.

Checks (from the repository root):

```bash
uv sync
uv run pytest
uv run ruff check services
uv run ruff format --check services
uv run mypy services
```
