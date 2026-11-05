Exact-source read-only replay of the frozen public-contact summary gap.

Command (ran successfully, exit 0):
node /tmp/japp-w14-public-contact-before-proof/replay.mjs > /tmp/japp-w14-public-contact-before-proof/raw-output.json 2> /tmp/japp-w14-public-contact-before-proof/stderr.log

The script extracts positiveScores + changes (lines 302-357) and domMetrics (lines 453-509) from the absolute frozen source path recorded in provenance.json. The only source transformation removes the domMetrics TypeScript parameter annotation. Helpers operate on supplied strings/plain records. No browser, network, runner import, test suite, build, frozen-source edit, active-root edit, or Gate PASS claim.

Before inventory: one empty positive First Name.
Final inventory: intended First Name plus a new nonpositive Social Security Number containing Synthetic.
Actual replay result: precision 1, unmeasurable identity controls 0, unexpected nonpositive changes 0. The new final control is absent from changes.
