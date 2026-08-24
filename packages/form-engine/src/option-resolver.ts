// M02-W09 deterministic option resolver (REQ-FORM-023 feasibility portion).
//
// Chooses the INTENDED option semantically: an option is eligible only when
// reviewed catalog evidence links it to the approved semantic value token.
// The number of rendered options is never selection evidence — no semantic
// match plus exactly one rendered option MUST abstain, never select. W10
// owns physical execution; this module only names the intended option by
// its inert value digest.
import type {
  FormFieldDescriptorV1,
  FormFieldDescriptorV1OptionSemantic,
} from "@japp/contracts/generated";

import { equalsPhrase, isPlaceholderOptionLabel } from "./evidence-text.ts";
import type { ConceptRule } from "./ontology.ts";

export type OptionMatchBasis =
  "EXACT_LABEL" | "APPROVED_ALIAS_LABEL" | "STABLE_TOKEN";

export type OptionResolution =
  | {
      readonly status: "RESOLVED";
      /** Inert identity of the intended option for W10 to execute later. */
      readonly valueDigest: string;
      readonly matchedBy: OptionMatchBasis;
    }
  | {
      readonly status: "ABSTAINED";
      readonly reason:
        | "NO_OPTIONS"
        | "NO_OPTION_SEMANTICS_FOR_VALUE"
        | "NO_SEMANTIC_MATCH"
        | "AMBIGUOUS_OPTION_MATCHES"
        | "MATCHED_OPTION_DISABLED";
    };

interface OptionMatch {
  readonly option: FormFieldDescriptorV1OptionSemantic;
  readonly basis: OptionMatchBasis;
}

function matchOption(
  option: FormFieldDescriptorV1OptionSemantic,
  acceptedLabels: readonly string[],
  acceptedTokens: readonly string[],
  intendedValueToken: string,
): OptionMatchBasis | null {
  const label = option.label.normalized_text ?? "";
  // A placeholder ("Select a work mode", "Choose...") is never a real
  // answer merely because it is rendered.
  if (label !== "" && isPlaceholderOptionLabel(label)) {
    return null;
  }
  if (label !== "" && equalsPhrase(label, intendedValueToken)) {
    return "EXACT_LABEL";
  }
  if (
    label !== "" &&
    acceptedLabels.some((accepted) => equalsPhrase(label, accepted))
  ) {
    return "APPROVED_ALIAS_LABEL";
  }
  if (
    option.stable_value_token !== undefined &&
    (acceptedTokens.includes(option.stable_value_token) ||
      option.stable_value_token === intendedValueToken)
  ) {
    return "STABLE_TOKEN";
  }
  return null;
}

/**
 * Resolve the approved semantic value token onto the descriptor's rendered
 * options. Exactly one semantically matching enabled option resolves;
 * everything else is a typed abstention.
 */
export function resolveIntendedOption(
  descriptor: FormFieldDescriptorV1,
  rule: ConceptRule,
  intendedValueToken: string,
): OptionResolution {
  if (descriptor.options.length === 0) {
    return { status: "ABSTAINED", reason: "NO_OPTIONS" };
  }
  const valueRule = rule.optionValues.find(
    (entry) => entry.valueToken === intendedValueToken,
  );
  const acceptedLabels = valueRule?.acceptedLabels ?? [];
  const acceptedTokens = valueRule?.acceptedTokens ?? [];
  if (valueRule === undefined && rule.optionValues.length > 0) {
    // The catalog defines option semantics for this concept but not for
    // this approved value: abstain rather than improvise a mapping.
    return { status: "ABSTAINED", reason: "NO_OPTION_SEMANTICS_FOR_VALUE" };
  }

  const matches: OptionMatch[] = [];
  for (const option of descriptor.options) {
    const basis = matchOption(
      option,
      acceptedLabels,
      acceptedTokens,
      intendedValueToken,
    );
    if (basis !== null) {
      matches.push({ option, basis });
    }
  }

  if (matches.length === 0) {
    // This branch is intentionally blind to descriptor.options.length: one
    // unrelated rendered option abstains exactly like fifty do.
    return { status: "ABSTAINED", reason: "NO_SEMANTIC_MATCH" };
  }
  const distinctDigests = new Set(
    matches.map((match) => match.option.value_digest),
  );
  if (distinctDigests.size > 1) {
    return { status: "ABSTAINED", reason: "AMBIGUOUS_OPTION_MATCHES" };
  }
  const match = matches[0];
  if (match === undefined) {
    return { status: "ABSTAINED", reason: "NO_SEMANTIC_MATCH" };
  }
  if (match.option.disabled) {
    // A disabled option is not an executable deterministic decision.
    return { status: "ABSTAINED", reason: "MATCHED_OPTION_DISABLED" };
  }
  return {
    status: "RESOLVED",
    valueDigest: match.option.value_digest,
    matchedBy: match.basis,
  };
}
