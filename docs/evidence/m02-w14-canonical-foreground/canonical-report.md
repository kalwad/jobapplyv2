# W14 DEVELOPMENT ACCEPTED_RUNNER PARTIAL_GATE_EVIDENCE

> THIS REPORT HAS NO CRITICAL-GATE AUTHORITY

Comparability: **ALL_CASES_COMPARABLE**

## Execution identity

- Execution ID: `evalrun_64WY2BVC336D6P5WSAG0ECS670`
- Request digest: `sha256:6d18cd8a3d2a0a61fa0fc91eb087c9ede5a243f0bdd204560023e86f6f682636`
- Canonical JSON digest: `sha256:0abcddd710faee5564566b8f4a71fa94426fb9e61257844590cde405844a4107`
- Runner version: `1.0.0`

## Raw case counts

| State | Count |
|---|---:|
| Total cases | 200 |
| Complete | 200 |
| Partial | 0 |
| Failed setup | 0 |
| Comparable | 200 |
| Incomparable | 0 |
| Pass | 200 |
| Fail | 0 |
| Invalid | 0 |
| Environment match | 200 |
| Environment mismatch | 0 |
| Environment unknown | 0 |
| Hash match | 200 |
| Hash mismatch | 0 |
| Hash unknown | 0 |
| Holdout valid | 0 |
| Holdout not applicable | 200 |
| Holdout unavailable | 0 |
| Holdout invalid | 0 |
| Zero-tolerance failures | 0 |

Pass rate: 100.00% (200/200)

Comparable rate: 100.00% (200/200)

## Metric counts, rates, and uncertainty

| Metric | Unit | Required | Observed | Missing | Pass | Fail | Pass rate | 95% comparable-case uncertainty | Proportion observations | Pooled numerator/denominator/rate | Proportion uncertainty | Uncertainty notes | Zero-tolerance failures |
|---|---|---:|---:|---:|---:|---:|---|---|---:|---|---|---|---:|
| CATASTROPHIC_OPTION_ERRORS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |
| DUPLICATE_ACTIONS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |
| HONEYPOT_FILLS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |
| NAVIGATION_ACTIVATIONS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |
| SENSITIVE_FILLS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |
| SUBMISSION_ACTIVATIONS | COUNT | 200 | 200 | 0 | 200 | 0 | 100.00% (200/200) | WILSON_SCORE 95% \[0.981154673623, 1\] \(200/200\) | 0 | NOT_APPLICABLE \(no raw proportion counts\) | NOT_APPLICABLE: NON_BERNOULLI_METRIC | NONE | 0 |

## Threshold results

### benchmarkcase_00PYMKZ3RCGSS5S1AFQC47S29Y

Case digest: `sha256:cd05427acf451c7b44f45b53522e8460ab34819bc592d4336d7e4a47db3ae7b8`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_019A715NFSESQZCAATSNJMWFZA

Case digest: `sha256:e1556023efae0cb8c5a313a22ed9e059eefcb5bc96e048d839fecf52b752740f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_01CBRM373BEA3R7KGVJ5TGBQSC

Case digest: `sha256:3633b12001c0db088107ef7c182842fd6e1d9b0483c914edce2e95e068247845`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_024A079DR9S1RENRFBCK658M4Q

Case digest: `sha256:735d2d2451e04c7d6265e2eac70e7dcb8dacff4692a68d51a62f28585c3db594`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_04PR3J5EXF37SVC4SY46DQBTST

Case digest: `sha256:8a9501b76ae1ed9f726f1fbcc8df0c8291a1c292054c585a81db3b322d6b66c9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_083J8GYCCRG8D3TAP8KFHV57C3

Case digest: `sha256:005039848270837ab8891ce28b789670ef6f305e7a5a33fc9c92b6d068757d97`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0962TZS0P5D7SHDGPSV57PYYVG

Case digest: `sha256:8636fb3d80d04a00f01394539494ced1e4580892eda46a3cf575a84022840311`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_09NJ8BFXMNZRBY3FTMC39GWA8C

Case digest: `sha256:4bdd9ac54a1f04d8a88f5cb800abbda051b584b1ed103c83784ae1237f6782a9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0AWQH265BGS8SWT3PQ080HR1MP

Case digest: `sha256:8e46a4168f662064150395c4e18a36f6ee34b8e21649925b15c72e2d3f6c1c7b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0DXAMPC63KKJQAE4SX14SWE5YX

Case digest: `sha256:b2fab7cfc55aea92738180a0c39093fe835518175d0066cd386a72cbff1d253f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0E3DHNCZQS8WY3V59X455WSYNW

Case digest: `sha256:18c9a3006a7868fe043d3b7a9a033e303d50184b289a6c78684542aaa0b8834b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0E968TNPVKWWSNB1EK72GEG3AH

Case digest: `sha256:7a9b8efbfd64645896ffd7f140835af76beef5c96911848566fab84f8e69a886`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0GH6D55XD5BQFNR2VPX8V45JF4

Case digest: `sha256:d0850dc7411a622bdd856e6c9e0767120622739b9eb3a35031ddee0dad82a955`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0GHGENQJB1XW1YWQHTX2GVTV8C

Case digest: `sha256:7ba68fc3927d7362b056c9587fcb8f0016d262aa9a1cf52df9bf3e777abea061`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0H8AET39579FSFG4436XJEMA27

Case digest: `sha256:952816d8c2440d030e57d283647782ef95d501cf75af0c96cb032732141a205e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0JWRT7KPD47GMNB7R6QVTY1W3T

Case digest: `sha256:c78b05f5da65dea8582eb6406ca2a3080ac04c69b34bb38a6273c8c21c4d9bc4`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0MC0SF8BBRMMFK3N1G90RGZKNA

Case digest: `sha256:1807979e56349ff67c0a6268ae86a655ad5d11da7e67f038fb49ed7dbfb4db1d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0MGFQWAWJ8CQ9GF2XN3QTZ24X8

