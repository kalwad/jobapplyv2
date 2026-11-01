# Native VM campaign runtime diagnostics (M03-W07/W08)

Diagnostic rounds on GitHub-hosted runners, dispatched on scratch branches
that are never merged. They measure what the static pre-flight audit of the
never-executed GNOME and Windows 11 VM campaigns could only infer. These are
diagnostics, not campaign evidence, and no VM campaign was released by them.

Rounds 1–3 ran on `ubuntu-24.04` (image 20261026.354.1), on the scratch branch
`diag/windows-service-env`. Every probe used the reviewed a5ec1e3
download-only candidates (GNOME prepare run41154763996, Windows 11 prepare
run41154871189). Host tools were installed with the same local-only APT
options as the harness (KI-0148). No product actor ran in rounds 1–3.

| Round | Run | Branch commit | What ran |
|---|---|---|---|
| 1 | 41165269919 | f68f6d8 | GNOME guest under KVM and under the harness's TCG; Windows 11 firmware boot (failed to start: swtpm AppArmor) |
| 2 | 41171253889 | e506513 | GNOME guest with a COM2 network/session watcher: as-is, needrestart suspended, NetworkManager masked; Windows 11 firmware COM1 and boot window |
| 3 | 41172293108 | 7a4d6c8 | The corrected harness code itself: Windows 11 `qemu_argv()` + firmware-triggered key; GNOME with needrestart suspended and the logind session lookup |

Each `roundN-*/workflow.yml` and `roundN-*/probes/` holds the exact probe
sources at that commit. `run-metadata.json` lists every run, job and artifact
digest. It also gives the size and SHA-256 of each downloaded file as it came
from the artifact. Several retained copies were LF-normalized for the
repository's `eol=lf` rule, by replacing CRLF with LF repeatedly until none
remains (so a run of CRs before a LF is removed). Several larger artifacts are
retained only as extracts.

## Measured facts

- **KVM on standard runners.** `/dev/kvm` exists (`crw-rw---- root:kvm`).
  After `sudo -n setfacl -m u:runner:rw` it answers KVM API 12
  (`round1-*/runner-facts.txt`). The runner-UID ACL entry is gone after one VM
  lifetime (`round3-*/kvm-acl-before-after.txt`). A second QEMU in the same
  job failed with `Could not access KVM kernel module: Permission denied`
  (`round2-*/win11-second-vm-qemu.stderr`). Both campaigns start exactly one
  VM, after granting the ACL.
- **swtpm AppArmor.** The reviewed swtpm profile allows sockets only under
  `/tmp` or the owner's home. A work directory under `/mnt` was refused
  (`round1-*/win11-swtpm-outside-home.stderr`); the harness's `$RUNNER_TEMP`
  is under the runner's home. In round 3 swtpm ran from `$RUNNER_TEMP`.
- **GNOME acceleration (KI-0152).** Under TCG the locked install took about
  1,000 s, and 18 of 568 SSH polls exceeded 6 s (`round1-*/gnome-tcg-*`).
  Under KVM the desktop was up by 195 s, with every poll within 3.01 s
  (`round1-*/gnome-kvm-*`).
- **GNOME SSH loss (KI-0149).**
  - Ubuntu's needrestart apt hook restarted ssh, systemd-networkd and other
    services after the locked install.
  - The install had regenerated netplan's backend files without the networkd
    `.network` for `enp0s2`, and NetworkManager is not in the closure.
  - The restarted networkd therefore left `enp0s2` unmanaged, with no IPv4
    address, and SSH never answered again
    (`round2-*/gnome-base-com2-network.txt`).
  - Masking NetworkManager did not help (`gnome-nmmask-*`).
  - With `NEEDRESTART_SUSPEND=1` the run completed (`gnome-nrsuspend-*`;
    round 3 `gnome-fixed-*`: collection at 268 s, max poll 3.01 s).
- **GNOME install log (KI-0153).** The reviewed 808-archive install wrote
  242,847 bytes, 93% of the former 256 KiB bound
  (`round2-*/gnome-nrsuspend-guest-timeline.json`).
