# Failure-only inspection. Never launches a desktop image, test, service or GUI.
param([Parameter(Mandatory = $true)][string] $OutputDirectory)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Write-Record([string] $Path, [object] $Value) {
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding utf8
}
function File-Binding([string] $Path) {
    $item = Get-Item -LiteralPath $Path
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected regular file: $Path"
    }
    return [ordered]@{
        path = $item.FullName
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

if (-not $IsWindows -or $env:RUNNER_ARCH -ne 'X64') { throw 'Requires native Windows X64 runner' }
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$tempRoot = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ([IO.Path]::GetDirectoryName($output) -ne $tempRoot -or
    [IO.Path]::GetFileName($output) -ne 'windows-native-loader-diagnostics' -or
    (Test-Path -LiteralPath $output)) {
    throw 'Output must be a fresh, direct RUNNER_TEMP/windows-native-loader-diagnostics directory'
}
New-Item -ItemType Directory -Path $output | Out-Null
$clock = [Diagnostics.Stopwatch]::StartNew()
$script:sequence = 0
$childEnvironment = [ordered]@{}
foreach ($name in @('SystemRoot', 'WINDIR', 'SystemDrive', 'PATH', 'PATHEXT', 'COMSPEC',
        'TEMP', 'TMP', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($null -ne $value) { $childEnvironment[$name] = $value }
}
$childEnvironment['GIT_OPTIONAL_LOCKS'] = '0'
$childEnvironment['GIT_CONFIG_NOSYSTEM'] = '1'
$childEnvironment['GIT_CONFIG_GLOBAL'] = 'NUL'

function Invoke-BoundTool([string] $Tool, [string[]] $Arguments) {
    if ($clock.Elapsed.TotalSeconds -ge 120) { throw 'Diagnostic command budget exhausted' }
    $script:sequence += 1
    $stem = Join-Path $output ('command-{0:d3}' -f $script:sequence)
    $before = File-Binding $Tool
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $before.path
    $startInfo.WorkingDirectory = $repo
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Environment.Clear()
    foreach ($entry in $childEnvironment.GetEnumerator()) {
        $startInfo.Environment[$entry.Key] = $entry.Value
    }
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $environmentSnapshot = [ordered]@{}
    foreach ($entry in $childEnvironment.GetEnumerator()) {
        $environmentSnapshot[$entry.Key] = $entry.Value
    }
    Write-Record "$stem.upfront.json" ([ordered]@{
        executable = $before; arguments = @($Arguments); cwd = $repo
        environment = $environmentSnapshot; started_utc = [DateTime]::UtcNow.ToString('o')
        timeout_ms = 15000; scope = 'Read-only tool inspection, no image launch'
    })
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $stdout = [IO.File]::Create("$stem.stdout")
    $stderr = [IO.File]::Create("$stem.stderr")
    $started = $false
    $timedOut = $false
    $result = $null
    try {
        $started = $process.Start()
        if (-not $started) { throw 'Tool failed to start' }
        Write-Record "$stem.launch.json" @{ owned_pid = $process.Id; executable = $before }
        $outTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout)
        $errTask = $process.StandardError.BaseStream.CopyToAsync($stderr)
        if (-not $process.WaitForExit(15000)) {
            $timedOut = $true
            $process.Kill($true)
            if (-not $process.WaitForExit(10000)) { throw 'Owned tool did not exit after termination' }
        }
        if (-not [Threading.Tasks.Task]::WaitAll(@($outTask, $errTask), 10000)) {
            throw 'Tool output drain did not close within budget'
        }
        $result = $process.ExitCode
    }
    finally {
        if ($started -and -not $process.HasExited) {
            $process.Kill($true)
            $null = $process.WaitForExit(10000)
        }
        $stdout.Dispose()
        $stderr.Dispose()
        $after = File-Binding $Tool
        Write-Record "$stem.result.json" ([ordered]@{
            exit_code = $result; timeout = $timedOut
            direct_tool_exited = ($started -and $process.HasExited)
            executable_after = $after; executable_unchanged = ($before.sha256 -eq $after.sha256)
            stdout = File-Binding "$stem.stdout"; stderr = File-Binding "$stem.stderr"
            ended_utc = [DateTime]::UtcNow.ToString('o')
            descendant_scope = 'No independent descendant enumeration or absence claim'
        })
        $process.Dispose()
    }
    if ($timedOut -or $before.sha256 -ne $after.sha256) { throw 'Bound tool timed out or changed' }
    return [pscustomobject]@{ code = $result; stdout = "$stem.stdout"; stderr = "$stem.stderr" }
}

$summary = [ordered]@{
    scope = 'Failure-only static PE inspection; no Cargo, --list, tests, services, GUI or DLL loading'
    source = $null; images = @(); tools = @(); common_controls_candidates = @()
    image_resolution = 'UNOBSERVED: static candidate paths are not a loaded-module witness'
    resource_or_loader_validation_pass = $false
    original_canonical_outcome = 'The preceding GitHub canonical step remains failed and unchanged'
    status = 'INCOMPLETE'; error = $null; ended_utc = $null; elapsed_seconds = $null
}
try {
    $git = (Get-Command git -CommandType Application).Source
    $head = Invoke-BoundTool $git @('rev-parse', 'HEAD', 'HEAD^{tree}')
    if ($head.code -ne 0) { throw 'Could not bind checkout' }
    $source = Invoke-BoundTool $git @('ls-files', '-s', '-z', '--',
        'apps/desktop/src-tauri', 'packages/contracts/schemas',
        'packages/contracts/catalog/error-catalog.v1.json', 'rust-toolchain.toml',
        '.github/workflows/ci.yml', 'scripts/windows-native-loader-diagnostics.ps1')
    if ($source.code -ne 0) { throw 'Could not bind source inputs' }
    $sourceFiles = @()
    foreach ($entry in ([IO.File]::ReadAllText($source.stdout) -split "`0")) {
        if ($entry -eq '') { continue }
        if ($entry -notmatch '^100(644|755) ([0-9a-f]{40}) 0\t(.+)$') {
            throw 'Unexpected tracked source entry'
        }
        $relative = $Matches[3]
        $gitBlob = $Matches[2]
        $path = Join-Path $repo $relative
        $bytes = [IO.File]::ReadAllBytes($path)
        $header = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.LongLength)`0")
        $actualBlob = [Convert]::ToHexString(
            [Security.Cryptography.SHA1]::HashData([byte[]]($header + $bytes))).ToLowerInvariant()
        if ($actualBlob -ne $gitBlob) { throw "Tracked source differs from Git blob: $relative" }
        $sourceFiles += [ordered]@{ relative_path = $relative; git_blob = $gitBlob
            working_file = File-Binding $path }
    }
    $summary.source = [ordered]@{
        head_and_tree = [IO.File]::ReadAllLines($head.stdout)
        files = $sourceFiles; github_sha = $env:GITHUB_SHA
        runner_os = $env:RUNNER_OS; runner_arch = $env:RUNNER_ARCH
        image_os = $env:ImageOS; image_version = $env:ImageVersion
        limitation = 'Source/tree binding is not a reconstructed compiler invocation or a PE provenance attestation'
    }
    Write-Record (Join-Path $output 'source-upfront.json') $summary.source

    # Discover installed SDK tools by VS/Windows Kits metadata; never alter PATH.
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    $vs = Invoke-BoundTool $vswhere @('-utf8', '-latest', '-products', '*', '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath')
    if ($vs.code -ne 0) { throw 'VS discovery failed' }
    $vsRoot = [IO.File]::ReadAllText($vs.stdout).Trim()
    if ($vsRoot.Contains("`n") -or -not [IO.Path]::IsPathFullyQualified($vsRoot)) {
        throw 'VS discovery did not return exactly one absolute installation'
    }
    $versionFile = Join-Path $vsRoot 'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt'
    $vcVersion = [IO.File]::ReadAllText($versionFile).Trim()
    if ($vcVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid installed MSVC version' }
    $dumpbin = Join-Path $vsRoot "VC/Tools/MSVC/$vcVersion/bin/Hostx64/x64/dumpbin.exe"
    $kitsRoots = @(foreach ($key in @(
            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots',
            'HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots')) {
        if (Test-Path -LiteralPath $key) {
            $value = Get-ItemPropertyValue -LiteralPath $key -Name KitsRoot10 -ErrorAction SilentlyContinue
            if ($value) { [IO.Path]::GetFullPath($value) }
        }
    })
    $kitsRoots = @($kitsRoots | Sort-Object -Unique)
    if ($kitsRoots.Count -ne 1) { throw 'Windows Kits registration missing or ambiguous' }
    $kitsRoot = $kitsRoots[0]
    $sdk = @(Get-ChildItem -LiteralPath (Join-Path $kitsRoot 'bin') -Directory |
        Where-Object { $_.Name -match '^10\.\d+\.\d+\.\d+$' -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'x64/mt.exe')) } |
        Sort-Object { [version]$_.Name } -Descending)
    if ($sdk.Count -eq 0) { throw 'No installed x64 Windows SDK manifest tool' }
    $mt = Join-Path $sdk[0].FullName 'x64/mt.exe'
    $summary.tools = @(File-Binding $vswhere; File-Binding $versionFile
        File-Binding $dumpbin; File-Binding $mt)
    Write-Record (Join-Path $output 'tools-upfront.json') $summary.tools

    $target = Join-Path $repo 'apps/desktop/src-tauri/target/debug'
    $images = @(Get-ChildItem -LiteralPath (Join-Path $target 'deps') -File |
        Where-Object { $_.Name -like 'japp_desktop-*.exe' -or $_.Name -like 'japp-desktop-*.exe' } |
        Sort-Object FullName -Unique)
    $normalApp = Join-Path $target 'japp-desktop.exe'
    if (Test-Path -LiteralPath $normalApp) { $images += Get-Item -LiteralPath $normalApp }
    if ($images.Count -eq 0 -or $images.Count -gt 8 -or
        ($images | Measure-Object Length -Sum).Sum -gt 536870912) {
        throw 'Native image inventory absent or exceeds 8 images / 512 MiB diagnostic bound'
    }
    foreach ($image in $images) {
        $before = File-Binding $image.FullName
        $copy = Join-Path $output $image.Name
        Copy-Item -LiteralPath $image.FullName -Destination $copy
        $retained = File-Binding $copy
        $after = File-Binding $image.FullName
        if ($before.sha256 -ne $retained.sha256 -or $before.sha256 -ne $after.sha256) {
            throw 'Native image changed during retention'
        }
        $summary.images += [ordered]@{ original = $before; retained = $retained
            classification = 'Candidate image: join exact failed filename with official job log' }
    }
    Write-Record (Join-Path $output 'images-upfront.json') $summary.images
    $needsCommonControls = $false
    $manifestUnavailable = $false
    foreach ($image in $summary.images) {
        foreach ($option in @('/headers', '/dependents', '/imports')) {
            $inspection = Invoke-BoundTool $dumpbin @($option, $image.retained.path)
            if ($inspection.code -ne 0) { throw 'PE inspection failed' }
            if ($option -eq '/imports' -and
                [IO.File]::ReadAllText($inspection.stdout).IndexOf('comctl32.dll',
                    [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $needsCommonControls = $true
            }
        }
        $manifest = $image.retained.path + '.manifest.xml'
        $extraction = Invoke-BoundTool $mt @('-nologo',
            "-inputresource:$($image.retained.path);#1", "-out:$manifest")
        $image['manifest_extraction_exit_code'] = $extraction.code
        $image['manifest'] = if (Test-Path -LiteralPath $manifest) { File-Binding $manifest } else { 'ABSENT' }
        if ($extraction.code -ne 0 -or $image['manifest'] -eq 'ABSENT') {
            $manifestUnavailable = $true
        }
        # A missing RT_MANIFEST is useful evidence, not a passing resource claim.
        if ((File-Binding $image.retained.path).sha256 -ne $image.retained.sha256) {
            throw 'Inspection changed retained PE bytes'
        }
    }
    if ($needsCommonControls) {
        $providers = @((Join-Path $env:SystemRoot 'System32/comctl32.dll'))
        $assemblyPattern = Join-Path $env:SystemRoot 'WinSxS/amd64_microsoft.windows.common-controls_6595b64144ccf1df_*'
        $assemblies = @(Get-ChildItem -Path $assemblyPattern -Directory)
        foreach ($assembly in $assemblies) {
            $candidate = Join-Path $assembly.FullName 'comctl32.dll'
            if (Test-Path -LiteralPath $candidate) { $providers += $candidate }
        }
        $providers = @($providers | Sort-Object -Unique)
        if ($providers.Count -gt 8) { throw 'Common Controls provider inventory exceeds bound' }
        foreach ($provider in $providers) {
            $before = File-Binding $provider
            $summary.common_controls_candidates += [ordered]@{
                file = $before
                version = (Get-Item -LiteralPath $provider).VersionInfo.FileVersion
                classification = 'Static installed candidate; not actual failed-process resolution'
            }
        }
        Write-Record (Join-Path $output 'common-controls-upfront.json') $summary.common_controls_candidates
        foreach ($provider in $summary.common_controls_candidates) {
            $exports = Invoke-BoundTool $dumpbin @('/exports', $provider.file.path)
            if ($exports.code -ne 0 -or
                (File-Binding $provider.file.path).sha256 -ne $provider.file.sha256) {
                throw 'Installed candidate export inspection failed or bytes changed'
            }
        }
    }
    $summary.status = if ($manifestUnavailable) {
        'STATIC_INSPECTION_PARTIAL_MANIFEST_UNAVAILABLE'
    } else {
        'STATIC_INSPECTION_CLOSED_NO_CAUSAL_VERDICT'
    }
}
catch {
    $summary.status = 'DIAGNOSTIC_INCOMPLETE'
    $summary.error = $_.Exception.ToString()
    throw
}
finally {
    $summary.ended_utc = [DateTime]::UtcNow.ToString('o')
    $summary.elapsed_seconds = $clock.Elapsed.TotalSeconds
    Write-Record (Join-Path $output 'summary.json') $summary
}
