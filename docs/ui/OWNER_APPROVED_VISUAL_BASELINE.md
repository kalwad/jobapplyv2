# Owner-Approved Visual Baseline

Revision-scoped approval ledger required by JAPP-MASTER-001 v1.4. This is an
empty governance scaffold, not a visual baseline approval. A row may become
`APPROVED` only with a repository-controlled fixture or screenshot, its
SHA-256, complete capture parameters, an explicit owner decision, and a dated
change-history entry.

## State vocabulary

- Baseline state: `NOT_YET_APPLICABLE`, `CAPTURED`, `REVIEW_READY`,
  `APPROVED`, or `REJECTED`.
- Owner decision: `NOT_APPROVED`, `APPROVED`, or `REJECTED`.
- M00-W11 requires every row to remain `NOT_YET_APPLICABLE` /
  `NOT_APPROVED`.

## Surface ledger

| Surface ID | Owner package(s) | Baseline state | Fixture/screenshot | SHA-256 | Viewport | Zoom | Theme | Token version | Approval date | Owner decision | Exceptions | Change history |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `DESKTOP_SHELL` | `M03-W01`, `M03-W11` | `CAPTURED` | docs/evidence/m03-w01-shell/desktop-home-1120.png | sha256:8beb5880b774cdfef9ab4a3765029b7cc1272d0e7b0ad288274850351ad662d1 | 1120x760 | 100% | light | M03-W01-initial | — | `NOT_APPROVED` | — | M03-W01: actual controlled renderer capture; source sha256:e47ae5a0af9df8327fedadd483613d4c62fb97d476ae6731e70c828502d8b628; final freeze remains M03-W11 |
| `HOME_DASHBOARD` | `M03-W11`, `M33-W07` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `JOBS` | `M33-W07` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `TRACKER` | `M25-W08` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `DOCUMENTS_RESUMES` | `M09-W07`, `M12-W07` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `PROFILE` | `M08-W07` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `SETTINGS` | `M05-W17`, `M27-W13`, `M27-W14` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `EXTENSION_DEFAULT` | `M17-W01`, `M17-W11` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `EXTENSION_AUTOFILL` | `M17-W11` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |
| `EXTENSION_REVIEW_UNRESOLVED` | `M17-W05`, `M17-W11`, `M34-W07` | `NOT_YET_APPLICABLE` | — | — | — | — | — | — | — | `NOT_APPROVED` | — | M00-W11: row created; no capture or decision |

## Capture and change contract

Capture metadata must include an exact repository revision, stable fixture,
viewport width and height, zoom percentage, theme, operating system when
material, browser/runtime when material, token version, and SHA-256 of the
artifact. The artifact must live in a future specification-approved evidence
location. A changed fixture, token version, viewport, or material component
invalidates the prior row until the owner explicitly re-approves it.

No screenshots, hashes, approvals, or visual pass results exist at M00-W11.


## M03-W01 initial capture — 2026-10-18

DESKTOP_SHELL is CAPTURED and NOT_APPROVED. Parameters, original bytes and exact UI source inventory are retained in docs/evidence/m03-w01-shell/captures.json. This uses shipping components with a synthetic version loader in the isolated renderer; actual native version IPC and keyboard behavior were inspected separately through CUA in the packaged macOS shell. The initial layout is not a frozen design system, a human task study, or a final M03-W11 visual approval. Historical M00-W11 no-capture statements above retain their original scope.
