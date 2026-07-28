# M01-W05…W07 representative cross-language compatibility suite

This directory is a private verification system, not a product contract API.
It proves that the representative schemas and security decisions committed
through M01-W07 behave consistently in generated TypeScript, generated
Python, and an isolated test-only Rust executable. It deliberately makes no
claim that every future schema has a production Rust representation.

## Canonical corpus

`corpus/manifest.v1.json` is the single inventory. Corpus format `1.0.0`
currently locks 363 sorted, unique, synthetic cases across three files:

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
and timeouts. The harness never enables networking or a remote schema
resolver. Canonical values are UTF-8 compact JSON with object keys sorted by
UTF-8 bytes, stable array order, exact strings, distinct null/missing states,
finite numbers only, and safe-integer enforcement. Integer and genuinely
fractional values remain distinct.

## Language paths

- `adapters/typescript-adapter.ts` snapshots unknown JavaScript values through
  descriptors, rejects accessors/proxies/symbols/unusual prototypes, then
  delegates to generated wrappers backed by the canonical strict Ajv runtime,
  then applies the generated finite M01-W06 semantic rules. It uses the
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

M01-W07 adds representative coverage for all nineteen platform roots: one
round trip each, twenty-two strong-branch positives (reviewed certification,
full certification, permission denial, verification-only probes, binary-stdio
native-host plans, orphan detection, accepted model profiles, rollback, and a
complete certification inventory), forty structural negatives (absolute,
traversal, UNC, and drive paths; shell text, chaining, interpreter flags, and
executable-path arguments; raw environment dictionaries; registry keys and
manifest bodies; plaintext secret and keychain members; unreviewed or wildcard
extension identifiers; browser executables and launch URLs; case-variant
platform identifiers and unknown support tiers; markup and oversized
messages; out-of-range, fractional, and boolean integers), and seventy-eight
semantic negatives covering every platform rule kind.

`breaking/` derives an exhaustive structural/semantic signature from the
canonical IR, catalogs, and valid corpus cases. The checked-in v1 baseline is
historical evidence—not source of truth. Normal check mode is read-only:

```text
pnpm contracts:compatibility:check
```

It detects schema/definition/property/enum/ref/type/nullability/pattern/bound/
openness regressions; version and supported-wire removal; command capability,
target, denial-code, and payload changes; and profile/final-submit/platform
authority broadening. Tests separately prove compatible new schemas,
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
