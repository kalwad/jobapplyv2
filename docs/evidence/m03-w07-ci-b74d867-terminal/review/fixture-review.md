# Independent review of the KI-0144 status-fixture change (separate context, read-only)

Reviewer: a general-purpose subagent given the diff, the failure extract and the precedent claim; 2026-10-30UTC. Verbatim final report follows.

**Verdict: CLEAR_WITH_NOTES.** The change is a legitimate premise-isolation fix. It hides no validator behaviour, and the precedent claim holds. I found nothing blocking. I made no edits to the repository.

**1. Premise isolation versus hidden behaviour: NOTE, no problem found**
- The diff touches only fixture helpers: `scripts/tests/test_validate_status.py:91`, `:194` (inside `resolve_corrective_issues`, `:188-197`) and `:349` (inside `prepare_m02_w06_pre_governance`, `:341-355`). `scripts/validate_status.py` has no diff, and no assertion or test was added or removed.
- These tests still prove the blocker rules. Each starts from `activate_corrective_blockers` (`:405-421`), which marks everything FIXED and then reactivates the synthetic KI-0029…0031:
  - `test_blocking_issue_omitted_from_live_blockers_is_rejected` (`:1105`): a HIGH IN_PROGRESS issue missing from the live blockers is rejected.
  - `test_omitted_blocker_still_enforces_affected_milestone_scope` (`:1116`).
  - `test_blocker_cannot_coexist_with_affected_accepted_milestone` (`:1213`).
  - `test_blocker_requires_zero_ready_packages_and_next_none` (`:1225`): READY packages are rejected while a live blocker exists.
- The fix makes those assertions stricter, not weaker. Before it, the generic "missing from PROJECT_STATUS live blockers" string at `:1113` could also have been matched by KI-0142's own error line.
- `test_migrated_repository_passes` (`:881`) still validates the real repo with KI-0142 live. `test_invalid_package_state_rejected` (`:1261`) keeps KI-0142 live and listed through a baseline PASS.
- I confirmed the live validator directly on cloned copies (in `/private/tmp/claude-501/-Users-tanishkalwad-jobapplyv2/17ee071f-b2d5-4e6f-a57e-209b35ae06c1/scratchpad/vs/`):
  - as-is: exit 0.
  - live blockers set to NONE: exit 1, "KI-0142 is HIGH/IN_PROGRESS but is missing from PROJECT_STATUS live blockers".
  - M03-W08 set to READY: exit 1, including "live CRITICAL/HIGH blockers require zero READY packages (found ['M03-W08'])".

**2. Are the 16 premises independent of KI-0142? Yes, all of them**
- `test_m00_may_remain_accepted_while_m01_blockers_are_live` (`:1235`): it models a reopened M01 (M01-W07 IN_PROGRESS, M02 and later NOT_STARTED). Before the fix its only error was "KI-0142 missing", because the scope check doesn't fire when M03 is NOT_STARTED. It still proves its point with KI-0029…0031, which are scoped to M01. An M03-W07 Windows packaging defect cannot exist at that point.
- `test_historical_boundary_removes_only_later_w14_findings` (`:2717`): the "only" is still proved, because `:2754-2757` asserts KI-0029…0031 stay IN_PROGRESS and the validator PASS requires their lines to be kept. KI-0142 was a confounder that `activate_corrective_blockers` left live.
- `test_m02_w06_verification_lifecycle_accepts_future_governance_state` (`:906`): the pre-governance fixture overwrites the blockers with KI-0055 only (`:354`), and `reset_downstream(M02-W07)` resolves only W14 IDs (`:824-825`). KI-0142 was therefore left unlisted. A W06-era state cannot hold an M03-W07 defect.
- The rest model a READY or ACCEPTED state from before or after KI-0142:
  - M03-W01 READY: `:1056`.
  - M01-W07 READY: `:1300`, `:1306`, `:2460`.
  - A FIXED ledger with NONE (`:1244`), which is literally that test's premise.
  - States where M03 is ACCEPTED (`:1872`, `:2327`, `:2390`, `:2542`, and `:3322` with its baseline at `:3334`). There the validator itself requires KI-0142 to be resolved, since `validate_status.py:1437-1453` forbids an ACCEPTED milestone under a live blocker.

**3. Precedent: holds**
- `git log -S` shows the same pattern three times, each adding a tuple to `resolve_corrective_issues`:
  - commit 4fb164f added `CURRENT_M02_CORRECTIVE_ISSUE_IDS`.
  - commit a744ff2 added the W14 tuple, which commits 15c7e33…730c641 then extended to KI-0096.
  - commit f4ee49e added the W07-era KI-0058…0062 to `prepare_m02_w06_pre_governance`.
- Other HIGH issues (KI-0065, KI-0070…0075, KI-0102) were filed already FIXED, so they never leaked.
- The stated reason for a separate tuple is correct. `test_w14_boundary_preserves_current_campaign_findings` (`:2762`) writes synthetic lines for exactly KI-0077…0096 and asserts every member of the W14 tuple is present (`:2801`). Adding KI-0142 to that tuple would fail it.
- There is a further semantic reason. `resolve_w14_findings_before_historical_boundary` (`:200-218`) and the W14-boundary branch (`:826-828`) would treat KI-0142 as a W14 campaign finding, which it is not.

**4. A more robust fix: NOTE**
- Resolving every live CRITICAL/HIGH issue dynamically would be riskier:
  - The fixture premise would reuse the validator's own parser, so a parsing bug would be shared by the fixture and the validator.
  - It would silently absorb future blockers, including ones that are relevant to a boundary.
  - The W14-boundary and W06 pre-governance fixtures would need exceptions.
  - It removes the tripwire that forces each new blocker to be consciously classified.
- Recommendation: keep the explicit tuples. Optionally, park a single guard test that fails with one clear message when a live HIGH/CRITICAL issue appears in no fixture tuple, instead of 16 confusing failures.
- Judged on its own, the current change is minimal and correct.

**5. Module run**
`uv run --frozen pytest -q scripts/tests/test_validate_status.py` → `239 passed in 145.88s`.

**6. Is KI-0144 accurate? Mostly: NON-BLOCKING wording issue**
- Accurate: the precedent, the resolution description, the "no assertion, test identity or validator rule changes" claim, `239 passed`, the KI-0103-class label, and the reproduction line (all 16 report "missing from live blockers").
- Imprecise: the description says the validator "refuses every modeled READY package". The extract also shows 8 × "KI-0142 blocks affected milestone M03, which cannot remain ACCEPTED". Two failing tests (`:1235` and `:2717`) contain no READY package at all and fail only on "missing from live blockers".
- Suggested wording: the fixtures replace the live blocker list, so KI-0142 is unlisted, and it also blocks modeled ACCEPTED M03 and modeled READY packages.

**Other NON-BLOCKING note**
- `docs/TEST_EVIDENCE.md` and `docs/PROJECT_STATUS.md` do not yet record the KI-0144 fixture fix or its `239 passed` command. CLAUDE.md requires `TEST_EVIDENCE.md` to hold every run command. The full Python suite rerun that KI-0144 requires is still outstanding.

The validator checks left clones of `docs` in `/private/tmp/claude-501/-Users-tanishkalwad-jobapplyv2/17ee071f-b2d5-4e6f-a57e-209b35ae06c1/scratchpad/vs/` (s1, s2, s3). They share disk blocks with the original, so they take almost no extra space. A safety check blocked my recursive delete, so they are still there for you to remove if you want.
