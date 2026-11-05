# Reviewed Windows 11 VM campaign attempts at a03aadf: no PASS (KI-0175)

The independent review (docs/evidence/m03-native-candidates-a03aadf-review) released the KI-0171-corrected candidate, artifact 13119257518, for one bound campaign. Its bound hashes:

| File | sha256 |
|---|---|
| bundle | `ce73eddd…` |
| media lock | `d1aa8e32…` |
| host tools | `b6f70b31…` |
| guest driver | `1a31fd23…` |
| review decision | `3cbd8f37…` |

| Lifecycle run | Hosted CPU | Outcome |
|---|---|---|
| 41504880968 | AMD EPYC 9V45 | Refused at the CPU gate; `vm_started: false` |
| 41505216414 | AMD EPYC 9V74 | Refused at the CPU gate; `vm_started: false` |
| 41505468952 | AMD EPYC 7763 (reviewed) | FAILED: guest terminal row `FAIL`, phase `environment`, "Protected current-boot machine attestation missing or unreadable" |

## Run 41505468952: the first Windows 11 guest run

- **Host and media:** the host install, exact tool bytes and the pinned ISO re-download and digest check all passed.
- **Setup:** with the KI-0171 answer file, unattended Setup installed Windows 11 Enterprise Evaluation, completed specialize, where the real bootstrap ran as SYSTEM, and OOBE, then auto-logged on the synthetic fixture account.
- **Guest driver:** it started from the fixture's Startup entry, opened COM2, and waited 30 s for the protected machine receipt written by the SYSTEM attestor scheduled task. Neither `machine.json` nor `machine-error.json` appeared, so the guest wrote its own bounded `failure.json` and the terminal FAIL row. Nothing else was written to COM2 (`guest-serial.raw`).
- **Collection:** the host collected the guest result disk (`guest-results/proof/failure.json`).
- **Closure:** FAILED, with no acceptance claim. QEMU and the TPM emulator were reaped.
- **Frames:** the failure frame shows the fixture's desktop with the guest's console window open.

This is the first time the bootstrap, the auto-logon, the guest's COM2 protocol and result collection ran inside Windows 11. All of them worked. KI-0175 records the attestor cause.

## Retention

Every artifact member of the three runs is retained under `run<id>/`, with PPM frames converted to PNG. `artifact-transformations.json` lists the conversions and LF normalizations with the original hashes. No answer file or credential is retained; `retention.json` records the exclusion.
