[CmdletBinding()]
param(
  [ValidateSet('web', 'itch', 'all')]
  [string]$Target = 'all',
  [string]$SshTarget = 'sterenn@ssh.cluster129.hosting.ovh.net',
  [string]$RemoteLabRoot = '/home/sterenn/lab'
)

$ErrorActionPreference = 'Stop'

if ($SshTarget -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$') {
  throw "SSH target invalide: $SshTarget"
}
if ($RemoteLabRoot -notmatch '^/home/[A-Za-z0-9_-]+/lab$') {
  throw "Remote lab root refusé: $RemoteLabRoot"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeEntries = @('index.html', 'app.js', 'css', 'data', 'modules', 'state', 'assets', 'gang')
$previewHeaders = Join-Path $PSScriptRoot 'preview.htaccess'
$webRemote = "$RemoteLabRoot/pokegang-preview"
$itchRemote = "$RemoteLabRoot/pokegang-itch-preview"

function Invoke-Native {
  param(
    [Parameter(Mandatory)] [string]$FilePath,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [string]$WorkingDirectory = $repoRoot
  )
  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath a échoué avec le code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Publish-Runtime {
  param(
    [Parameter(Mandatory)] [string]$SourceRoot,
    [Parameter(Mandatory)] [string]$RemotePath
  )
  $sources = $runtimeEntries | ForEach-Object { Join-Path $SourceRoot $_ }
  foreach ($source in $sources) {
    if (-not (Test-Path -LiteralPath $source)) {
      throw "Runtime incomplet, entrée absente: $source"
    }
  }

  # Poser les règles QA avant le runtime évite qu'une première requête arrivée
  # pendant le transfert soit mise en cache pendant sept jours par l'hôte.
  Invoke-Native -FilePath 'scp' -Arguments @(
    '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-P', '22',
    $previewHeaders,
    "${SshTarget}:${RemotePath}/.htaccess"
  )
  $scpArguments = @(
    '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-P', '22', '-r'
  ) + $sources + @("${SshTarget}:${RemotePath}/")
  Invoke-Native -FilePath 'scp' -Arguments $scpArguments
}

$targetsToCreate = switch ($Target) {
  'web'  { @($webRemote) }
  'itch' { @($itchRemote) }
  default { @($webRemote, $itchRemote) }
}
$quotedTargets = ($targetsToCreate | ForEach-Object { "'$_'" }) -join ' '
Invoke-Native -FilePath 'ssh' -Arguments @(
  '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-p', '22', $SshTarget,
  "mkdir -p $quotedTargets && chmod 755 $quotedTargets"
)

if ($Target -in @('web', 'all')) {
  Write-Host '[preview] Publication du runtime web FR...'
  Publish-Runtime -SourceRoot $repoRoot -RemotePath $webRemote
}

if ($Target -in @('itch', 'all')) {
  Write-Host '[preview] Construction du build itch EN...'
  Invoke-Native -FilePath 'node' -Arguments @('tools/build-itch.js')
  Publish-Runtime -SourceRoot (Join-Path $repoRoot 'dist-itch') -RemotePath $itchRemote
}

$checks = $targetsToCreate | ForEach-Object {
  "test -f '$_/index.html' && test -f '$_/app.js' && test -f '$_/modules/ui/onboardingPayoff.js' && test -f '$_/.htaccess'"
}
Invoke-Native -FilePath 'ssh' -Arguments @(
  '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-p', '22', $SshTarget,
  ($checks -join ' && ')
)

Write-Host '[preview] Publication terminée.'
if ($Target -in @('web', 'all')) {
  Write-Host '  Web  : https://lab.sterenna.fr/pokegang-preview/'
}
if ($Target -in @('itch', 'all')) {
  Write-Host '  Itch : https://lab.sterenna.fr/pokegang-itch-preview/'
}
