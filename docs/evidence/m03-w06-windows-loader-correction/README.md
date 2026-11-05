# Windows loader correction candidate

This finite packet binds eight actual source postimages over commit19762e2 and
the executed affected Python and native checks. It is a candidate for actual
Windows CI evaluation; KI-0109 remains IN_PROGRESS.

The Windows/MSVC build adds the pinned Common Controls v6 manifest to link
arguments used by library tests. The original failed executable was not
retained, so its actual missing DLL/export and the failure cause remain
unobserved. Windows resource merging and the candidate fix require execution.

Failure-only diagnostics preserve canonical failure, allow at most eight
existing desktop PE inputs/512MiB, and use bounded SDK inspection. That input
bound does not bound all diagnostic output bytes. System32/SxS export candidates
are not actual loader resolution. No tested PE is launched, DLL loaded or
copied, test rerun, or PATH patched by that diagnostic. PowerShell and SDK
execution are unverified on this Mac.

The six Python/policy commands exit0, including544 affected tests and the exact
1689-case collection. All15 native commands exit0 on macOS;183 identical cases
pass in each of three modes under default parallel execution. Source1919 and
runtime40 maps remain unchanged during their respective checks. The inventory
is updated afterward with exactly10 collected additions, no removals, and the
same two POSIX cases. Strict loader derivation for all three platforms is not
Windows test execution. These are component results, not a new full run.

`artifacts.json` binds the selected archive, exhaustive member manifest and
eight source postimages. Original wrong-cwd Ruff/source-observer failures are
retained. Selected primary-source fetch receipts are included; raw HTML/crate
bodies stay outside this packet. Historical hosted failure is preserved in
`../m03-w04-hosted-ci`. Independent actual-adoption review follows separately.

Independent combined actual-adoption/data/record review CLEAR50/50 is retained
in `actual-review-and-record-checks.tar.gz`, alongside all four existing
record-check receipts. Its initial32/33 working-path timing observation is
preserved. Source snapshots bind bytes; runtime snapshots also bind modes.
Final status/traceability/diff checks follow this factual receipt append.
