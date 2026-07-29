# M01-W05…W07 representative cross-language compatibility suite

This directory is a private verification system, not a product contract API.
It proves that the representative schemas and security decisions committed
through M01-W07 behave consistently in generated TypeScript, generated
Python, and an isolated test-only Rust executable. It deliberately makes no
claim that every future schema has a production Rust representation.

## Canonical corpus

`corpus/manifest.v1.json` is the canonical current-case inventory. Corpus
format `1.0.0` locks 511 sorted, unique, synthetic cases across three files:
505 apply to all three languages, five are TypeScript-only, and one is
Python-only, yielding TypeScript 510, Python 506, and Rust 505. The operation
split is 60 `AUTHORIZE`, 156 `ROUND_TRIP`, 287 `VALIDATE`, and 8
`VERSION_CHECK`; the corpus count retains one slot below the 512-case bound.

- `cases.v1.json` describes schema reference, category, operation, input
  reference or raw bytes, expected verdict/normal form/version/authorization
  result, applicable languages, rationale, and the synthetic-data assertion.
- `values.v1.json` contains reusable canonical JSON values.
- `raw-wire.v1.json` contains base64 bytes for malformed UTF-8, duplicate
  keys, invalid Unicode/control forms, deep/oversized input, hostile property
  names, huge numbers, and trailing data.

The manifest records byte length, SHA-256, case/category/language/operation
counts, and its own payload digest. Loading rejects missing, changed, or
unmanifested files, duplicate/missing/unsorted case IDs, real-data claims,
and nondeterministic metadata. Update it only after an intentional corpus
change:

```text
pnpm contracts:corpus:update-manifest
```

That explicit write command is never used by `pnpm verify`.

`semantic-witnesses/historical-platform-v1.json` is a separate immutable
accepted-set inventory, not part of the 511-case batch. It canonicalizes 556
source positive references from four published M01-W07 revisions into 229
distinct v1 schema/payload witnesses across all nineteen platform roots. Each
language executes those 229 `VALIDATE` requests as a second bounded batch. The
strict loader verifies digest-derived IDs, exact source revisions and counts,
recursive canonical deduplication, provenance, the 0659/860 accepted-anchor
equivalence, and the inventory digest.

## Adapter protocol and normalization

Protocol `JAPP_CONTRACT_ADAPTER_V1` is a bounded batch of at most 512 cases.
Each request carries a stable case ID, complete local schema reference,
`VALIDATE`, `ROUND_TRIP`, `VERSION_CHECK`, or `AUTHORIZE`, base64 raw JSON
bytes, and—only for authorization—a separate trusted-context snapshot.
Responses contain only protocol version, language, case ID, operation,
verdict/outcome, canonical JSON where applicable, and stable categories or
catalog error codes. Raw exceptions, paths, stack traces, and input echoes
are forbidden.

Children run with explicit argument arrays, `shell: false`, bounded output,
and timeouts: Rust build 300 seconds, adapter execution 120 seconds, and direct
semantic TypeScript execution 30 seconds. Generated CLI tests use a separate
15-second / 1-MiB boundary because expected nonzero exits must remain
inspectable. The harness never enables networking or a remote schema resolver.
Canonical values are UTF-8 compact JSON with object keys sorted by UTF-8 bytes,
stable array order, exact strings, distinct null/missing states, finite numbers
only, and safe-integer enforcement. Integer and genuinely fractional values
remain distinct.

## Language paths

- `adapters/typescript-adapter.ts` snapshots unknown JavaScript values through
  descriptors, rejects accessors/proxies/symbols/unusual prototypes, then
  delegates to generated wrappers backed by the canonical strict Ajv runtime,
  then applies the generated finite M01-W06/W07 semantic rules. It uses the
  M01-W01 version policy and generated catalog/policy APIs. It does not
  coerce, default, remove, or mutate fields.
- `adapters/python_adapter.py` imports the generated strict Pydantic v2
  package. It forbids extra fields and coercion, preserves missing versus
  null, serializes with `wire_dict()`, and freshly validates serialized model
  state before compatibility, finite semantic validation, or authorization
  use.
