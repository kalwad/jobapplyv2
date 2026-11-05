# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension/extension-research.spec.ts >> P8 regression: actual matrix work, education and language repeaters create, reorder, rerender and reject ambiguity through W10/W11
- Location: e2e/extension/extension-research.spec.ts:359:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "RECONCILED"
Received: "ROOT_AMBIGUOUS"
```

# Test source

```ts
  217 |     reason_codes: ["SENSITIVE_CONFIRMATION_REQUIRED", "CONFIRMATION_MISSING"],
  218 |   };
  219 | }
  220 | 
  221 | export async function buildTransaction(
  222 |   descriptor: FormFieldDescriptorV1,
  223 |   intended: DriverIntendedValue,
  224 |   decision: FormFieldDecisionV1,
  225 |   seed: string,
  226 | ): Promise<DriverTransactionRequest> {
  227 |   return {
  228 |     transaction_id: await stableSemanticId(
  229 |       "transaction",
  230 |       `w12-research-transaction\0${seed}`,
  231 |     ),
  232 |     correlation_id: decision.correlation_id,
  233 |     address: descriptor.address,
  234 |     decision,
  235 |     intended,
  236 |     settle: { budget_ms: 75 },
  237 |   };
  238 | }
  239 | 
  240 | export async function dynStart(harness: Harness, frameId: string) {
  241 |   const response = await runtimeMessage(
  242 |     harness.controller,
  243 |     buildDynamicStartTabRequest(nextId("start"), harness.tabId, frameId),
  244 |   );
  245 |   const parsed = parseDynamicStartTabResult(response);
  246 |   expect(parsed).not.toBeNull();
  247 |   return requireValue(parsed, "invalid start result").outcome;
  248 | }
  249 | 
  250 | export async function dynStop(harness: Harness, frameId: string) {
  251 |   const response = await runtimeMessage(
  252 |     harness.controller,
  253 |     buildDynamicStopTabRequest(nextId("stop"), harness.tabId, frameId),
  254 |   );
  255 |   const parsed = parseDynamicStopTabResult(response);
  256 |   expect(parsed).not.toBeNull();
  257 |   return requireValue(parsed, "invalid stop result").outcome;
  258 | }
  259 | 
  260 | export async function dynState(
  261 |   harness: Harness,
  262 |   frameId: string,
  263 | ): Promise<DynamicInstrumentationSnapshot> {
  264 |   const response = await runtimeMessage(
  265 |     harness.controller,
  266 |     buildDynamicStateTabRequest(nextId("state"), harness.tabId, frameId),
  267 |   );
  268 |   const parsed = parseDynamicStateTabResult(response);
  269 |   expect(parsed).not.toBeNull();
  270 |   const outcome = requireValue(parsed, "invalid state result").outcome;
  271 |   expect(outcome.status).toBe("COMPLETED");
  272 |   if (outcome.status !== "COMPLETED") {
  273 |     throw new Error("frame unavailable");
  274 |   }
  275 |   return outcome.snapshot;
  276 | }
  277 | 
  278 | export async function dynExecute(
  279 |   harness: Harness,
  280 |   items: readonly DriverTransactionRequest[],
  281 | ) {
  282 |   const response = await runtimeMessage(
  283 |     harness.controller,
  284 |     buildDynamicExecuteTabRequest(nextId("execute"), harness.tabId, [...items]),
  285 |   );
  286 |   const parsed = parseDynamicExecuteTabResult(response);
  287 |   expect(parsed).not.toBeNull();
  288 |   const outcome = requireValue(parsed, "invalid execute result").outcome;
  289 |   expect(outcome.status).toBe("COMPLETED");
  290 |   if (outcome.status !== "COMPLETED") {
  291 |     throw new Error("frame unavailable");
  292 |   }
  293 |   return outcome;
  294 | }
  295 | 
  296 | export async function dynReconcile(
  297 |   harness: Harness,
  298 |   frameId: string,
  299 | ): Promise<DynamicReconcileOutcome | { readonly status: "FRAME_UNAVAILABLE" }> {
  300 |   const response = await runtimeMessage(
  301 |     harness.controller,
  302 |     buildDynamicReconcileTabRequest(
  303 |       nextId("reconcile"),
  304 |       harness.tabId,
  305 |       frameId,
  306 |       await stableSemanticId("cor", nextId("w11-reconcile-cor")),
  307 |     ),
  308 |   );
  309 |   const parsed = parseDynamicReconcileTabResult(response);
  310 |   expect(parsed).not.toBeNull();
  311 |   return requireValue(parsed, "invalid reconcile result").outcome;
  312 | }
  313 | 
  314 | export function reconciled(
  315 |   outcome: Awaited<ReturnType<typeof dynReconcile>>,
  316 | ): Extract<DynamicReconcileOutcome, { readonly status: "RECONCILED" }> {
> 317 |   expect(outcome.status).toBe("RECONCILED");
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  318 |   if (outcome.status !== "RECONCILED") {
  319 |     throw new Error("reconciliation did not complete");
  320 |   }
  321 |   // Every reconciliation crossing the wire must satisfy the canonical
  322 |   // generated contract AND its RECONCILIATION_READINESS semantic rule.
  323 |   expect(validateFormReconciliationInventoryV1(outcome.inventory).valid).toBe(
  324 |     true,
  325 |   );
  326 |   expect(
  327 |     validateSemanticContractV1(
  328 |       "urn:japp:schema:form:reconciliation-inventory:v1",
  329 |       outcome.inventory,
  330 |     ).valid,
  331 |   ).toBe(true);
  332 |   return outcome;
  333 | }
  334 | 
  335 | export function itemFor(
  336 |   outcome: Extract<DynamicReconcileOutcome, { readonly status: "RECONCILED" }>,
  337 |   fieldId: string,
  338 | ) {
  339 |   return requireValue(
  340 |     outcome.inventory.items.find((item) => item.field_id === fieldId),
  341 |     `inventory item for ${fieldId} is missing`,
  342 |   );
  343 | }
  344 | 
  345 | export async function waitForDrain(
  346 |   harness: Harness,
  347 |   frameId: string,
  348 |   minimumBatches: number,
  349 | ): Promise<DynamicInstrumentationSnapshot> {
  350 |   const deadline = Date.now() + DRAIN_TIMEOUT_MS;
  351 |   for (;;) {
  352 |     const snapshot = await dynState(harness, frameId);
  353 |     if (
  354 |       snapshot.queue_length === 0 &&
  355 |       snapshot.batches_processed >= minimumBatches
  356 |     ) {
  357 |       return snapshot;
  358 |     }
  359 |     if (Date.now() > deadline) {
  360 |       throw new Error(
  361 |         `mutation batches did not drain: ${JSON.stringify(snapshot)}`,
  362 |       );
  363 |     }
  364 |     await harness.page.waitForTimeout(DRAIN_POLL_MS);
  365 |   }
  366 | }
  367 | 
```