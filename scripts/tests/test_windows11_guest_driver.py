"""Windows 11 guest driver contracts, read as source text only.

No PowerShell, .NET compiler, UI Automation, serial port, VM or product runs
here: the reviewed guest sources are parsed as data, and the answer file is
rendered by its pure generator. The Linux owner's modules are only imported
(importing them is inert) to bind the shared frame protocol and attestation
thresholds. A hosted Windows runner separately parses the PowerShell 5.1
sources and compiles the C# owner (windows11_source_check.ps1).
"""

from __future__ import annotations

import ast
import importlib.util
import inspect
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "scripts" / "windows11"
SHARED = ROOT / "scripts" / "linux_gnome"
ORCHESTRATOR = ROOT / "services" / "orchestrator" / "src" / "orchestrator"
# Windows PowerShell 5.1 reads a BOM-less script as the ANSI code page.
GUEST = (SOURCE / "windows11_guest.ps1").read_text(encoding="ascii")
OWNED = (SOURCE / "windows11_owned.cs").read_text(encoding="ascii")
BOOTSTRAP = (SOURCE / "windows11_bootstrap.ps1").read_text(encoding="ascii")
FRAMED_PHASES = ("ready", "keyboard", "restart", "relaunch", "collision")
# The attestor's one trace writer: the UTC time and the name it is given, appended
# with read sharing (KI-0175). A trace failure never stops the attestor or its
# error receipt (review: an unguarded append in the catch could suppress it).
TRACE_STEP = (
    "function TraceStep([string]$Name) { try { [IO.File]::AppendAllText($tracePath,"
    "([DateTime]::UtcNow.ToString('o')+' '+$Name+\"`r`n\"),[Text.Encoding]::ASCII) } "
    "catch { } }"
)
# The attestor's steps, in order; each is traced before its work.
ATTESTOR_STEPS = (
    "configuration",
    "operating-system",
    "interactive-user",
    "autologon",
    "processors",
    "system-disk",
    "tpm",
    "version",
    "secure-boot",
    "record",
)


def literal_end(text: str, index: int, language: str) -> int:
    """Index just past the string or character literal starting at index."""
    quote = text[index]
    verbatim = language == "cs" and quote == '"' and text[index - 1 : index] == "@"
    index += 1
    while index < len(text):
        char = text[index]
        if language == "cs" and not verbatim and char == "\\":
            index += 2
            continue
        if language == "ps" and quote == '"' and char == "`":
            index += 2
            continue
        if char == quote:
            if (language == "ps" or verbatim) and text[index + 1 : index + 2] == quote:
                index += 2
                continue
            return index + 1
        index += 1
    raise AssertionError("Unterminated literal")


def block(text: str, start: int, language: str) -> tuple[str, int]:
    """Body of the first brace block at or after start, and its end index."""
    opening = None
    depth = 0
    index = start
    while index < len(text):
        char = text[index]
        comment = (language == "ps" and char == "#") or (
            language == "cs" and text.startswith("//", index)
        )
        if comment:
            end = text.find("\n", index)
            index = len(text) if end < 0 else end
            continue
        if char in "'\"":
            index = literal_end(text, index, language)
            continue
        if char == "{":
            opening = index if opening is None else opening
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and opening is not None:
                return text[opening + 1 : index], index + 1
        index += 1
    raise AssertionError("Unbalanced block")


def ps_function(name: str, text: str = GUEST) -> str:
    match = re.search(r"(?m)^\s*function " + re.escape(name) + r"\b", text)
    assert match is not None, name
    return block(text, match.end(), "ps")[0]


def attestor_source() -> str:
    """The SYSTEM attestor script the bootstrap writes, as its here-string text."""
    attestor = re.search(r"\$attestor = @'\n(.*?)\n'@", BOOTSTRAP, re.DOTALL)
    assert attestor is not None
    return attestor.group(1)


def attestor_try(text: str) -> int:
    """Index of the attestor's one top-level try, past any one-line function body."""
    tries = [match.start() for match in re.finditer(r"(?m)^try \{", text)]
    assert len(tries) == 1, tries
    return tries[0]


def cs_member(signature: str) -> str:
    match = re.search(signature, OWNED)
    assert match is not None, signature
    return block(OWNED, match.end(), "cs")[0]


def functions_calling(call: str) -> set[str]:
    names = re.findall(r"(?m)^function (\w+)", GUEST)
    return {name for name in names if call in ps_function(name)}


def classifies_transient(body: str) -> bool:
    return (
        re.search(
            r"catch\s*\{\s*if\s*\(\s*-not\s*\(\s*NotYet \$_\s*\)\s*\)"
            r"\s*\{\s*throw\s*\}",
            body,
        )
        is not None
    )


def statements(body: str, language: str) -> list[str]:
    """Stripped code lines of a body, without blank or whole-line comment lines."""
    marker = "#" if language == "ps" else "//"
    lines = (line.strip() for line in body.splitlines())
    return [line for line in lines if line and not line.startswith(marker)]


def ps_value(expression: str, names: dict[str, str]) -> str:
    """Value of a closed PowerShell '+' string join of quoted literals and names."""
    terms = re.findall(r"'(?:[^']|'')*'|\$[A-Za-z][\w.]*", expression)
    assert "+".join(terms) == expression, expression
    return "".join(
        term[1:-1].replace("''", "'") if term.startswith("'") else names[term]
        for term in terms
    )