Case digest: `sha256:de1b66d4cab32e06517bd5a8e7bcb8e104c65f49fc70c641c84aba507f38ee74`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0N4ZG6ASJXMR2FJ10FJQBNXG5G

Case digest: `sha256:030eb5957126792b14773c624e479c859818a6d9a18ef5c5638dbc9877b48da4`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0NN0FKAEB354ZHVVM82E051M64

Case digest: `sha256:b19e2372118690d37d374f7fb535e12efa22372c6fb78caeb843b04f78bea664`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0V0SVV9K1HH96WQYXQH6Z17CQF

Case digest: `sha256:9eb7ef9530c59020360d6a3da4392098b090b4f0f28d946b498ce15e3d4d30dc`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0VN9CB60MCT8AAM88BDZ6CR7ZD

Case digest: `sha256:bcaf750a5053f16ded9c0b40391c69b0ff56c861ad92154a004c20b2bb5a5031`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0VP62GQDPN058MCX54ZG3MFH1R

Case digest: `sha256:812a5225d15e871a1fad7e91690d8885d5b323ee479751ddfc24c5078b819833`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0W6C3T4JEYK8AZ8H2Q7RKSE3V5

Case digest: `sha256:df78376335990382ce7978c3a4c9feb1d0f764b9a22175fb6dd4109f6a7aabb0`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0X1WC2SBEF1YJ2QGKGJ21R92BT

Case digest: `sha256:a16c26ca06c127d178345b1159412dcee5c94b9b57d46184836f42f814f12b15`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0X7WD67R5QGCX7XDN511NRB99N

Case digest: `sha256:032b47ee7b036b7253471d163279ac8f95a5e0b9efad7a0085d3ba4e0a8af244`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0Y550FGB6C29MWWAFHJ022XWXR

Case digest: `sha256:ab433eb2189a970668e88d92d5750a55c2f16c0b34846835e7c663bda877e522`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_0ZD32SQQQPDC47PFVZEG665T94

Case digest: `sha256:eb7e947c817e516eb322f098ce1effbb4db621302919d82238f77d2152fff27f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_11XYAN497RVCD3CB5S6TFG3WK9

Case digest: `sha256:bdd839a4feb72212afe7d9b5db75785b1016019260d693c33041f2b38b8fb2ea`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_125J5GZNVWCKYVXVB5M6AWZ14X

Case digest: `sha256:f90b3a83b85ca386b23016ad3cf598179b2cc36f7783402c01b9ae20a62b2706`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_12GEFG7FJZ6XK3J0PBAHKJGESW

Case digest: `sha256:d0ce4b1ba764fdb13bea503cc2d3ef1337cacd5ed2ed7ef98672b96f80b7ffb9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_12SDSNNNGQRJWJJJP64SYCKNJ2

Case digest: `sha256:dabed8717ea68c766bdccc47a49338ecfb869f83561a96b8e72c59dced40e8c8`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_13PV4A9Q4KGQGJEE7WANCBWWPT

Case digest: `sha256:3e29af1d2a5b50d2b757362dc8a1b7471eea50e31232f1e2d87ca5582d544d9d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_16AMTJSNX4FA62QGF4EJY26YP3

Case digest: `sha256:358b45747b104c811a3a2273e76e5abfb18676eb5a9ef16b3e8a523a6950a855`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1A5RXN5TDN4GKT9DZS8136P8CS

Case digest: `sha256:7bd704072ce076e6780b285f2dbb3e7979e145303c314f344c9465859da3747d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1A9CFW6M1RVJ2Y3FDJGPSRKSTS

Case digest: `sha256:e5bd40c767cb8b6664a34a3ad556f728e5e42d768646a842239cd1031bec86e1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1AGPWHWVF6ZJNBV39SHY4C1Y0X

Case digest: `sha256:34e9fb3c444487db592a7f87a76c5c114381c4d17fa7388a221223a03dbd235f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1BEHXP1ENBBQQ49HBZ1TEXC7DZ

Case digest: `sha256:3a78bc2e82c24882d720080094c8e5e4c17ddfd23a5005adb59a825e1b0b5a2b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1BS15QVG69ZRHRGEJQ2BK2S5CZ

Case digest: `sha256:c4b62cc9d6fc700a2ee8af263371a98d8f408e7d46d96fb93f73868e29e04ae7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1CTXJSQVCTCHJAJFKYGARPR1RJ

Case digest: `sha256:aae7ac0b6e75df7f95ff2bcfebbe56a9f64a67d954ab6610648cea9cf726a28b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1D7NZWBHQ81ZXKHM6ADF48R0RV

Case digest: `sha256:193811f6a7c87e14a5993bda05e5b8b63e7ea49c8499627de80dd45dc19af3f2`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1DD9FCRBFPM9GTGJK3FDN3TW9E

Case digest: `sha256:22a57c93b77c159692c253d6943cfaee6e8e231c3a657ece02f638ca61034894`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1DQTBNQQ6MG0JSFDAH3QM3715N

Case digest: `sha256:df5c4b374aa75359c6a48f56e6e2f9728d5e50e4a62ec273363e7221a32a76dc`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1EK78SV7YR7G10MAR2EMC0K85C

Case digest: `sha256:fd388887a52de8878db7e4e1f9f06c6bfc6ec95d22c859259d80d7d5c387b324`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1GCDTAC8436NPM9605VD3XVPY6

Case digest: `sha256:be70376de3a6c6ae19652ba76951d64adf3646e0e0e5ceb21ab7033c01fbe71d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1J97KZA3EWRC5TKGY36RWZAZ23

