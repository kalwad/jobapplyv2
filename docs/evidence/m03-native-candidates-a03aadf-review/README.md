# Independent review of the a03aadf Windows 11 candidate: released

Source S `a03aadf22ab83c9b39bc03f5387eaa0a702ebf27` (tree `7a96092b…`) differs from the previously reviewed 10f247b only by the KI-0171 answer-file correction (ModifyPartition Order numbered 1, 2), its test, and docs/evidence. The 10f247b Windows campaign had stalled at Setup's "Select location to install Windows 11".

**Package:** merge M `d9412fd0…` from hosted run 41384168159.
- Attempt 1 passed macOS and Ubuntu; its Windows verify was cancelled by the 60-minute job limit (KI-0172).
- Attempt 2 is terminal SUCCESS, with both native package jobs passing.

**Candidate:** download-only prepare run 41395340494 (request commit `e5aa210`), artifact 13119257518, ZIP sha256 `1940176f…`.
- Its guest source checks parsed and compiled the guest driver under Windows PowerShell 5.1 on hosted Windows.
- It installed nothing and started no VM.

An independent multi-agent workflow ran the review: 11 separate-context, read-only agents, with six lenses, two refuters for every actionable finding and a final reviewer. The lenses were bundle, media, host tools, guest driver, answer file and preparation record. The first launch was interrupted after two lenses; it was resumed with the same script and run id, and completed agents replayed from cache.
- Full output: `review-workflow-result.json`.
- Decision record that the release receipt binds: `review-decision.json`.
- Exact pinned bytes: `bound/`.

## Decision: RELEASE_ONE_BOUND_CAMPAIGN

All six lenses returned CLEAR_WITH_NOTES. Bound hashes, recomputed by the final reviewer:

| File | sha256 |
|---|---|
| bundle | `ce73eddd…2a2e` |
| media lock | `d1aa8e32…4533` |
| host tools | `b6f70b31…ba06` (unchanged) |
| guest driver | `1a31fd23…7b35` (unchanged) |

- **Answer file:** the answer-file lens generated the XML from S. It confirmed the contiguous ModifyPartition order, the image name and the install target. The XML differs from 10f247b's by one byte and equals the redacted structure that reached the desktop in diagnostic round 32.
- **Media:** unchanged. The ISO digest `bc3f2408…` matches Microsoft's published EN-US x64 Enterprise Evaluation value covered by OD-038.

Two findings survived adversarial checking and are filed:
- **KI-0173 (NON_BLOCKING):** round-32 desktops of the pinned evaluation image showed "Windows License is expired". It cannot produce a false PASS.
- **KI-0174 (verifiers lowered it to NOTE):** prepare-time gpgv does not pin the signing key, although all signatures verify against the 2018 Ubuntu archive key.

Conditions carried with the release:
- **Window:** dispatch before 2026-11-09T05:26:14Z, when the original package artifact expires.
- **Runner:** ImageVersion must be 20261026.354.1 and the CPU must be AMD EPYC 7763; other CPUs fail closed before any download.
- **Untested path:** the specialize bootstrap running as SYSTEM has never executed in a Windows 11 VM. A failure there fails closed.
