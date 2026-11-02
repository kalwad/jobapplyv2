"""Apply the KI-0175 mutants (implementer G/B, reviewer R, follow-up F) to the
current sources and run the current guest-driver tests against each."""
import subprocess
import sys
from pathlib import Path

S = Path(sys.argv[1])
REPO = sys.argv[2]
guest = (S / "post" / "windows11_guest.ps1").read_text(encoding="ascii")
boot = (S / "post" / "windows11_bootstrap.ps1").read_text(encoding="ascii")

ERR_BREAK = "        if($null -ne $failed -and (MachineDiffers $failed 'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) { break }\n"
ERR_READ = "        $failed=ProtectedReceipt $machineErrorPath\n"
MACHINE_READ = "        $current=ProtectedReceipt $machinePath\n        if($null -ne $current) { $machine=$current; if((MachineDiffers $machine $machineSchema $boot).Count -eq 0) { break } }\n"
start = guest.index("    # The attestor's trace holds only")
end = guest.index("    $mismatch=@()")
TRACE_BLOCK = guest[start:end]
TRACE_REMOVE = "if(Test-Path -LiteralPath $tracePath) { Remove-Item -LiteralPath $tracePath -Force }\n"
CAUGHT = "    TraceStep ('caught at '+$step)\n"
ERR_WRITE_TAIL = "'machine-error.json') -Encoding UTF8\n"
SUCCESS = "TraceStep 'wrote machine.json'\n"
RECORD_WRITE = "    $record|ConvertTo-Json -Depth 8|Set-Content"
APPEND = "[IO.File]::AppendAllText($tracePath,([DateTime]::UtcNow.ToString('o')+' '+$Name+\"`r`n\"),[Text.Encoding]::ASCII)"
CAPTION_LINE = "    $system=Get-CimInstance -ClassName Win32_ComputerSystem\n"
RM = "    Remove-ItemProperty -LiteralPath $winlogon -Name DefaultPassword -ErrorAction SilentlyContinue\n"
WINLOGON = "    $winlogon='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon'\n"
OPEN = "try { $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)) } catch { return $null }"
PARSE = "    try { return ([Text.Encoding]::UTF8.GetString($bytes,0,$count).TrimStart([char]0xFEFF)|ConvertFrom-Json) } catch { return $null }\n"


def swap(text, old, new):
    assert text.count(old) == 1, (old, text.count(old))
    return text.replace(old, new)


