# Model Runtime Profiles

Planning and future-evidence register. No platform model profile is accepted
by M00-W08.

| Platform | Current support | Full-AI profile acceptance | Current evidence | Early owning package(s) | Final acceptance owner |
|---|---|---|---|---|---|
| `macos-arm64` | `NOT_YET_IMPLEMENTED` | `NOT_ACCEPTED` | — | M05-W01…W13 | M05-W06/M05-W12 |
| `windows-x64` | `NOT_YET_IMPLEMENTED` | `NOT_ACCEPTED` | — | M05-W13, M05-W14, M05-W16 | M27-W10 |
| `ubuntu-x64` | `NOT_YET_IMPLEMENTED` | `NOT_ACCEPTED` | — | M05-W13, M05-W15, M05-W16 | M27-W10 |

## Sequencing contract

1. `M05` accepts the primary Mac full-AI profile and defines the common
   versioned profile contract.
2. `M05` validates native Windows/Ubuntu capability detection, explicit
   no-model behavior, insufficient-hardware handling, and feasible candidate
   paths when suitable hardware is available.
3. Missing qualifying Windows/Ubuntu full-AI hardware in `M05` does not block
   Gate B or `M06`.
4. `M27-W10` must later accept at least one full-AI Windows profile and one
   full-AI Ubuntu profile using the frozen factuality/structured-output
   corpus.
5. Gate D cannot pass unless all three platform rows are `CERTIFIED_FULL`,
   their acceptance is `ACCEPTED`, and each has a real evidence reference.

No artifact digest, accelerator result, driver bound, benchmark, latency,
memory result, or compatibility claim is recorded until the owning package
runs it.
