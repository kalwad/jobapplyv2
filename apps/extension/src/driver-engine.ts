// M02-W10 frame-local transaction kernel. It composes control-specific
// drivers around canonical W09 authority and W08 current-document semantic
// resolution. No Element reference, selector, or raw value crosses the wire.
import type {
  FormDriverResultV1,
  FormFieldAddressV1,
  FormFieldDescriptorV1,
} from "@japp/contracts/generated";

import {
  dateObservation,
  evidenceFromObservation,
  fieldAddressDigest,
  fileObservation,
  observationsEquivalent,
  optionObservation,
  repeaterObservation,
  synthesizeOutcome,
  textObservation,
  checkedObservation,
  UNOBSERVED,
  type SemanticObservation,
  type TransactionPhase,
} from "./driver-evidence.ts";
import {
  decisionAuthorizesExecution,
  decisionRefusalClass,
  isCanonicalDriverResult,
  MAX_UNDO_RECORDS,
  type DriverDiagnostics,
  type DriverIntendedValue,
  type DriverTransactionRequest,
  type NavigationIdentification,
  type UndoTransactionRequest,
} from "./driver-protocol.ts";
import {
  detectApplicationRoot,
  isElementEnabled,
  isElementVisible,
  resolveFieldTarget,
  type FieldTargetResolution,
  type ResolvedFieldTarget,
} from "./field-scanner.ts";
import type { FrameContext } from "./scanner-protocol.ts";
import { semanticDigest, stableSemanticId } from "./semantic-identity.ts";
import {
  checkboxDriver,
  nativeSelectDriver,
  radioGroupDriver,
} from "./drivers/choice-drivers.ts";
import type {
  ControlDriver,
  DriverContext,
} from "./drivers/driver-contract.ts";
import { readSiteAcceptance, settleWindow } from "./drivers/driver-dom.ts";
import { fileUploadDriver } from "./drivers/file-upload-driver.ts";
import { repeaterDriver } from "./drivers/repeater-driver.ts";
import { dateDriver, textDriver } from "./drivers/text-like-drivers.ts";
import {
  ariaComboboxDriver,
  scrollListboxDriver,
  workdayPromptResearchDriver,
} from "./drivers/widget-drivers.ts";

const DEFAULT_DRIVERS: readonly ControlDriver[] = [
  textDriver,
  dateDriver,
  nativeSelectDriver,
  radioGroupDriver,
  checkboxDriver,
  ariaComboboxDriver,
  scrollListboxDriver,
  repeaterDriver,
  fileUploadDriver,
  workdayPromptResearchDriver,
];

interface Preconditions {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly generation_matched: boolean;
  readonly policy_permitted: boolean;
}

interface UndoRecord {
  readonly transaction: DriverTransactionRequest;
  readonly driverKey: string;
  readonly payload: unknown;
  readonly priorObservation: SemanticObservation;
  readonly intendedObservation: SemanticObservation;
  consumed: boolean;
}

interface ResultInput {
  readonly transaction: DriverTransactionRequest;
  readonly operation: "EXECUTE" | "UNDO";
  readonly driverKey: string;
  readonly resolution: FormDriverResultV1["resolution_result"];
  readonly preconditions: Preconditions;
  readonly intended: SemanticObservation;
  readonly immediate: SemanticObservation;
  readonly settled: SemanticObservation;
  readonly siteAcceptance: FormDriverResultV1["site_acceptance"];
  readonly validationMessageDigests: readonly string[];
  readonly conditionalFieldIds: readonly string[];
  readonly settledGeneration: number;
  readonly phase: TransactionPhase;
  readonly attemptedAt: string;
  readonly durationMs: number;
  readonly recovery?: FormDriverResultV1["recovery"];
}

export interface DriverExecution {
  readonly result: FormDriverResultV1;
  readonly undoAvailable: boolean;
  readonly diagnostics: DriverDiagnostics;
}

export interface DriverUndoExecution {
  readonly status: "COMPLETED";
  readonly result: FormDriverResultV1;
  readonly diagnostics: DriverDiagnostics;
}

