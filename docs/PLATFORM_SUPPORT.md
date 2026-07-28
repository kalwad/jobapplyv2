# Platform Support

Canonical platform-governance memory for JAPP-MASTER-001 v1.4. This file
records intended certification scope and current evidence honestly; it is not
evidence that a product package, secure store, model runtime, native host,
installer, updater, or compatibility target already works.

## Support-state vocabulary

| State | Meaning |
|---|---|
| `CERTIFIED_FULL` | Native packaged core behavior and an accepted full-AI profile passed the complete platform gate. |
| `CERTIFIED_CORE` | Native packaged deterministic core behavior passed, but no accepted full-AI profile applies to the machine. |
| `EXPERIMENTAL` | Some behavior was measured, but no first-release support promise exists. |
| `UNSUPPORTED` | The target is deliberately outside the certified matrix and must fail visibly with an explanation. |
| `NOT_YET_IMPLEMENTED` | Planning contract only; no product certification evidence exists. |

## First-release target contract

| Target ID | Operating system | Architecture | Browser | Intended tiers | Current product state | Evidence |
|---|---|---|---|---|---|---|
| `macos-arm64` | macOS 14 or later | Apple Silicon arm64 | Chrome stable | `CERTIFIED_FULL`, `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — |
| `windows-x64` | Windows 11 | x86-64 | Chrome stable | `CERTIFIED_FULL`, `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — |
| `ubuntu-x64` | Ubuntu 24.04 LTS, supported default GNOME session | x86-64 | Chrome stable | `CERTIFIED_FULL`, `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — |

The macOS, Windows, and Ubuntu GitHub Actions jobs prove only the M00
repository toolchain and verification baseline. They do not certify packaged
product behavior. `M00-W09` added the required `windows-2025` hosted job,
the Windows-aware doctor/preflight behavior, and the deterministic
platform-portability policy suite (`scripts/check_portability.py`); a
passing `windows-2025` job is a repository/toolchain portability baseline
and does not prove packaged Windows 11 desktop support. No Windows
secure-store, native-messaging, local-model, installer, update, or product
claim exists yet, and `CROSS_PLATFORM_CORE` remains `NOT_EVALUATED`.

## Staged local-AI policy

- `M05` must accept the primary Mac full-AI profile, define the shared
  platform-profile contract, and validate native Windows/Ubuntu capability
  detection plus safe no-model and insufficient-hardware behavior.
- The absence of qualifying Windows or Ubuntu full-AI hardware during `M05`
  does not block `M06`.
- `M27-W10` owns final acceptance of at least one full-AI Windows profile and
  one full-AI Ubuntu profile.
- The provider-neutral M05-W03 path and M05-W17 re-anchoring must preserve the
  local Ollama default. The future experimental external provider remains
  non-core and cannot substitute for any required local profile.
- Neither Windows nor Ubuntu has an accepted full-AI profile today.
- `CROSS_PLATFORM_CORE` cannot pass until those later full-AI acceptances and
  every other Gate D requirement have real native packaged evidence.
- Those future evidence references must resolve to existing
  scoped evidence records: the relevant owning-package heading in
  `docs/TEST_EVIDENCE.md`, a Gate D heading in
  `docs/gates/HOLDOUT_EXECUTION_LOG.md`, or a dedicated artifact below
  `docs/gates/evidence/`. Placeholder or irrelevant prose, arbitrary
  repository files, external URLs, absolute paths, traversal, missing
  references, duplicate rows, and symlink escapes cannot satisfy Gate D.
  Every first-release target row must be `CERTIFIED_FULL` with such evidence
  before Gate D passes. M00-W10 added this fail-closed validation while
  leaving the gate `NOT_EVALUATED`.

## Contract boundary (M01-W07, contracts only)

`M01-W07` defined the typed cross-platform capability and platform-service
contracts as canonical JSON Schema under
`packages/contracts/schemas/platform/`, with generated strict TypeScript and
Pydantic v2 surfaces and representative test-only Rust agreement. The
contracts encode this governance policy structurally:

- The certified target vocabulary is exactly `MACOS_ARM64`, `WINDOWS_X64`, and
  `UBUNTU_X64`; `UNSUPPORTED_TARGET` and `UNKNOWN_TARGET` can never carry a
  certified tier.
- A support tier is a reviewed claim, never a self-asserted request field: a
  certified reviewed tier requires a completed independent review, an
  evaluated commit and tree, a reviewer identity, evidence references, and a
  measured native run.
- A missing, unevaluated, or unavailable local-AI runtime degrades AI features
  only; it cannot reduce the reviewed deterministic core tier.
- Only Chrome stable on a certified target is expressible as certified.
- Platform evidence is synthetic-only and references every artifact by digest.

This changes no support state. Every first-release target row above remains
`NOT_YET_IMPLEMENTED`, no compatibility row was added, no model profile is
accepted, and `CROSS_PLATFORM_CORE` remains `NOT_EVALUATED`. Defining a
contract is not evidence that any platform behavior works.

## Governance and ownership

- Typed platform contracts: `M01-W07` — delivered; see
  `packages/contracts/M01-W07.md`.
- Lifecycle/path/process packages: `M03-W07` through `M03-W10`.
- Native secure stores and portable backup: `M04-W07` through `M04-W10`.
- Platform model capability and fallback: `M05-W13` through `M05-W16`.
- Cross-platform rendering: `M10-W07`.
- Native-messaging registration/E2E: `M17-W07` through `M17-W10`.
- Native release candidates, full-AI certification, updater, and Gate D:
  `M27-W08` through `M27-W12`, with the explicit terminal order
  `M27-W01…W11` → `M27-W13` → `M27-W14` → `M27-W12`.

Gate D must be evaluated at the final accepted M27 content tree. If an
intervening change is claimed gate-neutral, M28 remains blocked until the
independent re-anchoring record is explicitly accepted. An experimental
provider decision of `DISABLED_BY_POLICY` is valid and must leave every
certified-platform and core-readiness obligation unchanged.

Detailed matrices live under `docs/platform/`. Compatibility claims require a
dated evidence reference and remain `NOT_YET_IMPLEMENTED` until their owning
packages genuinely run.
