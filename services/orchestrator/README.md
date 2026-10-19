# services/orchestrator

Local orchestrator: canonical data, migrations, encryption, document
processing, matching, AI pipelines, validation, tracker events, and
application plans, exposed over versioned loopback APIs
(docs/MASTER_IMPLEMENTATION_SPEC.md §5.3).

M03-W02 supplies the authenticated FastAPI skeleton. Its health and readiness
report only `SERVICE_SKELETON` lifecycle, without claiming database, AI,
platform-adapter or complete product readiness. Desktop process ownership,
restart policy and packaged native integration follow in M03-W03 onward.

`create_app(configuration)` takes an explicit strict configuration. Every HTTP
route, including unknown routes and unsupported methods, requires
`Authorization: Bearer <session_token>`. The only routes are
`GET /api/v1/health`, `GET /api/v1/ready` and `GET /api/v1/version`.
Successful payloads and errors use generated canonical models inside the common
versioned envelope, with `X-Japp-Schema-Id`, `X-Japp-Schema-Version`,
`X-Correlation-Id` and `Cache-Control: no-store` headers. Errors carry only the
canonical error code and occurrence/trace metadata. Request values and exception
text never become user-facing messages. OpenAPI/docs routes are disabled.

The HTTP boundary rejects browser `Origin`, forwarded/proxy headers, duplicate
authorization/correlation/Host headers, and any Host other than the actual
numeric loopback authority. FastAPI tracing, metrics, logs, operation spans and
environment auto-configuration are explicitly disabled.

The callable CLI is `python -m orchestrator`; it accepts no arguments and reads no
credential from the environment. An owning parent must send a private stdin
frame: a four-byte unsigned big-endian payload length followed by UTF-8 JSON,
at most 4096 bytes, within five seconds. Duplicate, unknown and missing fields
are rejected. The exact object is:

```json
{
  "protocol": "JAPP_SERVICE_BOOTSTRAP_V1",
  "schema_version": "1.0.0",
  "bind_host": "127.0.0.1",
  "bind_port": 49152,
  "session_token": "<64 lowercase hexadecimal characters from 32 OS-random bytes>",
  "instance_id": "svc_<26 Crockford characters>",
  "generation": 0
}
```

The token and instance ID are supplied by the owning parent. Generation is an
integer from 0 through 2147483647; ports are integers from 0 through 65535, with
zero reserved for owned development tests. The listener binds exclusively to
IPv4 `127.0.0.1`. The service never searches for or terminates another process by
port.

Stdout is a private framed control channel. After owning the socket and completing
Uvicorn/lifespan startup, the child sends exactly one frame in the same length
format with seven fields: `protocol: JAPP_SERVICE_STATUS_V1`,
`schema_version: 1.0.0`, `status: READY`, `bind_host: 127.0.0.1`, the actual
`bind_port`, and the same `instance_id`/`generation`. It contains no credential.
An owning parent must validate this pipe ACK before sending bearer HTTP traffic.
There is no ACK for bind or startup failure. Uvicorn diagnostic/access logging is
disabled to keep the pipe framed and prevent arbitrary exception/request output.

Keep stdin open for the lifetime of the child. EOF withdraws readiness and causes
graceful shutdown; any additional input withdraws the service as invalid
configuration. Exit codes are `0` for normal shutdown, `64` for invalid or timed
out bootstrap/configuration, `72` for an occupied bind port and `70` for other
startup/runtime failure. Only the later parent supervisor owns startup deadlines,
retries and forced escalation/reaping.

Checks (from the repository root):

```bash
uv sync --locked
uv run --locked pytest services/orchestrator/tests
uv run --locked ruff check services/orchestrator
uv run --locked ruff format --check services/orchestrator
uv run --locked mypy services/orchestrator
```