function resolutionClass(
  resolution: FieldTargetResolution,
): FormDriverResultV1["resolution_result"] {
  if (resolution.status === "AMBIGUOUS") {
    return "AMBIGUOUS";
  }
  if (resolution.status === "RESOLVED") {
    return "UNIQUE";
  }
  return resolution.reason === "NO_MATCH" ? "MISSING" : "STALE";
}

function resolutionPhase(
  resolution: FieldTargetResolution,
): Extract<TransactionPhase, { readonly phase: "RESOLUTION_FAILED" }> {
  const classified = resolutionClass(resolution);
  return {
    phase: "RESOLUTION_FAILED",
    resolution: classified === "UNIQUE" ? "STALE" : classified,
    documentChanged:
      resolution.status === "UNRESOLVED" && resolution.reason !== "NO_MATCH",
  };
}

function targetVisible(target: ResolvedFieldTarget): boolean {
  return target.descriptor.control_kind === "RADIO_GROUP"
    ? target.members.some(isElementVisible)
    : isElementVisible(target.anchor);
}

function targetEnabled(target: ResolvedFieldTarget): boolean {
  return target.descriptor.control_kind === "RADIO_GROUP"
    ? target.members.some(isElementEnabled)
    : isElementEnabled(target.anchor);
}

function generationMatches(
  target: ResolvedFieldTarget,
  address: FormFieldAddressV1,
): boolean {
  return (
    target.descriptor.observed_dom_generation ===
      address.observed_dom_generation &&
    target.descriptor.address.session_id === address.session_id &&
    target.descriptor.address.frame_id === address.frame_id &&
    target.descriptor.address.document_id === address.document_id
  );
}

function driverContext(
  document: Document,
  target: ResolvedFieldTarget,
  intended: DriverIntendedValue,
): DriverContext {
  return { document, target, intended };
}

export function matchingControlDrivers(
  drivers: readonly ControlDriver[],
  descriptor: FormFieldDescriptorV1,
  anchor: HTMLElement,
  intended: DriverIntendedValue,
): ControlDriver[] {
  return drivers.filter((driver) =>
    driver.detect(descriptor, anchor, intended),
  );
}

function driverCandidates(
  drivers: readonly ControlDriver[],
  target: ResolvedFieldTarget,
  intended: DriverIntendedValue,
): ControlDriver[] {
  return matchingControlDrivers(
    drivers,
    target.descriptor,
    target.anchor,
    intended,
  );
}

function intendedObservation(
  intended: DriverIntendedValue,
): SemanticObservation {
  switch (intended.kind) {
    case "TEXT":
      return textObservation(intended.text);
    case "OPTION":
      return optionObservation(intended.value_digest);
    case "CHECKED":
      return checkedObservation(intended.checked);
    case "DATE":
      return dateObservation(intended.iso_date);
    case "FILE":
      return fileObservation({
        name: intended.file_name,
        mediaType: intended.media_type,
        sizeBytes: intended.size_bytes,
        artifactDigest: intended.artifact_digest,
      });
    case "REPEATER_ADD":
      return repeaterObservation("ADD", intended.item_label, "PRESENT");
    case "REPEATER_EDIT":
      return repeaterObservation("EDIT", intended.item_label, intended.text);
    case "REPEATER_REMOVE":
      return repeaterObservation("REMOVE", intended.item_label, "\0ABSENT\0");
  }
}

function boundedDuration(started: number): number {
  return Math.min(
    600_000,
    Math.max(0, Math.round(performance.now() - started)),
  );
}

function currentConditionalFields(
  starting: readonly string[],
  settled: readonly string[],
): string[] {
  const known = new Set(starting);
  return [...new Set(settled.filter((fieldId) => !known.has(fieldId)))]
    .sort()
    .slice(0, 64);
}

