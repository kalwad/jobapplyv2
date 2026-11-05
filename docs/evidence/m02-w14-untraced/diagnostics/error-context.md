# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension/extension-w14-evaluation.spec.ts >> W14: execute all 200 immutable W12 recipes and preserve incomplete measurement evidence
- Location: e2e/extension/extension-w14-evaluation.spec.ts:184:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1500
Received:    2009.8366249999963
```

# Test source

```ts
  536 |     format_version: "W14_DEVELOPMENT_BUNDLE_1",
  537 |     labels: ["DEVELOPMENT", "PARTIAL_GATE_EVIDENCE", "NO_GATE_AUTHORITY"],
  538 |     started_at: startedAt,
  539 |     ended_at: new Date().toISOString(),
  540 |     source: facts,
  541 |     extension_build: {
  542 |       digest: sha256Canonical(buildFiles),
  543 |       inventory: buildFiles,
  544 |     },
  545 |     runtime: {
  546 |       node: process.versions.node,
  547 |       browser: { family: "CHROMIUM", version: browserVersion },
  548 |       hardware,
  549 |       hardware_digest: sha256Canonical(hardware),
  550 |       toolchain_digest: toolchainDigest,
  551 |     },
  552 |     configuration: {
  553 |       settle_budget_ms: 75,
  554 |       rerender_delay_ms: 20,
  555 |       ai_enabled: false,
  556 |       navigation_enabled: false,
  557 |       submission_enabled: false,
  558 |       supported_cohort: W14_CONTACT_COHORT,
  559 |       site_runtime_version: W14_SITE_RUNTIME_VERSION,
  560 |       execution_mode: "SEQUENTIAL_BATCH_V1",
  561 |     },
  562 |     corpus: {
  563 |       ...corpus,
  564 |       parent_manifest_digest: sha256Bytes(
  565 |         readFileSync(
  566 |           "packages/evaluation-corpus/artifacts/development/M02_AUTOFILL_DEVELOPMENT_V1/1.0.0/corpus.manifest.json",
  567 |         ),
  568 |       ),
  569 |       expansion_matrix_digest: matrixDigest,
  570 |     },
  571 |     cases,
  572 |     rows,
  573 |     assessment,
  574 |   };
  575 |   const compressed = gzipSync(JSON.stringify(bundle), { level: 9 });
  576 |   const evidence = {
  577 |     ...assessment,
  578 |     compressed_bundle_digest: sha256Bytes(compressed),
  579 |     compressed_bundle_bytes: compressed.byteLength,
  580 |   };
  581 |   await testInfo.attach("w14-development-run.json.gz", {
  582 |     body: compressed,
  583 |     contentType: "application/gzip",
  584 |   });
  585 |   await testInfo.attach("w14-development-assessment", {
  586 |     body: JSON.stringify(evidence, null, 2),
  587 |     contentType: "application/json",
  588 |   });
  589 |   if (output !== undefined) {
  590 |     mkdirSync(output, { recursive: true });
  591 |     writeFileSync(resolve(output, "development-run.json.gz"), compressed);
  592 |     writeFileSync(
  593 |       resolve(output, "assessment.json"),
  594 |       JSON.stringify(evidence, null, 2) + "\n",
  595 |     );
  596 |   }
  597 |   console.log(
  598 |     `W14_DEVELOPMENT ${JSON.stringify({ recorded_cases: rows.length, metrics: assessment.metrics, safety: physicalSafety, bundle_digest: evidence.compressed_bundle_digest })}`,
  599 |   );
  600 |   // Assertions check measurement integrity and safety, not fabricated product
  601 |   // accuracy. Failed metrics remain reviewable in the saved evidence first.
  602 |   expect(sourceUnchanged).toBe(true);
  603 |   expect(buildUnchanged).toBe(true);
  604 |   expect(orphanActions).toBe(0);
  605 |   expect(rows).toHaveLength(200);
  606 |   expect(new Set(rows.map((row) => row.case_id)).size).toBe(200);
  607 |   expect(safetyCoverage).toEqual({
  608 |     expected_cases: 200,
  609 |     observed_cases: 200,
  610 |     state: "OBSERVED",
  611 |   });
  612 |   expect(
  613 |     rows.filter((row) => row.measurement_state === "MEASUREMENT_ERROR"),
  614 |   ).toEqual([]);
  615 |   expect(Object.values(physicalSafety).every((count) => count === 0)).toBe(
  616 |     true,
  617 |   );
  618 |   expect(assessment.authored_logical_controls).toBe(4020);
  619 |   expect(assessment.observed_native_controls).toBe(4060);
  620 |   expect(
  621 |     rows.filter((row) => row.measurement_state === "REFUSED_INPUT_MODEL"),
  622 |   ).toEqual([]);
  623 |   expect(assessment.metrics.scored_cases).toBe(200);
  624 |   expect(
  625 |     assessment.metrics.ordinary_attempted_precision.rate,
  626 |   ).toBeGreaterThanOrEqual(0.995);
  627 |   expect(
  628 |     assessment.metrics.required_ordinary_recall.rate,
  629 |   ).toBeGreaterThanOrEqual(0.97);
  630 |   expect(assessment.metrics.required_reporting.rate).toBe(1);
  631 |   if (process.env.JAPP_W14_REQUIRE_TARGET_PERFORMANCE === "1") {
  632 |     expect(hardware.platform).toBe("darwin");
  633 |     expect(hardware.cpu_model).toBe("Apple M5");
  634 |     expect(
  635 |       assessment.metrics.full_settle_scan_fill_timing.p95_ms,
> 636 |     ).toBeLessThanOrEqual(1500);
      |       ^ Error: expect(received).toBeLessThanOrEqual(expected)
  637 |   }
  638 |   expect(assessment.metrics.preservation).toEqual({
  639 |     expected: 90,
  640 |     correct: 90,
  641 |     violations: 0,
  642 |     empty_abstention_violations: 0,
  643 |   });
  644 |   for (const family of ATS_FAMILIES) {
  645 |     const contact = rows.find(
  646 |       (row) => row.fixture_id === `W12-${family}-GROUPED-en-US-MY_INFORMATION`,
  647 |     );
  648 |     expect(contact?.score?.rates.required_recall).toEqual({
  649 |       numerator: 9,
  650 |       denominator: 9,
  651 |       rate: 1,
  652 |     });
  653 |     expect(contact?.score?.counts.sensitive_fills).toBe(0);
  654 |   }
  655 | });
  656 | 
```