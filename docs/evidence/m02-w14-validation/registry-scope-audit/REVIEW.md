# Read-only registry and aggregate-performance audit

Current scope is61 controlled contact proofs:49 actual intercepted-browser cases,
six retained pure archive/runner-failure proofs and six new pure snapshot-accounting
proofs. The registration accurately says55 retained controlled proofs plus six new
pure cases. Calling the55 all browser executions would overclaim.

The exact canonical list command, through current verify.run_command color/env
handling, passed61 builtin-JSON identities with no trailing Node warning.
NO_COLOR is removed only for the closed contact command/list; FORCE_COLOR=0
remains. Ambient public flags and JSON output paths are cleared, and CONTACT_RUN
is never granted. Execution validation requires all61 ordinary expectedStatus=passed,
status=expected, one passed attempt, retry0/errors[], exact no-skip/no-flaky stats;
list validation requires exact61 empty-result identities, matching execution.
Closed commands, owner/activation, counts and proofs are checked before children.

The two focused Python files pass19/19, and their collected19 node IDs exactly
match the committed inventory. Common1451 is unchanged. A first guard invocation
used root cwd accidentally and may have updated ignored pytest cache; no source
or evidence changed. The recorded final rerun uses only the outside copy and
cacheprovider is disabled. No browser or build was launched by this audit.

The default main Playwright --list discovered208 tests and includes both the
native128 W13-L benchmark and W14 all200 campaign. A mocked child probe confirms
JAPP_W13_PERFORMANCE_SAMPLES=20, JAPP_W14_REQUIRE_TARGET_PERFORMANCE=1 and absolute
JAPP_W14_ARTIFACT_DIRECTORY pass unchanged through run_command.

Recommended full aggregate invocation from the active root, after source freeze:

    env PATH=/opt/homebrew/opt/node@24/bin:$PATH \
      JAPP_W13_PERFORMANCE_SAMPLES=20 \
      JAPP_W14_REQUIRE_TARGET_PERFORMANCE=1 \
      JAPP_W14_ARTIFACT_DIRECTORY=/tmp/japp-final-verification/w14 \
      uv run python scripts/verify.py \
      > /tmp/japp-final-verification/aggregate.log 2>&1

Create the external parent directory before starting. Do not place the changing
command log or artifact directory inside source inventory. Do not pass --suite
for the complete aggregate, or add unsupported env/registry reporter overrides.
Root's normal installed pinned dependencies suffice; this outside audit used
pnpm_config_verify_deps_before_run=false solely because it shares symlinked
installed dependencies and must not auto-install into the root.

Caveats:

- Default main config is trace=retain-on-failure; this is not a trace-off timing
  run. It records effective trace posture in W14 evidence. Prior trace-off or
  differently configured results cannot be claimed as this aggregate's result.
- W13-L runs8,32 and20×128 controls, budgets settle0 deliberately and measures a
  LOWER_BOUND. All full scanning/currentness/physical fill checks remain. At20
  it asserts darwin and p95≤1500; it is not the full-settlement Gate-A claim.
- W14 runs all200 predeclared recipes, native witness/guards/preservation and full
  75ms settlement+20ms rerender. With REQUIRE_TARGET_PERFORMANCE=1 it requires
  darwin, Apple M5 and p95≤1500. Reporting/setup exclusions remain disclosed.
- External W14 directory receives gzip, assessment, execution, reports/manifests
  and the selected screenshot before final numerical assertions. Failed metrics
  are therefore retained after completed measurement. Catastrophic setup failure
  or test timeout before final bundle construction may prevent those end artifacts.
- W13_SCALING raw rows are printed/attached before p95 assertion. W13 has no writer
  for JAPP_W14_ARTIFACT_DIRECTORY. The external aggregate stdout log is necessary
  to retain those rows. All Playwright configs reuse default test-results, so later
  public proof suites can clean earlier attachments/failure traces. No automatic
  inter-suite archive occurs in verify.py. Do not claim a cleaned trace is retained.
- Commands/suites run sequentially, workers1/retries0. Keep other heavy work and
  browser campaigns off the host. Main child timeout1800s, W13-L timeout120s,
  W14 timeout600s remain unchanged and may independently fail.
- Full aggregate status-neutrality and W14 source/build comparisons require source
  freeze. Actual candidate bytes are source-inventory bound; committed Git ancestor
  coordinates are separately disclosed when the source tree is dirty.

Evidence files: focused-python-outside.log, python-nodeids.txt,
python-inventory.json, contact-list-output.log, contact-list-inventory.json,
main-list-output.log, main-list-summary.json, performance-env.json and
scope-inventory.json, all outside the active repository.