async function buildResult(input: ResultInput): Promise<FormDriverResultV1> {
  const synthesis = synthesizeOutcome(input.phase);
  const transaction = input.transaction;
  const result: FormDriverResultV1 = {
    result_id: await stableSemanticId(
      "result",
      `w10-result-v1\0${transaction.transaction_id}\0${input.operation}\0${synthesis.outcome}`,
    ),
    driver_id: await stableSemanticId(
      "driver",
      `w10-driver-v1\0${input.driverKey}`,
    ),
    session_id: transaction.address.session_id,
    field_address: transaction.address,
    resolution_result: input.resolution,
    preconditions: input.preconditions,
    action_attempt: {
      attempt_id: await stableSemanticId(
        "attempt",
        `w10-attempt-v1\0${transaction.transaction_id}\0${input.operation}`,
      ),
      attempted_at: input.attemptedAt,
      action_count: 1,
      duration_ms: input.durationMs,
      idempotency_key: await stableSemanticId(
        "idem",
        `w10-idempotency-v1\0${transaction.transaction_id}\0${input.operation}`,
      ),
    },
    intended_value: await evidenceFromObservation(input.intended),
    observed_value_immediate: await evidenceFromObservation(input.immediate),
    observed_value_settled: await evidenceFromObservation(input.settled),
    site_acceptance: input.siteAcceptance,
    validation_message_digests: input.validationMessageDigests.slice(0, 8),
    conditional_field_ids: input.conditionalFieldIds.slice(0, 64),
    starting_dom_generation: transaction.address.observed_dom_generation,
    settled_dom_generation: input.settledGeneration,
    persistence_verified: synthesis.persistence_verified,
    safe_retry_allowed: synthesis.safe_retry_allowed,
    outcome: synthesis.outcome,
    reason_codes: synthesis.reason_codes,
    correlation_id: transaction.correlation_id,
    causation_id: transaction.decision.decision_id,
    ...(input.recovery === undefined ? {} : { recovery: input.recovery }),
  };
  if (!isCanonicalDriverResult(result)) {
    throw new Error("driver invariant: constructed result is not canonical");
  }
  return result;
}

function emptyPreconditions(): Preconditions {
  return {
    visible: false,
    enabled: false,
    generation_matched: false,
    policy_permitted: false,
  };
}

function diagnostics(
  driverCandidateCount: number,
  settlePolls = 0,
  signalObserved = false,
): DriverDiagnostics {
  return {
    driver_candidate_count: driverCandidateCount,
    settle_polls: settlePolls,
    settle_signal_observed: signalObserved,
  };
}

/** One transaction engine instance belongs to exactly one frame agent. */
export class DriverTransactionEngine {
  readonly #drivers: readonly ControlDriver[];
  readonly #undoRecords = new Map<string, UndoRecord>();

  constructor(drivers: readonly ControlDriver[] = DEFAULT_DRIVERS) {
    this.#drivers = [...drivers];
  }