Case digest: `sha256:090782c6dbdd8fb2b5546d27a8114e03723ae0c44946543fa28821afab9f3833`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1JYSWRKKHWDHN5PXG5S6FF9KQ9

Case digest: `sha256:096ee8b00d0fdd59c1b3bf1da2fb0b9e07543b802659f84651fbc35d7239b51a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1M5XYEV12WDPERT47FKK1JZ78J

Case digest: `sha256:bc41269d3ec5d024214a06f80bef6f155d992924fb318954d4f4cc426fc3fe28`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1N1KVYV50YA1ZHD3K4XC68013F

Case digest: `sha256:13e39f7f1b22abbcdf556883344840367d1ad599e4491b41ee712723e8e70879`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1NXR72CCKC0K78JM6N7SYDZ79M

Case digest: `sha256:651ba270aab55fcda3b24f366b9337737b56aeaeed653c8a3421ed5db4701d34`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1PJP8NKMH28Z9049KS599QFXXM

Case digest: `sha256:76de169d63a6075e8b247399deecae20e5ba5a01d0a5d43e77da5b26dc9fb1e5`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1PZG6DR3PYGPPK8NNS1K9CDPW3

Case digest: `sha256:2db2d27f703130038828453528c6eb9bfa90df6b19f240e785889f54557859a5`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1R0FYQY24V7DYWF08KP1S7HB6V

Case digest: `sha256:c52dea82f966a3f6f2c42a68f072f52b95a5064a05f2b8e2984ff8e96e9c8eae`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1S823QV5T0MRGW6DRYQVGM4SSS

Case digest: `sha256:71d711f1b303dc3d0d5646994d25df0fbd6e635f4cd8ffa6799ea80117764089`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_1V3DZAKHFZ6H6MFBF6Z3VEA3K2

Case digest: `sha256:0ce780e310ecbcdaf93ee75f511d211fec0c506edf08a2a9c96631af087d11e5`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_20HWM5QZJHJVWR3XNDPXPT6977

Case digest: `sha256:8faf4c085ac14a9febcc36268c9945ffaa3362ba545534b928449ab35b80bafb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_20XSC6Z7YSDMYYCSX5NHMC2T3D

Case digest: `sha256:518bc2b140b67753aa89f38773e4a2af7c19f7214c8764bbbf849e187a0f357d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_223BY9ZQRZKWDAP67QF5Z8WBJ0

Case digest: `sha256:077b37d9f3a646931d0a5e729eb98a68a82ea76cdabe4f42c72b7e3217370f12`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_223KDK0J24JTRP78QZEF4TSFT9

Case digest: `sha256:ae4e827052536896cee9f54b3f2536f4c6450f1f44f4efa746af7c82cdf544a1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_26VCT7A7QDW3N1272KAZG075YJ

Case digest: `sha256:07e8d35d5eb1972d975395d2fe6945a0b148aeba0014811827e8a3fd7cf4e1d3`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_26XNN03S7JKTX2J8FA05AWW46P

Case digest: `sha256:00a229844d533179a92e4bf5587778647032093ab9545a14fc8c2c217aa10af7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_28320Q38NFHWV8TES45W7P3TVB

Case digest: `sha256:831caaec08ae5766a402facda498d7210719f2a1b9d240fa8632396a93c24f2e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_28HBQT6WXQ57TJFVDY8P2H9ESV

Case digest: `sha256:53b17696c8f507990e13c5660724478f8c9aa1aab73c2a9f6efd7848e15edd9c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_28Y9DWAFY1A8QBNSB8P2ERZRVX

Case digest: `sha256:2d5a83a0c84f3f71964b3af61dbf92776b5d9506404912eed641afeaf0a002c1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_296TK4FY30WP1X51ATY1J67MMT

Case digest: `sha256:975e60631120a460df60f52349429370fba70f240e0d02d63571617ed95bc06f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_29AP99JPXQ9NYJKK7SHY090TEF

Case digest: `sha256:c8277eca33c289696528c5eae081d7d7c551749e772e244ae928327f1a211b70`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2APYDB4HXNA9N7Y8Z4N2FG6T06

Case digest: `sha256:86dafe24279c4d0efd61828e160471960b4a07b907b1b2405461d6c29088f166`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2BABX3KCD4Q4RYWRS9C2MREY1X

Case digest: `sha256:b23690a20f3fbbcb8a2a8065efe7bd9d2a23ba02a99b51b078508cc7ad574bd8`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2CAQ3J3E8NCSGZJ7D8BMXC3A0A

Case digest: `sha256:0957ef8875dc7b11493d6224193da3403ce89870e6018b45016eb2533c85be96`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2E0M9DCMW0S8CAYBB0X9Q7YKWN

Case digest: `sha256:00b1964e3844a0d4bc20dec4bdcaa56828dc52aeec0b1bef71f1e9c81093647f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2EVT5PSMY7RM18YBMMX4P3KWAP

Case digest: `sha256:8add7c063b92f08e47af6da236190cefa3a22e66f7b7d5e645ae993bdc8227df`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2KADAK1GR6WNKMW388YKT22MP1

Case digest: `sha256:d9e93a1bb757a0b12620bbc988f4d2baf96cdf593904bc2c871ff3b766d1fe2f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2KY64XVPV128BEYFTG7JZAR1SB

Case digest: `sha256:77aff3e07b7227b6234ac94dea7e27b45101aa87a4420707d35dbafd95e61fd0`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2P8N012HZRK20CF9EEG3D57NRZ

Case digest: `sha256:fc1b0d3d53df3387831b664a3888d9204f91dcd3c5ecc63b592baf07273241be`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2QD890TD7A2DY8ZF7HX3446E3M

Case digest: `sha256:2def6488ce324d0e2b325cc542a64151edb685a88e7dec8170c52928a2ebfebb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2R7WH51B798NSVKDC4EZVXQBEA

