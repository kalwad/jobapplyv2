import { classifyField } from "../../../../../packages/form-engine/src/field-classifier.ts";
import { conceptRule } from "../../../../../packages/form-engine/src/ontology.ts";
import { synthesizePolicy } from "../../../../../packages/form-engine/src/safety-policy.ts";
/** Public evaluation only: approved synthetic facts through the actual kernel. */
import type {
  FormFieldDescriptorV1,
  FormFieldDecisionV1,
} from "@japp/contracts/generated";
import {
  canonicalJson,
  fieldAddressDigest,
} from "../../../src/driver-evidence.ts";
import { stableSemanticId } from "../../../src/semantic-identity.ts";
import { DriverTransactionEngine } from "../../../src/driver-engine.ts";
import { DynamicFrameEngine } from "../../../src/dynamic-engine.ts";
import { textDriver } from "../../../src/drivers/text-like-drivers.ts";
import { setNativeValue } from "../../../src/drivers/driver-dom.ts";
import type {
  ControlDriver,
  DriverContext,
} from "../../../src/drivers/driver-contract.ts";
import {
  resolveFieldTarget,
  scanFrameDocument,
  targetIsCurrent,
  isElementVisible,
  isElementEnabled,
} from "../../../src/field-scanner.ts";
import {
  SCAN_FRAME_KIND,
  SCANNER_PROTOCOL_VERSION,
  type FrameContext,
} from "../../../src/scanner-protocol.ts";
import { permitsPublicDocumentUrl } from "../public-inspection/scope.ts";
import {
  protectedBoundary,
  protectedAutocomplete,
  captureFocusFence,
  focusFenceMatches,
} from "./boundaries.ts";
import {
  SYNTHETIC_FACTS,
  planDigest,
  profileDigest,
  scanDigest,
  type ContactPlan,
  type ContactConcept,
} from "./protocol.ts";

function nativeContact(context: DriverContext): HTMLInputElement | null {
  const input = context.target.anchor;
  return input instanceof HTMLInputElement &&
    ["text", "email", "tel", "url"].includes(input.type) &&
    input.getAttribute("role") !== "combobox" &&
    protectedAutocomplete(input) === null &&
    !input.readOnly &&
    !input.disabled
    ? input
    : null;
}
export class ContactFrameExecutor {
  readonly document: Document;
  readonly frame: FrameContext;
  readonly registeredUrl: string;
  readonly engine: DriverTransactionEngine;
  readonly dynamic: DynamicFrameEngine;
  #plan: { id: string; value: ContactPlan } | null = null;
  readonly #used = new Set<string>();
  #preparing = false;