  #retainUndo(transactionId: string, record: UndoRecord): void {
    this.#undoRecords.delete(transactionId);
    this.#undoRecords.set(transactionId, record);
    while (this.#undoRecords.size > MAX_UNDO_RECORDS) {
      const oldest = this.#undoRecords.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.#undoRecords.delete(oldest);
    }
  }

  async execute(
    document: Document,
    frameContext: FrameContext,
    transaction: DriverTransactionRequest,
  ): Promise<DriverExecution> {
    const started = performance.now();
    const attemptedAt = new Date().toISOString();
    const intended = intendedObservation(transaction.intended);
    const resolved = await resolveFieldTarget(
      document,
      frameContext,
      transaction.address,
    );
    if (resolved.status !== "RESOLVED") {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: "NO_RESOLVED_DRIVER",
          resolution: resolutionClass(resolved),
          preconditions: emptyPreconditions(),
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase: resolutionPhase(resolved),
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(0),
      };
    }

    const target = resolved.target;
    const candidates = driverCandidates(
      this.#drivers,
      target,
      transaction.intended,
    );
    const addressDigest = await fieldAddressDigest(transaction.address);
    const policyPermitted =
      decisionAuthorizesExecution(transaction.decision) &&
      transaction.decision.policy_decision === "PERMIT" &&
      transaction.decision.field_address_digest === addressDigest &&
      transaction.decision.field_id === target.descriptor.field_id &&
      transaction.decision.correlation_id === transaction.correlation_id;
    const preconditions: Preconditions = {
      visible: target.descriptor.visible && targetVisible(target),
      enabled: target.descriptor.enabled && targetEnabled(target),
      generation_matched: generationMatches(target, transaction.address),
      policy_permitted: policyPermitted,
    };

    if (!policyPermitted) {
      const refusal = decisionRefusalClass(transaction.decision);
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: candidates[0]?.driverKey ?? "AUTHORITY_REFUSED",
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: target.descriptor.observed_dom_generation,
          phase: {
            phase: "DECISION_REFUSED",
            sensitive: refusal === "BLOCKED_SENSITIVE",
          },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(candidates.length),
      };
    }

    if (candidates.length !== 1) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey:
            candidates.length === 0 ? "UNSUPPORTED" : "AMBIGUOUS_DRIVER",
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: target.descriptor.observed_dom_generation,
          phase:
            candidates.length === 0
              ? { phase: "DRIVER_UNSUPPORTED" }
              : { phase: "DRIVER_AMBIGUOUS" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(candidates.length),
      };
    }

    const driver = candidates[0];
    if (driver === undefined) {
      throw new Error("driver invariant: unique candidate unavailable");
    }
    const initialContext = driverContext(
      document,
      target,
      transaction.intended,
    );
    if (
      !preconditions.visible ||
      !preconditions.enabled ||
      !preconditions.generation_matched
    ) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: target.descriptor.observed_dom_generation,
          phase: { phase: "PRECONDITIONS_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(1),
      };
    }

    const initialCheck = await driver.checkPreconditions(initialContext);
    if (!initialCheck.ok) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: target.descriptor.observed_dom_generation,
          phase: { phase: "PRECONDITIONS_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(1),
      };
    }
    const captured = await driver.captureUndo(initialContext);

    // Load-bearing immediately-before-action re-resolution. The action uses
    // only this fresh target and repeats driver-specific preconditions.
    const actionResolution = await resolveFieldTarget(
      document,
      frameContext,
      transaction.address,
    );
    if (actionResolution.status !== "RESOLVED") {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: resolutionClass(actionResolution),
          preconditions: { ...preconditions, generation_matched: false },
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase: resolutionPhase(actionResolution),
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(1),
      };
    }
    const freshTarget = actionResolution.target;
    const freshCandidates = driverCandidates(
      this.#drivers,
      freshTarget,
      transaction.intended,
    );
    const freshContext = driverContext(
      document,
      freshTarget,
      transaction.intended,
    );
    const freshCheck =
      freshCandidates.length === 1 &&
      freshCandidates[0]?.driverKey === driver.driverKey &&
      targetVisible(freshTarget) &&
      targetEnabled(freshTarget) &&
      generationMatches(freshTarget, transaction.address)
        ? await driver.checkPreconditions(freshContext)
        : { ok: false as const };
    if (!freshCheck.ok) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "UNIQUE",
          preconditions: { ...preconditions, generation_matched: false },
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: freshTarget.descriptor.observed_dom_generation,
          phase: { phase: "PRECONDITIONS_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(freshCandidates.length),
      };
    }

    let actionPerformed = false;
    try {
      if (!freshCheck.alreadySatisfied) {
        // Mark the attempt before entering driver code: a driver can mutate
        // partially and then throw, in which case bounded recovery is still
        // mandatory.
        actionPerformed = true;
        await driver.execute(freshContext);
      }
    } catch {
      let recovery: FormDriverResultV1["recovery"] | undefined;
      let recoveryRestored = false;
      if (actionPerformed && captured.restorable) {
        let recoveredObservation = UNOBSERVED;
        const recoveryResolution = await resolveFieldTarget(
          document,
          frameContext,
          transaction.address,
        );
        if (recoveryResolution.status === "RESOLVED") {
          const recoveryCandidates = driverCandidates(
            this.#drivers,
            recoveryResolution.target,
            transaction.intended,
          );
          if (
            recoveryCandidates.length === 1 &&
            recoveryCandidates[0]?.driverKey === driver.driverKey
          ) {
            const recoveryContext = driverContext(
              document,
              recoveryResolution.target,
              transaction.intended,
            );
            try {
              await driver.applyUndo(recoveryContext, captured.payload);
              recoveredObservation = await driver.observe(recoveryContext);
              recoveryRestored = observationsEquivalent(
                recoveredObservation,
                captured.priorObservation,
              );
            } catch {
              // The result remains an honest failed recovery; the retained
              // undo record permits one explicit, freshly resolved attempt.
            }
          }
        }
        recovery = {
          attempted: true,
          restored: recoveryRestored,
          evidence_digest: (await evidenceFromObservation(recoveredObservation))
            .semantic_digest,
        };
      }
      if (actionPerformed && captured.restorable && !recoveryRestored) {
        this.#retainUndo(transaction.transaction_id, {
          transaction,
          driverKey: driver.driverKey,
          payload: captured.payload,
          priorObservation: captured.priorObservation,
          intendedObservation: intended,
          consumed: false,
        });
      }
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: freshTarget.descriptor.observed_dom_generation,
          phase: { phase: "ACTION_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
          ...(recovery === undefined ? {} : { recovery }),
        }),
        undoAvailable:
          actionPerformed && captured.restorable && !recoveryRestored,
        diagnostics: diagnostics(1),
      };
    }

    const immediate = await driver.observe(freshContext);
    if (actionPerformed && captured.restorable) {
      this.#retainUndo(transaction.transaction_id, {
        transaction,
        driverKey: driver.driverKey,
        payload: captured.payload,
        priorObservation: captured.priorObservation,
        intendedObservation: intended,
        consumed: false,
      });
    }

    const settle = await settleWindow(document, transaction.settle);
    if (settle.timedOut) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "UNIQUE",
          preconditions,
          intended,
          immediate,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: freshTarget.descriptor.observed_dom_generation,
          phase: { phase: "SETTLE_TIMEOUT" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: actionPerformed && captured.restorable,
        diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
      };
    }

    const settledResolution = await resolveFieldTarget(
      document,
      frameContext,
      transaction.address,
    );
    if (settledResolution.status !== "RESOLVED") {
      const classified = resolutionClass(settledResolution);
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: classified,
          preconditions,
          intended,
          immediate,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase: {
            phase: "SETTLED_TARGET_LOST",
            resolution: classified === "UNIQUE" ? "STALE" : classified,
          },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: actionPerformed && captured.restorable,
        diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
      };
    }
    const settledTarget = settledResolution.target;
    const settledCandidates = driverCandidates(
      this.#drivers,
      settledTarget,
      transaction.intended,
    );
    if (
      settledCandidates.length !== 1 ||
      settledCandidates[0]?.driverKey !== driver.driverKey ||
      !generationMatches(settledTarget, transaction.address)
    ) {
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "STALE",
          preconditions,
          intended,
          immediate,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: settledTarget.descriptor.observed_dom_generation,
          phase: { phase: "SETTLED_TARGET_LOST", resolution: "STALE" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: actionPerformed && captured.restorable,
        diagnostics: diagnostics(
          settledCandidates.length,
          settle.polls,
          settle.signalObserved,
        ),
      };
    }
    const settledContext = driverContext(
      document,
      settledTarget,
      transaction.intended,
    );
    const settled = await driver.observe(settledContext);
    const acceptance = await readSiteAcceptance(
      driver.acceptanceElements?.(settledContext) ?? [
        settledTarget.anchor,
        ...settledTarget.members,
      ],
    );
    const conditionalFieldIds = currentConditionalFields(
      target.allFieldIds,
      settledTarget.allFieldIds,
    );
    const phase: TransactionPhase = {
      phase: "COMPLETE",
      immediateMatches: observationsEquivalent(immediate, intended),
      settledMatches: observationsEquivalent(settled, intended),
      siteAcceptance: acceptance.acceptance,
      validationMessageCount: acceptance.messageDigests.length,
      conditionalFieldsDiscovered: conditionalFieldIds.length > 0,
    };
    return {
      result: await buildResult({
        transaction,
        operation: "EXECUTE",
        driverKey: driver.driverKey,
        resolution: "UNIQUE",
        preconditions,
        intended,
        immediate,
        settled,
        siteAcceptance: acceptance.acceptance,
        validationMessageDigests: acceptance.messageDigests,
        conditionalFieldIds,
        settledGeneration: settledTarget.descriptor.observed_dom_generation,
        phase,
        attemptedAt,
        durationMs: boundedDuration(started),
      }),
      undoAvailable: actionPerformed && captured.restorable,
      diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
    };
  }

  async undo(
    document: Document,
    frameContext: FrameContext,
    undo: UndoTransactionRequest,
  ): Promise<
    | DriverUndoExecution
    | { readonly status: "UNKNOWN_TRANSACTION" | "ALREADY_CONSUMED" }
  > {
    const record = this.#undoRecords.get(undo.transaction_id);
    if (record === undefined) {
      return { status: "UNKNOWN_TRANSACTION" };
    }
    if (record.consumed) {
      return { status: "ALREADY_CONSUMED" };
    }
    record.consumed = true;
    const started = performance.now();
    const attemptedAt = new Date().toISOString();
    const transaction = record.transaction;
    const wrongAddress =
      (await fieldAddressDigest(undo.address)) !==
      (await fieldAddressDigest(transaction.address));
    let resolved = wrongAddress
      ? ({ status: "UNRESOLVED", reason: "STALE_DOCUMENT" } as const)
      : await resolveFieldTarget(document, frameContext, undo.address);
    if (resolved.status !== "RESOLVED") {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: resolutionClass(resolved),
          preconditions: emptyPreconditions(),
          intended: record.priorObservation,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase: resolutionPhase(resolved),
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(0),
      };
    }
    const candidates = driverCandidates(
      this.#drivers,
      resolved.target,
      transaction.intended,
    );
    const driver = candidates.find(
      (candidate) => candidate.driverKey === record.driverKey,
    );
    const currentContext =
      driver === undefined
        ? null
        : driverContext(document, resolved.target, transaction.intended);
    const current =
      currentContext === null || driver === undefined
        ? UNOBSERVED
        : await driver.observe(currentContext);
    const preconditions: Preconditions = {
      visible: targetVisible(resolved.target),
      enabled: targetEnabled(resolved.target),
      generation_matched: generationMatches(
        resolved.target,
        transaction.address,
      ),
      policy_permitted: true,
    };
    if (
      driver === undefined ||
      candidates.length !== 1 ||
      !preconditions.visible ||
      !preconditions.enabled ||
      !preconditions.generation_matched ||
      !observationsEquivalent(current, record.intendedObservation)
    ) {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: candidates.length > 1 ? "AMBIGUOUS" : "STALE",
          preconditions,
          intended: record.priorObservation,
          immediate: current,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: resolved.target.descriptor.observed_dom_generation,
          phase:
            candidates.length > 1
              ? {
                  phase: "RESOLUTION_FAILED",
                  resolution: "AMBIGUOUS",
                  documentChanged: false,
                }
              : { phase: "PRECONDITIONS_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(candidates.length),
      };
    }

    // Re-resolve once more immediately before the restoration action.
    resolved = await resolveFieldTarget(document, frameContext, undo.address);
    if (resolved.status !== "RESOLVED") {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: resolutionClass(resolved),
          preconditions: { ...preconditions, generation_matched: false },
          intended: record.priorObservation,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase: resolutionPhase(resolved),
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(1),
      };
    }
    const actionCandidates = driverCandidates(
      this.#drivers,
      resolved.target,
      transaction.intended,
    );
    const actionDriver = actionCandidates.find(
      (candidate) => candidate.driverKey === record.driverKey,
    );
    if (actionCandidates.length !== 1 || actionDriver === undefined) {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: actionCandidates.length > 1 ? "AMBIGUOUS" : "STALE",
          preconditions: { ...preconditions, generation_matched: false },
          intended: record.priorObservation,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: resolved.target.descriptor.observed_dom_generation,
          phase:
            actionCandidates.length > 1
              ? {
                  phase: "RESOLUTION_FAILED",
                  resolution: "AMBIGUOUS",
                  documentChanged: false,
                }
              : { phase: "PRECONDITIONS_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(actionCandidates.length),
      };
    }
    const actionContext = driverContext(
      document,
      resolved.target,
      transaction.intended,
    );
    try {
      await actionDriver.applyUndo(actionContext, record.payload);
    } catch {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: "UNIQUE",
          preconditions,
          intended: record.priorObservation,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: resolved.target.descriptor.observed_dom_generation,
          phase: { phase: "ACTION_FAILED" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(1),
      };
    }
    const immediate = await actionDriver.observe(actionContext);
    const settle = await settleWindow(document, undo.settle);
    const settledResolution = await resolveFieldTarget(
      document,
      frameContext,
      undo.address,
    );
    if (settle.timedOut || settledResolution.status !== "RESOLVED") {
      const settledClass = resolutionClass(settledResolution);
      const failedClass: "AMBIGUOUS" | "MISSING" | "STALE" =
        settledClass === "UNIQUE" ? "STALE" : settledClass;
      const phase: TransactionPhase = settle.timedOut
        ? { phase: "SETTLE_TIMEOUT" }
        : {
            phase: "SETTLED_TARGET_LOST",
            resolution: failedClass,
          };
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution:
            settledResolution.status === "RESOLVED"
              ? "UNIQUE"
              : resolutionClass(settledResolution),
          preconditions,
          intended: record.priorObservation,
          immediate,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: transaction.address.observed_dom_generation,
          phase,
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
      };
    }
    const settledContext = driverContext(
      document,
      settledResolution.target,
      transaction.intended,
    );
    const settled = await actionDriver.observe(settledContext);
    const acceptance = await readSiteAcceptance(
      actionDriver.acceptanceElements?.(settledContext) ?? [
        settledResolution.target.anchor,
        ...settledResolution.target.members,
      ],
    );
    const phase: TransactionPhase = {
      phase: "COMPLETE",
      immediateMatches: observationsEquivalent(
        immediate,
        record.priorObservation,
      ),
      settledMatches: observationsEquivalent(settled, record.priorObservation),
      siteAcceptance: acceptance.acceptance,
      validationMessageCount: acceptance.messageDigests.length,
      conditionalFieldsDiscovered: false,
    };
    return {
      status: "COMPLETED",
      result: await buildResult({
        transaction,
        operation: "UNDO",
        driverKey: record.driverKey,
        resolution: "UNIQUE",
        preconditions,
        intended: record.priorObservation,
        immediate,
        settled,
        siteAcceptance: acceptance.acceptance,
        validationMessageDigests: acceptance.messageDigests,
        conditionalFieldIds: [],
        settledGeneration:
          settledResolution.target.descriptor.observed_dom_generation,
        phase,
        attemptedAt,
        durationMs: boundedDuration(started),
      }),
      diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
    };
  }
}