Case digest: `sha256:c31eca66cd10e2849efce1d2da764405b71a8f340cc02d8f6e37c579e056cdaf`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2VPGMR6FR4XJCDKW05FSCXXK7J

Case digest: `sha256:10a8f25b7d03bd3ac7f024b4a8bae59ab0ef762098273771c36fef2001bd5368`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2X77TM6QX2MG2PWQ0TSAZ6NHZ6

Case digest: `sha256:5db2cdbf744ace4d20f8468decce7b0c847c078889e13d71dcd7a8cc7dd00360`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2XMXYHXANQQNFW2TFCYFNJDM8J

Case digest: `sha256:963a2644eafd58d099b0d7cd6dba2ff5ab3df03517c8f5b0c25047cb4035e0bd`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_2YSC2ZG0DN37TZG5N53KQ5TTRG

Case digest: `sha256:3988c6a24053359d93691a62f5af26ca57e325723be47c39c6fa9cbe6fc719a1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_32KK1YVEZCAYV666WWQP1232RZ

Case digest: `sha256:baa89dfa29327d72addfbfb45e1b8b228438d8cacc8a6c185eb7fa9099a914f9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3508PYNHMD37SR959WF1KK1CCM

Case digest: `sha256:09bfe37ba2db0e3b62ea0b2aa55c9526c660340328d77768e2845ccd807c4574`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_35V854WYFKDMFFCM1MNA0GAQRD

Case digest: `sha256:130a075f129119c8d85c3f286ec07feeebc747e18ac35b084a65020cb88bb21a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_37MY2WA7DYSFYFS0ZVKX1Z6KGR

Case digest: `sha256:162bcaa711e1573f7b09d9743eca67b74dd482e35a1bf290f3f1ecfd33c8ab2e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_383MW183Z3NS19WBX2D13KKGE1

Case digest: `sha256:76ac62543aefb17f43668a30bca7496cf069b036dee0c7104cbd144a0d995bfc`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_384SY96SBXGJQASBQH23DP113N

Case digest: `sha256:2e85fd090857f8b6b5b9213babac72edb6a3602c3816b7e8081edd858bf458a1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3APGFQF8QR7NKMQ63EWZX9FMN2

Case digest: `sha256:9e0a004ffc094ac991896ca7fb3b0b13d88b6b4a9f369c5a97bc96d16e2a4831`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3C3JCSWSX4HVPXXQJTY5SW343Y

Case digest: `sha256:701e78845339cfe9336d7a63e5c2e383fcb4a4a3dad9751d78fcdb81479337ef`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3CSDW4YQH78882DGRJ88FVA08G

Case digest: `sha256:e6a3fd70c816d506daa670fef00c268f678d06e6555cbc17f1235b387be10094`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3D4EX2F51HRJVWW575BBFQGJPY

Case digest: `sha256:2a25fe02805a58c50a5811647fc427b66b69280791496f1ed174785876a2dee8`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3EQ26S3E0JPAVHFKKJ5A6FAE4J

Case digest: `sha256:54024e4a34701fb212b12b46ec3b53a83e109789600cb0d671f1c2047ccdba0c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3F0W46WD3CZVFJ22QCQB0GW6X8

Case digest: `sha256:0e75a03ffd1df549d2110b52d7ce4894f2945600a8595ec1f94253e8d396c19a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3FFXZR85ACV4057J8CEHJBXTZE

Case digest: `sha256:3877f44b10d5f43d3ab514ce4492548186bfc83c25fa63b1c33ef80767d28bf8`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3GG0M51ZNVP87R08440Q84Y1GT

Case digest: `sha256:56734083c73011be145ed134b9db6993963e73c58240b63ccc156456e89599d2`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3GX1KVKT3V6D5A2WP9ANJM3GV4

Case digest: `sha256:9a8259e5b3bfa3ea6e1019b4e466ee2c390c83a8cdd20d5ff0bc06b69f42c197`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3HZ4D12WJ4EBPME0648JSNSTMG

Case digest: `sha256:bd2fdcc60a406c65efbdd4b16867f487ee591476cf98c79e58bae7d39ee2112c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3JRTH5SD0G79PTA4T3H6VZR7MB

Case digest: `sha256:ebef5fcaa238fc032071d9178c1eda84384c13087208048ca78bc1744aada2dc`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3NBT6GJPNK4WMX6M6Y41AHH324

Case digest: `sha256:6945f05eeddfca4004358987d061568cee77c52474ee001bf32c0ffee62ce53e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3P3FFFHK4B8FQ694N1PRR217KW

Case digest: `sha256:f08f7d8c6d3b6eebb09bbcdbd67b1c2f4b2d029361e80e306e668e297c0ee38e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3RF3B186BTWAF1K786PVDTHMTN

Case digest: `sha256:f3ca47a9acf21a1354a2642241879d7ddd1e5a6d7e43cc14821218865ea0c31e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3SGVVQP0JKFSRPBWKPWCT45AHW

Case digest: `sha256:13d446dd3bbb4fa86055adee1c729fef4e585a396f95f304f07209e0db3b7e04`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3T3P61DE0HVT2WYA0Y9YC2XF6K

Case digest: `sha256:a04afa40b46216889c113b2a57c30677554deef078fe52318fb3006f27516510`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3TVR0N2DRQ2QGGBCFD57WDP9W9

Case digest: `sha256:c603e1bf7911efeb9344c4538ad39b59020fbcecbb96fe405016f34062039af9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_3YH2NMYH2BF8117XV4WK6BE46P

Case digest: `sha256:edcd93a8997a790c0c812df857fefac5434f82ba9f8f088c74d3ed36385d26a3`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_412QXA555C693YRK04TKR94R04

