# Review of the 2100780 Windows 11 candidate: not released

Source S `2100780385817ca71a3be892f7d250deefb1b79c` (tree `e111a168…`) differs from the reviewed and campaigned a03aadf only by the KI-0175 attestor-wait correction, its tests and pins, and docs/evidence.

**Package:** merge M `fdba3c3d…` from hosted run 41538198385.
- Attempt 1 passed macOS and Ubuntu; its Windows verify was cancelled by the 60-minute job limit (KI-0172).
- Attempt 2 is terminal SUCCESS, with both native package jobs passing.

**Candidate:** download-only prepare run 41554286753 (request commit `b802f8f`), artifact 13193836341, ZIP sha256 `a8f47613…`.
- Its guest source checks parsed and compiled the guest driver under Windows PowerShell 5.1.26100 on hosted Windows.
- It installed nothing and started no VM.

A multi-agent workflow (wf_3d706db2-168) ran the review: 32 read-only agents, each with separate context, launched by the implementing session. They are not owner-independent.
- Eight lenses: bundle, media, host tools, guest driver, the KI-0175 correction, the never-run guest phases after `environment`, the answer file and seed, and the preparation record.
- Two refuters for every actionable finding, a completeness critic, and a final reviewer.
- Full output: `review-workflow-result.json`. Decision record: `review-decision.json`. The four candidate files the release would have bound: `bound/`.

## Decision: DO_NOT_RELEASE

Integrity and provenance are clear:
- The bundle audit passes and a negative control is refused.
- The original package copy equals ZIP `1628e749…`, manifest `0396ddf4…`.
- The guest-driver bytes equal S and its pins.
- All three InRelease signatures verify in pure Python under the 2018 Ubuntu archive key.
- All 117 debs and every tool and firmware pin match.
- The publisher digest still lists the locked ISO `bc3f2408…`.
- The prepare record is download-only.

Differences from the a03aadf candidate, all explained:
- publisher page telemetry bytes;
- the prepare runner CPU, which is recorded only;
- refreshed noble-security indexes.

No deb, tool or firmware pin changed. Candidate hashes, not released:

| File | sha256 |
|---|---|
| bundle | `a75deebc…9eb49` |
| media lock | `1f4350a5…749a0` |
| host tools | `54f89a44…4a59e8` |
| guest driver | `9659a295…a9fdf` |

The release is refused for one blocking harness defect, KI-0177.
- Windows 11 opens the Start menu by itself at first logon, and it holds the foreground for the whole guest window. This was seen in all post-logon frames of diagnostic rounds 34 and 35, and in the a03aadf campaign's `win11-failure.png`. In those frames the console's taskbar button shows refused activation.
- The guest's first foreground assertion, `Capture` in `Snapshot 'ready'`, has no retry and no mitigation, so the campaign would very likely fail closed at `ready`.
- The implementer viewed r35 frame-66 and the a03aadf failure frame and confirms the observation.

Surviving non-blocking findings, to fix in the same correction:
- KI-0178: COM2's 500 ms write timeout is unmeasured against the roughly 10.8 KB keyboard receipt.
- KI-0179: the fixed 300 s guest budget leaves little margin after a late attestation, for phases never measured on 2 nested vCPUs. With no input, the display blanks about 330 s after logon, which would break framed phases if the budget grows.
- KI-0176 (open): the bound source check does not parse the attestor here-string.
- KI-0173: the licence-expired watermark also appears in the a03aadf campaign frame.

Critic process notes:
- `review_evidence_sha256` must be the sha256 of a committed decision record.
- A PR push while a release run is pending can cancel it.
- The candidate and package artifacts expire on 2026-11-10.
- A runner-image rollover fails closed before the ISO download.
