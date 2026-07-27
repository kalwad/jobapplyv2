# Experimental AI Providers

Canonical provider-governance memory introduced by JAPP-MASTER-001 v1.4.
M00-W11 defines policy and future proof obligations only. It adds no provider
implementation, OAuth flow, endpoint, credential, token, model selection,
network request, data egress, routing, or production configuration.

## Core provider contract

- Ollama is the mandatory local provider and product default.
- `M05-W03` owns the future provider-neutral typed boundary and local Ollama
  adapter before Gate B.
- There is no silent provider fallback. A selected provider failure must remain
  explicit and must not redirect content or credentials to another provider.
- Experimental providers are non-core, disabled by default, and may not become
  a release dependency or a prerequisite for local workflows.
- `DISABLED_BY_POLICY` is a valid final outcome and must not degrade core
  readiness or Gate D.

## Provider registry

| Provider ID | Classification | Default state | Implementation state | Evaluation state | Ship decision | Release support | Core dependency | Owning package(s) |
|---|---|---|---|---|---|---|---|---|
| `OLLAMA_LOCAL` | Mandatory local default | `ENABLED_LOCAL_DEFAULT` | `NOT_IMPLEMENTED` | `NOT_EVALUATED` | `REQUIRED_FUTURE_CORE` | `REQUIRED_FUTURE_CORE` | `LOCAL_CORE` | `M05-W03`, `M05-W17` |
| `CHATGPT_ACCOUNT_OAUTH` | Experimental external provider | `DISABLED_BY_DEFAULT` | `NOT_IMPLEMENTED` | `NOT_EVALUATED` | `NOT_EVALUATED` | `NOT_SUPPORTED` | `PROHIBITED` | `M27-W13`, `M27-W14`, `M27-W12` |

`CHATGPT_ACCOUNT_OAUTH` must remain `DISABLED_BY_DEFAULT / NOT_IMPLEMENTED /
NOT_EVALUATED` through M00-W11. This registry deliberately contains no
endpoint, credential, access token, refresh token, model identifier, OAuth
client identifier, scope, egress destination, or production secret path.

## Future package order and authority

1. `M05-W03` creates the provider-neutral boundary with local Ollama as the
   explicit default and a fake external-provider test seam.
2. `M05-W17` performs final provider-boundary regression and Gate B
   re-anchoring. Earlier Gate B evidence cannot remain stale.
3. `M27-W13` may prototype an isolated ChatGPT-account OAuth provider only
   behind a default-off feature boundary.
4. `M27-W14` independently reviews then records `ENABLED_EXPERIMENTAL`,
   `DISABLED_BY_POLICY`, or another specification-permitted fail-closed
   decision.
5. `M27-W12` executes last, after `M27-W01` through `M27-W11`, `M27-W13`, and
   `M27-W14`, and audits the final M27 content revision for Gate D.

Only an accepted, revision-scoped M27-W14 decision may represent an
experimental provider as release-supported. `NOT_EVALUATED`,
`DISABLED_BY_DEFAULT`, `NOT_IMPLEMENTED`, and `DISABLED_BY_POLICY` must never
be rendered or interpreted as support.

## Future security, consent, and evidence obligations

Any experimental-provider implementation must, before enablement:

- store secrets only through the platform `SecretStore`; plaintext fallback is
  prohibited;
- use explicit per-provider consent, revocation, account-state, and data-egress
  disclosure;
- provide a default-off kill switch that cannot disable or reroute local
  Ollama workflows;
- enumerate transmitted data classes, destinations, retention assumptions, and
  provenance in the provider compatibility and egress evidence;
- pin and audit provider/runtime dependencies, SBOM effects, native networking,
  token handling, logs, crash output, and support boundaries;
- independently re-check then-current provider terms, security constraints,
  platform compatibility, and release policy at `M27-W14`;
- prove zero plaintext provider credentials, zero silent fallback, zero core
  outage dependency, and zero enablement without an accepted ship decision.

The development-only Codex login file `~/.codex/auth.json` must never be used
as a production application credential source.

## Current migration state

- Governance owner: `M00-W11`
- External providers enabled: none
- External provider implementations: none
- Terms/security reviews: none
- Credentials or tokens recorded: none
- Network or model requests added: none
