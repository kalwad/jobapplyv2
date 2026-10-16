import {
  approvedOptionMeaningSnapshot,
  selectOptionMeaning,
} from "./option-meaning.ts";
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
  descriptionApprovalMatches,
  recordedDomEvidenceRevision,
  targetIsCurrent,
  type FieldTargetResolution,
  type ResolvedFieldTarget,
} from "./field-scanner.ts";
import type { FrameContext } from "./scanner-protocol.ts";
import {
  captureValidationDescription,
  validationDescriptionCleared,
  validationDescriptionMatches,
  type ValidationDescriptionSnapshot,
} from "./validation-description.ts";
import { semanticDigest, stableSemanticId } from "./semantic-identity.ts";
import {
  checkboxDriver,
  nativeSelectDriver,
  optionMeaningApproval,
  optionMeaningApprovalMatches,
  radioGroupDriver,
} from "./drivers/choice-drivers.ts";
import type {
  ControlDriver,
  DriverContext,
  OptionMeaningApproval,
} from "./drivers/driver-contract.ts";
import {
  captureNativePropertyWitness,
  readSiteAcceptance,
  settleWindow,
} from "./drivers/driver-dom.ts";
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

/**
 * The accepted W10 driver family, exposed read-only so the M02-W11 dynamic
 * engine observes current values through the exact same control-specific
 * `observe` semantics that verified them. W11 never executes through this
 * list directly — every action still crosses DriverTransactionEngine.
 */
export function defaultControlDrivers(): readonly ControlDriver[] {
  return DEFAULT_DRIVERS;
}

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
  effectiveUndoAddress?: FormFieldAddressV1;
  effectiveUndoDescription?: ValidationDescriptionSnapshot;
  readonly optionMeaningApproval?: OptionMeaningApproval;
  readonly priorOptionMeaningApproval?: OptionMeaningApproval;
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

