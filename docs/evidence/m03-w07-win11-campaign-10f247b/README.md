# Reviewed Windows 11 VM campaign attempts at 10f247b: no PASS

The independent review (docs/evidence/m03-native-candidates-10f247b-review) released the Windows 11 candidate, artifact 13109055698, for one bound campaign. Its bound hashes:

| File | sha256 |
|---|---|
| bundle | `902c783d…` |
| media lock | `c18dc337…` |
| host tools | `b6f70b31…` |
| guest driver | `1a31fd23…` |

A runner whose CPU has no reviewed Windows 11 support basis refuses before any download or VM start. As the review anticipated, such a refusal needs a fresh request and release of the same reviewed candidate.

| Lifecycle run | Request commit | Hosted CPU | Outcome |
|---|---|---|---|
| 41371207016 | `53286f6` | AMD EPYC 9V74 | Refused at the CPU gate; `vm_started: false` |
| 41371433336 | `3d4bcbc` | Intel Xeon Platinum 8573C | Refused at the CPU gate; `vm_started: false` |
| 41371604274 | `cd9d47f` | AMD EPYC 7763 (reviewed) | FAILED: `Actual Windows setup/guest deadline expired; no login automation fallback` |

## Run 41371604274

- **Host and media:** the bundle audit, host install and exact tool bytes passed. The reviewed ISO was re-downloaded in 95.09 s and matched its pinned SHA-256 (`media-download.json`).
- **Boot:** OVMF started the install media, and the firmware-triggered boot key reached Windows Setup.
- **Setup stall:** five progress frames, one every 600 s, and the failure frame all show Windows Setup on "Select location to install Windows 11". Disk 0 already holds the answer file's System (260 MB), MSR (16 MB) and Primary (79.7 GB) partitions, and Disk 1 shows the JAPP-RESULT USB volume.
- **Guest silence:** the guest never wrote a protocol row. COM2 holds only the 440 bytes of the firmware mirror (`guest-serial.raw`).
- **Closure:** the closure is FAILED, with no acceptance claim. QEMU and the TPM emulator were reaped, and no false PASS was produced. Result collection failed because nothing ever reached the result disk.

The cause is KI-0171. A scratch-branch read of the same ISO (run 41377083648) found exactly one install image: index 1, named "Windows 11 Enterprise Evaluation", build 26300.9457. So the answer file's `/IMAGE/NAME` matches, and the image name is not the cause.

## Retention

Every artifact member of the three runs is retained under `run<id>/`, except that PPM frames are PNG. `artifact-transformations.json` lists the conversions and LF normalizations with the original hashes. `run-metadata.json` gives the runs and artifact digests.
