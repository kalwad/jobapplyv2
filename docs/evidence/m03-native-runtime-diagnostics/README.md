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

## Windows 11 Setup rounds 29–32 (hosted ubuntu-24.04, KVM; after the reviewed campaign)

The first reviewed Windows 11 campaign (run 41371604274) stopped at Windows Setup's "Select location to install Windows 11" (KI-0171). These scratch-branch rounds isolated the cause. They boot the exact pinned ISO, verified against its SHA-256, with the harness's own `qemu_argv()` and `answer_file()`. The seed CD carries the answer file and a no-op bootstrap, and the disks are the same 128 MiB JAPP-RESULT USB disk and 80 GB system disk.

| Round | Run | Result |
|---|---|---|
| 29, 30 | 41376693013, 41377083648 | install.wim holds one image: index 1, "Windows 11 Enterprise Evaluation", build 26300.9457, so the answer file's `/IMAGE/NAME` matches (`round30-*/wiminfo.txt`). Round 29's probe failed on its own `ls` of a missing install.esd |
| 31 | 41377438498 | The answer file as-is, and the same without `<Letter>C</Letter>`: both reach the location page within one minute and stay there for 30 minutes. Disk 0's partitions exist but show free space equal to their size (unformatted). The letter is not the cause |
| 32 | 41380947763 | Only the second ModifyPartition renumbered from `Order` 3 to 2: "Installing Windows 11" at about 1 minute, then the auto-logged-on desktop by 15 minutes. The same without the C: letter also progresses. With ModifyPartitions removed: "Windows 11 installation has failed" |

So ModifyPartition `Order` must number the modifications contiguously; it is not the PartitionID. The desktop watermark in round 32 reads "Windows License is expired", which is recorded as an observation.

## Windows 11 attestor rounds 33–37 (after the a03aadf campaign)

The reviewed a03aadf campaign (run 41505468952) installed Windows 11 and ran the guest. The guest then failed in the environment phase because the SYSTEM attestor's `machine.json` never appeared (KI-0175). Rounds 33–35 ran on hosted ubuntu-24.04 runners under KVM. They boot the same pinned ISO with the a03aadf answer file and the real bootstrap. `attestor_probe.ps1` takes the guest driver's place at logon; it only observes, and reports over COM2.

| Round | Run | Result |
|---|---|---|
| 33 | 41509581288 | Unchanged attestor (one-minute task limit): no `machine.json` and no `machine-error.json` in 7.5 minutes after logon. A standard user cannot query the SYSTEM task |
| 34 | 41514384986 | Diagnostic-only attestor tracing and a 10-minute limit: the task started as `NT AUTHORITY\SYSTEM` one second after the probe. The probe's own oversized trace line, serialized PowerShell objects, then occupied the slow emulated COM2 (about 1 KB/s) for the rest of the run |
| 35 | 41520516660 | Compact trace output: every attestor step completed and `machine.json` was written about 10 s after the task started (TPM step 2.6 s) |
| 36 | 41532813750 | The KI-0175 correction's first bootstrap and guest, on a hosted windows-2025 runner with Windows PowerShell 5.1 (no VM). All 20 checks pass; see below |
| 37 | 41534670479 | The same checks on the bytes after the correction's review (shared receipt reader, trace removed first), plus six more. All 26 checks pass; see below |

So the attestor runs at logon and is fast when it completes. A first-logon run can also produce nothing, and the guest's 30 s wait does not tolerate that variance. `round*/windows11_bootstrap.ps1` holds each round's exact bootstrap, including the diagnostic-only tracing in rounds 34 and 35. The serial captures keep each JDIAG row's first 4,000 bytes.

