# Paired explicit-option pre-execution source revision

Revision5 supersedes revision4 before either actual paired run. The final versioned semantic modules, composite validation-description helper, collision inventory and pure SHA correction are bound by a fresh complete runtime inventory. Revision4 metadata and its checklist are byte-preserved under `preexecution-history/revision-4/`; revision3 history remains byte-identical. The original three data digests and symmetric native observer remain unchanged. The revision3-to4 authoring commands below are historical preparation instructions; they intentionally refuse the current lock. Revision5 was prepared outside the source tree using the same production `captureRuntimeInventory` and exact previous-lock/file checks, with its proposal and before/after hashes retained in `docs/evidence/m02-w14-paired-revision5/`. Actual commands below require the separately reviewed revision5 digest. No old run is inherited.

This new four-case campaign still has zero actual candidate or legacy runs at authoring. Its input, oracle and legacy-projection bytes remain frozen. The original exact-four observations and expectations are unchanged; old results cannot serve as observations for these new paired inputs.

The previous revision 3 source inventory had 316 paths, including 98 generated Python bytecode cache files, and missed later runtime helpers. It is not complete runtime evidence and must not be used for execution. This PREEXECUTION correction replaces that list with a closed directory policy: every current file under extension entrypoints/src, e2e support, form-engine/src, evaluation-runner/src, and contracts src/schemas/generated is bound, plus explicit build/toolchain/package/lock configuration files. New files and deletions invalidate the inventory as well as byte changes. `open-dom.ts`, `drivers/mutation-guard.ts`, `option-meaning.ts`, generated contract entrypoints and the independent native observer are mandatory. Declared dependency/build/cache outputs, including Python bytecode, are excluded. Installed dependency bytes are not claimed to be independently hashed: package/toolchain/lock commitments and separate fresh-build output provenance remain required.

Both actual actors validate this policy before launch. The candidate validates it again before and after each case. The legacy checks its own unchanged sources and this same candidate/native-observer source binding before launch and after cleanup. The symmetric observer helper must retain its previously approved digest and eleven installed surfaces; this rebind tool refuses observer changes rather than silently revising instrumentation. Default loopback permissions and the four synthetic HTML/profile/oracle declarations remain unchanged.

Revision3 lock, sidecar, predeclaration and source bindings are preserved byte-for-byte under `preexecution-history/revision-3/`. They describe an unexecuted superseded source commitment. The new lock binds that history, the new policy/tool/tests/checklist and all current campaign sources. A new reviewed external lock commitment is required; the sidecar alone does not authorize accepting a changed lock.

The three immutable byte digests are:

- `paired-inputs.json`: `sha256:2d1ce7ba5acf2414f5936b47055e9afd412ffbee0f8a247cd2c6f583548c3812`
- `paired-oracles.json`: `sha256:96a9fa8780c4b0c5bee78edf9f0b721ea171c598ef3e9cd89cd33ddf8ccb3626`
- `legacy-projections.json`: `sha256:7c7cd5d546aee296ddaa50455b95b4baf7c32e2984ba1df53ddacf5c445531ed`

## Source preparation and review

The `inspect`/`propose` commands below are authoring steps against the preserved revision 3 state. Once the reviewed revision 4 patch is applied, use the `loadCampaign` check in the actual-run section; the authoring tool deliberately refuses a different previous lock. Integrate the final expanded driver delta and this tooling/history delta first. Do not run the candidate or baseline using the superseded lock. Parent must review the final kernel/source manifest before creating the revision 4 proposal. `inspect` is read-only; `propose` writes only to a fresh explicitly supplied directory outside the source root, never to that root. Neither command launches a browser, server, dependency install or build.

```sh
/opt/homebrew/opt/node@24/bin/node e2e/extension/legacy-paired-options/prepare-preexecution-rebind.mjs inspect --source-root /Users/tanishkalwad/jobapplyv2 --legacy-root /tmp/japp-legacy-cleanroom.ByLBQU
/opt/homebrew/opt/node@24/bin/node --test e2e/extension/legacy-paired-options/runtime-inventory.test.mjs e2e/extension/legacy-paired-options/owned-child-lifecycle.test.mjs e2e/extension/legacy-paired-options/compare-paired.structural.test.mjs
```

The first command must refuse if any mandatory final runtime helper is missing. The second contains only temporary source fixtures, fake child handles and conspicuously synthetic structural observations; none is a new paired system run.

Only after final source review, with no prior paired execution, produce a fresh proposal:

```sh
JAPP_PAIRED_REBIND_PARENT="$(mktemp -d /tmp/japp-w14-rebind-review.XXXXXX)"
/opt/homebrew/opt/node@24/bin/node e2e/extension/legacy-paired-options/prepare-preexecution-rebind.mjs propose --source-root /Users/tanishkalwad/jobapplyv2 --legacy-root /tmp/japp-legacy-cleanroom.ByLBQU --output "$JAPP_PAIRED_REBIND_PARENT/proposal" --review-record 'PARENT_REVIEWED_FINAL_DRIVER_DELTA_AND_MANIFEST_DIGESTS' --no-paired-execution true
```

Review `rebind-proposal.json`, its generated patch, the full runtime path list, preserved history and all three data hashes. The source inventory is measured twice during proposal generation. The proposed patch changes only source bindings, predeclaration, lock and sidecar; it does not alter data. Apply the reviewed proposal before any build or actual run, record the exact revision/dirty-tree scope and keep its reviewed lock digest outside the mutable sidecar.