const SAFE_NAVIGATION_NAMES = new Set([
  "CONTINUE",
  "CONTINUE APPLICATION",
  "NEXT",
  "NEXT STEP",
]);
const UNSAFE_NAVIGATION_NAMES = new Set([
  "APPLY",
  "COMPLETE APPLICATION",
  "CREATE ACCOUNT",
  "FINISH",
  "SUBMIT",
  "SUBMIT APPLICATION",
]);

function navigationName(element: HTMLElement): string {
  const aria = element.getAttribute("aria-label");
  const value =
    element instanceof HTMLInputElement ? element.value : element.textContent;
  return (aria ?? value)
    .normalize("NFKC")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Read-only research identification; this module has no navigation action. */
export async function identifyNavigationCandidate(
  document: Document,
): Promise<NavigationIdentification> {
  const root = detectApplicationRoot(document);
  if (root.status !== "FOUND") {
    return { status: "MISSING", candidate_count: 0 };
  }
  const candidates = [
    ...root.root.querySelectorAll<HTMLElement>(
      "button,input[type='button'],input[type='submit'],[role='button']",
    ),
  ].filter((element) => isElementVisible(element) && isElementEnabled(element));
  const unsafe = candidates.filter((element) =>
    UNSAFE_NAVIGATION_NAMES.has(navigationName(element)),
  );
  if (unsafe.length > 0) {
    return { status: "UNSAFE", candidate_count: unsafe.length };
  }
  const safe = candidates.filter((element) =>
    SAFE_NAVIGATION_NAMES.has(navigationName(element)),
  );
  if (safe.length === 0) {
    return { status: "MISSING", candidate_count: 0 };
  }
  if (safe.length > 1) {
    return { status: "AMBIGUOUS", candidate_count: safe.length };
  }
  const candidate = safe[0];
  if (candidate === undefined) {
    return { status: "MISSING", candidate_count: 0 };
  }
  return {
    status: "UNIQUE_SAFE_CANDIDATE",
    candidate_count: 1,
    candidate_name_digest: await semanticDigest(
      `w10-navigation-name-v1\0${navigationName(candidate)}`,
    ),
  };
}
