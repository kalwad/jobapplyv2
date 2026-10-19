# W14 public snapshot-union accounting delta

This is an outside-tree reporting-integrity fix. It changes no production driver, public authorization boundary, oracle, synthetic fact, network guard or public HTML. No public fill or browser build was executed for this delta.

`public-control-union.patch` changes six files. `control-accounting.ts` groups the union of initial and final literal identities, retains every physical snapshot observation and index, and refuses precision eligibility for initial-only, final-only or ambiguous groups. Unknown initial values remain `INITIAL_UNOBSERVED`; snapshot deltas never establish extension-write causality. Only unique literal matches provide known value/checked deltas. Literal matching does not establish DOM-node persistence; transient controls between the two observations remain unobserved.

`run-contact.ts` uses that accounting for every row. Prepared observations with unmeasurable topology receive `UNMEASURABLE_TOPOLOGY`, cannot enter the complete network-closed DOM subset, and are counted as incomplete coverage. Full-row precision, required recall, physical-change totals and unexpected nonpositive change totals are null if any aggregate row is incomplete. Known matched counts and fractions are separately named. An empty source subset also has unknown full totals. Existing incomplete document-event safety scope and null natural site acceptance remain.

The exact mandatory controlled inventory increases from 55 to 61: all 55 prior controlled identities are retained, plus six explicitly listed pure structural regressions for stable/reordered identities, final-only populated SSN, removed controls, duplicate initial identities, duplicate final identities and literal attribute drift. These six do not launch a browser. The two pure protocol tests and separate four-pure/two-browser inspection inventory are unchanged. Verification parser semantics, strict JSON identities, ordinary passes, no skips/flakiness/retries, closed argv/env grants and color-environment handling are unchanged. Existing Python test identities/common 1451 inventory are unchanged.

`paired-options-lint-for-preexecution-rebind.patch` is separate. It fixes the optional-chain lint error in the new paired candidate proof only. Apply this before the later PRE-EXECUTION runtime source rebind. It does not modify any paired input, expected value, profile, oracle, projection or existing lock. The source lock must be revised before either new paired execution; it is intentionally not refreshed against an unfinished root kernel here.

## Validation

The six new pure tests pass with zero skipped, unexpected or flaky results. Discovery lists exactly 61 identities. Targeted strict typed ESLint and root-project strict TypeScript pass. Focused Python contact proof guards plus suite-state regressions are checked separately; see `python-guard-tests.log`. Initial outside-copy checks lacked workspace dependency links/status/Git metadata; those fixture prerequisites were supplied from existing local state, without installing dependencies or changing root files. Both patches pass read-only `git apply --check` against the active tree.

`inserted-ssn-structural-replay.json` is explicitly synthetic structural-test evidence, with zero actual extension/public runs. The before-first-name/final-first-name-plus-populated-SSN reproduction now has `complete_control_coverage=false`, full precision=null, unexpected nonpositive changes=null and known matched changes=1.

Focused commands from the outside `tree` (pinned Node 24.18 and existing pinned dependencies):

```sh
/opt/homebrew/opt/node@24/bin/node /Users/tanishkalwad/jobapplyv2/node_modules/@playwright/test/cli.js test --config e2e/extension/public-contact/playwright.config.ts --grep 'snapshot union' --reporter=json
/opt/homebrew/opt/node@24/bin/node /Users/tanishkalwad/jobapplyv2/node_modules/@playwright/test/cli.js test --config e2e/extension/public-contact/playwright.config.ts --list --reporter=json
/opt/homebrew/opt/node@24/bin/node /Users/tanishkalwad/jobapplyv2/node_modules/typescript/bin/tsc -p tsconfig.json
/opt/homebrew/opt/node@24/bin/node /Users/tanishkalwad/jobapplyv2/node_modules/eslint/bin/eslint.js e2e/extension/public-contact/control-accounting.ts e2e/extension/public-contact/run-contact.ts e2e/extension/public-contact/controlled-contact.proof.ts e2e/extension/legacy-paired-options/paired-options.proof.ts
/Users/tanishkalwad/jobapplyv2/.venv/bin/python -m pytest scripts/tests/test_w14_contact_controlled_proof.py scripts/tests/test_suite_states.py -q
```

After coherent parent integration, mandatory proof still requires fresh default/inspect/contact builds, the 2 protocol tests and all 61 controlled proofs with exact matching list/run identities:

```sh
uv run python scripts/verify.py --suite w14-public-contact-controlled
```

That mandatory all 61/browser/build campaign has not been rerun for this delta. This patch is not public-site execution, a safety gate pass, or project completion evidence.

## Archival file names

Historical extracted snippets and the exact replay source carry an added `.txt` suffix in this evidence directory. They retain byte-identical preimages; original outside paths and commands remain in the immutable before-manifest. These are archived evidence, not executable repository modules. Root full lint first exposed their source-like suffixes; no production lint rule was weakened.