- `rust-harness/` is a `publish = false` test executable pinned by its own
  `Cargo.lock`. It uses exact `base64 0.22.1`, `jsonschema 0.49.1` with
  default features disabled, `serde 1.0.229`, and `serde_json 1.0.151`.
  Draft 2020-12 schemas and references are registered locally. Typed
  representative fixture/error/envelope/authorization, W06 feasibility, and
  W07 platform records reject unknown fields, round-trip through Serde, and
  mechanically check their enums and finite semantic-rule bindings against
  canonical schema/catalog vocabulary. Authorization loads canonical command,
  capability, policy, and error data. Nothing is exported to
  `services/native-host`, whose fail-closed scaffold is unchanged.

## Coverage and negative proof

The corpus covers the composed fixture, error record, standard envelope,
content-script report route, FEASIBILITY and GUIDED_PRE_SUBMIT bounded
operations, typed desktop/model/public-index/verification requests, exact
payload limits, supported older minor versions, strict structural/format/
enum/nullability failures, version incompatibilities, hostile raw JSON, and
default-deny escalation through every relevant principal/profile boundary.
Every structurally valid ordinary wire case resolves its expected canonical
form from its canonical value plus patch; TypeScript, Python, and Rust return
and compare that form for authorization and compatible-version operations as
well as explicit `ROUND_TRIP`. All four current platform commands are denied
under each of the four current profiles, and a content script is separately
denied secret-store, process-supervision, native-messaging-registration, and
browser/runtime-discovery authority.

M01-W07 coverage includes all nineteen published v1 platform roots, fifteen
corrected v2 roots, fifteen v2 positive round trips, thirty-nine explicit
v1-valid/v2-invalid migration pairs, and thirteen direct SEM-01…SEM-07 v2
negative reproductions, including the final certified-claim/inventory
cross-binding witness. The 229-row historical batch independently protects
the complete finite published v1 positive set discovered from corpus and
matrix evidence; it does not claim to enumerate every possible JSON value.

The independently declared corrected-major grids also execute outside the
corpus through this same real adapter protocol: 538 platform/package-policy
cells and 288 secret-store cells run in batches bounded by both 512 cases and
4 MiB. Every negative must remain structurally valid, return
`SEMANTIC_INVALID` with its root's canonical error code, and agree across
TypeScript, Python, and Rust.

`breaking/` derives a closed structural/catalog signature plus executable
semantic signatures for source corpus witnesses and the historical inventory.
Baseline format `2.1.0` binds 572 semantic witnesses and the historical
path/count/digest; the current signature covers 78 documents, 110 semantic
rules, and 215 supported valid cases. Its internal integrity digest is
`f0a254082a038350e47d3632219cedbc20304afa99526e02dc37fb9541da33d5`.
This is bounded evidence, not a claim of mathematical exhaustiveness, and the
checked-in baseline is historical evidence—not source of truth. Normal check
mode is read-only:

```text
pnpm contracts:compatibility:check
```

It detects schema/definition/property/enum/ref/type/nullability/pattern/bound/
openness regressions; version and supported-wire removal; semantic-rule
removal/rebinding; retained-witness acceptance or rejection removal,
expectation and failure-binding drift; historical-inventory drift; command
capability, target, denial-code, and payload changes; and profile/final-submit/
platform authority broadening. Tests separately prove compatible new schemas,
optional properties, minor versions, enum/deprecation metadata, and valid
cases. An intentional baseline update is separately named:

```text
pnpm contracts:compatibility:update-baseline
```

CI never invokes update mode. Infrastructure negatives prove failure for a
missing/crashing/timed-out/malformed adapter, Rust compile failure, missing/
duplicate/wrong case IDs, semantic disagreement, corpus/baseline drift,
breaking mutations, and activated-but-empty discovery.
Successful child processes must also keep stderr empty, preventing an adapter
from leaking diagnostics or hostile values outside its bounded JSON response.

Run the complete required path with `pnpm test:contract`; it builds Rust
`--locked --offline` and prints one deterministic execution proof containing
the exact TypeScript, Python, and Rust case counts.
