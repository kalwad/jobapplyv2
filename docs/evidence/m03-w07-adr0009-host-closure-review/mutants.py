"""ADR-0009 mutants: apply each to a copy of the repository, run its tests, restore.

Usage: python3 -I -B mutants.py <copy-of-repository-root> <python-with-pytest>
Each mutant replaces exact text (each edit must occur once) in one source of the
copy, runs the named test files from the copy's root, and restores the exact
bytes. KILLED means the tests failed; SURVIVED means they all passed.
"""

import json
import subprocess
import sys
from pathlib import Path

P = "scripts/linux_gnome/ubuntu_gnome_prepare.py"
V = "scripts/windows11/windows11_vm.py"
C = "scripts/windows11/windows11_candidate.py"
G = ["scripts/tests/test_ubuntu_gnome_review_regressions.py"]
W = ["scripts/tests/test_windows11_host_runtime.py"]
m = []
def add(name, file, tests, *edits):
    m.append({"name": name, "file": file, "tests": tests, "edits": [list(e) for e in edits]})
copy = '        sha(DPKG_STATUS, DPKG_STATUS_CAP)\n        shutil.copyfile(DPKG_STATUS, root / "status.copying")\n        (root / "status.copying").replace(root / "status")\n'
add("p_no_status_copy", P, G, (copy, ""))
add("p_status_copied_after_apt", P, G, (copy, ""), ('    archives = sorted((root / "archives").glob("*.deb"))\n', '    if runner_status:\n        shutil.copyfile(DPKG_STATUS, root / "status")\n    archives = sorted((root / "archives").glob("*.deb"))\n'))
add("p_no_symlink_refusal", P, G, ("        sha(DPKG_STATUS, DPKG_STATUS_CAP)\n", ""))
add("p_first_alternative_only", P, G, ("for name in group for found in runner.get(name, [])", "for name in group[:1] for found in runner.get(name, [])"))
add("p_break_after_first_provider", P, G, ("                        pending.append(installed[package])\n", "                        pending.append(installed[package])\n                    break\n"))
add("p_skip_runner_when_lock_satisfies", P, G, ("                satisfied = any(name in downloaded for name in group)\n", "                satisfied = any(name in downloaded for name in group)\n                if satisfied:\n                    continue\n"))
add("p_lock_never_satisfies", P, G, ("satisfied = any(name in downloaded for name in group)", "satisfied = False"))
add("p_lock_provides_ignored", P, G, ("    downloaded = providers(controls)", "    downloaded = {name: [name] for name in controls}"))
add("p_provides_ignored", P, G, ('        if meta.get("Provides"):', "        if False:"))
add("p_hold_not_installed", P, G, ('RUNNER_INSTALLED = frozenset({"install ok installed", "hold ok installed"})', 'RUNNER_INSTALLED = frozenset({"install ok installed"})'))
add("p_foreign_arch_counted", P, G, ('            or meta.get("Architecture") not in RUNNER_ARCHITECTURES\n', ""))
add("p_duplicate_installed_allowed", P, G, ('        if meta["Package"] in installed:\n            raise ValueError("Duplicate installed runner package: " + meta["Package"])\n', ""))
add("p_unsatisfied_ignored", P, G, ("                if not satisfied:", "                if False:"))
add("p_live_check_removed", P, G, ("    if live != rows:", "    if False:"))
add("p_live_any_status", P, G, ("if status not in RUNNER_INSTALLED or package in rows:", "if package in rows:"))
add("p_live_duplicate_allowed", P, G, ("if status not in RUNNER_INSTALLED or package in rows:", "if status not in RUNNER_INSTALLED:"))
add("p_live_foreign_counted", P, G, ("        if architecture not in RUNNER_ARCHITECTURES:\n            continue\n", ""))
add("p_row_without_status", P, G, ('            "status": installed[name]["Status"],\n', ""))
add("p_pre_depends_ignored", P, G, ('for field in ("Pre-Depends", "Depends"):', 'for field in ("Depends",):'))
add("p_no_recursion", P, G, ("                        pending.append(installed[package])\n", ""))
add("p_continuations_dropped", P, G, ('                meta[key] += " " + line.strip()\n', ""))
add("p_splitlines", P, G, ('        for line in block.split("\\n"):', "        for line in block.splitlines():"))
add("p_orphan_continuation_allowed", P, G, ("                if not key:\n                    raise ValueError(", "                if not key:\n                    continue\n                    raise ValueError("))
add("p_duplicate_field_allowed", P, G, ("            if not colon or key in meta:", "            if not colon:"))
add("p_strict_names", P, G, ('r"([A-Za-z0-9][A-Za-z0-9+._-]*)', 'r"([a-z0-9][a-z0-9+.-]+)'))
add("p_arch_qualifier_rejected", P, G, ("(?::[A-Za-z0-9-]+)?", ""))
add("p_status_cap_removed", P, G, ('    if len(raw) > DPKG_STATUS_CAP:\n        raise ValueError("Bounded runner dpkg status required")\n', ""))
add("p_package_cap_removed", P, G, ('    if len(provided) > LOCK_PACKAGE_CAP:\n        raise ValueError("Runner-provided closure exceeds finite cap")\n', ""))
add("p_root_check_removed", P, G, ("        if missing:\n            raise", "        if False:\n            raise"))
add("p_empty_status_flag_true", P, G, ('"empty_status_resolution": not runner_status,', '"empty_status_resolution": True,'))
add("p_status_sha_not_of_copy", P, G, ('result["dpkg_status_sha256"] = sha(root / "status", DPKG_STATUS_CAP)', 'result["dpkg_status_sha256"] = "0" * 64'))
add("p_downloaded_also_recorded", P, G, ("if package not in provided and package not in controls:", "if package not in provided:"))
add("w_any_status", V, W, ("if status not in RUNNER_INSTALLED or name in actual:", "if name in actual:"))
add("w_duplicate_allowed", V, W, ("if status not in RUNNER_INSTALLED or name in actual:", "if status not in RUNNER_INSTALLED:"))
add("w_held_refused", V, W, ('RUNNER_INSTALLED = frozenset({"install ok installed", "hold ok installed"})', 'RUNNER_INSTALLED = frozenset({"install ok installed"})'))
add("w_status_not_compared", V, W, ("        actual[name] = (version, arch, status)", "        actual[name] = (version, arch, INSTALLED)"), ("RUNNER_INSTALLED = frozenset(", "INSTALLED = \"install ok installed\"\nRUNNER_INSTALLED = frozenset("), ('        reviewed[row["package"]] = (row["version"], row["architecture"], row["status"])', '        reviewed[row["package"]] = (row["version"], row["architecture"], INSTALLED)'))
add("w_foreign_counted", V, W, ('        if arch not in {"amd64", "all"}:\n            continue\n', ""))
add("w_pre_check_removed", V, W, ('    require_runner_packages(\n        owner, reviewed, "Runner-provided host packages differ from the reviewed lock"\n    )\n', ""))
add("w_post_check_no_compare", V, W, ('require_runner_packages(\n        owner, reviewed, "Runner-provided host packages changed during install"\n    )', "runner_packages(owner, sorted(reviewed))"))
add("w_disjoint_removed", V, W, ('    if reviewed.keys() & {row["package"] for row in packages}:', "    if False:"))
add("w_v1_accepted", V, W, ('if lock.get("schema") != "japp-win11-host-tools-v2":', 'if lock.get("schema") not in {"japp-win11-host-tools-v1", "japp-win11-host-tools-v2"}:'))
add("w_extra_keys_allowed", V, W, ('set(row) != {"package", "version", "architecture", "status"}', 'not {"package", "version", "architecture", "status"} <= set(row)'))
add("w_row_status_unchecked", V, W, ('            or row["status"] not in RUNNER_INSTALLED\n', ""))
add("w_row_type_unchecked", V, W, ("            not isinstance(row, dict)\n            or set(row)", "            set(row)"))
add("w_cap_removed", V, W, ("if not isinstance(provided, list) or len(provided) > HOST_PACKAGE_CAP:", "if not isinstance(provided, list):"))
add("w_unnamed_image_matches", V, W, ("    if not image or lock[\"runner_image_version\"] != image:", "    if lock[\"runner_image_version\"] != image:"))
add("c_unnamed_image_allowed", C, W, ("    if not image:\n        raise ValueError(\"Named hosted runner image version required\")\n", ""))
add("c_status_not_retained", C, W, ('            retain_runner_status(work / "apt" / "status", args.output)', "            pass"))
add("c_status_digest_unchecked", C, W, ('        if not retained.is_file() or digest(retained) != lock["dpkg_status_sha256"]:\n            raise', '        if False:\n            raise'))
add("c_status_sha_not_staged", C, W, ('"runner_dpkg_status_sha256": lock["dpkg_status_sha256"],', '"runner_dpkg_status_sha256": None,'))
add("c_resolution_mode_not_staged", C, W, ('"empty_status_resolution": lock["empty_status_resolution"],', '"empty_status_resolution": True,'))
add("c_empty_status_resolution", C, W, ("lock = resolve(owner, work / \"apt\", host, HOST_ROOTS, runner_status=True)", "lock = resolve(owner, work / \"apt\", host, HOST_ROOTS)"))

