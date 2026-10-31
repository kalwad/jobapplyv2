# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension/extension-w14-w06.spec.ts >> W14 W06: account for all 32 original cases with mounted real-MV3 contact execution
- Location: e2e/extension/extension-w14-w06.spec.ts:319:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 43
Received: 42
```

# Test source

```ts
  502 |           (n, frame) => n + frame.state.physical.buttonClicks,
  503 |           0,
  504 |         ),
  505 |       0,
  506 |     ),
  507 |     submissions: rows.reduce(
  508 |       (sum, row) =>
  509 |         sum +
  510 |         row.after.reduce((n, frame) => n + frame.state.physical.submissions, 0),
  511 |       0,
  512 |     ),
  513 |   };
  514 |   const endSource = sourceSnapshot();
  515 |   const assessment = {
  516 |     format_version: "W14_W06_MOUNTED_CONTACT_ASSESSMENT_1",
  517 |     authority: "NONE",
  518 |     gate_decision: "NOT_DECIDED",
  519 |     complete_development_gate_evidence: false,
  520 |     expected_catalog_cases: FIXTURE_CASES.length,
  521 |     recorded_catalog_cases: rows.length,
  522 |     expected_contact_controls: fields.filter((field) => field.supported_contact)
  523 |       .length,
  524 |     correct_contact_controls: fields.filter(
  525 |       (field) => field.correct_contact_fill,
  526 |     ).length,
  527 |     unreported_required_controls: fields.filter(
  528 |       (field) => field.required_unreported,
  529 |     ).length,
  530 |     scanner_gaps: fields.filter((field) => field.scanner_gap).length,
  531 |     errors: rows.filter((row) => row.error !== null).length,
  532 |     safety,
  533 |     source_unchanged:
  534 |       source.digest === endSource.digest &&
  535 |       source.commit === endSource.commit &&
  536 |       source.tree === endSource.tree,
  537 |     build_unchanged:
  538 |       sha256Canonical(build) === sha256Canonical(builtFiles(EXTENSION_DIST)),
  539 |     limitations: [
  540 |       "All 32 frozen catalog cases are accounted for, not 32 successful fill scenarios.",
  541 |       "67 frozen W03 scenario transitions remain separately NOT_EXERCISED; no transition, upload, non-contact widget, receipt or navigation certification follows.",
  542 |       "This supplementary 11-fact contact profile is not byte-identical to the W12 10-fact input.",
  543 |       "Open-shadow scanner gaps and missing required reports are failures, never safe abstention credit.",
  544 |       "125ms settle and single mounted-route executions are not Gate A p95 performance proof.",
  545 |       "W06 baseline/fixture/schema record checks remain a separate required evidence slice.",
  546 |     ],
  547 |   };
  548 |   const bundle = {
  549 |     format_version: "W14_W06_MOUNTED_CONTACT_RUN_1",
  550 |     authority: "NONE",
  551 |     expected,
  552 |     expected_digest: expectedDigest,
  553 |     source,
  554 |     build,
  555 |     runtime: {
  556 |       browser: extensionContext.browser()?.version() ?? "UNKNOWN",
  557 |       node: process.versions.node,
  558 |       hardware: {
  559 |         platform: platform(),
  560 |         architecture: arch(),
  561 |         cpu_model: cpus()[0]?.model ?? "UNKNOWN",
  562 |         memory_bytes: totalmem(),
  563 |       },
  564 |     },
  565 |     configuration: {
  566 |       mounted_pages: true,
  567 |       body_replacement: false,
  568 |       artificial_rerender: false,
  569 |       settle_budget_ms: 125,
  570 |       navigation_enabled: false,
  571 |       submission_enabled: false,
  572 |       trace_mode: testInfo.project.use.trace ?? "UNSPECIFIED",
  573 |     },
  574 |     rows,
  575 |     assessment,
  576 |   };
  577 |   const compressed = gzipSync(JSON.stringify(bundle));
  578 |   await testInfo.attach("w14-w06-mounted-run.json.gz", {
  579 |     body: compressed,
  580 |     contentType: "application/gzip",
  581 |   });
  582 |   if (directory !== undefined) {
  583 |     writeFileSync(resolve(directory, "mounted-run.json.gz"), compressed);
  584 |     writeFileSync(
  585 |       resolve(directory, "assessment.json"),
  586 |       JSON.stringify(
  587 |         { ...assessment, compressed_bundle_digest: sha256Bytes(compressed) },
  588 |         null,
  589 |         2,
  590 |       ) + "\n",
  591 |     );
  592 |   }
  593 |   // Retain all raw outcomes before correctness assertions; no unsupported
  594 |   // case is omitted and no acceptance threshold is weakened to get green.
  595 |   expect(rows.map((row) => row.fixture_id)).toEqual(
  596 |     FIXTURE_CASES.map((item) => item.id),
  597 |   );
  598 |   expect(assessment.source_unchanged).toBe(true);
  599 |   expect(assessment.build_unchanged).toBe(true);
  600 |   expect(assessment.errors).toBe(0);
  601 |   expect(rows.flatMap((row) => row.missing_cohort_controls)).toEqual([]);
> 602 |   expect(assessment.correct_contact_controls).toBe(
      |                                               ^ Error: expect(received).toBe(expected) // Object.is equality
  603 |     assessment.expected_contact_controls,
  604 |   );
  605 |   expect(assessment.unreported_required_controls).toBe(0);
  606 |   expect(assessment.scanner_gaps).toBe(0);
  607 |   expect(safety).toEqual({
  608 |     unsupported_writes: 0,
  609 |     unsupported_value_changes: 0,
  610 |     duplicate_primary_events: 0,
  611 |     button_clicks: 0,
  612 |     submissions: 0,
  613 |   });
  614 |   expect(rows.every((row) => row.final_url_unchanged)).toBe(true);
  615 | });
  616 | 
```