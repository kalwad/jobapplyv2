# Independent review of the 10f247b native candidates: GNOME and Windows 11 released

Source S `10f247bc441036233963004d1d663cd80e3a0212` (tree `bb8fb0d4…`), package merge M `c25742ef…` from hosted run 41356786386.
- Attempt 1 failed only the Windows e2e-browser suite (KI-0170).
- Attempt 2 is terminal SUCCESS on macOS, Ubuntu and Windows, with both native package jobs passing.

Download-only candidates (neither run installed anything or started a VM; see `run-metadata.json`):

| Platform | Prepare run | Request commit | Artifact | ZIP sha256 |
|---|---|---|---|---|
| GNOME | 41367416097 | `4938c11` | 13106829926 | `ac3e3f91…` |
| Windows 11 | 41367514098 | `060882c` | 13109055698 | `71bae73b…` |

The Windows run's guest source checks parsed the guest scripts and compiled the C# under Windows PowerShell 5.1 on hosted Windows.

An independent multi-agent workflow ran the review: 19 separate-context, read-only agents, with nine lenses, two adversarial refuters for every actionable finding and one final reviewer per platform.
- Its complete output is `review-workflow-result.json`.
- The decision record that the release receipts bind is `review-decision.json`; its SHA-256 is each receipt's `review_evidence_sha256`.
- `bound/` holds the exact bytes of every file a receipt pins.

## GNOME: RELEASE_ONE_BOUND_CAMPAIGN

All four lenses returned CLEAR_WITH_NOTES. Bound hashes, recomputed by the final reviewer:

| File | sha256 |
|---|---|
| bundle | `ac34c896…e14c` |
| guest closure | `193416ec…d41e` |
| host tools | `4c3552e2…a447` |
| cloud-image keyring | `c2d40d92…2f2f` (unchanged from a5ec1e3) |

- All six retained InRelease signatures were verified independently in pure Python against the Ubuntu Archive 2018 key.
- The package export is byte-identical to the CI artifact.
- The host package set equals the a5ec1e3 release apart from the added setfacl pin.

One finding survived adversarial checking, as NON_BLOCKING; both skeptics would lower it to NOTE. The prepare-time gpgv check does not pin the signing key, although this candidate's signatures were all verified against the 2018 key. Pinning VALIDSIG is a later hardening.

Notes carried with the release:
- The host lock pins runner ImageVersion 20261026.354.1. Diagnose a stop from the environment value, not the log banner.
- review_state labels inside the bound files still read UNREVIEWED, and nothing consumes them. Authorization exists only in the receipt.
- The campaign re-checks hashes, not the signed apt chain. That chain is frozen by the bound locks.

## Windows 11: RELEASE_ONE_BOUND_CAMPAIGN

All five lenses returned CLEAR_WITH_NOTES. Bound hashes, recomputed by the final reviewer:

| File | sha256 |
|---|---|
| bundle | `902c783d…b2ed` |
| media lock | `c18dc337…c19c` |
| host tools | `b6f70b31…ba06` |
| guest driver | `1a31fd23…7b35` |

- The ISO digest `bc3f2408…` matches Microsoft's published value for the Windows 11 Enterprise Evaluation x64 en-US image that OD-038 covers.
- The guest controller files equal the repository at S.
- KI-0146 and KI-0147 were both checked fixed at S: the lifecycle `--bundle` path matches the artifact's `retained/` prefix, and every host step runs on Linux.

Three findings survived adversarial checking as NON_BLOCKING:
- The bootstrap's embedded SYSTEM attestor had never been parsed before a campaign. Before release, `pre-release-check/` parsed it, without running it, with Windows PowerShell 5.1.26100 on hosted windows-2025 (scratch-branch run 41370879234). The 49-line body (sha256 `9e212bae…`) and the outer file both have zero parse errors.
- wimtools and swtpm-tools are installed as root but never executed by the campaign.
- The release window is limited:
  - the artifacts expire 2026-11-09T00:26:34Z;
  - the runner ImageVersion must be 20261026.354.1;
  - the hosted CPU must be the reviewed AMD EPYC 7763; any other CPU fails closed before the ISO download and needs a new request and release.

Further notes:
- At the prepare run's measured speed, the campaign's ISO re-download (1162 s) uses about 35% of the 3300 s work budget. A timeout stays fail-closed.
- The answer file's ProtectYourPC=1 on the offline, disposable VM is outside OD-038's licence wording but has no effect.

## Limits

This review authorizes exactly one bound campaign per platform, at S and the hashes above. Any change to a script, workflow or bound file requires a new candidate and review. No campaign has run yet.
