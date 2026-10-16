# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension/extension-benchmark.spec.ts >> W13 L: total scan and re-resolution scaling includes work outside W11
- Location: e2e/extension/extension-benchmark.spec.ts:61:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1500
Received:    1535.096375000001
```

# Test source

```ts
  101 |       const response = await cdp.send("Performance.getMetrics");
  102 |       const metric = (name: string) => {
  103 |         const value = response.metrics.find(
  104 |           (item) => item.name === name,
  105 |         )?.value;
  106 |         if (value === undefined)
  107 |           throw new Error(`CDP metric unavailable: ${name}`);
  108 |         return value;
  109 |       };
  110 |       return {
  111 |         task_duration_s: metric("TaskDuration"),
  112 |         heap_used_bytes: metric("JSHeapUsedSize"),
  113 |       };
  114 |     };
  115 |     const before = await metrics();
  116 |     const started = performance.now();
  117 |     const top = foundTopFrame(await scanFrames(harness));
  118 |     expect(top.descriptors).toHaveLength(count);
  119 |     const transactions = [];
  120 |     for (const [i, descriptor] of top.descriptors.entries()) {
  121 |       const transaction = await approvedTransaction(
  122 |         descriptor,
  123 |         `w13-scaling-${String(count)}-${String(i)}`,
  124 |         { kind: "TEXT", text: "Synthetic W13" },
  125 |       );
  126 |       // Minimum accepted settle budget isolates a LOWER BOUND on scanning
  127 |       // cost. Final fresh reconciliation still checks every persisted value.
  128 |       transactions.push({ ...transaction, settle: { budget_ms: 0 } });
  129 |     }
  130 |     for (let i = 0; i < transactions.length; i += 32) {
  131 |       const outcome = await dynExecute(harness, transactions.slice(i, i + 32));
  132 |       for (const item of outcome.items) {
  133 |         expect(item.status).toBe("EXECUTED");
  134 |         if (item.status === "EXECUTED") {
  135 |           expect(item.result.outcome).toBe("VERIFIED");
  136 |         }
  137 |       }
  138 |     }
  139 |     const outcome = reconciled(
  140 |       await dynReconcile(harness, top.frame_context.frame_id),
  141 |     );
  142 |     const elapsed = performance.now() - started;
  143 |     const after = await metrics();
  144 |     expect(outcome.inventory.counts.verified_filled).toBe(count);
  145 |     const work = outcome.snapshot.scanner_work;
  146 |     expect(work).toBeDefined();
  147 |     if (work === undefined) throw new Error("total scanner work missing");
  148 |     expect(work.reresolution_calls).toBeGreaterThanOrEqual(4 * count);
  149 |     // Complete identity capture is shared only while observer revision and
  150 |     // context remain current. Four live target resolutions still run/control.
  151 |     expect(work.index_rebuilds).toBe(1);
  152 |     expect(work.index_hits).toBeGreaterThanOrEqual(4 * count - 1);
  153 |     expect(work.identity_pairs_examined).toBe(count);
  154 |     expect(work.candidate_enumerations).toBeLessThanOrEqual(3);
  155 |     expect(work.candidates_examined).toBeLessThanOrEqual(3 * count);
  156 |     expect(work.descriptors_built).toBe(6 * count);
  157 |     const physicalActions = Number(
  158 |       await harness.page.locator("html").getAttribute("data-physical-fills"),
  159 |     );
  160 |     expect(physicalActions).toBe(count);
  161 |     expect(outcome.snapshot.actions_executed).toBe(count);
  162 |     rows.push({
  163 |       control_count: count,
  164 |       actions_attempted: outcome.snapshot.actions_executed,
  165 |       physical_actions_count: physicalActions,
  166 |       total_wall_clock_ms: elapsed,
  167 |       scanner_work: work,
  168 |       w11_scan_duration_ms: outcome.snapshot.total_scan_duration_ms,
  169 |       w11_root_scans: outcome.snapshot.root_rescans,
  170 |       w11_subtree_scans: outcome.snapshot.affected_subtree_scans,
  171 |       cpu_source: "CHROMIUM_CDP_PERFORMANCE_TASK_DURATION_MAIN_PAGE",
  172 |       task_duration_delta_s: after.task_duration_s - before.task_duration_s,
  173 |       heap_source: "CHROMIUM_CDP_PERFORMANCE_JS_HEAP_USED_SIZE_MAIN_PAGE",
  174 |       heap_before_bytes: before.heap_used_bytes,
  175 |       heap_after_bytes: after.heap_used_bytes,
  176 |       settle_budget_ms: 0,
  177 |       evidence_scope: "LOWER_BOUND_NO_ASYNC_RERENDER_DELAY",
  178 |       browser_product: browserVersion.product,
  179 |       browser_revision: browserVersion.revision,
  180 |     });
  181 |     await cdp.detach();
  182 |     await harness.page.close();
  183 |     await harness.controller.close();
  184 |   }
  185 |   const samples = rows
  186 |     .filter((row) => row.control_count === 128)
  187 |     .map((row) => row.total_wall_clock_ms)
  188 |     .sort((a, b) => a - b);
  189 |   const p95 = samples[Math.ceil(0.95 * samples.length) - 1];
  190 |   // Retain all raw observations even when the target assertion fails. This
  191 |   // reporting occurs after every timed sample; it cannot change the budget.
  192 |   console.log(
  193 |     `W13_SCALING ${JSON.stringify({ labels: ["DEVELOPMENT", "HARNESS_VALIDATION", "NOT_GATE_A_FINAL_EVIDENCE"], rows })}`,
  194 |   );
  195 |   await testInfo.attach("w13-total-scan-scaling", {
  196 |     body: JSON.stringify(rows, null, 2),
  197 |     contentType: "application/json",
  198 |   });
  199 |   if (sampleCount === 20) {
  200 |     expect(process.platform).toBe("darwin");
> 201 |     expect(p95).toBeLessThanOrEqual(1500);
      |                 ^ Error: expect(received).toBeLessThanOrEqual(expected)
  202 |   }
  203 |   console.log(
  204 |     `W13_TARGET_P95 ${JSON.stringify({ samples: samples.length, p95_ms: p95, threshold_ms: 1500, settle_budget_ms: 0, scope: "TARGET_MACHINE_LOWER_BOUND_HARNESS_VALIDATION" })}`,
  205 |   );
  206 | });
  207 | 
  208 | test("W13 J: overlapping delayed repeater operations perform one physical click", async ({
  209 |   extensionContext,
  210 |   extensionId,
  211 |   serviceWorker,
  212 | }) => {
  213 |   const harness = await openHarness(
  214 |     extensionContext,
  215 |     extensionId,
  216 |     serviceWorker,
  217 |     "/native/",
  218 |   );
  219 |   await setFixture(
  220 |     harness,
  221 |     `<form data-japp-application-root="true">
  222 |     <section data-japp-repeater="work">
  223 |       <label for="repeat">First name</label>
  224 |       <input id="repeat" data-japp-repeater-controller="true">
  225 |       <button type="button" data-japp-repeater-action="ADD">Add employment</button>
  226 |     </section>
  227 |   </form>`,
  228 |   );
  229 |   await harness.page.evaluate(() => {
  230 |     document.documentElement.dataset.physicalClicks = "0";
  231 |     document.querySelector("button")?.addEventListener("click", () => {
  232 |       document.documentElement.dataset.physicalClicks = String(
  233 |         Number(document.documentElement.dataset.physicalClicks) + 1,
  234 |       );
  235 |       setTimeout(() => {
  236 |         const item = document.createElement("div");
  237 |         item.dataset.jappRepeaterItem = "true";
  238 |         item.dataset.jappItemLabel = "Synthetic employment";
  239 |         document.querySelector("section")?.append(item);
  240 |       }, 30);
  241 |     });
  242 |   });
  243 |   const top = foundTopFrame(await scanFrames(harness));
  244 |   const descriptor = descriptorByLabel(top.descriptors, "First name");
  245 |   const transaction = await buildTransaction(
  246 |     descriptor,
  247 |     { kind: "REPEATER_ADD", item_label: "Synthetic employment" },
  248 |     await fillDecision(descriptor, "w13-repeater-overlap"),
  249 |     "w13-repeater-overlap",
  250 |   );
  251 |   const outcomes = await Promise.all([
  252 |     dynExecute(harness, [transaction]),
  253 |     dynExecute(harness, [{ ...transaction }]),
  254 |   ]);
  255 |   expect(outcomes).toHaveLength(2);
  256 |   expect(
  257 |     await harness.page.locator("html").getAttribute("data-physical-clicks"),
  258 |   ).toBe("1");
  259 | });
  260 | 
  261 | test("W13 K: required control beyond capacity cannot receive a complete readiness proof", async ({
  262 |   extensionContext,
  263 |   extensionId,
  264 |   serviceWorker,
  265 | }) => {
  266 |   const harness = await openHarness(
  267 |     extensionContext,
  268 |     extensionId,
  269 |     serviceWorker,
  270 |     "/generic/basic",
  271 |   );
  272 |   const controls = Array.from(
  273 |     { length: 513 },
  274 |     (_, index) =>
  275 |       `<label for="field${String(index)}">Field ${String(index)}</label><input id="field${String(index)}" name="field${String(index)}" ${index === 512 ? "required" : ""}>`,
  276 |   ).join("");
  277 |   await setFixture(
  278 |     harness,
  279 |     `<form data-japp-application-root="true">${controls}</form>`,
  280 |   );
  281 |   const frames = await scanFrames(harness);
  282 |   const top = frames.find((frame) => frame.frame_context.is_top_frame);
  283 |   expect(top).toBeDefined();
  284 |   if (top === undefined) throw new Error("top frame unavailable");
  285 |   expect(top.root_status).toBe("CAPACITY_EXCEEDED");
  286 |   expect(top.descriptors).toHaveLength(0);
  287 |   const outcome = await dynReconcile(harness, top.frame_context.frame_id);
  288 |   expect(outcome.status).toBe("CAPACITY_EXCEEDED");
  289 |   expect("inventory" in outcome).toBe(false);
  290 | });
  291 | 
  292 | test("W13 K: observation beginning over capacity requires a complete recovery scan", async ({
  293 |   extensionContext,
  294 |   extensionId,
  295 |   serviceWorker,
  296 | }) => {
  297 |   test.setTimeout(120_000);
  298 |   const harness = await openHarness(
  299 |     extensionContext,
  300 |     extensionId,
  301 |     serviceWorker,
```