M = []  # (label, guest, bootstrap)
g = lambda label, old, new: M.append((label, swap(guest, old, new), boot))
b = lambda label, old, new: M.append((label, guest, swap(boot, old, new)))
g("G01 wait 150->30", "$machineLimit=150", "$machineLimit=30")
g("G02 wait 150->240", "$machineLimit=150", "$machineLimit=240")
g("G03 any error ends wait", ERR_BREAK, "        if($null -ne $failed) { break }\n")
g("G04 error binding uses receipt schema", "MachineDiffers $failed 'japp-win11-protected-machine-error-v1'", "MachineDiffers $failed 'japp-win11-protected-machine-v1'")
g("G05 error read before current receipt", MACHINE_READ + ERR_READ + ERR_BREAK, ERR_READ + ERR_BREAK + MACHINE_READ)
g("G06 no early exit on bound error", ERR_READ + ERR_BREAK, "")
g("G07 error binding ignores boot", "MachineDiffers $failed 'japp-win11-protected-machine-error-v1' $boot", "MachineDiffers $failed 'japp-win11-protected-machine-error-v1' $failed.boot_time")
g("G08 trace bound refusal removed", "        if($traceCount -gt 64KB) { throw 'Bounded protected attestor trace required' }\n", "")
g("G09 trace copied by path", TRACE_BLOCK, "    $tracePath='C:\\ProgramData\\JappHarness\\attestor-trace.txt'\n    if(Test-Path -LiteralPath $tracePath) { Copy-Item -LiteralPath $tracePath -Destination (Join-Path $proof 'attestor-trace.txt') }\n")
g("G10 trace read without write sharing", "[IO.File]::Open($tracePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))", "[IO.File]::Open($tracePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)")
M.append(("G11 trace retained after the decision", swap(swap(guest, TRACE_BLOCK, ""), "    $unmet=New-Object Collections.ArrayList\n", TRACE_BLOCK + "    $unmet=New-Object Collections.ArrayList\n"), boot))
g("G12 trace buffer 1 MB", "$traceBytes=New-Object byte[] (64KB+1)", "$traceBytes=New-Object byte[] (1MB+1)")
g("G13 trace not retained", TRACE_BLOCK, "")
g("G14 decision drops attestor refusal", "        if($null -ne $attestorError -and (MachineDiffers $attestorError 'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) { throw 'Protected machine attestor failed; its named step is retained' }\n", "")
g("R01 error break tolerates one mismatch", ".Count -eq 0) { break }\n        Start-Sleep", ".Count -le 1) { break }\n        Start-Sleep")
g("R03 unbounded loop", "} while($clock.Elapsed.TotalSeconds -lt $machineLimit)", "} while($true)")
g("R04 no sleep", "        Start-Sleep -Milliseconds 250\n    } while($clock.Elapsed.TotalSeconds -lt $machineLimit)", "    } while($clock.Elapsed.TotalSeconds -lt $machineLimit)")
g("R05 wait relative to setup (pre-review form)", "$machineLimit=150", "$machineLimit=$clock.Elapsed.TotalSeconds+150")
g("R06 trace overwrite mode", "[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)", "[IO.FileMode]::Create,[IO.FileAccess]::Write)")
g("R07 trace bound off by large", "if($traceCount -gt 64KB)", "if($traceCount -gt 64KB+1)")
g("R09 error read kept as receipt", ERR_READ, "        $failed=ProtectedReceipt $machineErrorPath; $machine=$failed\n")
g("R10 decision accepts error as pass", "if($null -eq $machine) { throw 'Protected current-boot machine attestation missing or unreadable' }", "if($null -eq $machine) { $machine=$attestorError }")
g("R2-06 wait unbounded via MaxValue", "$machineLimit=150", "$machineLimit=150; $machineLimit=[double]::MaxValue")
g("R2-08 trace retained only on failure", "    if(Test-Path -LiteralPath $tracePath) {\n        $traceBytes", "    if((Test-Path -LiteralPath $tracePath) -and $null -eq $machine) {\n        $traceBytes")
g("F01 receipt shares no delete", OPEN, OPEN.replace("([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)", "[IO.FileShare]::ReadWrite"))
g("F02 receipt bound removed", "    if($count -gt 64KB) { throw 'Bounded protected machine receipt required' }\n", "")
g("F03 receipt parse failure throws", PARSE, "    return ([Text.Encoding]::UTF8.GetString($bytes,0,$count).TrimStart([char]0xFEFF)|ConvertFrom-Json)\n")
g("F04 receipt open failure throws", OPEN, "$stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))")
g("F09 receipt BOM kept", ".TrimStart([char]0xFEFF)|ConvertFrom-Json", "|ConvertFrom-Json")
g("F10 receipt read by path again", PARSE, "    try { return (Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json) } catch { return $null }\n")
g("F11 receipt buffer 1 MB", "    $bytes=New-Object byte[] (64KB+1)\n", "    $bytes=New-Object byte[] (1MB+1)\n")
g("F12 pre-wait sleep 200 s (pin-guarded, expected survivor)", "    $machineLimit=150\n", "    Start-Sleep -Seconds 200\n    $machineLimit=150\n")
b("B01 task limit 10->1 min", "New-TimeSpan -Minutes 10", "New-TimeSpan -Minutes 1")
b("B02 task limit 10->60 min", "New-TimeSpan -Minutes 10", "New-TimeSpan -Minutes 60")
b("B03 earlier trace kept", TRACE_REMOVE, "")
M.append(("B04 trace removed after first line", guest, swap(swap(boot, TRACE_REMOVE, ""), "    TraceStep 'start'\n", "    TraceStep 'start'\n    " + TRACE_REMOVE)))
b("B05 caught line carries the message", "TraceStep ('caught at '+$step)", "TraceStep ('caught at '+$step+': '+$_.Exception.Message)")
b("B06 trace line carries the user", "+' '+$Name+\"`r`n\"", "+' '+$Name+' '+$env:USERNAME+\"`r`n\"")
b("B07 trace by Add-Content", "{ " + APPEND + " }", "{ Add-Content -LiteralPath $tracePath -Value ([DateTime]::UtcNow.ToString('o')+' '+$Name) }")
b("B08 tpm step untraced", "$step='tpm'; TraceStep $step", "$step='tpm'")
M.append(("B09 error receipt before caught line", guest, swap(swap(boot, CAUGHT, ""), ERR_WRITE_TAIL + "    throw\n", ERR_WRITE_TAIL + CAUGHT + "    throw\n")))
M.append(("B10 success traced before machine.json", guest, swap(swap(boot, "}\n" + SUCCESS, "}\n"), RECORD_WRITE, "    " + SUCCESS + RECORD_WRITE)))
b("B11 success line removed", "}\n" + SUCCESS, "}\n")
b("B12 step traces a read value", "$step='version'; TraceStep $step", "$step='version'; TraceStep $env:COMPUTERNAME")
b("B13 trace name differs from guest", "'attestor-trace.txt'", "'attestor.log'")
b("B14 step assigned a read value", "$step='record'; TraceStep $step", "$step=[string]$os.Caption; TraceStep $step")
b("B15 start line removed", "    TraceStep 'start'\n", "")
b("B16 trace outside the harness", "$tracePath=Join-Path $harness 'attestor-trace.txt'", "$tracePath=Join-Path $env:TEMP 'attestor-trace.txt'")
b("B17 stale error no longer removed", "if(Test-Path -LiteralPath $errorPath) { Remove-Item -LiteralPath $errorPath -Force }\n", "")
b("R11 trace named param value", CAPTION_LINE, CAPTION_LINE + "    TraceStep -Name $system.UserName\n")
b("R12 trace double quoted value", CAPTION_LINE, CAPTION_LINE + '    TraceStep "user $($system.UserName)"\n')
b("R13 second trace writer by name", CAPTION_LINE, CAPTION_LINE + "    Add-Content -LiteralPath (Join-Path $harness 'attestor-trace.txt') -Value $system.UserName\n")
b("R14 step spaced from read value", "    $step='interactive-user'; TraceStep $step\n", "    $step = [string]$system.UserName; TraceStep $step\n")
b("R15 trace value paren", CAPTION_LINE, CAPTION_LINE + "    TraceStep ($system.UserName)\n")
b("R16 limit hours", "-ExecutionTimeLimit (New-TimeSpan -Minutes 10)", "-ExecutionTimeLimit (New-TimeSpan -Hours 10)")
b("R17 limit zero", "-ExecutionTimeLimit (New-TimeSpan -Minutes 10)", "-ExecutionTimeLimit (New-TimeSpan -Minutes 0)")
b("R18 password into trace via registry", WINLOGON, WINLOGON + "    [IO.File]::AppendAllText((Join-Path $harness 'attestor-trace.txt'),[string](Get-ItemProperty -LiteralPath $winlogon).DefaultPassword)\n")
b("R19 caught trace removed", CAUGHT, "")
b("R20 trace removal only when error", TRACE_REMOVE.rstrip("\n"), "if(Test-Path -LiteralPath $errorPath) { Remove-Item -LiteralPath $tracePath -Force }")
b("R2-01 Add-Content secret", RM, "    Add-Content -LiteralPath (Join-Path $harness 'attestor-trace.txt') -Value ([string](Get-ItemProperty -LiteralPath $winlogon).DefaultPassword)\n" + RM)
b("R2-02 double-quoted secret", RM, "    TraceStep \"$((Get-ItemProperty -LiteralPath $winlogon).DefaultPassword)\"\n" + RM)
b("R2-03 named-param secret", RM, "    TraceStep -Name ([string](Get-ItemProperty -LiteralPath $winlogon).DefaultPassword)\n" + RM)
b("R2-04 spaced step secret", RM, "    $step = [string](Get-ItemProperty -LiteralPath $winlogon).DefaultPassword\n" + RM)
b("R2-12 user name via subexpression", "    $step='processors'; TraceStep $step\n", "    $step='processors'; TraceStep $step; TraceStep (\"user \"+$system.UserName)\n")
b("F05 TraceStep unguarded (a trace failure ends the attestor)", "{ try { " + APPEND + " } catch { } }", "{ " + APPEND + " }")
b("F06 TraceStep guard rethrows", "{ try { " + APPEND + " } catch { } }", "{ try { " + APPEND + " } catch { throw } }")
b("F07 second top-level try", "$step='configuration'\n", "try { $null=1 } catch { }\n$step='configuration'\n")
b("F08 trace via [System.IO.File]", APPEND, APPEND.replace("[IO.File]", "[System.IO.File]"))

