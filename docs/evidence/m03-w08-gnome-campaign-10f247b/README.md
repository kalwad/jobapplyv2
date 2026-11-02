# First reviewed GNOME VM campaign: scoped lifecycle PASS at 10f247b

Lifecycle run **41371114075** (workflow `reviewed Ubuntu GNOME package lifecycle`, request and release commit `0e241ba`) is terminal SUCCESS. It ran the one campaign released by docs/evidence/m03-native-candidates-10f247b-review on a GitHub-hosted ubuntu-24.04 runner:
- Source S: `10f247bc…`
- Package merge M: `c25742ef…`
- Candidate artifact: 13106829926
- Bound hashes: bundle `ac34c896…`, guest closure `193416ec…`, host tools `4c3552e2…`, keyring `c2d40d92…`
- Review decision: `efe60987…`

## What ran

1. **Host step** (`japp-gnome-host-proof/`), status `REVIEWED_HOST_INSTALL_AND_EXACT_TOOL_BYTES_PASS`:
   - the bundle audit;
   - the simulate-first host install plan (`host-install-plan.json`, only locked exact adds);
   - the reviewed local-only install;
   - exact tool-byte checks.
2. **VM campaign** (`japp-gnome-vm-proof/retained/`), status `ACTUAL_GDM_UBUNTU_GNOME_PACKAGE_LIFECYCLE_SCOPED_PASS` in 353 s, with no finalization errors. It ran under KVM (`kvm.json`: API 12, no TCG fallback), in the default GDM autologin session (`default_session_type: wayland`). It covered:
   - launch of the packaged desktop from its installed path;
   - native shell capture of all seven routes at baseline and enlarged zoom (`native-shell.json`: 14 routes, 7 zoom measurements, through AT-SPI);
   - keyboard Tab, Shift+Tab, Enter and the skip link;
   - 6×401 for health, ready and version, each with no token and with a wrong token;
   - a controlled service crash with recovery through Check again;
   - close and relaunch, twice;
   - File→Quit through AT-SPI;
   - Ctrl+Q sent through QMP;
   - relaunch from a relocated Unicode/space path;
   - a forced parent kill.

   The closure lists 18 milestone receipts and 20 frames, and the retained folder holds every guest receipt (01–115).
3. **Integrity:**
   - The source guard covers 2777 files, with bytes, modes, HEAD, tree and status unchanged.
   - The serial tail was scanned and holds no private key material.
   - The outer QEMU group was reaped with exit 0.

## What this does not claim

The closure records:
- `platform_certification_claimed: false`
- `universal_escaped_descendant_absence_claimed: false`
- `forced_startup_collision_recovery_claimed: false`

This is one scoped campaign on one hosted runner image (ImageVersion 20261026.354.1), not certification across GNOME versions or hardware. Windows 11 evidence is separate.

## Retention

- Every artifact member is retained, except that the 20 PPM frames are converted to PNG. Their original bytes and hashes, and the 5 text files whose CRLF was reduced to LF, are listed in `artifact-transformations.json`.
- The campaign's own `retention-manifest.json` is kept as produced and refers to the original artifact members.
- `run-metadata.json` gives the run, jobs and artifact digests.