Rounds 36 and 37 check the correction's PowerShell on Windows PowerShell 5.1 before any campaign. Round 36 ran on the correction's first bytes; a separate review then changed the guest's receipt reader and the attestor's removal order, so round 37 reran every check on the final bytes, which are identical to the repository's. `attestor_primitives.ps1` ran these checks:
- It parsed the exact bootstrap, the guest and the attestor body (the bootstrap's `$attestor` here-string, taken from its syntax tree) with no errors.
- It wrote the attestor body to a file as the bootstrap does, over a stale error and trace, and ran it as the task does. Off the fixture account, the run failed at `interactive-user` in 2 s. It left a fresh CRLF trace (`start`, `configuration`, `operating-system`, `interactive-user`, `caught at interactive-user`) and an error receipt bound to the run's nonce and the host's boot time, and no `machine.json`.
- The attestor's own `TraceStep` appended while a reader held the trace open in the guest's sharing mode, and it swallowed an unwritable path.
- A second run, started while such a reader held the trace open, removed and rewrote it with its own steps.
- The guest's own `ProtectedReceipt` returned nothing for an absent or partial file, parsed a whole one, and refused one over 64 KB.
- Round 37 only: the reader returned nothing, without an error, for a file a writer still held. A file it held open could still be removed. It parsed a receipt written by the attestor's own Set-Content, which starts with a byte-order mark.
- Round 37 only: when an earlier error was held open without delete sharing (as the pre-review guest's poll held it), a run stopped at the error removal. The earlier trace was already removed. When the guest's shared reader held it instead, a run removed it and wrote its own receipt and trace.
- The guest's own trace-retention block copied a trace exactly, refused one over 64 KB, and wrote nothing when the trace was absent.

Rounds 36 and 37 ran on Windows Server 2025 as an administrator, not on Windows 11 and not as SYSTEM. Their attestor runs stopped at the fixture check, so the later steps and the success path ran only in round 35, whose attestor carried diagnostic tracing rather than the correction's. Original output hashes, including the CRLF line endings, are in each round's `sources.json`; every attestor run's standard output was empty.

## Windows 11 campaign rehearsal rounds 38–50 (hosted ubuntu-24.04, KVM; after the 2100780 candidate review)

The 2100780 candidate was not released (KI-0177). These rounds rehearse the whole Windows 11 campaign on the scratch branch with the harness's own code: `windows11_vm.seed()`, `qemu_argv()`, `observe()` (the real COM2 receipt and frame protocol) and the post-PASS checks, on the pinned ISO and the real CI package. In rounds 38 to 47, each VM's guest controller is the candidate correction plus diagnostic instrumentation, in `diag/repo-root`. Rounds 48 to 50 instead ran the repository working tree's files as they stood at each dispatch, byte for byte, with no instrumentation; each round's `diag-inputs.json` records their hashes. Round 48's files were later changed by the separate review, and round 49's by its own findings; round 50's are the final correction. Each round's `guest-driver-vs-2100780.diff` is its controller against the repository at 2100780. The scratch driver `win11_rehearsal.py` skips only what a scratch run cannot satisfy: the reviewed bundle, the release receipt, source binding and the runner-image and CPU gates. Round 41 instead ran on a hosted windows-2025 runner. After a VM ends, its disposable disk is read read-only for crash dumps and event logs; raw dumps and logs were uploaded for 3 days only and are not retained.

Besides each round's variant settings, named in the table and in its diff (for example a disabled service, `ignore_msrs` or `pmu=off`), one diagnostic change applied to every VM from round 42 to round 47 and alters the target OS: the diagnostic bootstrap also set `PreventDeviceEncryption=1` under `HKLM\SYSTEM\CurrentControlSet\Control\BitLocker` (the DIAG-NOBITLOCKER line in each round's diff), so that a crashed VM's disk could be read. The repository's bootstrap does not set it. Without it, Windows encrypted the system partition on its own in every VM that finished Setup in rounds 40 and 48 to 50 (their forensics logs show it as BitLocker); rounds 38 and 39 did not read the disk. So the timings measured in rounds 42 to 47 come from VMs without device encryption. Rounds 48 to 50 measured the configuration the campaign runs.

| Round | Run | Branch commit | What ran and what it showed |
|---|---|---|---|
| 38 | 41562893419 | 1f8b822 | First-logon variants. With `StartShownOnUpgrade=1` in the Default profile, Start did not open and the console held the foreground; without it, SearchHost held it (KI-0177). In every VM the owned dxdiag launch wrote no report (KI-0180) |
| 39 | 41566483934 | 83a362e | Classic console host against Windows Terminal. dxdiag started directly wrote its report, and the owned launch still did not (KI-0180). The environment receipt's COM2 write took 70 and 44 ms (KI-0178). The conhost VM bugchecked (KI-0181) |
| 40 | 41573532694 | efd4038 | `ignore_msrs=1` did not prevent the bugcheck (KI-0181). In the VM that did not crash, the desktop app's first local-service start failed (KI-0182) |
| 41 | 41573731214 | 4690ac5 (`diag/windows-dxdiag-args`) | Windows PowerShell 5.1 on Windows Server 2025, no VM: dxdiag writes nothing for fully quoted arguments and writes its report for bare tokens (KI-0180) |
| 42 | 41593519821 | b6a33c0 | `pmu=off` did not prevent the bugcheck. A KVM trace and the symbolized kernel minidump put it at the `rdpmc` in `HalpAllocatePmcCounterSetEx` (KI-0181). The service process first appeared 4.5 to 8.8 s after the desktop process (KI-0182) |
| 43 | 41686846768 | ce09e21 | The crashing service is whesvc. With QEMU's Hyper-V enlightenments the guest never touched the counters (KI-0181). The packaged service, started on its own, sent READY 7.6 s after its spawn began (KI-0182). Both VMs that reached the keyboard phase lost a key there (KI-0184). One VM froze in Setup (KI-0183) |
| 44 | 41707301526 | 6ac2298 | Hyper-V enlightenments again, with and without whesvc; every bounded UI wait that succeeded took 24 to 426 ms (KI-0179). Both VMs that reached the keyboard phase lost a key there (KI-0184). One VM froze in Setup (KI-0183) |
| 45 | 41717391994 | acb16f7 | Three replicas with the enlightenments. One VM ran the whole guest to PASS: environment at 24.5 s, ready at 44.5 s, keyboard at 70.1 s and cleanup at 107.5 s of the guest clock (KI-0179); its keyboard receipt's write took 264 ms (KI-0178). Two VMs lost a fixed key during the native shell capture (KI-0184) |
| 46 | 41721262751 | e44a32d | Four replicas, for the lost keys. In the three that reached the desktop, a key was lost again; the app's window answered WM_NULL at once and was not hung, and the same key resent every 5 s for a minute was lost each time. After each of the 41 Tab presses that worked in rounds 45 and 46, Win32 focus was on WebView2's `Chrome_WidgetWin_1`; at each of the five lost keys it was on `Chrome_RenderWidgetHostHWND` (KI-0184). One VM froze in Setup at 40% (KI-0183) |
| 47 | 41733587131 | 873b20a | Six replicas with a trace of every foreground and Win32 focus change against the guest's own steps (`diag-focus-trace.txt`). A UIA SetFocus on a WebView2 element briefly makes the accessibility child the foreground and races the window's reactivation; when the child takes focus last, keys are lost. All 132 requests' focus changes ended within 85 ms, and all 7 lost keys were sent with the child holding focus (KI-0184). Handing focus to the child's parent keyboard window recovered all three times; repeating the UIA request recovered both times. Three VMs passed the whole guest, two through those recoveries. Two lost the first key and failed. One failed in the forced-parent phase on the owned job list (KI-0185) |
| 48 | 41739147286 | d4d07a7 | The repository's first KI-0184/KI-0185 correction, byte for byte and with no instrumentation, in six replicas; device encryption was on in the five that finished Setup. The hosted Windows PowerShell 5.1 job parsed and compiled it (`source-check-job-log-extract.txt`, `attestor_body_parsed: true`). Five VMs ran the whole guest to PASS with the host's post-PASS checks, with environment at 25.7 to 27.6 s and cleanup at 111.5 to 123.2 s of the guest clock (KI-0179). One froze in Setup at 18% (KI-0183). A separate review changed the correction after this round |
| 49 | 41747013174 | d82942f | The reviewed correction, the same way. The hosted Windows PowerShell 5.1 job parsed and compiled it. Four VMs ran the whole guest to PASS with the host's post-PASS checks, cleanup at 107.0 to 121.1 s of the guest clock. In one, the SYSTEM attestor read the console user before Windows reported it (KI-0186). In another, the ready capture was refused the foreground for 10 s, for an unrecorded reason (KI-0187). No VM lost a key |
| 50 | 41750667920 | 2d5af89 | The final correction, the same way, in eight replicas. The hosted Windows PowerShell 5.1 job parsed and compiled it. Seven VMs ran the whole guest to PASS with the host's post-PASS checks, cleanup at 104.2 to 123.9 s of the guest clock, four of them on AMD EPYC 7763 runners. One froze in Setup at 20% (KI-0183); after its first progress frame, every frame capture failed |

Each round's `sources.json` gives every retained file's artifact origin, original size and SHA-256 before LF normalization or PNG conversion, and the scratch sources at the branch commit. No round released a campaign, and no round's result is campaign evidence.

## Windows 11 host-tool closure rounds 51–54 (hosted ubuntu-24.04; ADR-0009)

The 2bf7a4d Windows 11 prepare refused its host tools because Ubuntu's archive had moved ahead of the runner image (KI-0189), and the owner accepted ADR-0009. These four rounds ran on a separate scratch branch, `diag/win11-host-closure` (never merged), with the repository's own resolver, `resolve()` and `simulate_host_install()` from `scripts/linux_gnome/ubuntu_gnome_prepare.py`, imported unchanged by the scratch driver `host_closure.py`. On a hosted ubuntu-24.04 runner each round resolves the Windows `HOST_ROOTS` twice, first against an empty private dpkg status (the old resolution) and then against a copy of the runner's status (ADR-0009), and simulates the install each time. Nothing is installed and no VM starts. Each round retains its `summary.json`, the runner-status lock and the runner-status simulated install plan, byte-identical to the artifact. Its `sources.json` names the artifact and every member not retained: the runner's 1.2 MB dpkg status (its SHA-256 is the `dpkg_status_sha256` in `runner-status-lock.json`), the empty-status lock, and the apt, gpgv and dpkg command records. `runner-step-log-extract.txt` holds the runner image banner and the Runner step's output, exact lines of the job log (the derivation is in `sources.json`). The image column gives the `ImageVersion` variable that host-tool locks record and the campaign checks. GitHub's job-log banner can label the same image differently: round 51's banner reads 20261025.353.1, as do the banners of the failing 2bf7a4d prepare and the 2100780 prepare, whose lock recorded `ImageVersion` 20261026.354.1.

| Round | Run | Branch commit | Runner image | What ran and what it showed |
|---|---|---|---|---|
| 51 | 41912040314 | 3387425 | 20261026.354.1 (banner 20261025.353.1) | The first ADR-0009 resolver, before its separate review. The empty-status resolution locked 117 packages, and its simulated install was refused exactly as in KI-0189: libpcre2-8-0 and libsqlite3-0 would be upgraded and php8.3-dev, libpcre2-dev, libsqlite3-dev and sqlite3 removed. The runner-status resolution downloaded 29 packages, including all ten roots, and recorded 88 runner-provided packages, among them libpcre2-8-0 10.42-4ubuntu2.1 and libsqlite3-0 3.45.1-1ubuntu2.8 at the runner's versions. Its simulated install was accepted. The 29 and the 88 together are exactly the 117 |
| 52 | 41918821956 | 4d21844 | 20261101.360.1 | The resolver after its first separate review, on the newer image. The empty-status refusal was the same, so this image also predates both updates. The runner-status resolution downloaded the same 29 packages and recorded the same 88 packages at the same versions, each with its dpkg status (all `install ok installed`), and its simulated install was accepted |
| 53 | 41929794476 | 022cbe8 | 20261101.360.1 | The resolver after its second review. Same results as round 52: the same empty-status refusal; the same 29 downloads and the same 88 recorded rows; the simulated install accepted |
| 54 | 41943736342 | ede3fdd | 20261026.354.1 (banner 20261025.353.1) | The resolver after its fourth review. `sources.json` gives the hashes of the sources it ran, which are the ones this record's commit carries. Same results as rounds 51 to 53: the same empty-status refusal; the same 29 downloads and the same 88 recorded rows; the simulated install accepted |

No round is campaign evidence. The rounds show only that the resolution and the simulated install succeed on these two images; the reviewed candidate, the campaign's re-check and the VM run are still to come.

## Limits

These are diagnostics on hosted build runners, not campaign evidence:

- Windows 11 Setup rounds 31–32 ran the unattended install with a no-op bootstrap. No guest bootstrap, attestation or VM lifecycle ran.
- The Windows rounds ran only the sliced guest phases listed above.
- No reviewed request released either campaign.
- The GNOME rounds bypassed request authorization (the authorize job); the bundle audit and the reviewed, simulate-first host install of ubuntu_gnome_host.py (host tools came from the workflow's own apt-get line); prepare_inputs, which checks the host-tool lock, the runner image version, the native tool hashes, the resource preflight, the package export and keyring pins and the source binding; and final_source_guard.
- The KIs above stay IN_PROGRESS until hosted campaigns at the corrected head pass.

`round3-*` used the harness sources listed under `round3_harness_copy_at_7a4d6c8`
in `run-metadata.json`. Later rounds list theirs in their own `sources.json`.
