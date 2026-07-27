/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/contract-text.v1.schema.json
 * Schema id: urn:japp:schema:common:contract-text:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

/**
 * Bounded machine token
 *
 * Compact inert token. It cannot carry whitespace, markup, scripts, selectors, or shell syntax.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9._:@+/-]{0,127}$
 * Minimum length: 1.
 * Maximum length: 128.
 */
export type CommonContractTextV1BoundedToken = string;

/**
 * Git object identifier
 *
 * Pattern: ^[0-9a-f]{40}$
 * Minimum length: 40.
 * Maximum length: 40.
 */
export type CommonContractTextV1GitObjectId = string;

/**
 * Reviewed locale tag
 *
 * Pattern: ^[a-z]{2}(?:-[A-Z]{2})?$
 * Minimum length: 2.
 * Maximum length: 5.
 */
export type CommonContractTextV1Locale = string;

/**
 * Bounded deterministic metric value
 *
 * Minimum: 0.
 * Maximum: 1000000000000.
 */
export type CommonContractTextV1MetricValue = number;

/**
 * Non-negative safe integer
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 0.
 * Maximum: 9007199254740991.
 */
export type CommonContractTextV1NonNegativeSafeInteger = number;

/**
 * Bounded normalized untrusted text
 *
 * Normalized page or document text retained only as bounded untrusted data. Markup delimiters, backslashes, braces, dollar signs, and executable punctuation are excluded.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9 .,:!?()'&+/@_-]{0,511}$
 * Minimum length: 1.
 * Maximum length: 512.
 * Sensitivity (x-japp-sensitivity): INTERNAL
 * Redaction (x-japp-redaction): HASH_ONLY
 */
export type CommonContractTextV1NormalizedText = string;

/**
 * Positive safe integer
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 1.
 * Maximum: 9007199254740991.
 */
export type CommonContractTextV1PositiveSafeInteger = number;

/**
 * Canonical schema reference
 *
 * Pattern: ^urn:japp:schema:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*:v(0|[1-9][0-9]*)(?:#\/\$defs\/[A-Za-z][A-Za-z0-9]*)?$
 * Minimum length: 24.
 * Maximum length: 256.
 */
export type CommonContractTextV1SchemaReference = string;

/**
 * Strict semantic version
 *
 * Pattern: ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$
 * Minimum length: 5.
 * Maximum length: 32.
 */
export type CommonContractTextV1VersionText = string;
