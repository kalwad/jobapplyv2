// M02-W10 control-driver contract (spec §5.11.5).
//
// The canonical architecture rejects one monolithic fillField(): each
// control family implements this explicit contract and the engine composes
// the transaction around it. Detection is deterministic over the canonical
// descriptor, the live W08-resolved anchor, and the typed intended value —
// never DOM order — and no driver may execute a control it did not
// explicitly claim.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import type { DriverIntendedValue } from "../driver-protocol.ts";
import type { SemanticObservation } from "../driver-evidence.ts";
import type { ResolvedFieldTarget } from "../field-scanner.ts";

export interface DriverContext {
  readonly document: Document;
  readonly target: ResolvedFieldTarget;
  readonly intended: DriverIntendedValue;
}

export type PreconditionOutcome =
  | { readonly ok: true; readonly alreadySatisfied: boolean }
  | { readonly ok: false };

export interface CapturedUndo {
  /** False when the control family cannot safely reverse this action. */
  readonly restorable: boolean;
  /** Redacted semantic evidence of the pre-action state. */
  readonly priorObservation: SemanticObservation;
  /** Driver-private bounded in-memory state needed to reverse the action. */
  readonly payload: unknown;
}

export interface ControlDriver {
  /** Deterministic driver identity seed (driver_id derives from this). */
  readonly driverKey: string;
  /** Explicit support claim; never true for controls the driver cannot own. */
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean;
  /** Driver-specific preconditions beyond visible/enabled/policy. */
  checkPreconditions(context: DriverContext): Promise<PreconditionOutcome>;
  /** Capture bounded in-memory pre-action state; read-only. */
  captureUndo(context: DriverContext): Promise<CapturedUndo>;
  /** Perform exactly the driver-specific action; a throw is ACTION_FAILED. */
  execute(context: DriverContext): Promise<void>;
  /** Redacted semantic observation of the control's current value. */
  observe(context: DriverContext): Promise<SemanticObservation>;
  /** Reverse the captured action on the freshly re-resolved target. */
  applyUndo(context: DriverContext, payload: unknown): Promise<void>;
  /** Expected settled resolution for the action (default PRESENT). */
  settledExpectation?(intended: DriverIntendedValue): "PRESENT" | "ABSENT";
  /** Expected settled resolution after undoing the action. */
  undoSettledExpectation?(intended: DriverIntendedValue): "PRESENT" | "ABSENT";
  /** Elements whose validation surface defines site acceptance. */
  acceptanceElements?(context: DriverContext): readonly HTMLElement[];
}
