# Download-only prepare runs for b4b5b96: both refused by the Debian index line bound

Both root requests bound to the exact b4b5b96 package artifacts (hosted run 41139850970) were accepted by their authorize jobs, and both download-only jobs then failed closed with the same parser refusal. No archive was installed, no VM was started and no product actor ran in either run (`install_vm_product_actors 0`, `vm_started false`).

| Run | Request commit | Jobs | Failure |
|---|---|---|---|
| [41147070404](https://github.com/kalwad/jobapplyv2/actions/runs/41147070404) prepare unreviewed GNOME dependency candidate | `3f2a7d3` | authorize success; download-only failure | `ValueError: Debian index line/stanza exceeds bound` (`gnome-closure.json`); source guard: 2468 source files, bytes/modes/head/tree/status unchanged |
| [41147235484](https://github.com/kalwad/jobapplyv2/actions/runs/41147235484) prepare unreviewed Windows11 media and host-tool candidate | `7ac6bda` | authorize success; guest-source-checks success; download-only failure | the same `ValueError` while resolving the signed APT host-tool candidate (`windows11-closure.json`) |

Cause, from the GNOME candidate's retained indexes (`gnome-index-line-observations.txt`): Ubuntu noble's universe `Packages` index (`packages-003`, 73,379,142 bytes; the signed noble Release lists exactly this size and SHA-256 for `universe/binary-amd64/Packages`) has exactly one line longer than the parser's 65,536-byte `LINE_CAP`, the 70,841-byte `Provides` field of `librust-winapi-dev`; that stanza is 71,854 bytes, far below the 1 MiB `STANZA_CAP`. The Windows 11 host-tool path resolves through the same `ubuntu_gnome_prepare.resolve` and parser (`scripts/windows11/windows11_candidate.py`); its indexes were not retained, but both runs' gpgv records verify the same three signed Release files with identical signing times (noble's signed 2024-04-25), so its noble universe index is the same file.

The Windows 11 run did download the official evaluation ISO anonymously before the refusal: 8,225,329,152 bytes, SHA-256 `bc3f24086ebadc94489066b5ad78089e2cf5c3491e90e790bb81a2b199c10e38` (`windows11-media-download.json`; `windows11-media-lock.json` stays `UNREVIEWED`, the ISO is not retained and a later campaign must re-download the identical digest). Media acceptance falls under OD-038.

`run-metadata.json` keeps both runs' jobs, conclusions and artifact IDs/digests. Correction: KI-0145.
