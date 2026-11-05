# ADR-0009 Windows 11 host closure: separate reviews and mutation evidence

This packet covers the source change that implements ADR-0009 for the Windows 11 host-tool closure (KI-0189). The prepare resolves the closure against a copy of the hosted runner's dpkg status and records the runner-provided packages, and the campaign re-checks them.

The changed sources are:
- scripts/linux_gnome/ubuntu_gnome_prepare.py:
  - `resolve(..., runner_status=True)`, which copies the runner's status and requires every root to be downloaded;
  - the dependency walk: `paragraphs`, `relation_groups`, `providers`, `installed_status`, `runner_provided` and `installed_rows`.
- scripts/linux_gnome/ubuntu_gnome_host.py: the `closed_install_plan` docstring only.
- scripts/windows11/windows11_candidate.py:
  - the v2 host-tools lock;
  - the retained `runner-dpkg-status` and its digest check;
  - a named runner image.
- scripts/windows11/windows11_vm.py: the campaign's v2 lock, row and image checks, and the runner-provided re-checks before the simulated install and after the real one.

The tests in scripts/tests/test_ubuntu_gnome_review_regressions.py and scripts/tests/test_windows11_host_runtime.py, and the exact Python test inventory, changed with them. The real-runner rounds 51 to 54 are in docs/evidence/m03-native-runtime-diagnostics (windows-host-closure).

## Reviews

Each review is a separate-context workflow that the implementing session launched, so none is an owner-independent review.

### Review 1: `wf_8b1c4c96-433` (`review-1-workflow-result.json`)

The review used 37 agents: four lenses (resolver semantics, campaign re-check, ADR conformance, test quality), two refuting verifiers per finding and a completeness critic.

Of 16 findings, both verifiers refuted one; 15 survived at least one verifier, four of them blocking. The critic added four more, one of them blocking; no verifier checked the critic's findings. Each is corrected:
- **Parser:** the status parser was stricter than dpkg. It split lines at characters other than LF and rejected dpkg-legal names, so one unrelated runner package could fail every candidate.
- **Roots:** a root that apt does not re-download was recorded nowhere.
- **ADR text:** the lock did not record each package's dpkg status, as ADR-0009 says it does.
- **Discarded evidence:** the status the walk used, and its hash, were discarded before review.
- **Untested paths:**
  - the copy-before-apt ordering;
  - the post-install re-check;
  - every-alternative and lock-only relations;
  - several other refusals.
- **Records and smaller defects:**
  - a stale docstring;
  - the GNOME scope was unrecorded;
  - the ADR registry row was missing;
  - an unnamed runner image matched an unnamed one;
  - the v1 test did not send a real v1 lock.

One part of one finding is recorded rather than fixed: the Windows roots acl and python3 are installed on the runner, yet they are downloaded from the archive like every root. An archive update to either one, ahead of the image, still fails the prepare closed. This is recorded in KI-0189 and in ADR-0009's implementation note.

### Review 2: `wf_3c8d4e79-2d4` (`review-2-workflow-result.json`)

The review used 38 agents: five lenses (review-1 dispositions, the resolver on a real runner, candidate and campaign, truth of the records, test quality and mutation), two refuting verifiers per finding and a completeness critic. It replayed the resolver offline over round 52's real runner status and recorded dpkg output: all 1213 paragraphs parsed, and the walk gave the same 88 rows as the lock.

All 16 findings survived at least one verifier. One was blocking: TEST_EVIDENCE said the critic's findings had survived verification. The critic added three more. Each is corrected:
- **Records:**
  - the "every finding corrected" wording, against the acl/python3 limit;
  - the runner image's two labels (job-log banner against `ImageVersion`);
  - the mutant result listed among the real-runner results;
  - the two unaccounted artifact members;
  - the extracts' provenance;
  - the manifest scope;
  - the mypy file count.
- **Tests:**
  - an architecture-`all` row and an architecture change at the campaign;
  - a purged runner package;
  - the copy-time size bound;
  - GNOME's empty-status calls;
  - the walk and hash reading the private copy;
  - non-UTF-8 runner status bytes.
- **Diagnosability:** refusals now name the package or line, and the candidate keeps the runner status when resolution refuses.

### Review 3: `wf_c6d10595-e2a` (`review-3-workflow-result.json`)

The review used 22 agents: three lenses (review-2 dispositions, truth of the records, the code and test changes after review 2), two refuting verifiers per finding, and a completeness critic whose findings were also verified. It re-ran the mutant set and recomputed both retention manifests.

It found 5 findings and 4 critic findings, each surviving at least one verifier; none was blocking. Each is corrected:
- **Empty placeholder:** a refusal before the runner's status was copied could leave apt's empty placeholder retained as `runner-dpkg-status`. Now only a status byte-identical to the runner's own is retained.
- **Overstated records:** that only what the image lacks is downloaded (acl and python3 are too); the failing prepare's `ImageVersion`, which was not recorded; the reason python3 is downloaded; and the scope of the over-approximation (it covers declared relations only).
- **Test gap:** a virtual name that only two runner packages provide.
- **Small fix:** the mypy line.

### Final check: `wf_9f7f0884-cc0` (`review-4-workflow-result.json`)

The check used 21 agents: two lenses (the review-3 fixes, and the truth of every changed record), two refuting verifiers per finding, and a completeness critic whose finding was also verified. It found 8 findings and 1 critic finding, each surviving at least one verifier; none was blocking. Each is corrected:
- **Status retention:** it compared the private copy with the live runner status, so it would have dropped the copy in exactly the refusal it exists to explain. resolve() now replaces the empty placeholder atomically with a complete copy, and any non-empty private status is retained.
- **Tests:** a success with nothing retained is refused, retention never raises, and a runner package's own Pre-Depends is walked.
- **Wording:**
  - Essential packages: dpkg and tar are walked and recorded; only undeclared ones rely on the image version alone.
  - The `closed_install_plan` docstring.
  - Which round ran which sources.
  - Two README phrases.

## Mutation

`mutants.py` applies 68 mutants (52 after review 1, then 11, 2 and 3 more after reviews 2, 3 and 4) to a copy of the repository: one or more exact edits in one source each, then the relevant test file, then the exact source bytes restored. Run it as `python3 -I -B mutants.py <copy-of-repository-root> <python-with-pytest>`.

Before the final test changes, 50 of 52 were killed. The two survivors were redundant-looking checks that change only the refusal:
- the campaign's installed-status check;
- the row type check.

The drift test now pins each case's exact refusal, and the row test includes a non-iterable row. `mutants-result.txt` is the final pass over the sources and tests as committed.

## Real-runner rounds

Rounds 51 to 54 in docs/evidence/m03-native-runtime-diagnostics (windows-host-closure) ran the resolver on hosted runners. Round 54 ran the sources this packet's commit carries.
