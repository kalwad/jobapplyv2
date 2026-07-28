# @japp/contracts — canonical JSON Schema source and conventions

Normative convention document for the repository's contract layer
(spec `JAPP-MASTER-001` §5.2 "JSON Schema as source of truth", M01-W01).
Every later contract package (M01-W02 … M01-W07) and every product schema
builds on the rules defined here. Changes to these conventions follow spec
§1.4 change control.

## 1. Ownership and layout

```text
packages/contracts/
├── README.md          # this normative convention document
├── schemas/           # CANONICAL hand-authored JSON Schema source (M01-W01)
│   ├── common/        # foundational shared definitions (listed below)
│   ├── error/         # M01-W03 error taxonomy/catalog/record documents
│   ├── fixture/       # test-only composition fixtures; never product data
│   ├── platform/      # M01-W07 cross-platform capability/service contracts
│   ├── security/      # M01-W04 capability/command/authorization documents
│   ├── semantic/      # schema for the finite semantic-rule catalog
│   └── {form,ats,workday,benchmark,gate,resume,rendering,session}/
│                      # M01-W06 feasibility/evidence wire contracts
├── catalog/           # CANONICAL validated data instances:
│   ├── error-catalog.v1.json        # M01-W03 error metadata
│   ├── capability-catalog.v1.json   # principals/profiles/capabilities
│   ├── command-catalog.v1.json      # bounded command metadata
│   ├── authorization-policy.v1.json # exact positive allow rows
│   └── semantic-rules.v1.json       # M01-W06 finite cross-field rules
├── src/               # deterministic catalog loader + strict validation layer
├── generator/         # M01-W02 deterministic generator engine (hand-authored)
├── generated/         # GENERATOR-OWNED output trees; never edited by hand
│   ├── MANIFEST.json  # provenance: inputs/data-inputs/outputs/type map
│   ├── typescript/    # generated types + typed Ajv-delegating validators
│   └── python/        # generated strict Pydantic v2 package (japp_contracts)
└── test/
    ├── schema/        # M01-W01 convention and definition tests
    ├── generated/     # M01-W02…W06 generator + generated-surface tests
    ├── fixtures/      # shared synthetic instance corpus for both languages
    └── contract/      # M01-W05…W07 cross-language compatibility evidence
```

- `schemas/` is the **single source of truth**. A contract exists when — and
  only when — its schema document is committed here.
- `schemas/common/` holds the foundational reusable definitions. Payload
  schemas reuse those definitions rather than restating IDs, versions,
  timestamps, digests, confidence, provenance, redaction, or correlation.
  M01-W06 adds feasibility/evidence wire shapes and M01-W07 adds the
  platform-service boundary; operating-system implementations and
  product-domain behavior remain future work.
- `schemas/fixture/` is test-only. Nothing under it may carry product data or
  be depended on by product code.
- `generated/` is produced exclusively by the M01-W02 generator (§10a).
  **Hand-authored or hand-maintained copies of generated TypeScript/Python
  contract models are prohibited** — models are produced by the generator or
  they do not exist. The `contract-gen` verification suite regenerates into
  an isolated temporary directory and byte-compares the complete committed
  inventory on every `pnpm verify`.

## 2. Document conventions

Every committed schema document must satisfy all of the following. The rules
are executable: `src/conventions.ts` implements them, `loadSchemaCatalog()`
fails closed on any violation, and `test/schema/` proves the positive and
negative behavior.

1. **Dialect.** `$schema` is exactly
   `https://json-schema.org/draft/2020-12/schema`. No other dialect is
   supported.
2. **Identity.** `$id` is a unique, stable, repository-controlled URN:
   `urn:japp:schema:<segment>[:<segment>…]:v<major>` (lowercase kebab-case
   segments; the final segment pins the major version). The `japp` namespace
   is the neutral internal repository namespace — no public product name or
   public schema domain exists, and the URN form makes remote fetching
   structurally meaningless.
3. **Path ↔ identity.** A document at
   `schemas/<segments…>/<name>.v<major>.schema.json` must declare exactly
   `$id: urn:japp:schema:<segments…>:<name>:v<major>`. One document per
   `$id`; duplicates fail the catalog.
4. **Version.** The root carries `x-japp-schema-version` with a strict
   `MAJOR.MINOR.PATCH` triple whose major equals the `$id` major.
5. **References.** A `$ref` is either a local JSON pointer (`#/$defs/…`) or
   the absolute `$id` of another committed catalog document, optionally with
   a `#/$defs/…` fragment. Remote (`http…`), relative (`./…`,
   `other.schema.json`), and `file:` references are prohibited; every
   reference resolves inside the repository, deterministically, offline.
