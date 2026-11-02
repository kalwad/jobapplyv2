# DIAGNOSTIC SCRATCH ONLY - never merge. Parse (never run) the SYSTEM attestor
# body embedded in windows11_bootstrap.ps1 at 10f247b, and the outer file,
# with Windows PowerShell 5.1's own parser.
param([Parameter(Mandatory=$true)][string]$Bootstrap)
$ErrorActionPreference='Stop'
$text=[IO.File]::ReadAllText($Bootstrap)
$start=$text.IndexOf("`$attestor = @'")
if($start -lt 0){ throw 'attestor here-string not found' }
$bodyStart=$text.IndexOf("`n",$start)+1
$end=$text.IndexOf("`n'@",$bodyStart)
$body=$text.Substring($bodyStart,$end-$bodyStart)
$tokens=$null;$errors=$null
[void][Management.Automation.Language.Parser]::ParseInput($body,[ref]$tokens,[ref]$errors)
$outerTokens=$null;$outerErrors=$null
[void][Management.Automation.Language.Parser]::ParseFile($Bootstrap,[ref]$outerTokens,[ref]$outerErrors)
[ordered]@{
  powershell=$PSVersionTable.PSVersion.ToString()
  edition=$PSVersionTable.PSEdition
  attestor_lines=($body -split "`n").Count
  attestor_sha256=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($body))).Replace('-','').ToLowerInvariant()
  attestor_errors=@($errors|ForEach-Object { $_.Message+' @'+$_.Extent.StartLineNumber })
  outer_errors=@($outerErrors|ForEach-Object { $_.Message+' @'+$_.Extent.StartLineNumber })
}|ConvertTo-Json -Depth 4
