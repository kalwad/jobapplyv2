/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/process-plan.v1.schema.json
 * Schema id: urn:japp:schema:platform:process-plan:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1EnvironmentEntry, PlatformVocabularyV1LifecycleMode, PlatformVocabularyV1MemoryMebibytes, PlatformVocabularyV1PathRole, PlatformVocabularyV1ProcessArgument, PlatformVocabularyV1ProcessProfileId, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RequestContext, PlatformVocabularyV1StdioMode, PlatformVocabularyV1TimeoutMilliseconds } from "../platform/vocabulary.v1.ts";

/**
 * Platform process supervisor spawn plan
 *
 * A typed spawn plan. It names an approved executable profile, never a command string, interpreter invocation, executable path, or script body. Arguments are an already-separated bounded array, the environment is a closed allowlist, and the working directory is a typed role. Shell interpolation, command chaining, redirection, metacharacter payloads, registry commands, privilege escalation, raw file descriptors, and raw signal values are structurally unrepresentable. This contract does not spawn anything.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformProcessPlanV1 {
  readonly process_plan_id: CommonStableIdV1StableId;
  readonly request_context: PlatformVocabularyV1RequestContext;
  readonly profile: PlatformVocabularyV1ProcessProfileId;
  readonly profile_version?: PlatformVocabularyV1ProductVersion;
  /**
   * Digest of the exact approved executable the profile resolves to, so a supervisor can refuse a substituted binary.
   */
  readonly executable_digest?: CommonProvenanceV1ContentDigest;
  /**
   * Already-separated argument array. It is never joined into a command line and never interpreted by a shell.
   *
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly arguments: readonly PlatformVocabularyV1ProcessArgument[];
  /**
   * Closed allowlist entries. An arbitrary environment dictionary cannot be expressed.
   *
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly environment_allowlist: readonly PlatformVocabularyV1EnvironmentEntry[];
  /**
   * Always false in a reviewed plan: a packaged process must not inherit an interactive-shell environment.
   */
  readonly inherit_parent_environment: boolean;
  readonly working_directory_role: PlatformVocabularyV1PathRole;
  readonly stdin_mode: PlatformVocabularyV1StdioMode;
  readonly stdout_mode: PlatformVocabularyV1StdioMode;
  readonly stderr_mode: PlatformVocabularyV1StdioMode;
  readonly lifecycle_mode: PlatformVocabularyV1LifecycleMode;
  readonly startup_timeout_ms: PlatformVocabularyV1TimeoutMilliseconds;
  readonly shutdown_timeout_ms: PlatformVocabularyV1TimeoutMilliseconds;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 8.
   */
  readonly max_restart_attempts: number;
  readonly max_memory_mib?: PlatformVocabularyV1MemoryMebibytes;
}
