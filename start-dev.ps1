Write-Host "Starting DocMatrix backend + frontend..." -ForegroundColor Cyan

$backendPath = "d:/SDMS/SDMS_Clone/backend"
$frontendPath = "d:/SDMS/SDMS_Clone/frontend"
$pythonExe = "d:/SDMS/.venv/Scripts/python.exe"

if (-not (Test-Path $pythonExe)) {
  Write-Host "Python venv not found at $pythonExe" -ForegroundColor Red
  exit 1
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $backendPath; & $pythonExe run.py"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm --prefix $frontendPath run dev"

Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Use this script whenever you start work to avoid login failures from backend downtime." -ForegroundColor Yellow
