# Generated contracts — DO NOT EDIT

Every file below this directory is produced by the deterministic contract
generator (M01-W02) from the canonical hand-authored JSON Schema source in
`packages/contracts/schemas/`. The schemas are the single source of truth;
these trees are derived artifacts.

- Regenerate: `pnpm generate:contracts`
- Verify (byte-exact drift check, read-only): `pnpm generate:contracts --check`

Manual edits are prohibited. The `contract-gen` verification suite
regenerates into a temporary directory and byte-compares the complete
committed inventory; any hand edit, missing file, stale file, or extra file
fails `pnpm verify`.

Layout:

- `MANIFEST.json` — provenance: generator format/config, every input
  schema id/version/SHA-256, every output path/SHA-256, and the
  schema-reference → generated-type identity map.
- `typescript/` — one module per schema document (mirroring the schema
  layout), `validators.ts` (typed wrappers whose runtime truth is the
  strict canonical Ajv catalog in `packages/contracts/src/`), and
  `index.ts` (the stable export surface re-exported by
  `@japp/contracts/generated`).
- `python/src/japp_contracts/` — the generated strict Pydantic v2 package
  (one module per schema document plus `_runtime.py`); importable as
  `japp_contracts` through the repository mypy/pytest path configuration.

Determinism contract: output depends only on the committed schema catalog
and the generator version — no timestamps, absolute paths, usernames,
hostnames, random values, or platform separators. Two generations of the
same catalog are byte-identical on every certified platform.