Case digest: `sha256:f80ab0973c2606860fb2a467851434a06c5e284a4bd3cd43138cbf35d3617c03`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_450TK0CDP9RDXV5EKSA01XCM0K

Case digest: `sha256:b10099ccf422f2d993a86324849179426764f04b2755295e8d35d4132d438910`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_45NCWSPASANQEKA3TJYCB0HRXT

Case digest: `sha256:6ddc17597238f8aed1cfa20a92398b0ec3e901a8ed94758dd6bde4b5a4a66949`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_477VBXQC8NRX09QKZFVNJP2W2C

Case digest: `sha256:95a4221d6a4a2f51a25acc4021a0caa3b95fa84164b8d7a9ef3ca6d210e8288e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_47RQMB9V3WV92J01188X8TJ70Z

Case digest: `sha256:32f1f95b4ec5e73fac3165d2b48a6ceaffb0245ad1311ab01fb58ca4b09a8014`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_48HTSBCR11ASGJYJERDVT937CV

Case digest: `sha256:6f92a9e01c23123fb297613d78696452d259171f47b98e7e4da6f5ff9f7d69e1`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4AKWQCQ42N04XBFP8MKA5X5FQN

Case digest: `sha256:75ac6fc77f7295fb282f26fb313d24fba1d5ce3ae53401d23b6b3407b582f6db`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4B18K64WXSD2WS5NCQHPZD5ERT

Case digest: `sha256:3f2a6622b4b358e26436036dbccb56acebec5b3d137cad6a17ed1215f1fe7cb7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4BPMWM14EGNKM82WNJAWDR9AEM

Case digest: `sha256:20037cbcaac35e5adc496e6ba4546b9caa2eb45415215b21990f511f88eded7e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4D5QC0Y8C5NNHZ7ZR8BAJSTPEF

Case digest: `sha256:c80cc5d1a65f3e11e54f4e3227efcc55c8333b5ad49ccc817317de3e87367caa`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4DH7PPNVFN2Z0KTY10KE0ESCGP

Case digest: `sha256:dc730e851d1a69866da1d0ba2847870f0c166d21e26d3f7794146d86a473567d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4H7XGNAT6BS04M0AWF48CGNBQ5

Case digest: `sha256:fbc966b21639aa037981d044f962bbdcd483aecfaf7b8e867db83d1cd2112c68`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4MA5AQ3SS91NZ53J5BPYV222HX

Case digest: `sha256:82e603794ab2150a0d948ef474887b33251c4dfa4aa1da9785456993d969813b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4MHQAABZPT8HX1ZEXA08NQZQ3W

Case digest: `sha256:5522df3839075994b7a9aab17324d4e3b6f6a229c3a93c40c60dca305cc74fce`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4PK6RBKVBD098AYJ20DXC7SAVJ

Case digest: `sha256:f1d007f7964d395c54a3783e8c49a18fff8d51290af52b14e29f51cfd0ed204e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4PXXRBAQA2Y5ZBTQBBS5MFK26W

Case digest: `sha256:6911e34c8ec9d80f5a15d67cebcb8d113ca282d59a8f8d31fecd2c4b664fb000`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4RAEM9XHJT44W4C7E5DKHZVYRC

Case digest: `sha256:2979db2e3ecb7b634ee01e56ca2745b59c9118dadd4b098715cb0874c95ccd1b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_4Z46ZT1VJY9XTBVRVKAK68AFQM

Case digest: `sha256:f29278ae3efb3f91ab02c128e80ca5f4bb88ad15db022394378c8df88e7df611`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_538DZMDNVNNFXK3SRN4MSVCJT1

Case digest: `sha256:d83a023afa813a46cf05301a521c588463b3199b4d02a1cc99e74c3bb2798c58`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_54K0RHFQKGEKT2D64DPGB64AXD

Case digest: `sha256:ccdf296455d8baf4f0ec1a5f8ab434f98fcf5694c3c18559641da0d0b933bb18`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_54X5D1VB47PZPE8KWYKPPE6E8M

Case digest: `sha256:b265aa2bbfada7af2b89c5a48f6f7c0efc5c7ea4ae606b9b708bf92a99129da7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_55XECJWJNM0JV6T03PS1T16TD1

Case digest: `sha256:e0c93a4fbe3fc7d1ff90ba84b7dbe458c49f43bfa155c01b3679a189f22771f7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_55Y3MPY6QRA897RSXDBSVSGEN6

Case digest: `sha256:33aa16df65f599d7eb59e0efa302d96fa97b3e956f87498c64ecb0df24fef348`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5614NWE7MCZV05QMN53A417EQH

Case digest: `sha256:0ef01a9d94cacc07c77c6ab5f01c450df1f0754ed1eb54448cf496a62a5483a4`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_568MWK9NKP3740W2ZHEYTNDC82

Case digest: `sha256:35a6e1c7992bde34a5cbe024fe54ad74c4ecf1e3710d2f85596739162825128a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_57S1DQKQVPYNEG67CKGJGZ6Q0M

Case digest: `sha256:8e74fef9734d11c7863b1682caaaa0e9e000c0b60f27d7a963dd4fa2dda09136`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_591G3DM0X8APWPCBNGBQ2VD3Q5

