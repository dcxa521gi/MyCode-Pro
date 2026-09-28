$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$binary = Join-Path $repoRoot 'target\release\MyCode.exe'
if (-not (Test-Path -LiteralPath $binary)) {
    throw "Windows binary was not built: $binary"
}

# The help command returns before initializing Tauri or opening the user's
# session database. It still exercises the native Windows DLL loader.
$process = Start-Process -FilePath $binary -ArgumentList 'app', '--help' -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "Windows binary startup check failed (exit $($process.ExitCode)). Check native DLL dependencies before publishing."
}
Write-Output 'Windows binary startup check passed.'
