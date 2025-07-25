Write-Host "Starting local web server for Slayer Suite..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will run at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
python -m http.server 8000