## Actual four-case commands after parent approval and CPU release

These commands are a runbook, not executed evidence. Use pinned Node 24.18.0/pnpm 11.17.0 and the existing legacy Python 3.12.13 runtime with its frozen 13 dependencies; install nothing. All browser contexts belong to fresh bundled Chromium profiles. Native user Chrome remains locked and must not be accessed.

```sh
cd /Users/tanishkalwad/jobapplyv2
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
export JAPP_W14_PAIRED_EXPECTED_LOCK='PARENT_REVIEWED_REVISION_5_SHA256_DIGEST'
export JAPP_W14_PAIRED_OPTIONS_EVALUATION=1
JAPP_PAIRED_RUN_DIRECTORY="$(mktemp -d /tmp/japp-w14-paired-run.XXXXXX)"
```

First check the reviewed lock and all sources without starting a runtime:

```sh
/opt/homebrew/opt/node@24/bin/node --input-type=module -e 'import {loadCampaign} from "./e2e/extension/legacy-paired-options/campaign.mjs"; const campaign=loadCampaign({candidateRoot:"/Users/tanishkalwad/jobapplyv2",legacyRoot:"/tmp/japp-legacy-cleanroom.ByLBQU"}); process.stdout.write(JSON.stringify({lock:campaign.lock_digest,cases:campaign.inputs.length})+"\n");'
```

Freshly build the default extension and preserve the build log/output hashes as compilation provenance. The dedicated paired configuration performs no implicit build or lab-server launch; its four exact fixture documents are locally intercepted. Do not substitute a public evaluation build.

```sh
env -u JAPP_W14_PUBLIC_INSPECTION -u JAPP_W14_PUBLIC_CONTACT_EVALUATION -u JAPP_W14_PUBLIC_CONTACT_RUN pnpm --filter @japp/extension build > "$JAPP_PAIRED_RUN_DIRECTORY/default-build.log" 2>&1
JAPP_W14_PAIRED_OPTIONS_OUTPUT="$JAPP_PAIRED_RUN_DIRECTORY/discovery" /opt/homebrew/opt/node@24/bin/node node_modules/@playwright/test/cli.js test --config e2e/extension/legacy-paired-options/playwright.config.ts --list --reporter=json > "$JAPP_PAIRED_RUN_DIRECTORY/discovery.json"
```

Require exactly four declared `paired explicit approved options:` identities, zero retries and no excluded tests. Actual candidate 4:

```sh
JAPP_W14_PAIRED_OPTIONS_OUTPUT="$JAPP_PAIRED_RUN_DIRECTORY/candidate" PLAYWRIGHT_JSON_OUTPUT_NAME="$JAPP_PAIRED_RUN_DIRECTORY/candidate-report.json" /opt/homebrew/opt/node@24/bin/node node_modules/@playwright/test/cli.js test --config e2e/extension/legacy-paired-options/playwright.config.ts --reporter=list,json > "$JAPP_PAIRED_RUN_DIRECTORY/candidate.log" 2>&1
```

Inspect assertion results and all four `paired-options-candidate.json` rows. Preserve partial/error artifacts; measurement/safety failure cannot be promoted to an accepted run. The test records raw observations before its assertions and makes no improvement assertion. Actual legacy 4, using the unchanged shared component and fresh owned loopback 18886 server:

```sh
JAPP_W14_PAIRED_CANDIDATE_ROOT=/Users/tanishkalwad/jobapplyv2 JAPP_W14_PAIRED_LEGACY_ROOT=/tmp/japp-legacy-cleanroom.ByLBQU JAPP_W14_PAIRED_PYTHON=/tmp/japp-legacy-cleanroom.ByLBQU/evaluation-runtime/bin/python JAPP_W14_PAIRED_PLAYWRIGHT_MODULE=/Users/tanishkalwad/jobapplyv2/node_modules/@playwright/test/index.mjs JAPP_W14_PAIRED_LEGACY_OUTPUT="$JAPP_PAIRED_RUN_DIRECTORY/legacy" /opt/homebrew/opt/node@24/bin/node e2e/extension/legacy-paired-options/run-legacy.mjs > "$JAPP_PAIRED_RUN_DIRECTORY/legacy-launch.log" 2>&1
```

The launcher refuses occupied 18886, owns only its two direct children, enforces a 180-second browser-runner deadline and bounded direct-child cleanup, and retains timeout/error evidence. Chromium descendant processes remain OS-level UNOBSERVED; normal context/profile closure is reported only from explicit successful raw cleanup records. Preserve `.control.json`, `.server.log` and `legacy/paired-options-legacy.json`.

Offline compare, after both actual runs provide complete compatible observations:

```sh
/opt/homebrew/opt/node@24/bin/node e2e/extension/legacy-paired-options/compare-paired.mjs "$JAPP_PAIRED_RUN_DIRECTORY/candidate" "$JAPP_PAIRED_RUN_DIRECTORY/legacy/paired-options-legacy.json" "$JAPP_PAIRED_RUN_DIRECTORY/paired-comparison.json"
```

Both systems receive the same frozen ten facts and approved United States/Michigan token metadata. Legacy conversion preserves fact.value and separately logs unsupported tokens. Exact phone formatting and digits equivalence remain separate. Native observer limits, differing origins/runtime/browser wrappers, unknown legacy interface fields, null site acceptance, small related synthetic scope and no timing-win claim remain explicit. This campaign cannot establish two independent legacy products, full-product parity, Simplify performance or a gate pass by itself.