export interface ValidationDescriptionClearingEvidence {
  readonly source: "READ_SITE_ACCEPTANCE_V1";
  readonly rejectedMessageDigests: readonly string[];
  readonly settledAddress: FormFieldAddressV1;
  readonly settledDescription: ValidationDescriptionSnapshot;
}
export interface DriverExecution {
  readonly descriptionClearing?: ValidationDescriptionClearingEvidence;
  readonly optionMeaningApproval?: OptionMeaningApproval;
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

// An engine-private proof for exactly the current synchronous turn. Drivers
// cannot mint it. Any await expires it; focus still performs its own fresh
// check before the native setter. No wall-clock/time-based freshness is used.
const synchronousMutationContexts = new WeakSet<DriverContext>();
function markSynchronousMutationContext(context: DriverContext): void {
  synchronousMutationContexts.add(context);
  queueMicrotask(() => synchronousMutationContexts.delete(context));
}

function driverContext(
  document: Document,
  target: ResolvedFieldTarget,
  intended: DriverIntendedValue,
  frameContext: FrameContext,
  approvedAddress: FormFieldAddressV1,
  approvedOption?: OptionMeaningApproval,
  restorationOptionApproval?: OptionMeaningApproval,
  approvedDescription?: ValidationDescriptionSnapshot,
): DriverContext {
  let current = target;
  const allowed = (candidate: ResolvedFieldTarget) =>
    descriptionApprovalMatches(approvedAddress, candidate.descriptor.address) &&
    (approvedDescription === undefined ||
      validationDescriptionMatches(approvedDescription, candidate.anchor)) &&
    (approvedOption === undefined ||
      optionMeaningApprovalMatches(approvedOption, candidate.descriptor) ||
      ((candidate.descriptor.control_kind === "COMBOBOX" ||
        (candidate.descriptor.control_kind === "SELECT" &&
          !(candidate.anchor instanceof HTMLSelectElement))) &&
        !candidate.descriptor.options.some(
          (option) => option.value_digest === approvedOption.valueDigest,
        ))) &&
    (restorationOptionApproval === undefined ||
      optionMeaningApprovalMatches(
        restorationOptionApproval,
        candidate.descriptor,
      ) ||
      ((candidate.descriptor.control_kind === "COMBOBOX" ||
        (candidate.descriptor.control_kind === "SELECT" &&
          !(candidate.anchor instanceof HTMLSelectElement))) &&
        !candidate.descriptor.options.some(
          (option) =>
            option.value_digest === restorationOptionApproval.valueDigest,
        ))) &&
    generationMatches(candidate, approvedAddress) &&
    targetIsCurrent(document, candidate) &&
    targetVisible(candidate) &&
    targetEnabled(candidate);
  const context: DriverContext = {
    document,
    target,
    intended,
    ...(approvedOption === undefined ? {} : { approvedOption }),
    ...(restorationOptionApproval === undefined
      ? {}
      : { restorationOptionApproval }),
    mutate: async (action) => {
      if (synchronousMutationContexts.delete(context)) {
        action(current);
        return;
      }
      if (allowed(current)) {
        action(current);
        return;
      }
      {
        const resolved = await resolveFieldTarget(
          document,
          frameContext,
          approvedAddress,
          "preaction",
        );
        if (
          resolved.status !== "RESOLVED" ||
          resolved.target.anchor !== target.anchor ||
          resolved.target.applicationRoot !== target.applicationRoot ||
          !allowed(resolved.target)
        )
          throw new Error("driver mutation authority changed");
        current = resolved.target;
      }
      // The callback is synchronous; no await separates this last authority
      // check from the native mutation. Drivers repeat focus checks inside it.
      action(current);
    },
  };
  return context;
}

export function captureDriverObservationWitness(
  driver: ControlDriver,
  context: DriverContext,
): () => boolean {
  const nativeCurrent = captureNativePropertyWitness([
    context.target.anchor,
    ...context.target.members,
  ]);
  const extraCurrent = driver.captureObservationWitness?.(context);
  return () => nativeCurrent() && (extraCurrent?.() ?? true);
}

async function checkedPreconditions(
  driver: ControlDriver,
  context: DriverContext,
): Promise<Awaited<ReturnType<ControlDriver["checkPreconditions"]>>> {
  try {
    return await driver.checkPreconditions(context);
  } catch {
    return { ok: false };
  }
}

export function matchingControlDrivers(
  drivers: readonly ControlDriver[],
  descriptor: FormFieldDescriptorV1,
  anchor: HTMLElement,
  intended: DriverIntendedValue,
): ControlDriver[] {
  // Open shadow support is intentionally native text/textarea only. Other
  // controls remain visible in reconciliation but grant no action authority.
  const shadow =
    typeof ShadowRoot !== "undefined" &&
    anchor.getRootNode() instanceof ShadowRoot;
  return drivers.filter(
    (driver) =>
      (!shadow || driver.driverKey === "TEXT_INPUT_V1") &&
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

/**
 * Canonical redacted semantic observation of a typed intended value. Also
 * consumed by the M02-W11 duplicate-action ledger, whose authority key is
 * derived from this exact evidence digest.
 */
export function intendedSemanticObservation(
  intended: DriverIntendedValue,
): SemanticObservation {
  return intendedObservation(intended);
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
    // Preserve independently observed rejection even when stale ownership
    // additionally prevents a complete verification/undo authority claim.
    reason_codes:
      input.siteAcceptance === "REJECTED" &&
      !synthesis.reason_codes.includes("SITE_REJECTED")
        ? [...synthesis.reason_codes, "SITE_REJECTED" as const].slice(0, 8)
        : synthesis.reason_codes,
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
      "preflight",
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
    // Native select meanings can change while opaque raw values remain the
    // same. The first approval must bind the entire W09 option observation;
    // subsequent checks retain the intended option's exact semantic evidence.
    const isStaticChoice =
      target.anchor instanceof HTMLSelectElement ||
      target.descriptor.control_kind === "RADIO_GROUP";
    const originalOptionSnapshot = approvedOptionMeaningSnapshot(
      transaction.address.option_fingerprint,
    );
    const currentOptionSnapshotMatches =
      transaction.address.option_fingerprint ===
      target.descriptor.address.option_fingerprint;
    const intendedOptionDigest =
      transaction.intended.kind === "OPTION"
        ? transaction.intended.value_digest
        : undefined;
    const selectedOptionMeaning =
      transaction.intended.kind !== "OPTION"
        ? undefined
        : originalOptionSnapshot === null
          ? currentOptionSnapshotMatches
            ? optionMeaningApproval(target.descriptor, transaction.intended)
            : undefined
          : selectOptionMeaning(
              originalOptionSnapshot,
              intendedOptionDigest ?? "",
            );
    const approvedOption = selectedOptionMeaning ?? undefined;
    const addressDigest = await fieldAddressDigest(transaction.address);
    const policyPermitted =
      (transaction.intended.kind !== "OPTION" ||
        (selectedOptionMeaning !== null &&
          (originalOptionSnapshot !== null || currentOptionSnapshotMatches) &&
          (!isStaticChoice || approvedOption !== undefined))) &&
      decisionAuthorizesExecution(transaction.decision) &&
      transaction.decision.policy_decision === "PERMIT" &&
      transaction.decision.field_address_digest === addressDigest &&
      transaction.decision.field_id === target.descriptor.field_id &&
      transaction.decision.correlation_id === transaction.correlation_id &&
      descriptionApprovalMatches(
        transaction.address,
        target.descriptor.address,
      );
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
      frameContext,
      transaction.address,
      approvedOption,
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

    const initialCheck = await checkedPreconditions(driver, initialContext);
    if (!initialCheck.ok) {
      // A guarded query probe may synchronously change semantic ownership.
      // Report its fresh resolution failure rather than a stale UNIQUE result;
      // no restoration is authorized under the changed identity.
      const failedResolution = targetIsCurrent(document, target)
        ? null
        : await resolveFieldTarget(
            document,
            frameContext,
            transaction.address,
            "preaction",
          );
      const failureClass =
        failedResolution === null
          ? "UNIQUE"
          : failedResolution.status === "RESOLVED" &&
              !descriptionApprovalMatches(
                transaction.address,
                failedResolution.target.descriptor.address,
              )
            ? "STALE"
            : resolutionClass(failedResolution);
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: failureClass,
          preconditions,
          intended,
          immediate: UNOBSERVED,
          settled: UNOBSERVED,
          siteAcceptance: "UNKNOWN",
          validationMessageDigests: [],
          conditionalFieldIds: [],
          settledGeneration: target.descriptor.observed_dom_generation,
          phase:
            failureClass === "UNIQUE"
              ? { phase: "PRECONDITIONS_FAILED" }
              : {
                  phase: "RESOLUTION_FAILED",
                  resolution: failureClass,
                  documentChanged: true,
                },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(1),
      };
    }
    const captured = await driver.captureUndo(initialContext);
    const priorOptionMeaningApproval =
      approvedOption === undefined ||
      captured.priorObservation.presence === "EMPTY"
        ? undefined
        : optionMeaningApproval(target.descriptor, {
            kind: "OPTION",
            value_digest: captured.priorObservation.parts[0] ?? "",
          });

    // Load-bearing immediately-before-action re-resolution. The action uses
    // only this fresh target and repeats driver-specific preconditions.
    const actionResolution = await resolveFieldTarget(
      document,
      frameContext,
      transaction.address,
      "preaction",
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
    let freshTarget = actionResolution.target;
    const freshCandidates = driverCandidates(
      this.#drivers,
      freshTarget,
      transaction.intended,
    );
    let freshContext = driverContext(
      document,
      freshTarget,
      transaction.intended,
      frameContext,
      transaction.address,
      approvedOption,
    );
    const freshCheck =
      freshCandidates.length === 1 &&
      freshCandidates[0]?.driverKey === driver.driverKey &&
      targetVisible(freshTarget) &&
      targetEnabled(freshTarget) &&
      generationMatches(freshTarget, transaction.address)
        ? await checkedPreconditions(driver, freshContext)
        : { ok: false as const };
    const originalDescription =
      freshTarget.descriptor.description?.normalized_text;
    const beforeDescription = captureValidationDescription(freshTarget.anchor);
    const beforeValidation =
      originalDescription === undefined
        ? null
        : await readSiteAcceptance(
            driver.acceptanceElements?.(freshContext) ?? [
              freshTarget.anchor,
              ...freshTarget.members,
            ],
          );
    const rejectedMessages = new Set<string>();
    const rejectedMessageDigests: string[] = [];
    if (
      beforeDescription !== null &&
      beforeDescription.normalizedText === originalDescription &&
      beforeValidation?.acceptance === "REJECTED"
    ) {
      for (const component of beforeDescription.components) {
        if (!component.error || component.text === "") continue;
        const digest = await semanticDigest(
          `driver-validation-message-v1\0${component.text}`,
        );
        if (beforeValidation.messageDigests.includes(digest)) {
          rejectedMessages.add(component.text);
          rejectedMessageDigests.push(digest);
        }
      }
    }
    let freshTargetCurrent = targetIsCurrent(document, freshTarget);
    if (freshCheck.ok && !freshTargetCurrent) {
      // Ordinary option-window traversal invalidates the index while retaining
      // control identity. Rebind after the last precondition await, still
      // requiring the same original node/root and original ownership approval.
      const refreshed = await resolveFieldTarget(
        document,
        frameContext,
        transaction.address,
        "preaction",
      );
      if (
        refreshed.status === "RESOLVED" &&
        refreshed.target.anchor === freshTarget.anchor &&
        refreshed.target.applicationRoot === freshTarget.applicationRoot &&
        descriptionApprovalMatches(
          transaction.address,
          refreshed.target.descriptor.address,
        ) &&
        driverCandidates(this.#drivers, refreshed.target, transaction.intended)
          .length === 1 &&
        driverCandidates(
          this.#drivers,
          refreshed.target,
          transaction.intended,
        )[0]?.driverKey === driver.driverKey
      ) {
        freshTarget = refreshed.target;
        freshTargetCurrent = targetIsCurrent(document, freshTarget);
        freshContext = driverContext(
          document,
          freshTarget,
          transaction.intended,
          frameContext,
          transaction.address,
          approvedOption,
        );
      }
    }
    if (
      !freshCheck.ok ||
      !descriptionApprovalMatches(
        transaction.address,
        freshTarget.descriptor.address,
      ) ||
      (beforeDescription !== null &&
        !validationDescriptionMatches(beforeDescription, freshTarget.anchor)) ||
      (approvedOption !== undefined &&
        !optionMeaningApprovalMatches(approvedOption, freshTarget.descriptor) &&
        (isStaticChoice ||
          freshTarget.descriptor.options.some(
            (option) => option.value_digest === approvedOption.valueDigest,
          ))) ||
      !freshTargetCurrent ||
      !targetVisible(freshTarget) ||
      !targetEnabled(freshTarget)
    ) {
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
        markSynchronousMutationContext(freshContext);
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
            recoveryCandidates[0]?.driverKey === driver.driverKey &&
            descriptionApprovalMatches(
              transaction.address,
              recoveryResolution.target.descriptor.address,
            )
          ) {
            const recoveryContext = driverContext(
              document,
              recoveryResolution.target,
              transaction.intended,
              frameContext,
              transaction.address,
              approvedOption,
              priorOptionMeaningApproval,
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
        ...(approvedOption === undefined
          ? {}
          : { optionMeaningApproval: approvedOption }),
        ...(priorOptionMeaningApproval === undefined
          ? {}
          : { priorOptionMeaningApproval }),
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
      "settle",
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
    const publicationEvidenceRevision = recordedDomEvidenceRevision(document);
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
      frameContext,
      transaction.address,
      approvedOption,
    );
    const settledPropertiesCurrent = captureDriverObservationWitness(
      driver,
      settledContext,
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
    const settledDescription = captureValidationDescription(
      settledTarget.anchor,
    );
    const descriptionClearing:
      ValidationDescriptionClearingEvidence | undefined =
      beforeDescription !== null &&
      settledDescription !== null &&
      settledDescription.normalizedText ===
        (settledTarget.descriptor.description?.normalized_text ?? "") &&
      validationDescriptionCleared(
        beforeDescription,
        settledDescription,
        rejectedMessages,
      ) &&
      acceptance.acceptance === "ACCEPTED" &&
      observationsEquivalent(immediate, intended) &&
      observationsEquivalent(settled, intended)
        ? {
            source: "READ_SITE_ACCEPTANCE_V1",
            rejectedMessageDigests,
            settledAddress: settledTarget.descriptor.address,
            settledDescription,
          }
        : undefined;
    const settledOptionApproval =
      approvedOption ??
      optionMeaningApproval(settledTarget.descriptor, transaction.intended);
    const settledAuthorityCurrent =
      (descriptionApprovalMatches(
        transaction.address,
        settledTarget.descriptor.address,
      ) ||
        descriptionClearing !== undefined) &&
      (transaction.intended.kind !== "OPTION" ||
        (settledOptionApproval !== undefined &&
          optionMeaningApprovalMatches(
            settledOptionApproval,
            settledTarget.descriptor,
          )));
    // A page-owned input/blur handler may change ownership after the single
    // authorized action. Preserve the observations but do not verify or grant
    // undo under that changed context, even when the visible value persists.
    const phase: TransactionPhase = settledAuthorityCurrent
      ? {
          phase: "COMPLETE",
          immediateMatches: observationsEquivalent(immediate, intended),
          settledMatches: observationsEquivalent(settled, intended),
          siteAcceptance: acceptance.acceptance,
          validationMessageCount: acceptance.messageDigests.length,
          conditionalFieldsDiscovered: conditionalFieldIds.length > 0,
        }
      : { phase: "SETTLED_TARGET_LOST", resolution: "STALE" };
    if (!settledAuthorityCurrent)
      this.#undoRecords.delete(transaction.transaction_id);
    if (descriptionClearing !== undefined) {
      const undo = this.#undoRecords.get(transaction.transaction_id);
      if (undo !== undefined) {
        undo.effectiveUndoAddress = descriptionClearing.settledAddress;
        undo.effectiveUndoDescription = descriptionClearing.settledDescription;
      }
    }
    const result = await buildResult({
      transaction,
      operation: "EXECUTE",
      driverKey: driver.driverKey,
      resolution: settledAuthorityCurrent ? "UNIQUE" : "STALE",
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
    });
    // Result IDs/evidence hashing await after the settlement observation.
    // A fresh synchronous index/root/ownership witness is required after the
    // last hash before a direct VERIFIED result or undo capability publishes.
    if (
      settledAuthorityCurrent &&
      (!settledPropertiesCurrent() ||
        (descriptionClearing !== undefined &&
          !validationDescriptionMatches(
            descriptionClearing.settledDescription,
            settledTarget.anchor,
          )) ||
        !targetIsCurrent(document, settledTarget, publicationEvidenceRevision))
    ) {
      this.#undoRecords.delete(transaction.transaction_id);
      return {
        result: await buildResult({
          transaction,
          operation: "EXECUTE",
          driverKey: driver.driverKey,
          resolution: "STALE",
          preconditions,
          intended,
          immediate,
          settled,
          siteAcceptance: acceptance.acceptance,
          validationMessageDigests: acceptance.messageDigests,
          conditionalFieldIds,
          settledGeneration: settledTarget.descriptor.observed_dom_generation,
          phase: { phase: "SETTLED_TARGET_LOST", resolution: "STALE" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        undoAvailable: false,
        diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
      };
    }
    return {
      ...(descriptionClearing === undefined ? {} : { descriptionClearing }),
      ...(settledOptionApproval === undefined
        ? {}
        : { optionMeaningApproval: settledOptionApproval }),
      result,
      undoAvailable:
        settledAuthorityCurrent && actionPerformed && captured.restorable,
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
        : driverContext(
            document,
            resolved.target,
            transaction.intended,
            frameContext,
            record.effectiveUndoAddress ?? transaction.address,
            record.optionMeaningApproval,
            record.priorOptionMeaningApproval,
            record.effectiveUndoDescription,
          );
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
      policy_permitted:
        descriptionApprovalMatches(
          record.effectiveUndoAddress ?? transaction.address,
          resolved.target.descriptor.address,
        ) &&
        (record.effectiveUndoDescription === undefined ||
          validationDescriptionMatches(
            record.effectiveUndoDescription,
            resolved.target.anchor,
          )),
    };
    if (
      driver === undefined ||
      candidates.length !== 1 ||
      !preconditions.visible ||
      !preconditions.enabled ||
      !preconditions.generation_matched ||
      !preconditions.policy_permitted ||
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
    if (
      actionCandidates.length !== 1 ||
      actionDriver === undefined ||
      !descriptionApprovalMatches(
        record.effectiveUndoAddress ?? transaction.address,
        resolved.target.descriptor.address,
      ) ||
      (record.effectiveUndoDescription !== undefined &&
        !validationDescriptionMatches(
          record.effectiveUndoDescription,
          resolved.target.anchor,
        )) ||
      !targetIsCurrent(document, resolved.target) ||
      !targetVisible(resolved.target) ||
      !targetEnabled(resolved.target)
    ) {
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
      frameContext,
      record.effectiveUndoAddress ?? transaction.address,
      record.optionMeaningApproval,
      record.priorOptionMeaningApproval,
      record.effectiveUndoDescription,
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
    const publicationEvidenceRevision = recordedDomEvidenceRevision(document);
    const settledContext = driverContext(
      document,
      settledResolution.target,
      transaction.intended,
      frameContext,
      record.effectiveUndoAddress ?? transaction.address,
      record.optionMeaningApproval,
      record.priorOptionMeaningApproval,
      record.effectiveUndoDescription,
    );
    const settledPropertiesCurrent = captureDriverObservationWitness(
      actionDriver,
      settledContext,
    );
    const settled = await actionDriver.observe(settledContext);
    const acceptance = await readSiteAcceptance(
      actionDriver.acceptanceElements?.(settledContext) ?? [
        settledResolution.target.anchor,
        ...settledResolution.target.members,
      ],
    );
    const settledAuthorityCurrent =
      descriptionApprovalMatches(
        record.effectiveUndoAddress ?? transaction.address,
        settledResolution.target.descriptor.address,
      ) &&
      (record.optionMeaningApproval === undefined ||
        optionMeaningApprovalMatches(
          record.optionMeaningApproval,
          settledResolution.target.descriptor,
        )) &&
      (record.priorOptionMeaningApproval === undefined ||
        optionMeaningApprovalMatches(
          record.priorOptionMeaningApproval,
          settledResolution.target.descriptor,
        ));
    const phase: TransactionPhase = settledAuthorityCurrent
      ? {
          phase: "COMPLETE",
          immediateMatches: observationsEquivalent(
            immediate,
            record.priorObservation,
          ),
          settledMatches: observationsEquivalent(
            settled,
            record.priorObservation,
          ),
          siteAcceptance: acceptance.acceptance,
          validationMessageCount: acceptance.messageDigests.length,
          conditionalFieldsDiscovered: false,
        }
      : { phase: "SETTLED_TARGET_LOST", resolution: "STALE" };
    const result = await buildResult({
      transaction,
      operation: "UNDO",
      driverKey: record.driverKey,
      resolution: settledAuthorityCurrent ? "UNIQUE" : "STALE",
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
    });
    // Undo has the same publication authority boundary as execute: neither
    // its own input handler nor a metadata-hash await may publish stale proof.
    if (
      settledAuthorityCurrent &&
      (!settledPropertiesCurrent() ||
        !targetIsCurrent(
          document,
          settledResolution.target,
          publicationEvidenceRevision,
        ))
    ) {
      return {
        status: "COMPLETED",
        result: await buildResult({
          transaction,
          operation: "UNDO",
          driverKey: record.driverKey,
          resolution: "STALE",
          preconditions,
          intended: record.priorObservation,
          immediate,
          settled,
          siteAcceptance: acceptance.acceptance,
          validationMessageDigests: acceptance.messageDigests,
          conditionalFieldIds: [],
          settledGeneration:
            settledResolution.target.descriptor.observed_dom_generation,
          phase: { phase: "SETTLED_TARGET_LOST", resolution: "STALE" },
          attemptedAt,
          durationMs: boundedDuration(started),
        }),
        diagnostics: diagnostics(1, settle.polls, settle.signalObserved),
      };
    }
    return {
      status: "COMPLETED",
      result,
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
