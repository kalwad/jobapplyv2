# apps/extension

Browser extension (WXT + React + TypeScript, Manifest V3,
docs/MASTER_IMPLEMENTATION_SPEC.md §5.2). It detects supported ATS pages,
scans and fills forms via typed operations, shows field status and
provenance, and reports submission evidence (§5.3). It can never access the
database or model runtime directly (§5.4).

This is a workspace slot created by the M00-W02 scaffold. The WXT extension
is scaffolded in M17-W01; adding extension code earlier would be a fake
feature (spec §1.5). No build/test scripts exist here yet by design.
