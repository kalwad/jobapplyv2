# Independent review of the KI-0145 correction (separate context, read-only)

Reviewer: a general-purpose subagent given the diff, the retained candidate data and the evidence packet; 2026-10-31UTC. Verbatim final report follows; its single blocking finding (noble main versus universe) is corrected in the committed text.

**Verdict: BLOCKED.** The parser change itself is sound and I'd clear it as is. The block is one factual error that appears in six places, all quick to fix: the index with the long line is noble **universe**, not noble main.

### BLOCKING
**B1. Wrong component.** `packages-003` is `universe/binary-amd64/Packages` (suite noble).
- The retained indextargets output (GNOME `command-1624.stdout`) lists targets in this order: noble main, restricted, universe, multiverse, then the same four for noble-updates and for noble-security.
- `packages-003`'s size and SHA-256 (73,379,142 bytes, `687ffc96…`) match the noble Release's `universe/binary-amd64/Packages` entry in `release-02.Release`.
- noble main is `packages-001`: 7,165,069 bytes, 6,099 stanzas, longest line 11,204 bytes.

Places that say "main":
- `scripts/linux_gnome/ubuntu_gnome_signed_indexes.py:23`, a code comment in a protected file. Fix it now, before the hosted run and the new request commits bind it.
- `scripts/tests/test_ubuntu_gnome_signed_indexes.py:47`
- `docs/KNOWN_ISSUES.md:59` (title) and `:65`
- `docs/PROJECT_STATUS.md:35`
- the evidence `README.md:10`, in two spots. Changing the README means updating its hash in `retention-manifest.json`.

This project has blocked on a false evidence sentence before, so I've treated it the same way.

### Q1 – Is raising the line bound safe and legitimate? Yes.
- **Memory:** `bounded_lines` (`:72-75`) still reads at most LINE_CAP+1 (1 MiB+1) bytes per line. The 1 MiB stanza bound is unchanged (`:47-56`), so the most a single stanza can hold in memory is the same as before. Only the read buffer grows, from 64 KiB to 1 MiB.
- **Other limits unchanged:** 256 MiB per index and 1 GiB total (`:274-277`), 2 MiB per Release file, and 256 KiB for command output (`ubuntu_gnome_vm.py:160-165`).
- **Callers:** only three, all in this file:
  - `release_entries` (`:119`), which parses Release text after gpgv has verified it.
  - the indextargets output (`:255`), which comes from local APT and is under 13 KB.
  - the Packages loop (`:298`).
- **Inputs are already authenticated:** each index is pinned and joined to the signed Release (`:274-287`) before it is parsed.
- **Nothing else depends on 64 KiB lines.** No other module parses the retained indexes. `fields()` in `ubuntu_gnome_prepare.py:112` is a separate parser with no line limit, fed by capped command output. Only package, version, architecture, filename, size and sha256 values leave the parser.
- **Legitimate fix:** deb822 sets no line-length limit, and the old 64 KiB bound rejected real signed archive data. This is a resource limit, not a safety or acceptance threshold. One side effect: the line check is now always covered by the stanza check. A mutant that removes the line check survives, as expected.

### Q2 – Tests
- **Not weakened.** The oversized case matches `exceeds bound`. The colon-less payload's own unpack error doesn't match that, so the case really does test the bound.
- **Both refusals are still covered:** an oversized line (`oversized-field`) and an oversized stanza made of acceptable lines (the new test).
- **Mutation results** (run on scratch copies):
  - Old 64 KiB cap: both new tests fail.
  - Stanza check removed: the stanza test fails.
  - Stanza bound raised to 2 MiB: three tests fail, so `LINE_CAP == STANZA_CAP == 1 MiB` is pinned.
  - No checks at all: two tests fail.