def py_value(node: ast.expr, names: dict[str, object]) -> object:
    """Value of a closed Python constant, name, subscript, '+', '*' or '**' tree."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return names[node.id]
    if isinstance(node, ast.Subscript):
        container = py_value(node.value, names)
        assert isinstance(container, dict)
        return container[py_value(node.slice, names)]
    assert isinstance(node, ast.BinOp), ast.dump(node)
    left, right = py_value(node.left, names), py_value(node.right, names)
    if isinstance(node.op, ast.Add):
        assert isinstance(left, str)
        assert isinstance(right, str)
        return left + right
    assert isinstance(left, int)
    assert isinstance(right, int)
    if isinstance(node.op, ast.Mult):
        return left * right
    assert isinstance(node.op, ast.Pow), ast.dump(node)
    return int(left**right)


def load_host_module(name: str, monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    """One Linux-owner module, loaded as test_windows11_host_runtime.py does."""
    monkeypatch.syspath_prepend(str(SHARED))
    monkeypatch.syspath_prepend(str(SOURCE))
    # The Linux VM host module imports fcntl; give a Windows verify host an
    # inert stand-in so these pure contracts run on every host.
    if "fcntl" not in sys.modules:
        try:
            import fcntl  # noqa: F401, PLC0415 - POSIX verify hosts only
        except ImportError:
            monkeypatch.setitem(sys.modules, "fcntl", ModuleType("fcntl"))
    spec = importlib.util.spec_from_file_location(name, SOURCE / (name + ".py"))
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, module)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def deployment() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "windows11_guest_driver_deployment", SOURCE / "windows11_deployment.py"
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_package_root_uses_the_long_form_profile_base_not_8_3_temp() -> None:
    # 'JappFixture' has 11 characters, so userenv gives an 8.3 %TEMP%
    # (C:\Users\JAPPFI~1\...) while the product reports long image paths.
    assignment = re.search(r"(?m)^\s*\$packageRoot=(.+)$", GUEST)
    assert assignment is not None
    assert "$env:TEMP" not in assignment.group(1)
    assert "JobApply '+[char]0x03A9+' space '" in assignment.group(1)
    base = re.search(r"(?m)^\s*\$localData=(.+)$", GUEST)
    assert base is not None
    assert base.group(1) == "[Environment]::GetFolderPath('LocalApplicationData')"
    assert GUEST.index("$localData=") < GUEST.index("$packageRoot=Join-Path")
    assert "IsPathRooted($localData)" in GUEST


def test_service_image_is_matched_by_file_identity_never_path_text() -> None:
    endpoint = ps_function("Endpoint")
    assert "-ieq" not in endpoint
    assert "MemberImage(" not in endpoint
    assert "$Owner.MemberIsImage($_, $image)" in endpoint
    member_is_image = cs_member(r"public bool MemberIsImage\(uint pid,string image\)")
    assert "SameFile(MemberImage(pid),image)" in member_is_image
    same_file = cs_member(r"static bool SameFile\(string first,string second\)")
    assert "FileIdentity(first)" in same_file
    assert "FileIdentity(second)" in same_file
    identity = cs_member(r"static string FileIdentity\(string path\)")
    # FILE_READ_ATTRIBUTES, all sharing, OPEN_EXISTING; volume + 64-bit file ID.
    assert "CreateFile(path,0x80,7,IntPtr.Zero,3,0,IntPtr.Zero)" in identity
    assert "new IntPtr(-1)" in identity
    assert "GetFileInformationByHandle(file,out info)" in identity
    assert "info.volume" in identity
    assert "info.indexHigh" in identity
    assert "info.indexLow" in identity
    assert "CloseHandle(file)" in identity
    # BY_HANDLE_FILE_INFORMATION field order.
    assert re.search(
        r"struct FileIdentityInfo \{ public uint attributes; public FileTime "
        r"created,accessed,written; public uint "
        r"volume,sizeHigh,sizeLow,links,indexHigh,indexLow; \}",
        OWNED,
    )
    member = cs_member(r"internal Member\(IntPtr owner,uint pid,string image\)")
    assert "SameFile(Path,image)" in member
    assert "String.Equals(Path" not in OWNED


def test_not_yet_classifies_only_transient_automation_states() -> None:
    body = ps_function("NotYet")
    assert "[Management.Automation.MethodInvocationException]" in body
    assert "[Management.Automation.GetValueInvocationException]" in body
    assert "InnerException" in body
    assert "-is [InvalidOperationException]" in body
    assert "-is [Runtime.InteropServices.COMException]" in body
    assert "-ceq 'System.Windows.Automation.ElementNotAvailableException'" in body
    # A guest-side 'throw' (no inner .NET exception) stays a real failure.
    assert "[Management.Automation.RuntimeException]" not in body


@pytest.mark.parametrize(
    ("name", "deadline"),
    [
        ("ShellWait", "Actual bounded native shell focus or geometry did not settle"),
        ("Ready", "Actual owned Diagnostics Ready/version UI not observed"),
        (
            "ShellMeasurement",
            (
                "Actual visible complete glyph measurement unavailable or unchanged "
                "after chord"
            ),
        ),
        ("WaitCheckedAt", "Exactly one actual Checked at timestamp required"),
        ("CheckedAdvance", "Owned Enter keyboard action did not advance Checked at"),
    ],
    ids=["ShellWait", "Ready", "ShellMeasurement", "WaitCheckedAt", "CheckedAdvance"],
)
def test_every_guest_wait_predicate_is_total_and_strict_at_its_deadline(
    name: str, deadline: str
) -> None:
    body = ps_function(name)
    assert classifies_transient(body)
    loop = re.search(r"\bdo \{", body)
    assert loop is not None
    tail = re.search(
        r"\} while\s*\(\s*\$clock\.Elapsed\.TotalSeconds -lt \$limit\)", body
    )
    assert tail is not None
    assert body.index("try {") > loop.start()
    assert body.index("try {") < tail.start()
    # Each 'not yet' records its bounded cause, from a fresh value per wait.
    assert re.search(r"\$transient ?= ?''", body[: loop.start()])
    assert re.search(
        r"\{\s*throw\s*\}; (?:\$last=''; )?\$transient=LastTransient \$_ \}", body
    )
    # The strict assertion stays: the last statement after the bound throws, and
    # names the last 'not yet' cause it saw.
    assert body.rstrip().endswith("throw ('" + deadline + "'+$transient)")


def test_timestamp_reads_are_only_made_inside_bounded_total_waits() -> None:
    assert "function CheckedAt(" not in GUEST
    assert functions_calling("TryCheckedAt $Owner") == {
        "WaitCheckedAt",
        "CheckedAdvance",
    }
    found = ps_function("TryCheckedAt")
    assert "return $null" in found
    assert "throw" not in found
    keyboard = re.search(r"(?m)^\s*\$phase='keyboard';(.+)$", GUEST)
    assert keyboard is not None
    assert keyboard.group(1).strip() == (
        "$checkedBefore=WaitCheckedAt $app; $app.KeyboardCheckAgain(); "
        "$checkedAfter=CheckedAdvance $app $checkedBefore"
    )
    shell = ps_function("ShellCapture")
    assert (
        "$checkedBefore=WaitCheckedAt $Owner;ShellWait { DesktopVersionsShown $Owner }"
    ) in shell
    assert (
        "if($slug -ceq 'diagnostics') { $Owner.KeyboardCheckAgain();"
        "$checkedAfter=CheckedAdvance $Owner $checkedBefore }"
    ) in shell
    assert "catch [InvalidOperationException] { $names=@() }" not in GUEST


def test_ready_tests_readiness_before_starting_any_rate_limited_recheck() -> None:
    body = ps_function("Ready")
    names = body.index("$names = @($Owner.Names())")
    ready = body.index("{ return }")
    diagnostics = body.index("$Owner.Invoke('Diagnostics')")
    again = body.index("$Owner.Invoke('Check again')")
    assert names < ready < diagnostics < again
    assert "-contains 'Ready'" in body[names:ready]
    interval = re.search(
        r"\$clock\.Elapsed\.TotalSeconds -ge \$retried\+(\d+)\)\) \{ "
        r"\$retried=\$clock\.Elapsed\.TotalSeconds; \$Owner\.Invoke\('Check again'\)",
        body,
    )
    assert interval is not None
    assert int(interval.group(1)) >= 1


def test_set_focus_settles_within_a_bound_before_the_same_identity_check() -> None:
    settles = cs_member(r"static bool Settles\(Func<bool> observation\)")
    assert re.search(r"const int SettleMilliseconds=3000;", OWNED)
    assert "catch(Exception error) { if(!Transient(error)) throw;" in settles
    transient = cs_member(r"static bool Transient\(Exception error\)")
    for caught in (
        "error is ElementNotAvailableException",
        "error is COMException",
        "error is InvalidOperationException",
    ):
        assert caught in transient
    assert "clock.ElapsedMilliseconds>=SettleMilliseconds" in settles
    assert "Thread.Sleep(25)" in settles
    focus_calls = [match.end() for match in re.finditer(r"\.SetFocus\(\);", OWNED)]
    assert len(focus_calls) == 3
    for index in focus_calls:
        following = OWNED[index : OWNED.index("throw new", index)]
        assert "if(!Settles(" in following
    keys = cs_member(r"void Keys\(bool quit\)")
    assert 'focused.Current.Name=="Check again"' in keys
    assert "Contains((uint)focused.Current.ProcessId)" in keys
    assert '"Owned button focus required"' in keys
    route = cs_member(r"public void ShellFocusRoute\(string label\)")
    assert "Settles(()=>link.Current.HasKeyboardFocus)" in route
    assert '"Owned route link focus unavailable"' in route
    skip = cs_member(r"public void ShellFocusSkip\(\)")
    assert (
        "Settles(()=>link.Current.HasKeyboardFocus&&!link.Current.IsOffscreen)" in skip
    )
    assert '"Actual skip link focus unavailable"' in skip


def test_quit_is_invoked_in_the_owned_desktop_root_popup_menu() -> None:
    quit_line = re.search(r"(?m)^\s*\$app\.Expand\('File'\);(.+)$", GUEST)
    assert quit_line is not None
    assert quit_line.group(1).strip().startswith("$app.InvokePopupItem('Quit');")
    assert "$app.Invoke('Quit')" not in GUEST
    popup = cs_member(r"AutomationElement OwnedPopupItem\(string name\)")
    # Measured on hosted Windows: the File popup is not a desktop-root UIA child.
    assert "AutomationElement.RootElement" not in popup
    assert 'FindWindowEx(IntPtr.Zero,handle,"#32768",null)' in popup
    assert "ControlType.Menu)" in popup
    assert "!ids.Contains(owner)" in popup
    assert '"Unique visible owned popup menu required"' in popup
    assert "ControlType.MenuItem" in popup
    assert "ids.Contains((uint)item.Current.ProcessId)" in popup
    assert "item.Current.IsEnabled" in popup
    invoke = cs_member(r"public void InvokePopupItem\(string name\)")
    assert "Settles(()=>{ item=OwnedPopupItem(name); return item!=null; })" in invoke
    assert "InvokePattern.Pattern" in invoke


def test_listener_release_waits_past_the_windows_refusal_window() -> None:
    body = ps_function("Released")
    assert body.count("BeginConnect(") == 1
    bound = re.findall(r"AsyncWaitHandle\.WaitOne\((\d+)\)", body)
    # Hosted windows-2025 refused a closed loopback port after 2.000-2.046 s
    # (run 41137888774; KI-0106).
    assert len(bound) == 1
    assert 3000 <= int(bound[0]) <= 10000
    assert "[Net.Sockets.SocketError]::ConnectionRefused" in body
    assert "'Owned retired endpoint still accepts TCP'" in body
    assert not re.search(r"\b(while|for|foreach|Start-Sleep)\b", body)


def test_protocol_port_opens_before_preflight_and_reports_a_bounded_fail_row() -> None:
    opened = GUEST.index("$serial.Open()")
    assert GUEST.index("New-Object IO.Ports.SerialPort(") < opened
    assert opened < GUEST.index("Get-Content -LiteralPath $Configuration")
    start = GUEST.index("try {", opened)
    body, end = block(GUEST, start, "ps")
    for step in (
        "Get-Content -LiteralPath $Configuration",
        "'Closed guest configuration required'",
        "'Exactly one fresh owned result disk required'",
        "'Fresh proof namespace required'",
        "New-Item -ItemType Directory -Path $proof",
    ):
        assert step in body
    assert re.match(r"\s*catch \{", GUEST[end:])
    handler = block(GUEST, end, "ps")[0]
    assert "terminal='FAIL';phase='preflight'" in handler
    assert (
        "nonce=(ConfigPin 'nonce');package_sha256=(ConfigPin 'package_sha256')"
        in handler
    )
    assert "message=(BoundedMessage $_.Exception)" in handler
    assert "$serial.WriteLine('JAPP11 '+" in handler
    assert handler.rstrip().endswith("exit 1")
    assert "^[0-9a-f]{64}$" in ps_function("ConfigPin")
    assert "Substring(0,[Math]::Min(512," in ps_function("BoundedMessage")


def test_machine_attestation_is_retained_and_each_failing_pin_is_named() -> None:
    copy = GUEST.index(
        "foreach($retainedName in @('machine-error.json','machine.json'))"
    )
    assert (
        "Copy-Item -LiteralPath $retainedPath -Destination "
        "(Join-Path $proof $retainedName)" in GUEST
    )
    assert "(Get-Item -LiteralPath $retainedPath).Length -gt 64KB" in GUEST
    identity = GUEST.index(
        "throw ('Protected current-boot machine attestation differs: '"
    )
    unmet = GUEST.index("throw ('Actual Windows11 setup/hardware requirements unmet: '")
    assert copy < identity < unmet
    for name in ("schema", "nonce", "boot_time"):
        assert "[void]$mismatch.Add('" + name + "')" in GUEST
    for name in (
        "caption",
        "product_type",
        "architecture",
        "build",
        "ubr",
        "tpm_spec",
        "vcpus",
        "ram_bytes",
        "disk_bytes",
    ):
        assert "[void]$unmet.Add('" + name + "')" in GUEST
    # Exact booleans, each named on its own.
    assert (
        "foreach($name in @('secure_boot','tpm_present','tpm_ready')) { "
        "$value=MachineScalar $machine $name; if($value -isnot [bool] -or -not $value) "
        "{ [void]$unmet.Add($name) } }"
    ) in GUEST
    assert "'Protected machine attestor failed; its named step is retained'" in GUEST
    attestor = re.search(r"\$attestor = @'\n(.*?)\n'@", BOOTSTRAP, re.DOTALL)
    assert attestor is not None
    text = attestor.group(1)
    start = attestor_try(text)
    work, end = block(text, start, "ps")
    assert "Set-Content -LiteralPath (Join-Path $harness 'machine.json')" in work
    for step in (
        "configuration",
        "operating-system",
        "interactive-user",
        "autologon",
        "processors",
        "system-disk",
        "tpm",
        "version",
        "secure-boot",
        "record",
    ):
        assert "$step='" + step + "'" in text[:end]
    assert re.match(r"\s*catch \{", text[end:])
    handler = block(text, end, "ps")[0]
    assert "schema='japp-win11-protected-machine-error-v1';step=$step" in handler
    assert "Substring(0,[Math]::Min(512,$message.Length))" in handler
    assert "(Join-Path $harness 'machine-error.json')" in handler
    assert handler.rstrip().endswith("throw")


def test_unauthorized_requires_the_canonical_orchestrator_error_envelope() -> None:
    responses = ast.parse((ORCHESTRATOR / "responses.py").read_text())
    schemas = [
        node.value.value
        for node in responses.body
        if isinstance(node, ast.Assign)
        and [getattr(t, "id", None) for t in node.targets] == ["ERROR_SCHEMA"]
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    ]
    assert schemas == ["urn:japp:schema:error:record:v1"]
    envelope_keys = {
        key.value
        for node in ast.walk(responses)
        if isinstance(node, ast.Dict)
        for key in node.keys
        if isinstance(key, ast.Constant)
    }
    assert {"envelope", "payload", "schema_id"} <= envelope_keys
    boundary = (ORCHESTRATOR / "boundary.py").read_text()
    assert 'failure_response("TRANSPORT_UNAUTHENTICATED", 401, correlation)' in boundary
    check = ps_function("UnauthenticatedEnvelope")
    assert "-cne 'envelope,payload'" in check
    assert "$envelope.PSObject.Properties['schema_id']" in check
    assert "$payload.PSObject.Properties['code']" in check
    assert "$schema.Value -ceq '" + schemas[0] + "'" in check
    assert "$code.Value -ceq 'TRANSPORT_UNAUTHENTICATED'" in check
    assert "$schema.Value -is [string]" in check
    assert "$code.Value -is [string]" in check
    unauthorized = ps_function("Unauthorized")
    assert "if (-not (UnauthenticatedEnvelope $body))" in unauthorized
    assert "$body.error" not in GUEST


def test_framed_phases_wait_for_the_exact_host_frame_acceptance() -> None:
    framed = re.search(r"(?m)^\$framedPhases = @\(([^)]*)\)$", GUEST)
    assert framed is not None
    assert tuple(re.findall(r"'([^']+)'", framed.group(1))) == FRAMED_PHASES
    receipt = ps_function("Receipt")
    written = receipt.index("$serial.WriteLine('JAPP11 '+$line)")
    accepted = receipt.index(
        "if($framedPhases -ccontains $Name) { HostAccepted "
        "('JAPP11-FRAME-ACCEPT '+$Name+' '+$config.nonce) 60000 "
        "('Host did not accept the actual '+$Name+' frame') }"
    )
    assert written < accepted
    host = ps_function("HostAccepted")
    assert "$serial.ReadTimeout=$Milliseconds" in host
    assert "catch [TimeoutException]" in host
    assert "if($line -cne $Expected) { throw $Refusal }" in host
    assert (
        "HostAccepted ('JAPP11-ENV-ACCEPT '+$config.nonce) 15000 "
        "'Host did not accept actual native environment'"
    ) in GUEST
    # Every framed phase has exactly one receipt in the ordered lifecycle.
    for phase in FRAMED_PHASES:
        assert len(re.findall(r"Receipt '" + phase + r"' ", GUEST)) == 1


def test_accelerator_failure_reports_the_keyboard_focus_owner() -> None:
    line = re.search(r"(?m)^\s*\$focusOwner=\$app\.FocusOwner\(\);(.+)$", GUEST)
    assert line is not None
    assert line.group(1).strip() == "$app.KeyboardQuit()"
    after = GUEST[line.end() :]
    refusal = re.match(
        r"\s*if\(-not \$app\.WaitEmpty\(6000\)\) \{ throw \('Owned foreground "
        r"Ctrl\+Q left owned job members after 6 s; keyboard focus owner before "
        r"the chord: '\+\$focusOwner\) \}\s*\n\s*Closed \$app \$endpoint\.port",
        after,
    )
    assert refusal is not None
    owner = cs_member(r"public string FocusOwner\(\)")
    assert "AutomationElement.FocusedElement" in owner
    assert "catch(Exception error)" in owner
    assert "Bounded(" in owner


def test_answer_file_names_every_setup_and_oobe_page_without_bypasses(
    deployment: ModuleType,
) -> None:
    data = deployment.answer_file("aZ_9" * 10, "Windows 11 Enterprise Evaluation")
    root = ET.fromstring(data)  # noqa: S314 - our pure generator output, no external XML
    ns = {"u": deployment.NAMESPACE}

    def component(phase: str, name: str) -> ET.Element:
        found = root.findall(
            "u:settings[@pass='" + phase + "']/u:component[@name='" + name + "']", ns
        )
        assert len(found) == 1
        return found[0]

    winpe = component("windowsPE", "Microsoft-Windows-International-Core-WinPE")
    assert winpe.findtext("u:SetupUILanguage/u:UILanguage", namespaces=ns) == "en-US"
    regional = component("oobeSystem", "Microsoft-Windows-International-Core")
    assert regional.attrib["processorArchitecture"] == "amd64"
    for name in ("InputLocale", "SystemLocale", "UILanguage", "UserLocale"):
        assert winpe.findtext("u:" + name, namespaces=ns) == "en-US"
        assert regional.findtext("u:" + name, namespaces=ns) == "en-US"
    oobe = component("oobeSystem", "Microsoft-Windows-Shell-Setup").find("u:OOBE", ns)
    assert oobe is not None
    for name in (
        "HideEULAPage",
        "HideLocalAccountScreen",
        "HideOnlineAccountScreens",
        "HideOEMRegistrationScreen",
        "HideWirelessSetupInOOBE",
    ):
        assert oobe.findtext("u:" + name, namespaces=ns) == "true"
    assert oobe.findtext("u:ProtectYourPC", namespaces=ns) == "1"
    for word in (b"SkipMachineOOBE", b"SkipUserOOBE", b"BYPASSNRO", b"LabConfig"):
        assert word not in data
    assert b"Administrators" not in data


def test_answer_file_modifies_partitions_in_contiguous_order(
    deployment: ModuleType,
) -> None:
    # KI-0171: with ModifyPartition Order 1, 3 the pinned ISO's Setup created the
    # partitions, never formatted them and waited at "Select location to install
    # Windows 11"; with Order 1, 2 it installed to the desktop (diagnostic run
    # 41380947763). Order counts modifications; PartitionID names the target.
    data = deployment.answer_file("aZ_9" * 10, "Windows 11 Enterprise Evaluation")
    root = ET.fromstring(data)  # noqa: S314 - our pure generator output, no external XML
    ns = {"u": deployment.NAMESPACE}
    disks = root.findall(
        "u:settings[@pass='windowsPE']/u:component[@name='Microsoft-Windows-Setup']"
        "/u:DiskConfiguration/u:Disk",
        ns,
    )
    assert len(disks) == 1
    created = [
        (row.findtext("u:Order", namespaces=ns), row.findtext("u:Type", namespaces=ns))
        for row in disks[0].findall("u:CreatePartitions/u:CreatePartition", ns)
    ]
    assert created == [("1", "EFI"), ("2", "MSR"), ("3", "Primary")]
    modified = [
        tuple(
            row.findtext("u:" + name, namespaces=ns)
            for name in ("Order", "PartitionID", "Format", "Label", "Letter")
        )
        for row in disks[0].findall("u:ModifyPartitions/u:ModifyPartition", ns)
    ]
    assert modified == [
        ("1", "1", "FAT32", "System", None),
        ("2", "3", "NTFS", "Windows", "C"),
    ]
    target = root.find(
        "u:settings[@pass='windowsPE']/u:component[@name='Microsoft-Windows-Setup']"
        "/u:ImageInstall/u:OSImage/u:InstallTo",
        ns,
    )
    assert target is not None
    assert (
        target.findtext("u:DiskID", namespaces=ns),
        target.findtext("u:PartitionID", namespaces=ns),
    ) == ("0", "3")


# Driver invariants that no bounded wait may treat as 'not yet' (review: an
# invariant retried to a generic deadline loses its exact cause).
OWNED_INVARIANTS = (
    "Finite complete owned job list required",
    "Owned app already exited",
    "Window ownership changed",
    "Owned accessibility tree exceeds bound",
    "Accessibility node outside retained job",
    "Accessibility text exceeds bound",
    "Finite exact control query required: ",
    "Control node outside retained job: ",
    "Unique owned control required: ",
    "Finite desktop popup menu enumeration required",
    "Unique visible owned popup menu required",
    "Owned popup window is not an owned native menu",
    "Finite owned popup menu query required",
    "Popup menu item outside retained job",
    "Unique enabled owned popup menu item required: ",
    "Native role node outside retained job",
    "Owned native subtree exceeds bound",
    "Managed ARIA query outside retained job",
    "Finite exact shell query required",
    "Shell node outside retained job",
    "Unique exact native shell element required",
    "Finite owned shell tree required",
    "Bounded owned shell node required",
    "Glyph range outside retained job",
    "Native text provider outside retained job",
    "Actual per-monitor owned-window DPI required",
)
# Replaced or still-rendering UIA nodes stay 'not yet' within each bound.
OWNED_TRANSIENTS = (
    "Owned window unavailable",
    "Owned control unavailable: ",
    "Visible exact owned shell element unavailable",
    "Managed/native owned element identity differs",
    "Native element changed during ARIA observation",
    "Exact unique whole glyph label required",
    "One actual owned native text provider required",
)


def test_owned_invariants_are_a_distinct_type_no_wait_retries() -> None:
    assert re.search(
        r"public sealed class OwnedInvariantException : Exception \{\s*"
        r"public OwnedInvariantException\(string message\) : base\(message\) \{ "
        r"\}\s*\}",
        OWNED,
    )
    assert statements(cs_member(r"static bool Transient\(Exception error\)"), "cs") == [
        (
            "return !(error is ObjectDisposedException)&&(error is "
            "ElementNotAvailableException||error is COMException||error is "
            "InvalidOperationException);"
        )
    ]
    assert statements(
        cs_member(r"static bool Settles\(Func<bool> observation\)"), "cs"
    ) == [
        'Stopwatch clock=Stopwatch.StartNew(); settleLast="";',
        "while(true) {",
        "try { if(observation()) return true; }",
        (
            'catch(Exception error) { if(!Transient(error)) throw; settleLast="; last: '
            '"+error.GetType().FullName+": "+Bounded(error.Message,256); }'
        ),
        "if(clock.ElapsedMilliseconds>=SettleMilliseconds) return false;",
        "Thread.Sleep(25);",
        "}",
    ]
    for message in OWNED_INVARIANTS:
        assert OWNED.count('throw new OwnedInvariantException("' + message) >= 1, (
            message
        )
        assert 'InvalidOperationException("' + message not in OWNED, message
    for message in OWNED_TRANSIENTS:
        assert OWNED.count('throw new InvalidOperationException("' + message) >= 1, (
            message
        )
    # Every bounded Settles refusal names the last 'not yet' cause it saw.
    refusals = re.findall(
        r"if\(!Settles\(.*?\)\) throw new (\w+)\((.*?)\);", OWNED, re.S
    )
    assert len(refusals) == 4
    for kind, message in refusals:
        assert kind == "OwnedInvariantException"
        assert message.endswith("+settleLast")
    # The PowerShell classifier rejects the same type, and a disposed owner, first.
    assert statements(ps_function("NotYet"), "ps") == [
        "$exception=$Record.Exception",
        (
            "if(($exception -is [Management.Automation.MethodInvocationException] -or "
            "$exception -is [Management.Automation.GetValueInvocationException]) -and "
            "$null -ne $exception.InnerException) { "
            "$exception=$exception.InnerException }"
        ),
        (
            "if($exception.GetType().FullName -ceq "
            "'JobApplyValidation.OwnedInvariantException' -or $exception -is "
            "[ObjectDisposedException]) { return $false }"
        ),
        (
            "return ($exception -is [InvalidOperationException] -or $exception -is "
            "[Runtime.InteropServices.COMException] -or $exception.GetType().FullName "
            "-ceq 'System.Windows.Automation.ElementNotAvailableException')"
        ),
    ]
    assert statements(ps_function("LastTransient"), "ps") == [
        "$exception=$Record.Exception",
        (
            "if(($exception -is [Management.Automation.MethodInvocationException] -or "
            "$exception -is [Management.Automation.GetValueInvocationException]) -and "
            "$null -ne $exception.InnerException) { "
            "$exception=$exception.InnerException }"
        ),
        "$message=[string]$exception.Message",
        (
            "return ('; last: '+$exception.GetType().FullName+': '+"
            "$message.Substring(0,[Math]::Min(256,$message.Length)))"
        ),
    ]


def test_invoke_and_expand_use_the_one_owned_enabled_pattern_node() -> None:
    # Measured (run 41229140888): the exact-name 'Diagnostics' descendants are a
    # ListItem, a Hyperlink (InvokePattern) and a Text; the first one is the ListItem.
    assert ".FindFirst(" not in OWNED
    control = cs_member(
        r"AutomationElement OwnedControl\(string name,AutomationPattern pattern\)"
    )
    assert statements(control, "cs") == [
        (
            "if(String.IsNullOrEmpty(name)||name.Length>256) throw new "
            'ArgumentException("Finite exact control name required");'
        ),
        (
            "AutomationElementCollection nodes=Window().FindAll(TreeScope.Descendants,"
            "new PropertyCondition(AutomationElement.NameProperty,name));"
        ),
        (
            "if(nodes.Count>32) throw new OwnedInvariantException("
            '"Finite exact control query required: "+name);'
        ),
        (
            "HashSet<uint> ids=new HashSet<uint>(Members()); List<AutomationElement> "
            "found=new List<AutomationElement>();"
        ),
        "foreach(AutomationElement node in nodes) {",
        (
            "if(!ids.Contains((uint)node.Current.ProcessId)) throw new "
            'OwnedInvariantException("Control node outside retained job: "+name);'
        ),
        "object supported;",
        (
            "if(node.Current.IsEnabled&&node.TryGetCurrentPattern(pattern,"
            "out supported)) found.Add(node);"
        ),
        "}",
        (
            'if(found.Count>1) throw new OwnedInvariantException("Unique owned control '
            'required: "+name+" ("+found.Count+" enabled with '
            '"+pattern.ProgrammaticName+")");'
        ),
        (
            'if(found.Count==0) throw new InvalidOperationException("Owned control '
            'unavailable: "+name+" ("+nodes.Count+" exact-name nodes, none enabled '
            'with "+pattern.ProgrammaticName+")");'
        ),
        "return found[0];",
    ]
    assert statements(cs_member(r"public void Invoke\(string name\)"), "cs") == [
        (
            "((InvokePattern)OwnedControl(name,InvokePattern.Pattern)"
            ".GetCurrentPattern(InvokePattern.Pattern)).Invoke();"
        )
    ]
    expand = statements(cs_member(r"public void Expand\(string name\)"), "cs")
    assert expand[0] == (
        "ExpandCollapsePattern menu=(ExpandCollapsePattern)OwnedControl(name,"
        "ExpandCollapsePattern.Pattern).GetCurrentPattern(ExpandCollapsePattern.Pattern);"
    )
    keys = cs_member(r"void Keys\(bool quit\)")
    assert (
        'OwnedControl("Check again",InvokePattern.Pattern); button.SetFocus();' in keys
    )
    assert len(re.findall(r"\bOwnedControl\(", OWNED)) == 4
    # Ready invokes route and button controls by exact name only.
    ready = ps_function("Ready")
    assert re.findall(r"\$Owner\.Invoke\('([^']+)'\)", ready) == [
        "Diagnostics",
        "Check again",
    ]


def test_quit_popup_is_the_one_visible_owned_win32_menu_window() -> None:
    # Measured (run 41229932862): after Expand('File') one visible '#32768' window
    # whose thread belongs to the job's root member; FromHandle gives a Menu with
    # one enabled InvokePattern MenuItem 'Quit'; it is no desktop-root UIA child.
    assert "AutomationElement.RootElement" not in OWNED
    for declaration in (
        (
            '[DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr '
            "FindWindowEx(IntPtr parent,IntPtr after,string className,string "
            "windowName);"
        ),
        '[DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);',
        (
            '[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId('
            "IntPtr window,out uint pid);"
        ),
    ):
        assert OWNED.count(declaration) == 1, declaration
    assert re.search(r"const int PopupWindowBound=64;", OWNED)
    popup = cs_member(r"AutomationElement OwnedPopupItem\(string name\)")
    assert statements(popup, "cs") == [
        "HashSet<uint> ids=new HashSet<uint>(Members());",
        "IntPtr popup=IntPtr.Zero,handle=IntPtr.Zero; int seen=0;",
        'while((handle=FindWindowEx(IntPtr.Zero,handle,"#32768",null))!=IntPtr.Zero) {',
        (
            "if(++seen>PopupWindowBound) throw new OwnedInvariantException("
            '"Finite desktop popup menu enumeration required");'
        ),
        "uint owner;",
        (
            "if(GetWindowThreadProcessId(handle,out owner)==0||!IsWindowVisible(handle)"
            "||!ids.Contains(owner)) continue;"
        ),
        (
            "if(popup!=IntPtr.Zero) throw new OwnedInvariantException("
            '"Unique visible owned popup menu required");'
        ),
        "popup=handle;",
        "}",
        "if(popup==IntPtr.Zero) return null;",
        "AutomationElement menu=AutomationElement.FromHandle(popup);",
        (
            "if(!ids.Contains((uint)menu.Current.ProcessId)||menu.Current.ControlType!="
            'ControlType.Menu) throw new OwnedInvariantException("Owned popup window '
            'is not an owned native menu");'
        ),
        (
            "AutomationElementCollection items=menu.FindAll(TreeScope.Descendants,"
            "new AndCondition(new PropertyCondition(AutomationElement.NameProperty,"
            "name),new PropertyCondition(AutomationElement.ControlTypeProperty,"
            "ControlType.MenuItem)));"
        ),
        (
            "if(items.Count>32) throw new OwnedInvariantException("
            '"Finite owned popup menu query required");'
        ),
        "AutomationElement found=null;",
        "foreach(AutomationElement item in items) {",
        (
            "if(!ids.Contains((uint)item.Current.ProcessId)) throw new "
            'OwnedInvariantException("Popup menu item outside retained job");'
        ),
        "object supported;",
        (
            "if(!item.Current.IsEnabled||!item.TryGetCurrentPattern(InvokePattern.Pattern,"
            "out supported)) continue;"
        ),
        (
            'if(found!=null) throw new OwnedInvariantException("Unique enabled owned '
            'popup menu item required: "+name);'
        ),
        "found=item;",
        "}",
        "return found;",
    ]
    invoke = cs_member(r"public void InvokePopupItem\(string name\)")
    assert statements(invoke, "cs") == [
        (
            "if(String.IsNullOrEmpty(name)||name.Length>256) throw new "
            'ArgumentException("Finite exact control name required");'
        ),
        "AutomationElement item=null;",
        (
            "if(!Settles(()=>{ item=OwnedPopupItem(name); return item!=null; })) "
            'throw new OwnedInvariantException("Owned popup menu item unavailable: '
            '"+name+settleLast);'
        ),
        "((InvokePattern)item.GetCurrentPattern(InvokePattern.Pattern)).Invoke();",
    ]
    # The bounded poll is the shared 3 s settle: at most 3 s for the popup.
    assert re.search(r"const int SettleMilliseconds=3000;", OWNED)


def test_strict_predicates_are_pinned_exactly() -> None:
    assert statements(
        cs_member(r"static bool SameFile\(string first,string second\)"), "cs"
    ) == [
        (
            "return String.Equals(FileIdentity(first),FileIdentity(second),"
            "StringComparison.Ordinal);"
        )
    ]
    keys = cs_member(r"void Keys\(bool quit\)")
    assert (
        'return focused!=null&&focused.Current.Name=="Check again"&&new '
        "HashSet<uint>(Members()).Contains((uint)focused.Current.ProcessId);"
    ) in statements(keys, "cs")
    assert statements(ps_function("UnauthenticatedEnvelope"), "ps") == [
        "if ($Body -isnot [Management.Automation.PSCustomObject]) { return $false }",
        (
            "if ((@($Body.PSObject.Properties.Name | Sort-Object) -join ',') -cne "
            "'envelope,payload') { return $false }"
        ),
        "$envelope=$Body.envelope; $payload=$Body.payload",
        (
            "if ($envelope -isnot [Management.Automation.PSCustomObject] -or $payload "
            "-isnot [Management.Automation.PSCustomObject]) { return $false }"
        ),
        (
            "$schema=$envelope.PSObject.Properties['schema_id']; "
            "$code=$payload.PSObject.Properties['code']"
        ),
        (
            "return ($null -ne $schema -and $null -ne $code -and $schema.Value -is "
            "[string] -and $code.Value -is [string] -and $schema.Value -ceq "
            "'urn:japp:schema:error:record:v1' -and $code.Value -ceq "
            "'TRANSPORT_UNAUTHENTICATED')"
        ),
    ]
    released = statements(ps_function("Released"), "ps")
    assert released[4:7] == [
        (
            "try { $socket.EndConnect($pending); "
            "throw 'Owned retired endpoint still accepts TCP' }"
        ),
        (
            "catch [Net.Sockets.SocketException] { if ($_.Exception.SocketErrorCode "
            "-ne [Net.Sockets.SocketError]::ConnectionRefused) { throw } }"
        ),
        "finally { $pending.AsyncWaitHandle.Close() }",
    ]
    assert statements(ps_function("CheckedAdvance"), "ps") == [
        "$limit=[Math]::Min(300,$clock.Elapsed.TotalSeconds+6)",
        "$transient=''",
        "do {",
        "WithinBudget",
        "$after=$null",
        (
            "try { $after=TryCheckedAt $Owner } catch { if(-not(NotYet $_)){throw}; "
            "$transient=LastTransient $_ }"
        ),
        "if($null -ne $after -and $after -cne $Before) {",
        (
            "if(-not(TimestampAdvances $Before $after)) { throw 'Owned Enter keyboard "
            "action did not advance Checked at' }"
        ),
        "return $after",
        "}",
        "Start-Sleep -Milliseconds 25",
        "} while($clock.Elapsed.TotalSeconds -lt $limit)",
        "throw ('Owned Enter keyboard action did not advance Checked at'+$transient)",
    ]
    assert statements(ps_function("TimestampAdvances"), "ps")[-1] == (
        "return $right.whole_ticks -gt $left.whole_ticks -or ($right.whole_ticks "
        "-eq $left.whole_ticks -and $right.nanoseconds -gt $left.nanoseconds)"
    )
    assert statements(ps_function("MachineScalar"), "ps") == [
        "if($null -eq $Value) { return $null }",
        "$property=$Value.PSObject.Properties[$Name]",
        (
            "if($null -eq $property -or $property.Value -is [Array] -or "
            "$property.Value -is [Management.Automation.PSCustomObject]) "
            "{ return $null }"
        ),
        "return $property.Value",
    ]
    assert statements(ps_function("DesktopVersionsShown"), "ps") == [
        "$names=@($Owner.Names())",
        (
            "return ($names -ccontains 'App version' -and "
            "$names -ccontains 'Tauri version')"
        ),
    ]


def test_ready_rechecks_every_two_seconds_until_ready_and_versions() -> None:
    # Measured (run 41229140888): the panel shows 'Starting' from its launch-time
    # check for 30 s and never refreshes by itself; only 'Check again' does.
    body = statements(ps_function("Ready"), "ps")
    assert body[:5] == [
        "$limit = [Math]::Min(300, $clock.Elapsed.TotalSeconds+35)",
        "$clicked = $false",
        "$retried = $null",
        "$transient = ''",
        "do {",
    ]
    assert body[5:12] == [
        "WithinBudget",
        "try {",
        "$names = @($Owner.Names())",
        (
            "if ($names -contains 'Ready' -and ($names -join ' ') -match "
            "'0\\.0\\.1' -and ($names -join ' ') -match '1\\.0\\.0') { return }"
        ),
        (
            "if (-not $clicked -and $names -contains 'Diagnostics') { "
            "$Owner.Invoke('Diagnostics'); $clicked=$true }"
        ),
        (
            "elseif ($names -contains 'Check again' -and ($null -eq $retried -or "
            "$clock.Elapsed.TotalSeconds -ge $retried+2)) { "
            "$retried=$clock.Elapsed.TotalSeconds; $Owner.Invoke('Check again') }"
        ),
        "} catch { if (-not (NotYet $_)) { throw }; $transient=LastTransient $_ }",
    ]


@pytest.fixture
def inputs(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    return load_host_module("windows11_inputs", monkeypatch)


def test_machine_pins_equal_the_host_attestation_thresholds(inputs: ModuleType) -> None:
    host = ast.parse(inspect.getsource(inputs.attest_guest))
    limits = next(
        node
        for node in ast.walk(host)
        if isinstance(node, ast.Dict)
        and "vcpus" in [getattr(key, "value", None) for key in node.keys]
    )
    host_minimum = {
        py_value(key, {}): py_value(value, {})
        for key, value in zip(limits.keys, limits.values, strict=True)
        if key is not None
    }
    # The guest's own pins: PowerShell's GB suffix is 1024**3 bytes.
    sizes = {"vcpus": "2", "ram_bytes": "4GB", "disk_bytes": "64GB"}
    for name, text in sizes.items():
        value = int(text[:-2]) * 1024**3 if text.endswith("GB") else int(text)
        assert host_minimum[name] == value, name
    lines = [
        (
            "$value=MachineScalar $machine 'caption'; if($value -isnot [string] "
            "-or $value -cne 'Microsoft Windows 11 Enterprise Evaluation') "
            "{ [void]$unmet.Add('caption') }"
        ),
        (
            "if((MachineScalar $machine 'product_type') -ne 1) "
            "{ [void]$unmet.Add('product_type') }"
        ),
        (
            "if((MachineScalar $machine 'architecture') -cne 'AMD64') "
            "{ [void]$unmet.Add('architecture') }"
        ),
        "if((MachineScalar $machine 'build') -ne "
        + str(inputs.BUILD)
        + ") { [void]$unmet.Add('build') }",
        "if((MachineScalar $machine 'ubr') -ne "
        + str(inputs.UPDATE_BUILD_REVISION)
        + ") { [void]$unmet.Add('ubr') }",
        (
            "foreach($name in @('secure_boot','tpm_present','tpm_ready')) { "
            "$value=MachineScalar $machine $name; if($value -isnot [bool] "
            "-or -not $value) { [void]$unmet.Add($name) } }"
        ),
        (
            "if((MachineScalar $machine 'tpm_spec') -notmatch '^2\\.0') "
            "{ [void]$unmet.Add('tpm_spec') }"
        ),
        *(
            "if((MachineScalar $machine '" + name + "') -lt " + text + ") "
            "{ [void]$unmet.Add('" + name + "') }"
            for name, text in sizes.items()
        ),
    ]
    start = GUEST.index("$unmet=New-Object Collections.ArrayList")
    end = GUEST.index("if($unmet.Count -gt 0)", start)
    assert statements(GUEST[start:end], "ps")[1:] == lines
    # The identity pins bind a record to this run's nonce and boot, case-exact.
    assert statements(ps_function("MachineDiffers"), "ps") == [
        "$mismatch=New-Object Collections.ArrayList",
        (
            "if((MachineScalar $Record 'schema') -cne $Schema) { "
            "[void]$mismatch.Add('schema') }"
        ),
        (
            "if((MachineScalar $Record 'nonce') -cne $config.nonce) "
            "{ [void]$mismatch.Add('nonce') }"
        ),
        (
            "if((MachineScalar $Record 'boot_time') -cne $Boot) "
            "{ [void]$mismatch.Add('boot_time') }"
        ),
        "return ,@($mismatch)",
    ]
    assert "Microsoft Windows 11 Enterprise Evaluation" in inspect.getsource(
        inputs.attest_guest
    )


def test_a_stale_attestor_error_never_overrides_a_current_machine_receipt() -> None:
    # Each poll reads through one handle that shares write and delete access, so it
    # never blocks an attestor removing an earlier run's file; a file absent, being
    # written or removed between polls is 'not yet' (KI-0175 review).
    assert statements(ps_function("ProtectedReceipt"), "ps") == [
        (
            "try { $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,"
            "[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor "
            "[IO.FileShare]::Delete)) } catch { return $null }"
        ),
        "$bytes=New-Object byte[] (64KB+1)",
        "$count=0",
        (
            "try { do { $read=$stream.Read($bytes,$count,$bytes.Length-$count); "
            "$count+=$read } while($read -gt 0 -and $count -lt $bytes.Length) } "
            "finally { $stream.Dispose() }"
        ),
        ("if($count -gt 64KB) { throw 'Bounded protected machine receipt required' }"),
        (
            "try { return ([Text.Encoding]::UTF8.GetString($bytes,0,$count)"
            ".TrimStart([char]0xFEFF)|ConvertFrom-Json) } catch { return $null }"
        ),
    ]
    wait = GUEST.index("$machineLimit=")
    retained = GUEST.index(
        "foreach($retainedName in @('machine-error.json','machine.json'))"
    )
    traced = GUEST.index(
        "$tracePath='C:\\ProgramData\\JappHarness\\attestor-trace.txt'"
    )
    decided = GUEST.index("$mismatch=@()")
    unmet = GUEST.index("$unmet=New-Object Collections.ArrayList")
    assert wait < retained < traced < decided < unmet
    # The bound polls for a current receipt first; only an attestor error bound to
    # this nonce and boot also ends it (KI-0175), and a stale one is 'not yet'.
    assert statements(GUEST[wait:retained], "ps") == [
        "$machineLimit=150",
        "$machine=$null",
        "do {",
        "$current=ProtectedReceipt $machinePath",
        (
            "if($null -ne $current) { $machine=$current; if((MachineDiffers $machine "
            "$machineSchema $boot).Count -eq 0) { break } }"
        ),
        "$failed=ProtectedReceipt $machineErrorPath",
        (
            "if($null -ne $failed -and (MachineDiffers $failed "
            "'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) { break }"
        ),
        "Start-Sleep -Milliseconds 250",
        "} while($clock.Elapsed.TotalSeconds -lt $machineLimit)",
    ]
    assert "$machineSchema='japp-win11-protected-machine-v1'" in GUEST[:wait]
    # Whenever the wait ends without a current receipt, only an error bound to this
    # nonce and boot names the attestor.
    assert statements(GUEST[decided:unmet], "ps") == [
        "$mismatch=@()",
        (
            "if($null -ne $machine) { $mismatch=MachineDiffers $machine $machineSchema "
            "$boot }"
        ),
        "if($null -eq $machine -or $mismatch.Count -gt 0) {",
        "$attestorError=ProtectedReceipt $machineErrorPath",
        (
            "if($null -ne $attestorError -and (MachineDiffers $attestorError "
            "'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) "
            "{ throw 'Protected machine attestor failed; its named step is retained' }"
        ),
        (
            "if($null -eq $machine) "
            "{ throw 'Protected current-boot machine attestation missing or "
            "unreadable' }"
        ),
        (
            "throw ('Protected current-boot machine attestation differs: '+"
            "($mismatch -join ','))"
        ),
        "}",
    ]
    assert GUEST.count("$machineErrorPath") == 3
    # The attestor clears any earlier logon's error and trace before its own run,
    # and binds its own error to this run's nonce and boot.
    text = attestor_source()
    start = attestor_try(text)
    # The trace goes first: a run that stops on the error removal never leaves an
    # earlier run's trace for the guest to retain as its own.
    assert statements(text[:start], "ps")[3:] == [
        "$tracePath=Join-Path $harness 'attestor-trace.txt'",
        (
            "if(Test-Path -LiteralPath $tracePath) "
            "{ Remove-Item -LiteralPath $tracePath -Force }"
        ),
        "$errorPath=Join-Path $harness 'machine-error.json'",
        (
            "if(Test-Path -LiteralPath $errorPath) "
            "{ Remove-Item -LiteralPath $errorPath -Force }"
        ),
        TRACE_STEP,
        "$step='configuration'",
        "$nonce=$null",
        "$bootTime=$null",
    ]
    work, end = block(text, start, "ps")
    assert statements(work, "ps")[:8] == [
        "TraceStep 'start'",
        "TraceStep $step",
        (
            "$config=Get-Content -LiteralPath (Join-Path $harness 'guest-config.json') "
            "-Raw|ConvertFrom-Json"
        ),
        "if($config.nonce -cmatch '^[0-9a-f]{64}$') { $nonce=[string]$config.nonce }",
        "$step='operating-system'; TraceStep $step",
        "$os=Get-CimInstance -ClassName Win32_OperatingSystem",
        "$bootTime=$os.LastBootUpTime.ToUniversalTime().ToString('o')",
        "$system=Get-CimInstance -ClassName Win32_ComputerSystem",
    ]
    assert "nonce=$config.nonce;boot_time=$bootTime;" in work
    # The guest's boot binding is the same expression the attestor records.
    assert "$boot=$os.LastBootUpTime.ToUniversalTime().ToString('o')" in GUEST
    handler = block(text, end, "ps")[0]
    assert (
        "[ordered]@{schema='japp-win11-protected-machine-error-v1';step=$step;"
        "nonce=$nonce;boot_time=$bootTime;error_type=$_.Exception.GetType().FullName;"
        "message=$message.Substring(0,[Math]::Min(512,$message.Length))}"
        "|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $harness "
        "'machine-error.json') -Encoding UTF8"
    ) in statements(handler, "ps")
    assert text.count("machine-error.json") == 2


def test_machine_receipt_wait_is_150_seconds_inside_the_guest_deadline() -> None:
    # KI-0175: a first-logon attestor run wrote nothing within the 30 s the guest
    # waited (run 41505468952); a completed one took about 10 s (round 35).
    # The bound is a mark on the guest's own clock, which starts at the logon that
    # also starts the attestor task, not an interval after the guest's setup.
    limits = re.findall(r"(?i)\$machineLimit\s*=\s*(.+)", GUEST)
    assert limits == ["150"]
    assert re.findall(r"(?i)\$machineLimit\b", GUEST) == ["$machineLimit"] * 2
    assert "} while($clock.Elapsed.TotalSeconds -lt $machineLimit)" in GUEST
    # The wait is a part of the guest's own fixed work deadline, never an extension,
    # and it ends by the deadline's midpoint: the other half stays for dxdiag (up to
    # 45 s), the environment accept, extraction and the lifecycle.
    budget = re.fullmatch(
        r"if \(\$clock\.Elapsed\.TotalSeconds -ge (\d+)\) "
        r"\{ throw 'Guest work deadline exceeded' \}",
        "\n".join(statements(ps_function("WithinBudget"), "ps")),
    )
    assert budget is not None
    assert int(budget.group(1)) == 300
    assert 2 * int(limits[0]) <= int(budget.group(1))
    assert re.findall(r"(?m)^\$clock = (.+)$", GUEST) == [
        "[Diagnostics.Stopwatch]::StartNew()"
    ]
    assert len(re.findall(r"(?i)\$clock\s*=", GUEST)) == 1
    assert GUEST.index("$clock = ") < GUEST.index("$machineLimit=")


def test_attestor_task_limit_is_ten_minutes_beyond_the_guest_wait() -> None:
    # A one-minute limit could kill a slow first-logon run before its catch wrote
    # any cause (KI-0175); a stalled run is still ended, and its trace kept.
    settings = re.findall(r"(?m)^\$settings = (.+)$", BOOTSTRAP)
    assert settings == [
        (
            "New-ScheduledTaskSettingsSet -ExecutionTimeLimit "
            "(New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries"
        )
    ]
    # Nothing else sets the limit: no property write on the settings object and no
    # later re-registration (PowerShell names are case-insensitive; review F2).
    assert len(re.findall(r"(?i)New-ScheduledTaskSettingsSet", BOOTSTRAP)) == 1
    assert len(re.findall(r"(?i)ExecutionTimeLimit", BOOTSTRAP)) == 1
    assert re.findall(r"(?i)\$settings\b", BOOTSTRAP) == ["$settings"] * 2
    assert len(re.findall(r"(?i)-Settings \$settings\b", BOOTSTRAP)) == 1
    assert len(re.findall(r"(?i)Register-ScheduledTask\b", BOOTSTRAP)) == 1
    for changer in ("Set-ScheduledTask", "Enable-ScheduledTask", "schtasks"):
        assert not re.search("(?i)" + changer, BOOTSTRAP), changer
    wait = re.findall(r"(?m)^\s*\$machineLimit=(\d+)$", GUEST)
    assert len(wait) == 1
    assert int(wait[0]) < 10 * 60


def test_only_a_current_attestor_error_ends_the_machine_wait_early() -> None:
    wait = GUEST.index("$machineLimit=")
    loop = statements(block(GUEST, GUEST.index("do {", wait), "ps")[0], "ps")
    ends = [line for line in loop if re.search(r"\bbreak\b", line)]
    assert len(ends) == 2
    receipt, error = ends
    # The current receipt is read first in every poll and is always preferred.
    assert receipt == (
        "if($null -ne $current) { $machine=$current; if((MachineDiffers $machine "
        "$machineSchema $boot).Count -eq 0) { break } }"
    )
    bound = re.fullmatch(
        r"if\(\$null -ne \$failed -and \(MachineDiffers \$failed '([a-z0-9-]+)' "
        r"\$boot\)\.Count -eq 0\) \{ break \}",
        error,
    )
    assert bound is not None
    assert (
        loop.index("$current=ProtectedReceipt $machinePath")
        < loop.index(receipt)
        < loop.index("$failed=ProtectedReceipt $machineErrorPath")
        < loop.index(error)
    )
    # The error must carry the attestor's own error schema, this run's nonce and
    # this boot: one from another run, boot or schema is 'not yet' for the bound.
    assert "{schema='" + bound.group(1) + "';step=$step;" in attestor_source()
    assert statements(ps_function("MachineDiffers"), "ps")[1:4] == [
        (
            "if((MachineScalar $Record 'schema') -cne $Schema) "
            "{ [void]$mismatch.Add('schema') }"
        ),
        (
            "if((MachineScalar $Record 'nonce') -cne $config.nonce) "
            "{ [void]$mismatch.Add('nonce') }"
        ),
        (
            "if((MachineScalar $Record 'boot_time') -cne $Boot) "
            "{ [void]$mismatch.Add('boot_time') }"
        ),
    ]
    # An early end still fails with the attestor's own named refusal, decided by the
    # same binding when no current receipt exists.
    decided = GUEST[GUEST.index("$mismatch=@()") :]
    assert (
        "if($null -ne $attestorError -and (MachineDiffers $attestorError '"
        + bound.group(1)
        + "' $boot).Count -eq 0) { throw 'Protected machine attestor failed; its "
        "named step is retained' }"
    ) in decided


def test_attestor_trace_is_created_fresh_for_each_run() -> None:
    text = attestor_source()
    start = attestor_try(text)
    before = statements(text[:start], "ps")
    path = before.index("$tracePath=Join-Path $harness 'attestor-trace.txt'")
    # An earlier logon's trace is removed before this run writes its first line.
    assert before[path + 1] == (
        "if(Test-Path -LiteralPath $tracePath) "
        "{ Remove-Item -LiteralPath $tracePath -Force }"
    )
    assert not re.search(r"\bTraceStep [$'(]", text[:start])
    # The first append of this run creates it; the run's first line is 'start'.
    assert TRACE_STEP in before
    assert statements(block(text, start, "ps")[0], "ps")[0] == "TraceStep 'start'"
    assert len(re.findall(r"\$tracePath\b", text)) == 4
    # It lives in the protected harness, which only SYSTEM and Administrators can
    # change and the Users group can read (inherited by every file in it).
    assert re.findall(r"@\('(S-1-5-[0-9-]+)','(\w+)'\)", BOOTSTRAP) == [
        ("S-1-5-18", "FullControl"),
        ("S-1-5-32-544", "FullControl"),
        ("S-1-5-32-545", "ReadAndExecute"),
    ]
    assert "$acl.SetAccessRuleProtection($true, $false)" in BOOTSTRAP
    assert "'ContainerInherit,ObjectInherit', 'None', 'Allow'" in BOOTSTRAP
    assert "$harness='C:\\ProgramData\\JappHarness'" in text


def test_attestor_trace_lines_carry_only_step_names_and_timestamps() -> None:
    text = attestor_source()
    assert re.findall(r"(?m)^\s*function (\w+)", text) == ["TraceStep"]
    assert statements(ps_function("TraceStep", text), "ps") == [
        TRACE_STEP[TRACE_STEP.index("{") + 2 : -2]
    ]
    # Every call passes a fixed literal or the current step name, which is only
    # ever assigned a fixed literal: no read value can reach the trace. PowerShell
    # resolves command and variable names in any case, so every check below is
    # case-insensitive over the code (review mutants m1-m3, M01-M06, M21, M22).
    code = "\n".join(statements(text, "ps"))
    calls = re.findall(r"(?i)\bTraceStep (\([^)\n]*\)|'[^'\n]*'|\$\w+)", code)
    assert calls == [
        "'start'",
        *["$step"] * len(ATTESTOR_STEPS),
        "('caught at '+$step)",
        "'wrote machine.json'",
    ]
    assert re.findall(r"(?i)\$step\s*=([^;\n]*)", code) == [
        "'" + step + "'" for step in ATTESTOR_STEPS
    ]
    # Every use of TraceStep, every write and every use of the name 'step' is one
    # of the above: an unrecognised call form, a second writer or a computed step
    # name would otherwise reach the trace (review mutants R01-R04, R11-R18).
    assert re.findall(r"(?i)\bTraceStep\b", code) == ["TraceStep"] * (1 + len(calls))
    assert not re.search(r"(?i)\bTraceStep\s+[-\"@]", code)
    # 'step' as a name: each assignment and its trace call, the caught line, and the
    # error receipt's key and value. A Set-Variable, foreach, scoped or braced form
    # adds one more.
    names = re.findall(r"(?i)(?<![a-z])step(?![\w-])", code)
    assert len(names) == 2 * len(ATTESTOR_STEPS) + 3
    assert len(re.findall(r"(?i)attestor-trace\.txt", code)) == 1
    assert re.findall(r"(?i)\[(?:System\.)?IO\.[\w.]+\]", code) == ["[IO.File]"]
    assert len(re.findall(r"(?i)\[IO\.File\]::", code)) == 1
    assert len(re.findall(r"(?i)AppendAllText", code)) == 1
    for writer in ("Add-Content", "Out-File", "WriteAll", "Tee-Object", "New-Item"):
        assert not re.search("(?i)" + writer, code), writer
    for alias in ("ac", "sc", "ni", "tee", "sv", "nv", "set", "iex"):
        assert not re.search(r"(?i)(?<![\w-])" + alias + r"(?![\w-])", code), alias
    for changer in ("Set-Variable", "New-Variable", "Invoke-Expression", "PSVariable"):
        assert not re.search("(?i)" + changer, code), changer
    assert ">" not in code
    assert re.findall(
        r"(?i)Set-Content -LiteralPath \(Join-Path \$harness '([^']+)'\)", code
    ) == [
        "machine.json",
        "machine-error.json",
    ]
    assert len(re.findall(r"(?i)Set-Content", code)) == 2
    for forbidden in ("$script:", "$local:", "$global:", "[ref]", "${"):
        assert forbidden not in code.lower(), forbidden
    # Each step is traced before its work.
    start = attestor_try(text)
    work, end = block(text, start, "ps")
    lines = statements(work, "ps")
    assert lines[1] == "TraceStep $step"
    for step in ATTESTOR_STEPS[1:]:
        assert ("$step='" + step + "'; TraceStep $step") in lines
    # A caught failure names its step before the error receipt that ends the guest's
    # wait; success is traced only after machine.json is written.
    handler = statements(block(text, end, "ps")[0], "ps")
    assert handler[0] == "TraceStep ('caught at '+$step)"
    assert handler[-1] == "throw"
    assert lines[-1] == (
        "$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath "
        "(Join-Path $harness 'machine.json') -Encoding UTF8"
    )
    assert statements(text, "ps")[-1] == "TraceStep 'wrote machine.json'"
    # One run writes at most these lines; each is a 28-character 'o' UTC time, a
    # space and a fixed name, far inside the guest's 64 KB retention bound.
    names = ["start", *ATTESTOR_STEPS, "wrote machine.json"]
    longest = max(len("caught at " + step) for step in ATTESTOR_STEPS)
    assert sum(28 + 1 + len(name) + 2 for name in names) + 28 + 1 + longest + 2 < (
        64 * 1024
    )


def test_attestor_trace_is_retained_bounded_before_any_check() -> None:
    wait = GUEST.index("} while($clock.Elapsed.TotalSeconds -lt $machineLimit)")
    start = GUEST.index("$tracePath='C:\\ProgramData\\JappHarness\\attestor-trace.txt'")
    decided = GUEST.index("$mismatch=@()")
    assert wait < start < decided
    # The attestor may still append: a shared read with a fixed bound, refused like
    # the receipts above it, written to a fresh proof member.
    assert statements(GUEST[start:decided], "ps") == [
        "$tracePath='C:\\ProgramData\\JappHarness\\attestor-trace.txt'",
        "if(Test-Path -LiteralPath $tracePath) {",
        "$traceBytes=New-Object byte[] (64KB+1)",
        "$traceCount=0",
        (
            "$traceStream=[IO.File]::Open($tracePath,[IO.FileMode]::Open,"
            "[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor "
            "[IO.FileShare]::Delete))"
        ),
        (
            "try { do { $traceRead=$traceStream.Read($traceBytes,$traceCount,"
            "$traceBytes.Length-$traceCount); $traceCount+=$traceRead } "
            "while($traceRead -gt 0 -and $traceCount -lt $traceBytes.Length) } "
            "finally { $traceStream.Dispose() }"
        ),
        (
            "if($traceCount -gt 64KB) "
            "{ throw 'Bounded protected attestor trace required' }"
        ),
        (
            "$traceCopy=[IO.File]::Open((Join-Path $proof 'attestor-trace.txt'),"
            "[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)"
        ),
        (
            "try { $traceCopy.Write($traceBytes,0,$traceCount) } finally "
            "{ $traceCopy.Dispose() }"
        ),
        "}",
    ]
    assert GUEST.count("attestor-trace.txt") == 2
    assert "'attestor-trace.txt'" in attestor_source()
    # The receipts keep their own bound; the trace never replaces them.
    assert "(Get-Item -LiteralPath $retainedPath).Length -gt 64KB" in GUEST[:start]


def test_diagnostics_route_settles_before_its_tree_and_geometry_are_read() -> None:
    shell = ps_function("ShellCapture")
    order = [
        "$Owner.ShellKeys('enter');ShellWait { $Owner.ShellRouteFocused($label) }",
        "$checkedBefore=$null;$checkedAfter=$null",
        "if($slug -ceq 'diagnostics') {",
        "$checkedBefore=WaitCheckedAt $Owner;ShellWait { DesktopVersionsShown $Owner }",
        "}",
        "$name='shell-'+$scale+'-'+$slug",
        "Snapshot $name $Owner",
        "$tree=$Owner.ShellTree()|ConvertTo-Json -Depth 10",
    ]
    lines = statements(shell, "ps")
    first = lines.index(order[0])
    assert lines[first : first + len(order)] == order
    geometry = lines.index("$geometry=$Owner.ShellRouteGeometry($label)")
    assert lines[geometry + 1] == (
        "if($slug -ceq 'diagnostics') { $Owner.KeyboardCheckAgain();"
        "$checkedAfter=CheckedAdvance $Owner $checkedBefore }"
    )
    assert first < geometry
    assert shell.count("WaitCheckedAt $Owner") == 1
    # The product renders both version labels only once its metadata load is ready.
    product = (ROOT / "apps" / "desktop" / "src" / "diagnostics.tsx").read_text(
        encoding="utf-8"
    )
    ready = product.index('{state.kind === "ready" ? (')
    for label in ("App version", "Tauri version"):
        assert product.count("<dt>" + label + "</dt>") == 1
        assert product.index("<dt>" + label + "</dt>") > ready


@pytest.fixture
def vm(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    return load_host_module("windows11_vm", monkeypatch)


def test_framed_phases_and_accept_lines_equal_the_host_owner(vm: ModuleType) -> None:
    framed = re.search(r"(?m)^\$framedPhases = @\(([^)]*)\)$", GUEST)
    assert framed is not None
    guest_phases = tuple(re.findall(r"'([^']+)'", framed.group(1)))
    assert vm.FRAMED_PHASES[0] == "environment"
    assert guest_phases == vm.FRAMED_PHASES[1:]
    nonce = "0123456789abcdef" * 4
    receipt = ps_function("Receipt")
    frame = re.search(r"HostAccepted \((.+?)\) 60000 ", receipt)
    environment = re.search(r"HostAccepted \((.+?)\) 15000 ", GUEST)
    assert frame is not None
    assert environment is not None
    host = ast.parse(inspect.getsource(vm.observe))
    accepts = [
        node.value
        for node in ast.walk(host)
        if isinstance(node, ast.Assign)
        and [getattr(target, "id", None) for target in node.targets] == ["accept"]
    ]
    assert len(accepts) == 2
    environment_accept, frame_accept = accepts
    assert ps_value(environment.group(1), {"$config.nonce": nonce}) == (
        "JAPP11-ENV-ACCEPT " + nonce
    )
    assert (
        py_value(environment_accept, {"nonce": nonce}) == "JAPP11-ENV-ACCEPT " + nonce
    )
    for phase in vm.FRAMED_PHASES[1:]:
        expected = "JAPP11-FRAME-ACCEPT " + phase + " " + nonce
        assert ps_value(frame.group(1), {"$Name": phase, "$config.nonce": nonce}) == (
            expected
        )
        assert py_value(frame_accept, {"row": {"phase": phase}, "nonce": nonce}) == (
            expected
        )
    # The host ends each line with LF; the guest's ReadLine keeps its default LF.
    assert 'serial.sendall((accept + "\\n").encode())' in inspect.getsource(vm.observe)
    assert ".NewLine" not in GUEST