- **GNOME autostart session (KI-0150, KI-0156).**
  - The autostarted app had no `XDG_SESSION_ID`, and
    `loginctl show-session self` refused it.
  - `loginctl show-user <uid> --property=Display` named the real session.
  - The unchanged repository receipt returned CAPABILITY_UNAVAILABLE
    (`round2-*/gnome-nrsuspend-session.json`,
    `gnome-nrsuspend-unchanged-receipt.json`).
  - The corrected receipt resolved session 25 (`gdm-autologin`, `wayland`).
    At +0 s it failed only `graphical-session.target`, which became active
    2.8 s later. At +60 s and +120 s it was SESSION_READY
    (`round3-*/gnome-fixed-receipt-*.json`).
- **AT-SPI action names (KI-0151).** In the real session
  `iface.get_name(0)` raised
  `TypeError: Atspi.Accessible.get_name() takes exactly 1 argument (2 given)`,
  while `iface.get_action_name(0)` returned `'activate'` (both rounds'
  `*-session.json`, key `atspi`).
- **Windows 11 firmware console (KI-0154).** Under the harness's argv, OVMF
  wrote ANSI control sequences and BdsDxe lines to COM1 from 1.2 s on
  (`round2-*/win11-no-key-com1.raw`). With a second serial port, OVMF wrote
  the same 440 bytes to COM2 as to COM1 (`round3-*/win11-com1-console.raw`,
  `win11-com2-protocol.raw`; original byte counts in `run-metadata.json`).
- **Windows 11 boot key (KI-0155).**
  - With no key, OVMF started the media loader at 2.3 s, and the loader's
    "Press any key to boot from CD or DVD" prompt timed out at about 5.5 s.
    "No bootable option" followed at 9.4 s (`round2-*/win11-no-key-*`).
    The former fixed key at +8 s was too late.
  - In round 3 the corrected `installation_media_started()` trigger saw the
    start line at 2.2 s and sent one key at 2.7 s. The frame at 26 s is the
    Windows 11 Setup language page (`round3-*/win11-setup-frame.png`,
    `win11-events.json`, `win11-qemu-argv.json`).

## Windows guest driver and product rounds (hosted windows-2025 desktop)

Hosted windows-2025 runners have an interactive desktop: session 2,
UserInteractive true, Explorer running, and UI Automation and SendInput both
work. Their %TEMP% is the 8.3 alias `C:\Users\RUNNER~1\...`. These are
Windows Server 2025 build hosts, not Windows 11 certification. Rounds 4–11
(`windows-guest-rounds/`, scratch branch `diag/windows-service-env`) ran the
guest driver's own code (`windows11_owned.cs` compiled with PowerShell 5.1,
`windows11_guest.ps1` functions loaded through the PowerShell parser) against
the reviewed a5ec1e3 portable package, and later against a fixed build.

- **Rounds 4–6 (41225412050, 41226037122, 41226305647).** The packaged desktop
  goes from "Starting local service" to "Local service failed" within about
  0.2 s, from any path and with or without the guest's job owner, and
  japp-orchestrator.exe never starts. Alone, with the product's SystemRoot-only
  environment, the same service answers READY in 0.97 s.
- **Instrumented builds (`windows-product-builds/`, scratch branch
  `diag/win-gui-service`).** Build run41226818696 printed
  `resource_dir=Some("\\?\C:\...")` then `InvalidRuntime
  src\service\windows_policy.rs:55` (KI-0157; line 55 of the instrumented
  build, lines 43–48 of the repository file). Build run41227766396 with the
  drive-form fix reached "Desktop App" (service running). Build run41229600953
  logged the WebView2 accelerator events: Ctrl+Q with focus in the page was
  handled, and the app exited (KI-0158).