ERR_RM = "$errorPath=Join-Path $harness 'machine-error.json'\nif(Test-Path -LiteralPath $errorPath) { Remove-Item -LiteralPath $errorPath -Force }\n"
TR_RM = "$tracePath=Join-Path $harness 'attestor-trace.txt'\nif(Test-Path -LiteralPath $tracePath) { Remove-Item -LiteralPath $tracePath -Force }\n"
SETTINGS = "$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries\n"
REGISTER_TAIL = "-Settings $settings | Out-Null\n"
THROW_LINE = "    $step='interactive-user'; TraceStep $step\n"
b("B18 error removed before trace (pre-review order)", TR_RM + ERR_RM, ERR_RM + TR_RM)
b("V01 upper-case step from a read value", THROW_LINE, THROW_LINE + "    $STEP=[string]$system.UserName\n")
b("V02 lower-case tracestep of the password", RM, "    tracestep ([string](Get-ItemProperty -LiteralPath $winlogon).DefaultPassword)\n" + RM)
b("V03 sv alias sets step", THROW_LINE, THROW_LINE + "    sv step ([string]$system.UserName)\n")
b("V04 scoped step", THROW_LINE, THROW_LINE + "    $local:step=[string]$system.UserName\n")
b("V05 foreach leaves step", THROW_LINE, THROW_LINE + "    foreach($step in @([string]$system.UserName)) { }\n")
b("V06 New-Variable step", THROW_LINE, THROW_LINE + "    New-Variable -Name step -Value ([string]$system.UserName) -Force\n")
b("V07 Set-Variable built name", THROW_LINE, THROW_LINE + "    Set-Variable -Name ('st'+'ep') -Value ([string]$system.UserName)\n")
b("V08 mixed-case Step assignment", THROW_LINE, THROW_LINE + "    $Step = [string]$system.UserName\n")
b("V09 add-content lower case", THROW_LINE, THROW_LINE + "    add-content -LiteralPath $tracePath -Value $system.UserName\n")
b("V10 ac alias", THROW_LINE, THROW_LINE + "    ac $tracePath $system.UserName\n")
b("V11 redirection append", THROW_LINE, THROW_LINE + "    [string]$system.UserName >> $tracePath\n")
b("V12 System.IO.StreamWriter", THROW_LINE, THROW_LINE + "    $w=New-Object System.IO.StreamWriter($tracePath,$true); $w.WriteLine($system.UserName); $w.Dispose()\n")
b("V13 iex", THROW_LINE, THROW_LINE + "    iex ('TraceStep '+$system.UserName)\n")
b("T01 settings property rewrite", SETTINGS, SETTINGS + "$settings.ExecutionTimeLimit = 'PT1M'\n")
b("T02 Set-ScheduledTask after register", REGISTER_TAIL, REGISTER_TAIL + "Set-ScheduledTask -TaskName 'JappOwnedMachineAttestation' -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1))\n")
b("T03 lower-case property rewrite", SETTINGS, SETTINGS + "$Settings.executiontimelimit='PT1M'\n")
b("T04 second settings object", SETTINGS, SETTINGS + "$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries\n")
killed = 0
for label, mg, mb in M:
    d = S / "mut" / label.split()[0]
    d.mkdir(parents=True, exist_ok=True)
    (d / "windows11_guest.ps1").write_text(mg, encoding="ascii", newline="\n")
    (d / "windows11_bootstrap.ps1").write_text(mb, encoding="ascii", newline="\n")
    out = subprocess.run([sys.executable, "-I", str(S / "tools" / "variant.py"), REPO, str(S / "work"), str(d / "windows11_guest.ps1"), str(d / "windows11_bootstrap.ps1"), str(S / "post" / "test_windows11_guest_driver.py")], capture_output=True, text=True).stdout
    failed = [line.split("::")[1].split(" ")[0] for line in out.splitlines() if line.startswith(("FAILED", "ERROR"))]
    ok = "exit 0" not in out
    killed += ok
    print(f"{label}: {'KILLED' if ok else 'SURVIVED'} {failed[:3]}")
print(f"{killed}/{len(M)} killed")