Case digest: `sha256:9ca1d3176af97ff65e2adaee5dd47f63bd13219012bd7b93e820eefb7236a25f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_59YXYTWBY2WHVPRKF1AKPGACVJ

Case digest: `sha256:b37f37176c8da7ea65249c6e1e99a87f005e186645c3b0f50f095e56e6f5d297`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5AQVKT6SNCY4GNDAEH5MJX6XD4

Case digest: `sha256:129f3e0554b2c0552d7470444783e80e97c6db9eb10f306eaf85d285b37b6969`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5CD2W9S5MGXTVXERG1113241ZC

Case digest: `sha256:703d5a9604a155ad31b3d09861db6a6ae15ded82d5ee4807cc2e724eebb967d0`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5CHAH7E69JE5623R3J0FX1HRA5

Case digest: `sha256:332badb9f63a35f2812784d460771de146a4cc5c7b27b78a5b3452f8dd7af800`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5CJK0Z64RKQS70DXS65MC0BNS5

Case digest: `sha256:2e016d640809decfa850bd3a6d84dee28a90652a77a56e97af51f0235670394a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5E2J2TT4YPHVR7WNPGFY34CTYN

Case digest: `sha256:5a2f71e72e7dc9ef8bcc1a85ce07f267784426e14eb66c904dd51f73709cd24d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5EN0Q9QWA43GPXN1SBQMN07KZX

Case digest: `sha256:186678cbdfe9ec6af95f0dd1d9ac7966075f327c07bd24a91bea48f7df675a59`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5JF685MZXCWT1Q9S0FEM2VSEPV

Case digest: `sha256:661edde6321900606527aef986e9ee99ff6142be782d1b14bb948e2274ba06de`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5MARCM6VEZC7V37Z7YSPAFZ9T7

Case digest: `sha256:bcd7e550aabfdf1bb4dcc89e464f621b6eb6c5bf3e8aa46651b75433383004f6`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5NE3Q459TSEJ2E044FPTAXJQ2D

Case digest: `sha256:e79b17aa2271b52b62620ad0eaef5e4e00bd21e373f64b919cbe3a535dcd0bbc`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5R17VZMJ7JHHS3FFHBR955PBD0

Case digest: `sha256:b7b62d9cc03c22c97987f650f0eeda943a88c45f6a536df06b3de9ebcae9d424`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5RF6SQZHXWES2F5VCNP367BKFZ

Case digest: `sha256:507c2fee4daadabd95469d5d21db796fc85742617e7ca7032491c7d0ba91a619`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5RND9MN89SG2CSBVQRQB8HYK25

Case digest: `sha256:5c76991900cf7490107e7f417d7a72205b14e308351cd0ca44d3ce5dd8d89d2f`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5TNMV8GK84M69JMDV5CM18ZH3W

Case digest: `sha256:c256698010846713cc0aa535c0d40e973541c5c02d9434f2e366029def5b2767`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5XB6R9TVQQF0J3BWB9YHBH46BS

Case digest: `sha256:eef62665a534be5e39cda0c1afaa734a356fbb58ab77007dcbb151e6892dd16c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5Y3F6TJQMM6PX2X7BZGGV5A886

Case digest: `sha256:625c2f8813ccc079d6de22c7ed9627ef8492255496d14ef37b3f98bc4d830d75`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_5Z52ZJXN34QD8J2MTY9TZ0YHV4

Case digest: `sha256:e97094df0ad274e19418b34e6bae0dc09b652dc9eccd9b40f8885cbc24c9c0e7`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6002CNPF3FFFGH39EZX4H7GS7C

Case digest: `sha256:8ee05459d7ec27f805611f87d71aa052f5ab3904e2f93fcd798640772c842707`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_63K1FW1EMN504NAT1FHSWPA959

Case digest: `sha256:5cacd3d91d6110b215e560076826db4c3490a14af2a9d5a5cc5ecf30c807fa90`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_664HG0SDE1Y1FD3BRT92YVHB0A

Case digest: `sha256:f43ec9977c71d2a1009aab425c503e02e7fb6f674180897100976280392d7ccb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_671FG78ZN14BVX1X8ECN26XH8P

Case digest: `sha256:48c3acff45568e8511538b32dfc2b3466669d9f813e87ee5becb4ad60a446b4c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_67K68WAQD9SD7ES24WXGGZFFGD

Case digest: `sha256:ace14b0609012f7d7c87f16a51b6d09c066df7e9ade125ed47a4035acdce449a`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_67MQBYWX6QBJ4SRX18ENC8NSEY

Case digest: `sha256:fcefd6b093542d21758a4ee8fada8e4da7fc8a1cbc3ad41dac1d76f932e0e3a4`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6AEBETXSAMX38DQZ7AXJ5DX375

Case digest: `sha256:6e5b1d8ce30b45913589bad4ba361007de02783f2f230333e6a25ccf9aadf9ee`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6B3YR0RZWTDZJG0AJ11DHFE0G3

Case digest: `sha256:dd8bc7e4dd9dcfc9c78198c567208e9e30c3b46625f2cab0d6b550fb16048bc2`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6E00SR16SEVBM7XW4WC44K7QD8

Case digest: `sha256:805a4b0af00d738c6acf6a5c2c2da9a4c60479b453c2d4117bccbe76a0c1f4de`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6GFC310WET7E1QKFFYGTT9TGKQ

Case digest: `sha256:e97dca4beea8fe01f287e090e870194afea9fb8507509614f3915dffcb27d0a5`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6H1W0FX2AND4YVJCB02ZPA1YTQ

Case digest: `sha256:db01ebc9565c29a67dd2f865dcab7ae1af1c6ae87159e3818d7c5f299181d6b4`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6HPZZ66MEMF79NPX4D4QGJ9ZSQ

Case digest: `sha256:f654651eb5c803fb96dfedefcab3f4d51fc00f3148abf7ee88d0759cca2bca98`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6MBKF1JWY0GCFJMT5QDM07TS1C

Case digest: `sha256:125b7e8bdd0a5fc72c8fd763034962f8c56540530d2a711ad5a8494bdf89dd10`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6N2N8XMYQVB38KTVKGYWSK3N2A

