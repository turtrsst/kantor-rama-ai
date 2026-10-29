#Requires -Version 5.1
<#
  Obsidian Memory Bridge - capture one Agent-Run note into the KRA vault.
  Duplicate-safe: refuses to overwrite an existing note unless -Force is given.
  Idempotent on the dashboard: the same link is never inserted twice.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string]$Project,
    [Parameter(Mandatory = $true)]
    [ValidateSet('proposed', 'in-progress', 'blocked', 'failed', 'verified')]
    [string]$Status,
    [Parameter(Mandatory = $true)][string]$BodyFile,
    [string]$ProjectPath = '\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai',
    [string]$VaultRoot = '\\100.76.172.67\c$\vault\KRA',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
    Write-Output "ERROR $Message"
    exit 1
}

if (-not (Test-Path -LiteralPath $VaultRoot -PathType Container)) {
    Fail "vault not found: $VaultRoot"
}
if (-not (Test-Path -LiteralPath $BodyFile -PathType Leaf)) {
    Fail "body file not found: $BodyFile"
}

$runsDir = Join-Path $VaultRoot '01-KRA\Agent-Runs'
$dashPath = Join-Path $VaultRoot '01-KRA\Dashboard KRA.md'
$backupDir = Join-Path $VaultRoot '.backups'
if (-not (Test-Path -LiteralPath $runsDir)) {
    New-Item -ItemType Directory -Path $runsDir -Force | Out-Null
}

$slug = ($Title.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($slug)) { Fail 'title produced an empty slug' }
if ($slug.Length -gt 80) { $slug = $slug.Substring(0, 80).TrimEnd('-') }

$now = Get-Date
$fileName = '{0}-{1}.md' -f $now.ToString('yyyy-MM-dd'), $slug
$notePath = Join-Path $runsDir $fileName

if ((Test-Path -LiteralPath $notePath) -and -not $Force) {
    Write-Output "SKIPPED duplicate: $notePath"
    exit 0
}

$body = [System.IO.File]::ReadAllText($BodyFile).TrimEnd()

$note = @"
---
type: agent-run
project: $Project
status: $Status
created: $($now.ToString('yyyy-MM-dd'))
tags:
  - kra
  - agent-run
---

# $Title

- Timestamp: $($now.ToString('yyyy-MM-dd HH:mm'))
- Project: $Project
- Project path: ``$ProjectPath``
- Status: $Status

$body

## Links

- [[Dashboard KRA]]
- [[KRA]]
"@

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($notePath, $note.TrimEnd() + "`n", $utf8)

$baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
$link = "- [[$baseName]] - $Title ($Status)"
$dashUpdated = $false

if (Test-Path -LiteralPath $dashPath) {
    $lines = [System.IO.File]::ReadAllLines($dashPath)
    $alreadyLinked = $false
    foreach ($line in $lines) {
        if ($line.Trim() -eq $link) { $alreadyLinked = $true; break }
    }

    if (-not $alreadyLinked) {
        $start = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i].Trim() -eq '## Agent Runs') { $start = $i; break }
        }

        if ($start -ge 0) {
            $end = $lines.Count
            for ($i = $start + 1; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '^## ') { $end = $i; break }
            }
            $insertAt = $end
            while ($insertAt -gt ($start + 1) -and $lines[$insertAt - 1].Trim() -eq '') {
                $insertAt--
            }

            if (-not (Test-Path -LiteralPath $backupDir)) {
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            }
            $backupName = 'Dashboard KRA.{0}.md.bak' -f $now.ToString('yyyyMMdd-HHmmss')
            Copy-Item -LiteralPath $dashPath -Destination (Join-Path $backupDir $backupName)

            $out = New-Object System.Collections.Generic.List[string]
            for ($i = 0; $i -lt $insertAt; $i++) { $out.Add($lines[$i]) }
            $out.Add($link)
            for ($i = $insertAt; $i -lt $lines.Count; $i++) { $out.Add($lines[$i]) }

            [System.IO.File]::WriteAllLines($dashPath, $out, $utf8)
            $dashUpdated = $true
        }
        else {
            Write-Output "WARN dashboard section '## Agent Runs' not found; note written without dashboard link"
        }
    }
}
else {
    Write-Output "WARN dashboard not found at $dashPath"
}

if ($dashUpdated) {
    Write-Output "CREATED $notePath"
    Write-Output "DASHBOARD linked: $link"
}
else {
    Write-Output "CREATED $notePath"
    Write-Output "DASHBOARD unchanged (link already present or section missing)"
}