- **Rounds 7–8 (41228853420, 41229140888), against the fixed build:**
  - Work: the guest's 401 envelope check (12×401, `envelope`/`payload`),
    SetFocus (settled in 4 ms), Check again with a later Checked at, route focus,
    close with port release (3.0 s; the refused connect takes about 2–3 s), and
    the forced-parent kill.
  - Fail: `Invoke('Diagnostics')`, which hits a non-invokable ListItem first,
    and the desktop-root popup search.
  - Round 8's Ctrl+Q step did not drain the job either (`drained: false`, focus
    in msedgewebview2). It ran after the failed File→Quit step, which had left
    the previous launch running in the same job ("Native owned shutdown left
    job members"), so a drained job was not reachable; the next relaunch then
    met "Accessibility node outside retained job". This round does not isolate
    the handler. Rounds 21, 23 and 26 drained the job after Ctrl+Q.
- **Rounds 9–11 (41229650132, 41229781565, 41229932862).** After the driver's
  `Expand('File')`, a visible `#32768` window owned by desktop.exe appears
  within 100 ms. It is not a UI Automation child of the desktop root, but
  `AutomationElement.FromHandle` reads it as Menu "File" with one MenuItem
  "Quit"; invoking it quit the app and drained the job in 825 ms.
- **Packaging note.** The fixed build's portable folder was retained as an
  artifact. upload-artifact drops hidden files, so round 7 restores the
  manifest-listed `runtime/.gitignore` and checks its exact bytes against the
  package's build manifest before launching.

## Windows guest lifecycle rounds 13–26 (hosted windows-2025 desktop)

Scratch branch `diag/win-guest-lifecycle` runs `diag/win_guest_probe7.ps1`.
It loads every function of `windows11_guest.ps1` through the PowerShell parser,
compiles `windows11_owned.cs` with Windows PowerShell 5.1, and runs the guest's
own phase code sliced verbatim from `$phase='ready'` up to, not including, the
terminal PASS row. It replaces `Receipt` (no serial write) and `HostAccepted`
(no frame-acceptance wait) and copies the package folder with a synthetic
config. So none of the following ran in any round:
- the COM2 open and its preflight row;
- the config and seed checks;
- machine attestation and its error retention;
- the dxdiag/environment phase and its ENV-ACCEPT wait;
- ZIP extraction and the inventory check;
- the serial receipts and JAPP11-FRAME-ACCEPT waits;
- the guest's own catch/finally (owned-cleanup.json, package-after.json, the terminal JAPP11 row).

They stay unverified until the first hosted Windows 11 campaign. The branch's
`diag/win_guest_current.ps1` and `diag/win_owned_current.cs` are copies of the
working-tree driver at each round; every round's `sources.json` gives their
hashes. Rounds 13–23 use the fixed instrumented package (build run41227766396).
Round 26 uses an uninstrumented build of exactly the working tree's product
files (`windows-product-builds/product-final-sources.json`, build
run41249725017, which reached "Desktop App" from an ASCII and a Unicode/space
path with empty stderr).

| Round | Run | Result |
|---|---|---|
| 13 | 41232857330 | Ready 12.85 s, 12×401, all 7 baseline shell routes; FAIL at the enlarged ShellMeasure, "Exact unique whole glyph label required" |
| 14 | 41233069849 | Text probe: FindText inside the versions region's range drifts one character per line break ("0.0.1" read ".1\nTau"; KI-0163) |
| 15 | 41248050820 | FAIL at a baseline focus settle (skip link to main); not seen again in rounds 17–26 |
| 17, 19 | 41248210751, 41248474580 | Baseline passes; at 175% the anchors are offscreen after a text range's ScrollIntoView (round 19 records `offscreen: true`, y > 800) |
| 18 | 41248352997 | Leaf-scoped ranges read "0.0.1", "App version" and "Tauri version" exactly; ShellMeasure passes at baseline |
| 20 | 41248672768 | The region's ScrollItemPattern brings the anchors into view at 175% (`shell-measure-after` ok) |
| 21, 23 | 41248844718, 41249084652 | **Probe terminal PASS** (69.4 s, 65.5 s) of the sliced phases: ready, unauthorized12, 14 shell routes (baseline and enlarged), crash, restart, close, relaunch, collision, menu Quit, Ctrl+Q, forced parent, cleanup |
| 26 | 41250313459 | **Probe terminal PASS** (64.6 s), the same sliced phases, against the uninstrumented reviewed product build |

The round 21, 23 and 26 driver copies equal the working-tree
`windows11_owned.cs` (5b2e5070…) and `windows11_guest.ps1` (63323c70…), which
are the `WINDOWS11_NATIVE_PINS` in `scripts/check_portability.py`. These hosts
are Windows Server 2025 build hosts, not Windows 11; no Windows 11 setup,
answer file, bootstrap, attestation or QMP frame ran.

## GNOME end-to-end rounds 12–28 (hosted ubuntu-24.04, KVM)

Scratch branch `diag/windows-service-env` runs `diag/gnome_e2e.py`, which
calls the harness's own `prepare_image`, `prepare_guest`, `launch_vm`,
`observe_session`, `run_lifecycle` and `finalize` from a copy of
`scripts/linux_gnome` (`diag/repo-root`), with the reviewed a5ec1e3 GNOME
candidate's package and guest closure. It bypasses request authorization (the authorize job); the bundle audit and the reviewed, simulate-first host install of ubuntu_gnome_host.py (host tools came from the workflow's own apt-get line); prepare_inputs, which checks the host-tool lock, the runner image version, the native tool hashes, the resource preflight, the package export and keyring pins and the source binding; and final_source_guard.
The KI-0157/KI-0158 product changes are Windows-only, so the a5ec1e3 package is
the current Linux product.

