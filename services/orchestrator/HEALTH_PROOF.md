# Connection-bound health proof v1

The optional `JAPP-HMAC-SHA256-V1` mode authenticates only an empty
`GET /api/v1/health`, with no query or content/transfer encoding. It keeps every
health request authenticated and preserves existing bearer behavior. A native
client uses this proof before releasing its raw bearer on the same HTTP/1 stream.
It never falls back to bearer after failed or unsupported proof negotiation.

Bootstrap's 64 lowercase hexadecimal token characters decode to the 32-byte
HMAC-SHA256 key. The nonce is 32 fresh OS-random bytes encoded as 64 lowercase
hexadecimal characters. The native client derives the actual client/server IPv4
addresses and ports from its connected socket; the server uses actual ASGI
`client`/`server` values with proxy rewriting disabled. Both endpoints must be
numeric `127.0.0.1`. Connection tuples are authenticated data, never supplied by
caller-controlled headers.

Request headers are exactly one of each:

- `Authorization: JAPP-HMAC-SHA256-V1 <64 lowercase hex request MAC>`
- `X-Japp-Auth-Version: 1.0.0`
- `X-Japp-Nonce: <64 lowercase hex nonce>`
- `X-Correlation-Id: <canonical stable ID>`

Reject duplicate/missing/unknown proof headers, mixed proof/bearer modes, invalid
grammar, unsupported auth versions, nonempty bodies, other methods and other
routes. Ordinary HTTP headers still apply, including strict Host/Origin/proxy
protection. Proof mode cannot authorize private bodies or mutations.

Each transcript field is ASCII bytes preceded by its unsigned four-byte
big-endian byte length. Fields are in the following exact order:

| Request transcript                     | Response transcript                                  |
| -------------------------------------- | ---------------------------------------------------- |
| `JAPP_HTTP_AUTH_REQUEST_V1`            | `JAPP_HTTP_AUTH_RESPONSE_V1`                         |
| `1.0.0`                                | `1.0.0`                                              |
| `GET`                                  | lowercase hex SHA256 of the exact request transcript |
| `/api/v1/health`                       | decimal HTTP status                                  |
| lowercase hex SHA256 of the empty body | lowercase hex SHA256 of exact response body bytes    |
| nonce                                  | exact `X-Japp-Schema-Id` value                       |
| correlation ID                         | exact `X-Japp-Schema-Version` value                  |
| instance ID                            | correlation ID                                       |
| decimal generation                     | instance ID                                          |
| client IPv4                            | decimal generation                                   |
| decimal client port                    | client IPv4                                          |
| server IPv4                            | decimal client port                                  |
| decimal server port                    | server IPv4                                          |
| —                                      | decimal server port                                  |

The response retains the canonical JSON envelope and ordinary schema/version,
correlation, no-store and nosniff headers. It additionally carries exactly one
`X-Japp-Auth-Version`, `X-Japp-Nonce` and `X-Japp-Server-Proof` (64 lowercase
hexadecimal HMAC-SHA256 characters over the response transcript). Sign exact
transmitted body bytes, never a parsed/reserialized equivalent. Server proof
buffering is limited to 16 KiB body, 64 headers/16 KiB header name/value bytes
including added proof headers, and 1.5 seconds of inner route work. Invalid
application output produces a canonical unsigned service-unavailable error.

Native accepts a proof only after checking its MAC in constant time, status 200,
canonical LIVE health envelope/payload, schema/header agreement, correlation,
instance/generation and active native session. Every subsequent request uses the
same explicit HTTP/1 connection handle. A broken connection fails; there is no
transparent reconnect, proxy, redirect, pool, DNS lookup or bearer downgrade.
Native cancellation/deadline failure aborts the driver and bounds its cleanup
join to 50 ms; callers must account for that cleanup bound in their outer IPC
budget. Every operation in this core is one of the three fixed idempotent GETs.
One retry is permitted only for a validated 503
`TRANSPORT_SERVICE_UNAVAILABLE` on that same verified stream, within the action
budget; the allowed code is checked against the canonical SAFE_RETRY catalog.

Fresh client nonce/tuple/generation binding prevents captured responses from
proving a new connection. The server intentionally has no one-use nonce cache:
repeated authenticated empty health proofs on the same tuple remain read-only.
Do not infer general request replay prevention or mutation authority. This
profile does not protect against privileged TCP/OS interception or compromised
endpoint memory and makes no TLS-equivalence claim.

The independently authored fixture `tests/fixtures/health-proof.v1.json` binds
Python/Rust request/response bytes and MACs. Implementation tests additionally
cover complete relay rejection, actual child death with listener reuse, reuse
after a proven connection closes, rejected proofs, response bounds, strict
canonical validation, deadline/cancellation and bounded idempotent retry.
