/**
 * ATS adapters (spec v1.2 §5.1): M02 research adapters; Workday-first production in M19-M20; Greenhouse/Lever/Ashby and later families after the Workday gate.
 *
 * M02-W12 exports pure RESEARCH_ONLY classifiers. Production support and
 * browser action authority are absent; W08–W11 remain authoritative.
 */
export const PACKAGE_NAME = "@japp/ats-adapters";
export * from "./research-adapter.ts";
