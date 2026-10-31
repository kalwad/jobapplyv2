# Independent review of the a5ec1e3 native candidates: GNOME released, Windows 11 not released

Source S `a5ec1e3a894fc6f11354f5adce1631b1cc262470` (tree `758efac1…`), package merge M `97e21680…` from hosted run 41149738856 (terminal SUCCESS; the Windows package actor passes again, cleanup 267 ms). Download-only candidates: GNOME prepare run 41154763996 (request commit `df99cdc`, artifact 13024588558, ZIP sha256 `a807367b…`) and Windows 11 prepare run 41154871189 (request commit `b421351`, artifact 13023973641, ZIP sha256 `1432e309…`). Neither run installed anything or started a VM (`run-metadata.json`).

The review was run by an independent multi-agent workflow (29 separate-context, read-only agents: nine lenses, two adversarial refuters for every actionable finding, one final reviewer per platform). Its complete output is `review-workflow-result.json`; the decision record bound by a release receipt is `review-decision.json`. `bound/` holds the exact bytes of every file a receipt pins, so each pinned SHA-256 is reproducible from this packet.

## GNOME: RELEASE_ONE_BOUND_CAMPAIGN

All four lenses (bundle, guest closure, host tools and keyring, preparation record) returned CLEAR_WITH_NOTES with no blocking finding. Bound hashes (each recomputed by the final reviewer): bundle `415a2f7d…81e9`, guest closure `4754901a…bd6f`, host tools `23e9cdcb…d953`, cloud-image keyring `c2d40d92…dbf2f`; export.json `b258f6d0…562ba`. Highlights:

- Two lenses each verified all three Ubuntu InRelease signatures independently in pure Python (RSA-4096, SHA-512, PKCS#1 v1.5) against the 2018 archive key, with tamper negative controls; all 808 guest and 131 host archives join signed Packages records whose indexes join the signed Releases.
- The package export is byte-identical to the original CI artifact, and the repository's own `audit_bundle` and `validate_closure` accept the candidate (run on macOS).
- 2025 recorded preparation commands, all exit 0: no sudo, no install, no VM, no credentials; source unchanged.

Carried notes (none blocks; all fail closed): the host lock pins the runner image version, so the campaign stops if GitHub rotates the ubuntu-24.04 image before it runs; the signed chain is checked at review time and the campaign re-checks only the pinned hashes; the bound cloud-image keyring also contains the Ubuntu Cloud Image Builder key, but the campaign requires a signature by the UEC image key and the source-pinned image SHA-256; the guest closure's full transitive dependency set and the product package content were not re-derived here.

## Windows 11: DO_NOT_RELEASE

The candidate's own contents check out (media, host tools, guest controller, preparation record): the ISO digest `bc3f2408…` matches Microsoft's published value for the Windows 11 Enterprise Evaluation x64 en-US image covered by OD-038, and the three guest controller files equal the repository source at S. Two defects in the protected campaign infrastructure, each upheld by all four adversarial votes and re-checked by the final reviewer, mean no campaign on this candidate could pass:

1. The prepare workflow uploads two paths (`retained/` and `retention-failure.json`), so every artifact member sits under `retained/`, while the lifecycle workflow passes `--bundle "$RUNNER_TEMP/japp-reviewed-win11-inputs/inputs"`; the bundle audit would fail before any step (KI-0146).
2. `windows11_vm.seed()` runs `scripts/windows_package.py inspect` on the Linux host, but that script refuses any host other than native Windows x64; the campaign would fail after the ISO download and before QEMU starts (KI-0147).

Both files are protected sources, so the correction needs a new source commit, package run and reviewed candidate.