Case digest: `sha256:f14edb42a7789151fd6a1c97ff1b79a049f9e0c01ed10cd92583f94a4c1b2449`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6NJVJM7HSEKAAGKTFR6AJRA9J3

Case digest: `sha256:67623b314eeb2ba71531fd0fd9ffa1172ee845fd2db1e3c6452d24751053d4fb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6NKZ941GDXNH5BQV37YEBWMSF1

Case digest: `sha256:04786fdcb699d5448171a9cf89c39db95864d454a0efac2206ad2c20c87ea6ab`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6NZFEWZF628667MXC9YCH55XV5

Case digest: `sha256:4a9e690f29223d14e3456b238abd095148e744b75ec735b9264f644089a26124`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6PENY1M393QJ6JTK4AEA1JZQ09

Case digest: `sha256:46b9f1efcdc535d1ee92bcbcf63a5cfb05507fbe972716328aa98544edb8b860`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6Q1X366MCBHJE6K9QRHCTZQG7R

Case digest: `sha256:81afd81beb469ebafd7c415a8da3775b4d5df93f7841f68cde23e948d6c3e894`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6QTDV09TBTV3Y6TGYAMMD8AWY3

Case digest: `sha256:76f12338fabb5188b1ec7e949282911b10bdf0cc0768e1a7cafef866ab353b8c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6RF9Y4KH8B7SWTY7GS13PS1XQY

Case digest: `sha256:18f2340c110988199ef642d3498ae19c9adfe273e3cb352ae173340d4f8878f2`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6SFE75Y35V2B81PE5Z49RG39PK

Case digest: `sha256:31b129faeafe01624c86eb0f4aae25e9e2ab96557bc0ef3c15eb46d6be39fc8c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6VHQVQA1TPX3YT4AG00CPATHD6

Case digest: `sha256:434ae69aeee501659320d0efd3e82e1e24b6a3f29050f72659cb8596cb124f9b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_6ZWKZ0EFFGJ17KGVMFSKJ7Y41X

Case digest: `sha256:ee229d4d6d4f384712c5b273c69646f8cd3bf62f81d1b8bf7f79c188040c240c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_72BHZ7WCE5AZEV0P5E2V9TRVDG

Case digest: `sha256:ff266fd328db8c7585130cfa05bb34085d18a7d1c41ffd320cb32ef5ab5fec28`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_73CETR49JZWTM36S433VCJNWC5

Case digest: `sha256:8c10bd4b87772bab8b4f3f4a093483e701d6a5e8ead11b74a7ba42c07ea379f9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_73NCAEYQN9CGT7XWKA78S3XFE8

Case digest: `sha256:9ec49c5898ca9b99a68a3e87355f62b974659a0ea28af61a04ae9d0e07836a68`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_76M7R2PZ0PDXYQMXZM7P3082BX

Case digest: `sha256:a769d0276264b5fcd37820e5472ac875ac19f92bb162298b5985716f340f39eb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_76PCPA5CRB88WFXYWC309SJ1XS

Case digest: `sha256:192dc760f5c488a57080c036fdf0568b8ee08e5d12a9a87d6083a4dee7342285`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_790SY8185SXWE28GYRNPNQQHYR

Case digest: `sha256:3d6ca45de0f351c40ab40c9513e0544e3468709f3c4df5625623ae0c83a168da`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7B1R0KV6SKCYF80T5AAZAZS1YK

Case digest: `sha256:ff97e0b307c70f15365910866809f12858651752813e5e91360c542ab40f56d9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7B1S0CB7HJS3H7Y5SXFHR29MGD

Case digest: `sha256:764dff882ab00402843926d4e4bf611abcf5479d3a429445847b5e02d30aec6e`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7B48VYZ8RRJJTMVR7FV7AJ16E7

Case digest: `sha256:622234758629a8a40b18a3c24512e7b941e9ed6c208630c70f0110c90b62a4a6`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7B6SNP99Z7D0GDSFMZSJ1VH54N

Case digest: `sha256:f3962a20e311eee21f1e02f19e6980c079cc4270e9c11b586b0eb33f41c1c791`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7C5Q1ZYBKY7AEH2J279VZNNP98

Case digest: `sha256:e3280843171274efef89ff9f8e17e361234cd37a5db9ae1347234751f18fa064`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7CN8897NNB3MJCTGKXEN70BXKT

Case digest: `sha256:a529709607d90169e9ff1f73a3fa74fa1fa8b788e511de5c3cbf358c1918fc9b`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7CS0PBX6P097TMRBBV6X5XJHE4

Case digest: `sha256:0e8048b6178f9979fa4c4762b4498c9c6e978904390d542a8c3e79eafef866a0`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7D3ANEX7H8AP75NQEBKWJ7QN6Q

Case digest: `sha256:3ece3a04f432a34dea9933ed61a709c0381b829e0267ae0245147550864e78e6`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7E655TXY94RJPCTKY9A14ZS86Y

Case digest: `sha256:dc1a5aa822e49ef2584242690db7c5662e900c34c013ebe575402f7462c78912`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7FW4D0JWZ87H07BBZ4X7A21SPZ

Case digest: `sha256:fae522cbc7c5058ace6ad64f9383e3c884e787d271b2c232c332e7d3e65304ba`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7FXHXT45MSH5YFX2JEQMK9PJBN

Case digest: `sha256:0532eccd5f44ce1f9da43043391ea3217b4e702c21c58a3e3c0bdc465b7fcd71`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7J189EB06SS6FN686DKC4SVQNH

Case digest: `sha256:f0a26c28bb37d9e508899e0ee90f028e1101620253727112b18d76784cb8e2a9`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7J58RXEWW6EVDM6Q1NNX80MCKB

Case digest: `sha256:940f4cd24ef3a3c4f7d444df664c9324fd4e0b498201af8dde7e7f4d122ab088`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7JA1YE57V2MP9AVXZYJ0FM3JPF

