$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot

Write-Output "Starting SmartWaste 360 API on http://127.0.0.1:8000 ..."
$existing = Get-Process -Name python -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.CommandLine -like "*uvicorn*" }
if ($existing) { Write-Output "A uvicorn process is already running." }

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