| Round | Run | Result |
|---|---|---|
| 12 | 41233236511 | Image, provision and session pass; launch FAIL: `Atspi.Accessible.get_text() takes exactly 1 argument (3 given)` (KI-0162) |
| 16 | 41248054236 | Launch PASS; `shell_focus_diagnostics` FAIL: no unique actionable target |
| 22 | 41248905032 | The refusal names its candidates: the focused heading (actions `['']`) and the navigation link (`['jump']`) (KI-0165) |
| 24 | 41249463049 | 49 of 50 shell steps (receipts 02–51) pass; `shell_scale_step4` FAIL: version rows offscreen, checked before scrolling (KI-0164) |
| 25 | 41249857437 | Scrolling the "App version" label first is not enough: WebKitGTK scrolls only until that label shows |
| 27 | 41250366992 | Scrolling the whole region: all 96 shell steps (receipts 02–97) pass; `keyboard_before` FAIL because the scroll pane and named document are also FOCUSED (KI-0166) |
| 28 | 41250875399 | **ACTUAL_GDM_UBUNTU_GNOME_PACKAGE_LIFECYCLE_SCOPED_PASS** (340.6 s), 115 receipts: launch, native shell capture (14 routes, 7 zoom stages), keyboard, 6×401 (health, ready and version, each with no token and a wrong token), service crash and Check again, close/relaunch twice, File→Quit, Ctrl+Q, relocated Unicode-path launch, forced parent, finish |

Round 28's `ubuntu_gnome_guest.py` (retained in its folder) is the working-tree
module with the KI-0164, KI-0165 and KI-0166 corrections, before the round-3
review edits to `focus_before_chord` and later test-driven corrections. The
working-tree module also writes the same settle loop as `while anchors is None`,
for mypy, with unchanged behaviour. Round 28's `ubuntu_gnome_vm.py` (hash in its
`sources.json`) also predates later working-tree edits (late-frame handling and
the review corrections). So neither host nor guest module that passed is
byte-identical to the module that will run in the campaign. Its PPM frames are
retained as PNG; each `sources.json` records the original artifact bytes and
hash.

## Limits

These are diagnostics on hosted build runners, not campaign evidence:

- No Windows 11 unattended install, guest bootstrap, attestation or VM lifecycle ran.
- The Windows rounds ran only the sliced guest phases listed above.
- No reviewed request released either campaign.
- The GNOME rounds bypassed request authorization (the authorize job); the bundle audit and the reviewed, simulate-first host install of ubuntu_gnome_host.py (host tools came from the workflow's own apt-get line); prepare_inputs, which checks the host-tool lock, the runner image version, the native tool hashes, the resource preflight, the package export and keyring pins and the source binding; and final_source_guard.
- The KIs above stay IN_PROGRESS until hosted campaigns at the corrected head pass.

`round3-*` used the harness sources listed under `round3_harness_copy_at_7a4d6c8`
in `run-metadata.json`. Later rounds list theirs in their own `sources.json`.