Case digest: `sha256:9d7ca469a3c03b8237fb002b0be4dfddddf53670b71f5c3e74d6258578b5f069`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7JMKPR5KGJPMWNJWNMN5S4C71H

Case digest: `sha256:28aa21d9d22d4420bb584f18a8828e960d3b44b3f6437ae9309ee3c6086aa3ee`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7JQ1WBHF3R5EY6WF9ZC4XASG2E

Case digest: `sha256:f232722a26ff3aad90b0cd9985c49aaa900662e86020e824d10545e5f0e4cbdb`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7PVNNQB5R1QXPGKG7GB4Z5RYAK

Case digest: `sha256:d5d46bb32a324cc1a527af46f58381e46ddb968b6e71009611a1d97ec58919e3`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7T0SH8VSA8SXY5DB3EF9WGV02S

Case digest: `sha256:3f2e1274b41bbc31d68994b69596c3e9f7a89ee750a5da1b7f67372b1d36551c`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7TSVBRP338W7A3DPCMYY6RWW2A

Case digest: `sha256:e4e146b9477a7e8ed3a9923e7c8d940185d37838556d3b8f5e8f053efe489282`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7VFMX7Q29NWAAXTMDY6V341XW1

Case digest: `sha256:cd7dfe48ac5a70dc0e0ada986863d5bb2f51cf0207c99a2faa50a11c8b9ef886`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7WFKY17RX2WWR7E9RH0YJGF9GJ

Case digest: `sha256:4da7a765d35d7b8d44c50e2bdee3e7e9faa29a43321aeda47a25092662aeaf0d`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

### benchmarkcase_7XDCKV5YYTSEH4CS1835XR69EH

Case digest: `sha256:0aabf203ad360f814ee316e5833163a2648cbdeb2829acbd3226d37a95d0e861`; threshold-set digest: `sha256:0048ddcf8ddf223492358d7760ea359573a99bf2b72dde9ff0e815b6d82dc714`.

Outcome: **PASS**; completeness: **COMPLETE**; comparable: **true**.

| Metric | Comparator | Expected | Measured | Unit | Raw proportion | Passed |
|---|---|---:|---:|---|---|---|
| CATASTROPHIC_OPTION_ERRORS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| DUPLICATE_ACTIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| HONEYPOT_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| NAVIGATION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SENSITIVE_FILLS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |
| SUBMISSION_ACTIVATIONS | EXACT | 0 | 0 | COUNT | NOT_APPLICABLE | true |

Missing required metrics: NONE.

## Precision and recall

| Group | TP | FP | FN | Precision | Recall | Precision 95% / note | Recall 95% / note | Uncertainty notes |
|---|---:|---:|---:|---|---|---|---|---|
| AUTOFILL_ANY_ATTEMPT_ELIGIBLE_TRUTH | 1485 | 0 | 0 | 100.00% (1485/1485) | 100.00% (1485/1485) | WILSON_SCORE 95% \[0.997419833524, 1\] \(1485/1485\) | WILSON_SCORE 95% \[0.997419833524, 1\] \(1485/1485\) | NONE |

## Failure/error-code counts

NONE

## Regression comparison

NOT_APPLICABLE — no explicit reviewed regression reference was supplied.

## Provenance

| Commitment | Value |
|---|---|
| Repository commit | `4d6a3e57af8d6224ac1cc7efeabcdacfbc306483` |
| Repository tree | `e3cc8c19a4340188c6b3d416a34848a9040587cd` |
| Runner source | `sha256:6f98ddd6ea6fb40ccf769b6c977bc8d28830eeea5623dbde74451f22b1075350` |
| Schema manifest | `sha256:57d08eab5f18b6afe8a70a52ff0ad4a2c3e496d3620508392701076c3b04e31d` |
| Generator format | `1.5.0` |
| Corpus | `M02_AUTOFILL_DEVELOPMENT_V1` / `1.0.0` / `sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8` |
| Holdout state | `NOT_APPLICABLE` |
| Runtime/toolchain | `sha256:49cfdce183a6b5f0136917890ee6de66c43f070b809b9f4eeca66674e812ea94` |
| Operating system / architecture | `DARWIN` / `ARM64` |
| Browser | `CHROMIUM 151.0.7922.34` |
| Model digest | NOT_APPLICABLE |
| Implementation | `japp-mv3@1.0.0` / `sha256:6f98ddd6ea6fb40ccf769b6c977bc8d28830eeea5623dbde74451f22b1075350` |
| Adapter | `w14_real_mv3_autofill@1.0.0` |
| Clock | `node_utc_clock@1.0.0` |
| Prompt digests | NOT_APPLICABLE |

## Limitations

- This runner measures supplied cases; it cannot make or mutate a critical-gate decision.
- Wilson intervals characterize bounded Bernoulli uncertainty and do not establish superiority, non-inferiority, or product quality by themselves.
- This is a public synthetic pre-W06 development run. The NOT_APPLICABLE commitment is not an M02-W06 holdout manifest or holdout evidence.
- Canonical per-case thresholds measure the declared zero-tolerance safety counts only.
- Accuracy, required reporting, preservation and scan/fill performance are separate W14 measurements and assertions.
- Public W12 expansion with the declared synthetic contact profile; the W06 parent corpus is not wholly executed here.
- No hidden holdout, public employer form, Simplify or live legacy comparison was executed by this run.
- The holdout waiver is recorded separately under owner ADR-0006; canonical holdout metadata remains development not applicable.
- Git coordinates identify the published ancestor; the source inventory binds the actual candidate bytes.
- This report has no critical-gate authority and is incomplete Gate A evidence.

THIS REPORT HAS NO CRITICAL-GATE AUTHORITY
