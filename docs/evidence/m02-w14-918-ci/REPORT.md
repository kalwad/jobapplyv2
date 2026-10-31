# 918dedb CI retention and scoped outcomes

GitHub run 38970154103, attempt 1, PR #1, head 918dedb3fc379e1fc19cf6ef54bbefa1110b35d3 finished **FAILURE**. Ubuntu job 117206260841 and macOS job 117206260362 succeeded; Windows job 117206260868 failed during Python execution/capture.

Every completed job log records checkout of PR merge commit 3781e31a17013ae361f14f371502196a7f516245. Its Git tree bd9eb473719dba61ed842c266c553e334c893538 exactly equals the 918 head tree, verified from GitHub Git/run metadata. The tested commit is distinct from the PR head; no result is attributed to a later source or undo-race correction.

Ubuntu and macOS each have all 19 ACTIVE suites PASS, visual NOT_YET_APPLICABLE, aggregate exit 0 and tracked-clean assertion SUCCESS. Python passes 1454 cases in 490.22 s on Ubuntu and 547.09 s on macOS. Windows has no final pytest or aggregate summary: its available downloaded job log ends the Python traceback when the runner itself cannot write its diagnostic log because the disk is full. Its tracked-clean assertion is SKIPPED. The artifact-upload step reports no matching files and the final run artifact inventory is empty.

## Native Windows compiler scope

The native Windows log records infrastructure.test.ts 8/8 PASS in 2746 ms (line 1210), complete contracts 2524/2524 PASS (line 1229), and a second infrastructure 8/8 PASS in 2405 ms (line 1420). Its exact source is snapshotted and bound to Git blob f1955c6fabbfaac7828e05bbc3b752c0efc463f1 / SHA-256 27f8d2e1578bdcb2b236f0684cd083518252163480b366508ca8cd16053ecc00. It requires a valid compilation using the resolved absolute pinned compiler before unchanged invalid-source rejection, timing bounds and mandatory cleanup. This remains native confirmation of that narrow correction, independently of the failed aggregate.

## Corrected waiver cases and capacity failure

Windows collected exactly 1452 Python cases. Its 201-node status-validator collection and 201 sequential progress symbols match. The five formerly failing Unicode waiver cases map to pass symbols at zero-based indices 176, 177, 178, 181 and 182. The first setup error is index 183, test_gate_v2_waiver_refuses_invalid_owner_decision_row[missing]. The file reports 183 pass symbols and 18 setup-error symbols. This named outcome is derived from canonical collection order plus sequential pytest progress, not from a retained final pytest summary; windows-five-waiver-progress.json preserves the exact mapping and raw line numbers.

The first available setup stack identifies test_validate_status.py:117, shutil.copytree(REPO_ROOT / "docs", repo / "docs"). The runner then reports "There is not enough space on the disk" while writing C:\actions-runner\cached\2.337.0\_diag\blocks at raw line 7503. The available log is complete as downloaded, but the producer lost the remaining traceback/suite summary because its diagnostic storage was exhausted. No 1452-case pass or 19-suite Windows pass is claimed.

The subsequent contact-guard file shows ..F......... Collection-order mapping identifies test_w14_contact_child_environment_is_narrow_and_parent_flags_do_not_mutate as the failing node. Its stack is absent, so its cause is unresolved; it is not automatically attributed to disk exhaustion. windows-contact-progress.json preserves that scope separately. No retry was requested.

Source snapshots from the exact 918 commit cover the compiler fixture, waiver fixture, contact guard and verifier. Git blob hashes and SHA-256 values are independently checked in source-files.json. No production parser or encoding policy is changed by this retention task, and no root file, ignored output, build or test activity was performed. The new independent undo-race review remains a separate scope; successful CI on this tree does not resolve it.