6. **No aliasing indirection.** `$anchor`, `$dynamicAnchor`, `$dynamicRef`,
   `$vocabulary`, and legacy `definitions` are prohibited.
7. **Closed objects by default.** Every `"type": "object"` schema sets
   `"additionalProperties": false` unless it is a deliberate extension
   surface marked `"x-japp-extension-point": true` (§5). Unknown properties
   are validation failures, never silently carried data.
8. **Metadata.** Root `title` and `description` are required and non-empty.
9. **Annotations.** Only the five registered `x-japp-*` annotation keywords
   (§6) may appear. Anything else — including any other `x-…` key — fails
   both the convention check and strict compilation.
10. **No defaults.** The `default` keyword is prohibited. Validation never
    injects, coerces, or removes data (§8).

## 3. Foundational shared definitions (M01-W01)

| Document (`schemas/common/…`)   | `$id`                                      | Defines                                                                                                                                                                |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stable-id.v1.schema.json`      | `urn:japp:schema:common:stable-id:v1`      | `idPrefix`, `stableId` — `<prefix>_<26-char Crockford base32 body>` entity identifiers (matches the spec's `clm_…`/`ev_…` style; bodies exclude I, L, O, U)            |
| `schema-version.v1.schema.json` | `urn:japp:schema:common:schema-version:v1` | `schemaId` (the URN grammar), `schemaVersion` (strict numeric triple)                                                                                                  |
| `timestamp-utc.v1.schema.json`  | `urn:japp:schema:common:timestamp-utc:v1`  | `utcTimestamp` — RFC 3339 date-time, uppercase `T`/`Z`, UTC only, optional 1–9 fractional digits; calendar-valid via full-mode format assertion                        |
| `calendar-date.v1.schema.json`  | `urn:japp:schema:common:calendar-date:v1`  | `calendarDate` — RFC 3339 full-date; a distinct type from timestamps in both directions                                                                                |
| `enum-token.v1.schema.json`     | `urn:japp:schema:common:enum-token:v1`     | `enumToken` — the UPPER_SNAKE_CASE grammar every enum value must satisfy                                                                                               |
| `money.v1.schema.json`          | `urn:japp:schema:common:money:v1`          | `decimalAmount`, `currencyCode`, `money` — decimal-string amounts (never binary floats; no exponents/leading zeros/grouping; ≤ 6 fraction digits) plus a currency code |
| `location.v1.schema.json`       | `urn:japp:schema:common:location:v1`       | `countryCode`, `structuredLocation` — required country; optional bounded region/locality/postal_code                                                                   |
| `provenance.v1.schema.json`     | `urn:japp:schema:common:provenance:v1`     | `sourceKind`, `contentDigest`, `provenance` — required source_kind + source_id + observed_at; optional sha256 digest and confidence                                    |
| `confidence.v1.schema.json`     | `urn:japp:schema:common:confidence:v1`     | `confidence` — number in the closed interval [0, 1]                                                                                                                    |
| `redaction.v1.schema.json`      | `urn:japp:schema:common:redaction:v1`      | `sensitivityClass`, `redactionPolicy`, `redactionAnnotation` — the defined redaction vocabulary (§6)                                                                   |
| `correlation.v1.schema.json`    | `urn:japp:schema:common:correlation:v1`    | `correlationId`, `causationId` — workflow-trace identifiers on the stable-id grammar                                                                                   |
| `envelope.v1.schema.json`       | `urn:japp:schema:common:envelope:v1`       | `extensionKey`, `extensions`, `envelopeMetadata`, `envelopedRecord` — forward-compatible message/record envelope (§5)                                                  |

`schemas/fixture/test-record.v1.schema.json`
(`urn:japp:schema:fixture:test-record:v1`) is the test-only fixture proving
that these definitions compose into a concrete payload and flow through the
envelope and version policy end to end.

**Honesty boundaries of the syntactic checks.** Currency codes are checked
against the ISO 4217 _shape_ (`^[A-Z]{3}$`) and country codes against the
ISO 3166-1 alpha-2 _shape_ (`^[A-Z]{2}$`). The repository maintains **no**
ISO catalog, so semantically nonexistent codes such as `ZZZ` pass syntax.
Claiming exact-catalog validation requires committing the catalog and its
maintenance/update policy through change control first. Postal codes are
shape-checked only. Confidence is an IEEE 754 double bounded to [0, 1];
producers should emit bounded digits and consumers must never compare for
exact equality. Money never travels as a JSON number.

## 4. Versioning and compatibility policy

- **Representation.** Instance data declares the schema it was written
  against via the envelope: `schema_id` (URN, major inside) plus
  `schema_version` (exact triple). Schema documents declare their own
  version with `x-japp-schema-version`.
- **MAJOR** — breaking. Removing/renaming a field or enum token, tightening
  a constraint, changing a type or semantic meaning. A new major is a new
  document (`…:v2`) in a new file (`<name>.v2.schema.json`); majors may
  coexist during a migration window.
- **MINOR** — additive only. Adding an **optional** field, adding an enum
  token, adding a new `$defs` entry, relaxing nothing else. Every instance
  valid under `X.Y` must remain valid under `X.(Y+n)` — this is an invariant,
  not an aspiration; a change that breaks it is a major regardless of intent.
- **PATCH** — editorial. Descriptions, titles, comments. Never affects
  instance validity; ignored during acceptance evaluation.
- **Acceptance rules** (implemented in `src/versioning.ts` and
  `src/envelope.ts`, tested in `test/schema/envelope.test.ts`):
  - unknown/different **major** → `UNKNOWN_MAJOR_VERSION`, rejected outright;
  - declared **minor newer** than the catalog schema →
    `UPGRADE_REQUIRED_NEWER_MINOR`, rejected fail-closed — this is the
    explicit migration/upgrade signal (the M04 migration framework will
    consume it; nothing is migrated here);
  - declared minor **equal or older** → validated against the current
    catalog schema (safe because minors are additive-only);
  - malformed version → rejected at the envelope boundary.
- **Deprecation.** A member scheduled for removal keeps working for the rest
  of its major and is annotated with the standard 2020-12 `deprecated: true`
  plus `x-japp-deprecated-since: "<version>"`. Removal happens only in the
  next major.
- **Enum evolution.** Enums are closed string-token sets
  (UPPER_SNAKE_CASE). Adding a token is a minor change; removing or renaming
  one is a major change. Validators reject undeclared tokens — there is no
  unknown-token pass-through.
- **Unknown data is not "safe" because JSON Schema would permit it.**
  Objects are closed; the only forward-compatible surface is the explicit
  extension mechanism below.

## 5. Forward compatibility: the explicit extension mechanism

Where genuinely required — currently only the envelope's `extensions`
member — a schema may declare a deliberately open object marked
`"x-japp-extension-point": true` with property names constrained to the
namespaced grammar `^x-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`. Extension values are
**opaque, untrusted data**: they are preserved in transit, but no component
may act on them without a reviewed schema of their own, and they must never
carry secrets or PII. Everything outside an extension point stays closed.

## 6. Redaction vocabulary and annotation keywords

The defined namespaced vocabulary lives in
`urn:japp:schema:common:redaction:v1`:

- `sensitivityClass`: `PUBLIC | INTERNAL | PERSONAL | SENSITIVE | SECRET`
- `redactionPolicy`: `NONE | REDACT_VALUE | HASH_ONLY | FORBID_CAPTURE`

Exactly five custom annotation keywords are registered; each is
compile-time-checked against its vocabulary and anything else is rejected:

| Keyword                   | Where                                            | Value                        |
| ------------------------- | ------------------------------------------------ | ---------------------------- |
| `x-japp-schema-version`   | document root                                    | strict `MAJOR.MINOR.PATCH`   |
| `x-japp-sensitivity`      | field schemas                                    | one `sensitivityClass` token |
| `x-japp-redaction`        | field schemas                                    | one `redactionPolicy` token  |
| `x-japp-deprecated-since` | deprecated members (requires `deprecated: true`) | strict version triple        |
| `x-japp-extension-point`  | deliberately open objects                        | literally `true`             |

Annotations describe handling; they never change instance validity.

## 7. Null versus missing

`null` and _missing_ are distinct and never interchangeable:

- An **optional non-nullable** field is omitted when unknown; `null` is a
  validation error (fixture: `note`).
- A **required nullable** field must be present, and `null` is a deliberate,
  meaningful value ("known to have none"), declared explicitly via
  `anyOf: [{…}, {"type": "null"}]` (fixture: `superseded_by`).
- No field is nullable by accident: nullability appears only where the
  known-none case is semantically real.

## 8. Validation layer

`src/` implements the strict offline validation stack used by the tests and
by later packages:

- `catalog.ts` — `loadSchemaCatalog()` reads `schemas/**` in sorted POSIX
  path order (identical behavior on macOS, Windows, Ubuntu), parses every
  document, applies every §2 convention, and throws `SchemaCatalogError`
  listing all violations. Stray files, unparseable JSON, duplicate `$id`s,
  and references leaving the repository all fail closed.
- `validator.ts` — `createContractValidator(catalog)` builds **Ajv 2020**
  (pinned via the workspace catalog: `ajv`, with `ajv-formats` in `full`
  mode for calendar-correct `date`/`date-time` assertions) configured
  strictly: `strict: true`, `strictSchema/Numbers/Types/Tuples: true`,
  `allowUnionTypes: false`, `coerceTypes: false`, `useDefaults: false`,
  `removeAdditional: false`, `validateSchema: true` (every document is
  validated against the 2020-12 meta-schema), and no `loadSchema` hook (a
  reference that leaves the registered catalog throws instead of fetching).
  Every catalog document is compiled eagerly at construction so keyword,
  meta-schema, and reference problems surface deterministically.
- `versioning.ts` / `envelope.ts` — the §4 acceptance policy and the
  two-phase enveloped-record validation (`envelope shape → schema_id lookup
→ version policy → payload validation`), returning typed fail-closed
  outcomes.

No network access exists anywhere in this layer. Validation is deterministic
across the three certified CI operating systems.

## 9. Reconstruction: adding or changing a schema

1. Author or edit the document under `schemas/` following §2 (path ↔ `$id`,
   dialect, closed objects, references, annotations).
2. Bump `x-japp-schema-version` according to §4; a new major is a new
   `…v<major+1>.schema.json` file with its own `$id`.
3. Extend the tests: every new definition needs positive **and** negative
   instance tests under `test/schema/`; every new convention needs a
   negative proving it fails.
4. Run the focused suite, then the repository gates:

   ```bash
   pnpm --filter @japp/contracts test
   pnpm verify
   ```

5. Update this document when a convention (not merely a definition) changes.
   Convention changes follow spec §1.4 change control.

Test placement rule: M01-W01 schema tests live in `test/schema/`; M01-W02
generator and generated-model tests live in `test/generated/` (TypeScript)
and `scripts/tests/test_generated_contracts.py` (Python), sharing the
synthetic corpus in `test/fixtures/instance-corpus.json`. M01-W04 policy
tests live in `test/generated/security-policy.test.ts` and
`scripts/tests/test_generated_security_policy.py`; they prove generated
policy behavior in both languages without claiming M01-W05 wire-round-trip
certification.
M01-W06 semantic-runtime tests live in `test/generated/`,
`scripts/tests/test_generated_semantic_rules.py`, and the adapters.
M01-W07 platform tests live in `test/schema/w07-platform.test.ts` and
`scripts/tests/test_generated_platform_contracts.py`.
`test/contract/` is the active M01-W05…W07 representative cross-language
suite.
Its versioned hash-locked synthetic corpus drives the real generated
TypeScript/Ajv and Python/Pydantic paths plus a private test-only Rust
harness. See `test/contract/README.md`; this evidence does not create a
production Rust contract surface or claim coverage of future schemas.

## 10a. Generated contracts (M01-W02)

The generator is deterministic and fail-closed. Its engine lives in
`generator/` (part of this package, unit-tested by Vitest); the canonical
entry point is `scripts/generate-contracts.ts`, executed directly by the
repository-pinned Node (native type stripping — no Bash wrapper, no compile
step, no shell profile):

```bash
pnpm generate:contracts          # regenerate packages/contracts/generated/
pnpm generate:contracts --check  # read-only byte-exact drift check
```

- **Input gate.** Generation loads the catalog through `loadSchemaCatalog()`
  and compiles it through `createContractValidator()` — the unweakened
  M01-W01 convention/strict-Ajv gate — before any output is planned. Any
  violation aborts with no writes.
- **Supported construct set** (exactly what the committed catalog uses):
  `$defs`; local `#/$defs/…` and absolute catalog `$ref` (with optional
  `#/$defs/…` fragment, siblings limited to metadata); string
  `pattern`/`minLength`/`maxLength`; `format: date | date-time` with the
  full-mode calendar/time assertions (mirrored in Python, including the
  `23:59:60Z` leap-second slot and proleptic year 0000); number
  `minimum`/`maximum`; bounded `integer` with required inclusive
  safe-integer `minimum` and `maximum` (TypeScript `number` with strict Ajv
  runtime truth; constrained strict Python `int`); `boolean` (strict — never
  coerced from strings or integers); uniform arrays (single object `items` schema plus
  `minItems`/`maxItems`); closed string enums; closed objects
  (`additionalProperties: false`, `required`, `properties`); the marked
  extension surface (`x-japp-extension-point` + `propertyNames` +
  `maxProperties`); two-member `anyOf` nullability; the boolean schema
  `true` for deliberately opaque payloads; `title`/`description`/`$comment`,
  `deprecated`, and the five `x-japp-*` annotations as metadata.
- **Everything else fails closed** with the document path and JSON pointer:
  tuple arrays (`prefixItems`), `uniqueItems`/`contains`, general
  `anyOf`/`oneOf`/`allOf`/`not`/conditionals, `const`, unbounded,
  fractional-bound, reversed-bound, or unsafe-integer schemas, exclusive
  bounds, `multipleOf`, numeric enums, `format` values beyond date/date-time,
  non-identifier or underscore-leading property names and actual reserved
  Pydantic model-member collisions, recursive
  `$defs` cycles, and any unlisted keyword. Extending support is a
  deliberate generator change with tests, never a silent approximation.
- **TypeScript output** (`generated/typescript/`): one module per schema
  document mirroring the schema layout; fully-qualified deterministic type
  names (`CommonMoneyV1DecimalAmount`, root payloads like
  `FixtureTestRecordV1`); optional members use real optional properties
  (missing ≠ undefined under `exactOptionalPropertyTypes`), required
  nullable members are `T | null`, extension surfaces are
  `readonly [key: \`x-${string}\`]: unknown` (never `any`), opaque payloads
  are `unknown`. `validators.ts` provides `validateContractInstance` plus a
  typed wrapper per generated reference; wrappers delegate runtime truth to
  the strict canonical Ajv catalog in `src/` (no re-implemented rules),
  narrow only after success, preserve the structured error list, and throw
  on references outside the catalog. Definitions-only document ids are
  deliberately absent from the wrapper map (their bare `$id`compiles to an
unconstrained schema). Stable import surface:`@japp/contracts/generated`→`generated/typescript/index.ts`.
- **Python output** (`generated/python/src/japp_contracts/`): strict
  Pydantic v2 (pinned `pydantic==2.12.5` in the root uv dev group; models
  use `extra="forbid"` and `strict=True`; no defaults are injected and no
  coercion occurs — JSON integers stay `int`, floats stay `float`, `bool` is
  rejected for numbers; bounded integer schemas are strict constrained `int`
  and reject bool, floats, numeric strings, and values outside their safe
  inclusive bounds). Missing and explicit null stay distinct: optional non-nullable
  members reject explicit null before validation; required nullable members
  accept a deliberate null. Decimal amounts and date/timestamp values keep
  their exact string wire form; `wire_dict()` emits the canonical wire
  representation (absent members stay absent). Importability is wired
  through the repository `pythonpath`/`mypy_path` configuration
  (`pyproject.toml`), the generated package ships `py.typed`, and strict
  mypy checks it through the test imports.
- **Determinism and provenance.** Output depends only on the committed
  catalog and the generator version: documents are processed in sorted `$id`
  order, definitions in dependency order (alphabetical tiebreak), imports/
  exports/manifest keys explicitly sorted, all text LF UTF-8. No
  timestamps, absolute paths, usernames, hostnames, random values, or
  platform separators exist in any output (`__pycache__/` interpreter
  caches are outside the compared inventory). `generated/MANIFEST.json`
  records the generator format/config, every input schema id/version/
  SHA-256 (exact committed bytes), all four validated canonical data inputs
  (error, capability, command, and policy) with their validating schema,
  version, and SHA-256, every output path/SHA-256, and the
  schema-reference → generated-type identity map for both languages.
- **Write mode** performs a transactional, rollback-safe whole-tree
  replacement (deliberately not called "atomic": no single indivisible
  multi-directory operation exists portably on macOS, Windows, and Ubuntu).
  The complete tree is materialized and byte-verified in a unique sibling
  staging directory before the existing tree is touched; the existing tree
  is renamed aside to a unique sibling backup — never deleted first — and
  the verified staging tree is renamed into place; the backup is removed
  only after the new tree is installed. If installation fails, the backup
  is restored automatically; if even the rollback rename fails, nothing
  recoverable is deleted and the error names every surviving directory and
  the manual recovery action. The installed path only ever transitions
  between complete trees, so stale outputs of deleted schemas cannot
  survive and a partially written tree can never appear at the installed
  path. **Check mode** regenerates into an isolated temporary directory,
  verifies the materialized bytes, and byte-compares the complete
  inventory against `generated/` (missing, stale, modified, and unexpected
  extra files all fail with actionable paths) without ever touching the
  working tree.

## 10b. Error taxonomy (M01-W03)

The machine-readable error taxonomy lives in three schema documents plus
one canonical validated data instance:

- `schemas/error/taxonomy.v1.schema.json`
  (`urn:japp:schema:error:taxonomy:v1`) — the closed vocabulary: the twelve
  required families (`VALIDATION`, `CONFLICT`, `UNSUPPORTED`, `SENSITIVE`,
  `MODEL`, `STORAGE`, `TRANSPORT`, `RENDERING`, `SITE`, `BENCHMARK`,
  `GATE`, `SUBMISSION`), the 80 stable family-prefixed UPPER_SNAKE_CASE
  error codes, severities (`WARNING | ERROR | CRITICAL`), retry/recovery
  dispositions (`SAFE_RETRY | RETRY_AFTER_REMEDIATION | PAUSE_FOR_USER |
NO_RETRY_PROHIBITED | NO_RETRY_TERMINAL`), reporting origins (spec
  §5.4/§5.5 components/boundaries), the derived message-key grammar, and
  the bounded user-safe message shape.
- `schemas/error/catalog.v1.schema.json`
  (`urn:japp:schema:error:catalog:v1`) — the structure of the catalog
  instance, and `catalog/error-catalog.v1.json` — the ONE source of truth
  for per-code metadata: derived message key, safe default English
  message, optional remediation, severity, disposition,
  `user_action_required`, `transient`, diagnostic policy (the canonical
  redaction vocabulary), optional owning boundary, and version metadata.
  The generator validates the instance through the strict catalog
  validator and fails closed on: schema violations, unsorted or duplicate
  entries, any disagreement with the taxonomy `errorCode` enum (both
  directions), family/prefix mismatch, non-derived message keys, message
  lint violations (URLs, paths, stack-trace references, doubled spaces —
  on top of the schema's charset/bounds that already exclude
  interpolation, HTML, and control characters), and the family invariant
  matrix (SENSITIVE ⇒ user action + pause/prohibit; SITE ⇒ pause;
  UNSUPPORTED/SENSITIVE/GATE/BENCHMARK/SUBMISSION ⇒ never `SAFE_RETRY`;
  `transient` ⇔ `SAFE_RETRY`; GATE/BENCHMARK never transient). Independent
  handwritten TypeScript/Python catalogs are prohibited — both surfaces
  are generated from this instance.
- `schemas/error/record.v1.schema.json`
  (`urn:japp:schema:error:record:v1`) — the strict wire record. It
  serializes ONLY the stable code plus occurrence identity/trace data
  (`error_id`, `occurred_at`, `origin`, `correlation_id`, optional
  `causation_id`, optional `diagnostic_digest`); family, severity,
  disposition, flags, and user-safe text are always derived from the
  catalog by the consumer, so contradictory caller-supplied metadata and
  free-form user-facing messages are structurally unrepresentable. The
  record is closed with no extension surface; diagnostics travel out of
  band (redacted, bounded) and are referenced only by SHA-256 digest.

Evolution rules: codes follow the §4 enum rules — adding a code (with its
catalog entry) is a MINOR change; removing, renaming, or semantically
reassigning one is a MAJOR change; deprecated codes carry
`deprecated_since` and remain defined for the rest of their major version.
No generic `UNKNOWN` code exists and none may be added as a substitute for
classification.

`SAFE_RETRY` and `transient` are an exact equivalence: a safe retry is a
transient condition whose same operation may be repeated without user
involvement, while every other disposition is non-transient. Retry policy
may still bound the number of attempts. `MODEL_MALFORMED_OUTPUT` is the
bounded, side-effect-free retry case and is therefore `SAFE_RETRY` plus
`transient=true`. `MODEL_VALIDATION_FAILED` may represent policy,
factuality, evidence, or deterministic-postcondition rejection, so an
unchanged blind retry is unsafe; it is non-transient
`RETRY_AFTER_REMEDIATION`. Every MODEL default message explicitly states
that accepted deterministic results remain usable and unchanged. KI-0020
restores these already-declared v1 semantics and corrects invalid v1 data;
it does not introduce a new retry meaning.

Generated surfaces (`generated/typescript/error/catalog-data.v1.ts`,
`generated/python/.../error/catalog_data_v1.py`): the frozen
`ERROR_CATALOG_V1` metadata map keyed by code, the sorted
`ERROR_CODES_V1`, `isErrorCodeV1`/`is_error_code_v1`,
`requireErrorCatalogEntryV1`/`require_error_catalog_entry_v1` (unknown
codes fail closed without echoing the untrusted value), and
`errorDefaultMessageV1`/`error_default_message_v1`. Wire validation stays
with the standard generated validators (`validateErrorRecordV1`,
`ErrorRecordV1`), which delegate to the strict canonical Ajv catalog and
strict Pydantic v2 respectively. The taxonomy defines errors only —
executable capabilities and command allowlists are M01-W04.

## 10c. Capability and command allowlists (M01-W04)

M01-W04 adds one coordinated canonical authorization layer:

- `schemas/security/capability-taxonomy.v1.schema.json` and
  `catalog/capability-catalog.v1.json` define exactly nine architectural
  software principals, four current profiles (`FEASIBILITY`,
  `GUIDED_PRE_SUBMIT`, `PRODUCTION_NO_SUBMIT`, `VERIFICATION`), and eighteen
  bounded authority classes. There is no generic `SYSTEM`, `ADMIN`, `USER`,
  `ANY`, or catch-all capability.
- `schemas/security/command-taxonomy.v1.schema.json` and
  `catalog/command-catalog.v1.json` define the bounded command inventory.
  Every command has exactly one capability, final target, supported-profile
  set, exact encoded-payload byte limit, consequence class, idempotency
  expectation, M01-W03 denial code, description, and explicit non-goals.
  Detailed command payloads remain owned by M01-W06, M01-W07, and later
  packages.
- `schemas/security/authorization-request.v1.schema.json` is closed metadata
  only: version/request identity, command, preserved origin, immediate sender,
  final target, profile, timestamp/correlation, exact payload byte count, and
  optional digest/causation/idempotency data. Payload, capability claims,
  decisions, denial text, paths, selectors, HTML, SQL, scripts, registry data,
  arbitrary commands, secrets, and tokens are not representable.
- `schemas/security/authorization-policy.v1.schema.json` and
  `catalog/authorization-policy.v1.json` are a positive allowlist only. Each
  row is one exact `(profile, command, origin, sender, receiver, final target)`
  tuple. Missing rows deny. Wildcards, regex, inheritance, transitive trust,
  negative rows, and generic internal trust are structurally absent.

The receiver, authenticated immediate sender, authenticated preserved origin,
active profile, and receiver-observed encoded payload size are trusted runtime
context passed separately to generated authorization. Caller metadata must
match the authenticated sender, preserved origin, active profile, and measured
size before any allow-row lookup. The original requester therefore stays
bound across the reviewed content-script → service-worker → native-host →
orchestrator route, and a caller cannot under-report payload size. Complete-hop
validation rejects shortcuts, origin rewriting, and confused-deputy
escalation. M01-W04 defines this authorization boundary; M17 owns the concrete
authenticated transport and byte measurement that supplies the context.

The generator independently enforces architectural ceilings even if policy
JSON is edited: content scripts can only originate bounded state/review
reports; service workers and native hosts cannot convert forwarding into
origin authority; models, platform adapters, and the public index cannot
originate product commands; desktop requests stay behind typed orchestrator
services; immutable profile-capability ceilings prevent coordinated catalog
edits from adding model/private/platform authority to FEASIBILITY or
GUIDED_PRE_SUBMIT; reviewed command capability/target and critical
idempotency semantics cannot be relabeled; verification cannot acquire
production-data/platform/submission authority; and no current profile can
grant final submission. Platform
capability/command categories are declared for stable recognition and keep
empty profile sets and zero rows. M01-W07 (§10f) defines their concrete typed
payload contracts without granting any of them operational authority; a later
package that needs a platform operation must extend this catalog explicitly. Final submission is likewise a known command with a specific safe
denial and zero rows.

Generated surfaces live at
`generated/typescript/security/policy-data.v1.ts` and
`generated/python/src/japp_contracts/security/policy_data_v1.py`. They expose
immutable catalogs and sorted inventories, non-echoing type guards/lookups,
exact-route `allowedCommandsForV1`/`allowed_commands_for_v1`, and typed
fail-closed `authorizeCommandRequestV1`/`authorize_command_request_v1`.
TypeScript request validation delegates to the strict canonical Ajv catalog;
Python uses the generated strict Pydantic v2 model. Authorization snapshots
JavaScript data properties before validation/use and reserializes any Python
request-model instance into a fresh strict validation input, so accessors,
proxies, or post-validation model mutation cannot create time-of-check/time-
of-use drift. No handwritten per-language policy map exists.

## 10d. Cross-language compatibility evidence (M01-W05)

`pnpm test:contract` runs the 363-case canonical corpus and the failure
infrastructure/breaking-change tests. Protocol, normalization, exact
representative scope, dependency pins, baseline lifecycle, and reconstruction
commands are documented in `test/contract/README.md`. Normal compatibility
and manifest checks are read-only; their separately named update commands are
never part of `pnpm verify`.

The Rust crate under the suite is private, `publish = false`, locked, offline
after fetch, and test-only. It mechanically compares its representative typed
vocabulary with canonical schema/catalog data and exports nothing to the
native host.

## 10e. Feasibility and benchmark contracts (M01-W06)

M01-W06 adds 21 strict root wire contracts across form, ATS, Workday,
session, benchmark, gate, resume, and rendering families. JSON Schema remains
the structural source of truth. Cross-field conditions that the deliberately
bounded generator subset cannot express are represented by the validated,
non-executable `catalog/semantic-rules.v1.json`. Generator format `1.3.0`
emits identical finite TypeScript and Python dispatchers after validating
each rule binding against the exact schema vocabulary. The catalog contains
no expressions and cannot execute schema or catalog content.

Structural validation always runs before semantic validation. The semantic
layer rejects, among other contradictions, an insufficient or raw-selector
field identity, unauthorized/sensitive fill decisions, an unverified driver
success, inconsistent reconciliation counts, READY with blockers, navigation
without proof/control/idempotency, unsafe retry after an uncertain
transition, benchmark PASS with incomplete or mismatched evidence, a holdout
body in a manifest, gate PASS without complete review/evidence, unsupported
claims marked release-eligible, accepted clipped/overflowing layout, and a
certification scope broader than its measured tuple.

The canonical inventory, rule architecture, generated surfaces, invariants,
and explicit non-claims are recorded in
[`M01-W06.md`](./M01-W06.md). The expanded cross-language corpus and private
Rust representative coverage are documented in `test/contract/README.md`.
These contracts do not fill forms, navigate, render, run models or benchmarks,
evaluate gates, or certify any Workday pattern.

## 10f. Cross-platform capability and platform-service contracts (M01-W07)

M01-W07 adds 19 strict root wire contracts under `schemas/platform/` plus the
definitions-only `urn:japp:schema:platform:vocabulary:v1` supporting document.
They cover certified platform identity and support tiers, platform capability
and capability-state reporting, typed logical paths and trusted resolution
results, the secret-store boundary, process-supervisor plans/handles/results,
native-messaging registration intents and results, browser discovery and
browser records, model-runtime profiles and runtime capability,
installer/updater state, platform diagnostics, and cross-platform
evidence/certification-input records.

Generator format `1.4.0` records that the finite semantic-rule vocabulary grew
by eighteen platform rule kinds (22 → 40) with matching TypeScript and Python
evaluators; the canonical rule catalog grows from 42 to 80 bindings and
`urn:japp:schema:semantic:rule-catalog:v1` takes the required MINOR bump to
`1.1.0`. Every platform request carries a typed principal/profile context, and
the semantic layer restricts platform operations to the orchestrator and
verification harness — content scripts, service workers, models, the public
index, the desktop app, the native host, and the platform adapter itself can
never originate one.

**Authority is deliberately unchanged.** The M01-W04 capability, command, and
authorization-policy catalogs are untouched: the four platform commands keep
empty supported-profile sets and zero allow rows, all 127 positive rows and
every negative case are preserved, and defining a payload contract grants no
operational authority.

The canonical inventory, per-boundary invariants, generator decision,
compatibility classification, and explicit non-claims are recorded in
[`M01-W07.md`](./M01-W07.md). These contracts detect no platform, certify no
platform, resolve no path, open no secret store, spawn no process, register no
host, locate no browser, run no model, install or update nothing, and evaluate
no gate.

## 10g. Boundaries owned by later packages

- **M03-W07 … M03-W10** — the operating-system adapters that implement the
  M01-W07 lifecycle, path, and process contracts.
- **M04-W07 … M04-W10** — the native Keychain, Credential Manager/DPAPI, and
  Secret Service stores behind the M01-W07 secret contracts.
- **M05-W13 … M05-W16** — measured model-runtime profiles and fallback UX.
- **M17-W07 … M17-W10** — native-messaging registration and cross-platform E2E.
- **M27-W07 … M27-W12** — packaging, signing, update/rollback, and the
  Cross-Platform Core Gate evidence bundle.
- **M04** — the real migration framework that consumes the
  `UPGRADE_REQUIRED_NEWER_MINOR` / major-version signals.
- Product/domain payload schemas arrive with their owning milestones.