- **Results:** the suite gives 26 passed. The inventory digest (`fd565c5c…`) recomputes correctly, and the 26 collected test IDs match the inventory exactly.
- **NON-BLOCKING gaps (both existed before this change):**
  - **Size counter never reset (m6 survives):** if the size counter isn't reset between stanzas, the whole suite still passes, yet real data would then fail. A test with two 600 KiB stanzas would catch it.
  - **Unbounded `readline()` survives:** the file path through `bounded_lines` is untested. The 256 MiB per-index limit still bounds it.

### Q3 – Evidence claims
- **packages-003:** exactly one line over 65,536 bytes (librust-winapi-dev Provides, 70,841 bytes; stanza 71,854). The old parser refuses it; the new one reads all 64,755 stanzas in 0.7 s locally. `packages-001` and `packages-002` match the observations file exactly.
- **Windows failure:** same message, and it happened after indextargets; commands 244–246 are cleanup `git` calls.
- **Windows inference can be stated more firmly.** Both runs' gpgv records show identical signatures on all three Releases, including noble's 2024-04-25 15:11:21. Windows lists its targets in the same order, so its universe index is byte-identical.
- **Windows call path:** confirmed at `windows11_candidate.py:34` and `:318`. Its output folder sits in `private-work` (`:317`), which is deleted, so "not retained" is accurate.
- **Packet files:** all eight hashes and sizes match `retention-manifest.json`. The five copied records are byte-identical to the downloaded artifacts. I did not re-fetch `run-metadata.json` from GitHub.

### Q4 – Likely next failures
Every limit I could check against the retained data passes:

| Limit | Actual | Result |
|---|---|---|
| Three Release files (≤ 2 MiB) | 125–255 KB, 414/870/414 entries, single stanza < 1 MiB | pass |
| Index count (MAX_INDEXES 12) | 12 | pass |
| Each of the 12 signed index sizes (≤ 256 MiB) | largest 73.4 MB | pass |
| Total index size (≤ 1 GiB) | 136.3 MB | pass |
| Package records in the 3 retained indexes | no carriage returns, no non-UTF-8, no colon-less field lines, no invalid field names | pass |
| Selected archives (LOCK_PACKAGE_CAP 2048) | 808 | pass |
| Archive total (6 GiB) | 392.5 MB, largest 40 MB | pass |
| GNOME final inputs (5,000 files, 8 GiB, 512 MiB each) | projected about 1,100 files, about 1 GB | headroom |
| Windows final inputs (6,000 files, 2 GiB) | about 55 MB of debs + 136 MB of indexes + artifact | headroom |
| Time | about 186 s of guest commands vs 2,400 s; Windows ISO 181 s + 27 s of resolve vs 2,100 s | headroom |

**Not verifiable locally:**
- **Nine unretained indexes:** noble multiverse plus every noble-updates and noble-security index, about 55 MB. They haven't been checked against the line, stanza or field-name rules. 388 of the 808 guest archives must join there; the other 420 join in noble main. A line over 1 MiB is unlikely (the observed maximum is about 15 times smaller). If you want to cut the risk of another hour-long round trip, fetching those nine by-hash files and running the corrected parser on them locally would settle it. That needs the owner's OK to download.
- **Steps no hosted run has reached yet:** the GNOME host resolve, `extract_host_tools` (which requires regular-file tool pins), `copy_package`, the Windows `stage_host` and `tool_pin` (including whether the `OVMF_*_4M` firmware files are regular files), and the final manifests. Their numeric limits have ample headroom, but the file-type checks can't be verified without the debs.

### Q5 – KI-0145 accuracy
Accurate except for B1. Two NOTES:
- The GNOME run finished around 2026-10-30T23:57Z and the Windows run around 2026-10-31T00:01Z, so "Discovered … 2026-10-31UTC" is borderline but defensible.
- The README could cite the matching gpgv signatures as direct support for the Windows inference.

My check scripts are in `/private/tmp/claude-501/-Users-tanishkalwad-jobapplyv2/17ee071f-b2d5-4e6f-a57e-209b35ae06c1/scratchpad/review-ki0145/` (`verify.py` for the data checks, `mut/` for the mutants). Nothing in the repository was changed.