  constructor(document: Document, frame: FrameContext, registeredUrl: string) {
    this.document = document;
    this.frame = frame;
    this.registeredUrl = registeredUrl;
    const driver: ControlDriver = {
      ...textDriver,
      driverKey: "W14_PUBLIC_GUARDED_NATIVE_CONTACT_V1",
      detect(descriptor, anchor, intended) {
        return (
          anchor instanceof HTMLInputElement &&
          ["text", "email", "tel", "url"].includes(anchor.type) &&
          protectedAutocomplete(anchor) === null &&
          textDriver.detect(descriptor, anchor, intended)
        );
      },
      checkPreconditions: async (context) => {
        const base = await textDriver.checkPreconditions(context);
        return base.ok && this.executionBoundary(context) === null
          ? base
          : { ok: false };
      },
      captureUndo: async (context) => ({
        ...(await textDriver.captureUndo(context)),
        restorable: false,
        payload: null,
      }),
      applyUndo: () => {
        throw new Error("W14_PUBLIC_UNDO_HAS_NO_AUTHORITY");
      },
      // Same reviewed W10 setter and event envelope. The added synchronous
      // guard after focus catches a page that opens a protected boundary in
      // its focus handler, before any synthetic contact value is written.
      execute: (context) => {
        if (this.executionBoundary(context) !== null)
          throw new Error("W14_PUBLIC_ACTION_BOUNDARY");
        const input = nativeContact(context);
        if (input === null || context.intended.kind !== "TEXT")
          throw new Error("W14_PUBLIC_NATIVE_CONTACT_ONLY");
        const parent = input.parentElement;
        const form = input.form;
        const root = context.target.applicationRoot;
        // Conservative synchronous semantic fence: any site markup change
        // during focus pauses this opt-in mode. No HTML leaves the frame.
        const focusFence = captureFocusFence(this.document);
        if (focusFence === null)
          throw new Error("W14_PUBLIC_FOCUS_FENCE_UNOBSERVED");
        const labels = [...(input.labels ?? [])]
          .map((label) => label.textContent)
          .join("\0");
        input.focus();
        if (
          !targetIsCurrent(this.document, context.target) ||
          this.executionBoundary(context) !== null ||
          input.parentElement !== parent ||
          input.form !== form ||
          context.target.applicationRoot !== root ||
          !focusFenceMatches(this.document, focusFence) ||
          [...(input.labels ?? [])]
            .map((label) => label.textContent)
            .join("\0") !== labels
        ) {
          // The protected boundary ends this action. No additional blur
          // handler or recovery write is activated after the refusal.
          throw new Error("W14_PUBLIC_ACTION_BOUNDARY");
        }
        setNativeValue(input, context.intended.text);
        input.blur();
        return Promise.resolve();
      },
    };
    this.engine = new DriverTransactionEngine([driver]);
    this.dynamic = new DynamicFrameEngine(this.engine);
  }
  currentBoundary() {
    if (
      this.document.location.href !== this.registeredUrl ||
      !permitsPublicDocumentUrl(this.registeredUrl)
    )
      return "CURRENT_URL_CHANGED";
    if (this.document.defaultView?.navigator.onLine !== false)
      return "NETWORK_ISOLATION_REQUIRED";
    return protectedBoundary(this.document);
  }
  executionBoundary(context: DriverContext) {
    const boundary = this.currentBoundary();
    if (boundary !== null) return boundary;
    const input = nativeContact(context);
    if (
      input === null ||
      !input.isConnected ||
      !context.target.applicationRoot.isConnected ||
      !context.target.applicationRoot.contains(input) ||
      !isElementVisible(input) ||
      !isElementEnabled(input)
    )
      return "UNSUPPORTED_CONTACT_CONTROL";
    if (input.value !== "") return "PREEXISTING_VALUE";
    return null;
  }
  async prepare(plan: ContactPlan, requestId: string) {
    const blocked = this.currentBoundary();
    if (blocked !== null)
      return { state: "BLOCKED", reason: blocked, plan_id: null };
    if (this.#plan !== null || this.#preparing)
      return {
        state: "BLOCKED",
        reason: "PLAN_ALREADY_FROZEN_OR_PREPARING",
        plan_id: null,
      };
    this.#preparing = true;
    try {
      if (
        plan.source_url !== this.registeredUrl ||
        canonicalJson(plan.frame_context) !== canonicalJson(this.frame) ||
        plan.profile_digest !== (await profileDigest())
      )
        return {
          state: "BLOCKED",
          reason: "PLAN_BINDING_MISMATCH",
          plan_id: null,
        };
      const scan = await scanFrameDocument(this.document, this.frame, {
        kind: SCAN_FRAME_KIND,
        protocolVersion: SCANNER_PROTOCOL_VERSION,
        requestId,
        expected_document_id: this.frame.document_id,
        scope: { kind: "APPLICATION_ROOT" },
      });
      if (scan.root_status !== "FOUND")
        return {
          state: "BLOCKED",
          reason: "APPLICATION_ROOT_UNRESOLVED",
          plan_id: null,
        };
      if ((await scanDigest(scan)) !== plan.before_scan_digest)
        return {
          state: "BLOCKED",
          reason: "BEFORE_SNAPSHOT_CHANGED",
          plan_id: null,
        };
      const eligible = scan.descriptors.filter(
        (field) =>
          field.control_kind === "TEXT" && field.visible && field.enabled,
      );
      if (
        eligible
          .map((field) => field.field_id)
          .sort()
          .join() !==
        plan.fields
          .map((field) => field.field_id)
          .sort()
          .join()
      )
        return {
          state: "BLOCKED",
          reason: "CANDIDATE_INVENTORY_MISMATCH",
          plan_id: null,
        };
      for (const field of plan.fields) {
        const descriptor = eligible.find(
          (item) => item.field_id === field.field_id,
        );
        if (
          descriptor === undefined ||
          canonicalJson(descriptor.address) !== canonicalJson(field.address)
        )
          return {
            state: "BLOCKED",
            reason: "FIELD_BINDING_MISMATCH",
            plan_id: null,
          };
      }
      const id = await planDigest(plan);
      this.#plan = {
        id,
        value: JSON.parse(canonicalJson(plan)) as ContactPlan,
      };
      const start = await this.dynamic.start(this.document, this.frame);
      if (start.status !== "STARTED") {
        this.#plan = null;
        return {
          state: "BLOCKED",
          reason: "OBSERVATION_START_REFUSED",
          plan_id: null,
        };
      }
      return { state: "PREPARED", reason: "FROZEN_BEFORE_FILL", plan_id: id };
    } finally {
      this.#preparing = false;
    }
  }
  async execute(
    planId: string,
    fieldId: string,
    decision: FormFieldDecisionV1,
  ) {
    const active = this.#plan;
    const boundary = this.currentBoundary();
    if (active?.id !== planId)
      return {
        state: "BLOCKED",
        reason: "UNKNOWN_PLAN",
        decision: null,
        result: null,
      };
    if (boundary !== null)
      return {
        state: "BLOCKED",
        reason: boundary,
        decision: null,
        result: null,
      };
    const field = active.value.fields.find((item) => item.field_id === fieldId);
    if (field === undefined)
      return {
        state: "BLOCKED",
        reason: "FIELD_NOT_IN_FROZEN_INVENTORY",
        decision: null,
        result: null,
      };
    if (this.#used.has(fieldId))
      return {
        state: "BLOCKED",
        reason: "FIELD_ALREADY_ATTEMPTED",
        decision: null,
        result: null,
      };
    // Reserve before any await so overlapping requests never issue two writes.
    this.#used.add(fieldId);
    const resolved = await resolveFieldTarget(
      this.document,
      this.frame,
      field.address,
      "preflight",
    );
    if (resolved.status !== "RESOLVED")
      return {
        state: "ABSTAINED",
        reason: "LIVE_RESOLUTION_REFUSED",
        decision: null,
        result: null,
      };
    const descriptor: FormFieldDescriptorV1 = resolved.target.descriptor;
    if (
      descriptor.field_id !== fieldId ||
      canonicalJson(descriptor.address) !== canonicalJson(field.address)
    )
      return {
        state: "ABSTAINED",
        reason: "LIVE_FIELD_CHANGED",
        decision: null,
        result: null,
      };
    if (
      decision.field_address_digest !==
      (await fieldAddressDigest(field.address))
    )
      return {
        state: "BLOCKED",
        reason: "POLICY_ADDRESS_MISMATCH",
        decision: null,
        result: null,
      };
    const correlationId = await stableSemanticId(
      "cor",
      `${planId}\0${fieldId}`,
    );
    if (
      decision.final_decision !== "FILL" ||
      !Object.hasOwn(SYNTHETIC_FACTS, decision.field_concept)
    )
      return {
        state: "ABSTAINED",
        reason: "DETERMINISTIC_POLICY_ABSTAIN",
        decision,
        result: null,
      };
    // The Node controller cannot manufacture contact authority merely by
    // forging a structurally valid decision. Reclassify the freshly resolved
    // real descriptor with the same pure W09 classifier/negative evidence,
    // then independently apply the actual catalog floor and fixed record.
    const classification = classifyField(descriptor);
    if (
      classification.status !== "CLASSIFIED" ||
      classification.band !== "DETERMINISTIC" ||
      classification.concept !== decision.field_concept ||
      classification.confidence !== decision.classification_confidence
    )
      return {
        state: "BLOCKED",
        reason: "LIVE_CONTACT_CLASSIFICATION_MISMATCH",
        decision: null,
        result: null,
      };
    const value = SYNTHETIC_FACTS[decision.field_concept as ContactConcept];
    const rule = conceptRule(classification.concept);
    const record = {
      recordId: await stableSemanticId(
        "record",
        `w14-public-contact\0${classification.concept}\0${value}`,
      ),
      concept: classification.concept,
      policy: "FILL_FROM_EXPLICIT_RECORD" as const,
      confirmation: { state: "MISSING" as const },
      valueConfidence: 1,
    };
    const policy = synthesizePolicy({
      rule,
      record,
      classificationBand: classification.band,
      required: descriptor.required,
      optionResolution: undefined,
    });
    if (
      policy.finalDecision !== "FILL" ||
      decision.policy_decision !== policy.policyDecision ||
      decision.confirmation_state !== policy.confirmationState ||
      decision.sensitivity_class !== rule.sensitivity ||
      decision.value_source_type !== policy.valueSourceType ||
      decision.value_source_ref !== policy.valueSourceRef ||
      decision.value_confidence !== policy.valueConfidence ||
      decision.user_confirmation_ref !== policy.userConfirmationRef
    )
      return {
        state: "BLOCKED",
        reason: "LIVE_CONTACT_POLICY_MISMATCH",
        decision: null,
        result: null,
      };
    const transaction = {
      transaction_id: await stableSemanticId(
        "transaction",
        `${planId}\0${fieldId}`,
      ),
      correlation_id: correlationId,
      address: field.address,
      decision,
      intended: { kind: "TEXT" as const, text: value },
      settle: { budget_ms: 75 },
    };
    this.dynamic.beginAction();
    let execution;
    try {
      execution = await this.engine.execute(
        this.document,
        this.frame,
        transaction,
      );
    } finally {
      this.dynamic.endAction();
    }
    await this.dynamic.noteExternalExecution(transaction, execution);
    return {
      state: "EXECUTED",
      reason: execution.result.outcome,
      decision,
      result: execution.result,
    };
  }
}
