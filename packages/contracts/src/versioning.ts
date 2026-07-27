/**
 * Version-compatibility policy for canonical schemas (M01-W01).
 *
 * A declared instance version is evaluated against the catalog's supported
 * version for the same schema document:
 *
 * - different MAJOR  -> REJECTED_UNKNOWN_MAJOR (fail closed; majors are
 *   incompatible by definition and require an explicit migration, owned by
 *   the M04 migration framework later);
 * - newer MINOR      -> UPGRADE_REQUIRED_NEWER_MINOR (fail closed with an
 *   explicit upgrade signal: minors are additive, but a reader cannot claim
 *   to validate constraints it has never seen);
 * - same or older MINOR -> COMPATIBLE (minors are strictly additive-optional,
 *   so every older-minor instance validates against the current schema);
 * - malformed        -> REJECTED_MALFORMED.
 *
 * PATCH is ignored for acceptance: patch releases must not change instance
 * validity.
 */

import { parseSchemaVersion, type SchemaVersionTriple } from "./conventions.ts";

export type VersionCompatibilityOutcome =
  | "COMPATIBLE"
  | "UPGRADE_REQUIRED_NEWER_MINOR"
  | "REJECTED_UNKNOWN_MAJOR"
  | "REJECTED_MALFORMED";

export interface VersionCompatibility {
  readonly outcome: VersionCompatibilityOutcome;
  readonly declared: SchemaVersionTriple | null;
  readonly supported: SchemaVersionTriple;
}

/** Evaluate a declared version string against the supported catalog version. */
export function evaluateVersionCompatibility(
  declaredText: string,
  supported: SchemaVersionTriple,
): VersionCompatibility {
  const declared = parseSchemaVersion(declaredText);
  if (declared === null) {
    return { outcome: "REJECTED_MALFORMED", declared: null, supported };
  }
  if (declared.major !== supported.major) {
    return { outcome: "REJECTED_UNKNOWN_MAJOR", declared, supported };
  }
  if (declared.minor > supported.minor) {
    return { outcome: "UPGRADE_REQUIRED_NEWER_MINOR", declared, supported };
  }
  return { outcome: "COMPATIBLE", declared, supported };
}