# Review 2 (wf_3c8d4e79-2d4) additions.
add("p_strict_decode_status", P, G, ('paragraphs(raw.decode("utf-8", "replace"))', "paragraphs(raw.decode())"))
add("p_walk_reads_live_status", P, G, ('runner_provided(\n            owner, root / "status", controls\n        )', "runner_provided(owner, DPKG_STATUS, controls)"))
add("p_hash_reads_live_status", P, G, ('result["dpkg_status_sha256"] = sha(root / "status", DPKG_STATUS_CAP)', 'result["dpkg_status_sha256"] = sha(DPKG_STATUS, DPKG_STATUS_CAP)'))
add("p_default_runner_status", P, G, ("    runner_status: bool = False,", "    runner_status: bool = True,"))
add("p_copy_cap_removed", P, G, ("        sha(DPKG_STATUS, DPKG_STATUS_CAP)\n", "        sha(DPKG_STATUS)\n"))
add("p_duplicate_unnamed", P, G, ('"Duplicate installed runner package: " + meta["Package"]', '"Duplicate installed runner package: "'))
add("p_live_difference_unnamed", P, G, ('+ " ".join(sorted(changed)[:10])', '+ ""'))
add("p_malformed_unnamed", P, G, ('"Malformed Debian control paragraph: " + repr(line[:80])', '"Malformed Debian control paragraph: "'))
add("p_gnome_host_runner_status", P, W, ('host_lock = resolve(owner, owner.work / "host-apt", host, HOST_ROOTS)', 'host_lock = resolve(owner, owner.work / "host-apt", host, HOST_ROOTS, runner_status=True)'))
add("w_all_arch_refused", V, W, ('        if arch not in {"amd64", "all"}:', '        if arch not in {"amd64"}:'))
add("w_arch_not_compared", V, W, ("        actual[name] = (version, arch, status)", '        actual[name] = (version, "amd64", status)'), ('        reviewed[row["package"]] = (row["version"], row["architecture"], row["status"])', '        reviewed[row["package"]] = (row["version"], "amd64", row["status"])'))
# Review 3 (wf_c6d10595-e2a) additions.
add("p_first_virtual_provider_only", P, G, ("for name in group for found in runner.get(name, [])", "for name in group for found in runner.get(name, [])[:1]"))
add("c_placeholder_retained", C, W, ("        if private.is_file() and private.stat().st_size > 0:", "        if private.is_file():"))
# Final check (wf_9f7f0884-cc0) additions.
add("p_runner_pre_depends_ignored", P, G, ('for field in ("Pre-Depends", "Depends"):', 'for field in (("Pre-Depends", "Depends") if meta in controls.values() else ("Depends",)):'))
add("c_digest_guarded_on_exists", C, W, ('if not retained.is_file() or digest(retained) != lock["dpkg_status_sha256"]:', 'if retained.is_file() and digest(retained) != lock["dpkg_status_sha256"]:'))
add("c_retention_except_narrowed", C, W, ("    except OSError:\n        return", "    except FileExistsError:\n        return"))

root, python = Path(sys.argv[1]), sys.argv[2]
for mutant in m:
    path = root / mutant["file"]
    original = path.read_bytes()
    text = original.decode("utf-8")
    for old, new in mutant["edits"]:
        if text.count(old) != 1:
            raise SystemExit(mutant["name"] + ": edit does not occur exactly once")
        text = text.replace(old, new)
    path.write_bytes(text.encode("utf-8"))
    try:
        run = subprocess.run(
            [python, "-I", "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", *mutant["tests"]],
            cwd=root, capture_output=True, text=True,
            env={"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}, check=False,
        )
        lines = run.stdout.strip().splitlines()
        state = "SURVIVED" if run.returncode == 0 else "KILLED"
        print(mutant["name"] + ": " + state + " | " + (lines[-1] if lines else run.stderr[-300:]), flush=True)
    finally:
        path.write_bytes(original)
        if path.read_bytes() != original:
            raise SystemExit("source not restored: " + str(path))
