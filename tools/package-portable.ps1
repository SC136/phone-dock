# Desk Deck Portable Packager for Windows
# Creates a standalone zip containing node.exe, scripts, web assets and dependencies.

param(
    [string]$NodeVersion = "v22.14.0",
    [switch]$SkipDownload
)

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
$distDir = Join-Path $rootDir "dist"
$stageDir = Join-Path $distDir "DeskDeck-Windows-x64"
$zipPath = Join-Path $distDir "DeskDeck-Windows-x64.zip"

Write-Host "=== Desk Deck Portable Packager ===" -ForegroundColor Cyan
Write-Host "Project root: $rootDir"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

# 1. Download standalone node.exe if not cached
$cacheDir = Join-Path $distDir "cache"
if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
}
$cachedNodeExe = Join-Path $cacheDir "node-$NodeVersion.exe"

if (-not (Test-Path $cachedNodeExe)) {
    $nodeUrl = "https://nodejs.org/dist/$NodeVersion/win-x64/node.exe"
    Write-Host "Downloading standalone Node.js ($NodeVersion)..." -ForegroundColor Yellow
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($nodeUrl, $cachedNodeExe)
    $webClient.Dispose()
    Write-Host "Downloaded: $([math]::Round((Get-Item $cachedNodeExe).Length / 1MB, 1)) MB" -ForegroundColor Green
} else {
    Write-Host "Using cached Node.js binary: $cachedNodeExe" -ForegroundColor Green
}

# 2. Prepare staging directory
if (Test-Path $stageDir) {
    Remove-Item $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir | Out-Null

Write-Host "Copying application files..." -ForegroundColor Cyan

# Copy node.exe
Copy-Item $cachedNodeExe (Join-Path $stageDir "node.exe") -Force

# Copy core app files
$copyFiles = @("server.js", "tray.ps1", "deskdeck.vbs", "package.json", "package-lock.json")
foreach ($f in $copyFiles) {
    Copy-Item (Join-Path $rootDir $f) (Join-Path $stageDir $f) -Force
}

# Copy public folder
Copy-Item (Join-Path $rootDir "public") (Join-Path $stageDir "public") -Recurse -Force

# Copy node_modules (excluding any unnecessary test/cache files)
Copy-Item (Join-Path $rootDir "node_modules") (Join-Path $stageDir "node_modules") -Recurse -Force

# 3. Create simple batch launchers for end users

# Start Desk Deck.bat
$startBat = @"
@echo off
setlocal
cd /d "%~dp0"
echo Starting Desk Deck...
start "" wscript //B "deskdeck.vbs"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4321"
"@
Set-Content -Path (Join-Path $stageDir "Start Desk Deck.bat") -Value $startBat -Encoding Ascii

# Stop Desk Deck.bat
$stopBat = @"
@echo off
cd /d "%~dp0"
echo Stopping Desk Deck...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process | Where-Object { `$_.CommandLine -like '*tray.ps1*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host 'Desk Deck has been stopped.' -ForegroundColor Green"
echo.
timeout /t 2 /nobreak >nul
"@
Set-Content -Path (Join-Path $stageDir "Stop Desk Deck.bat") -Value $stopBat -Encoding Ascii

# Enable Auto-Start on Boot.bat
$enableBat = @"
@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "`$appDir = (Get-Location).Path; `$vbsPath = Join-Path `$appDir 'deskdeck.vbs'; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'DeskDeck' -Value ('wscript.exe //B \"' + `$vbsPath + '\"'); `$ws = New-Object -ComObject WScript.Shell; `$sc = `$ws.CreateShortcut(\"`$([Environment]::GetFolderPath('Startup'))\Desk Deck.lnk\"); `$sc.TargetPath = 'wscript.exe'; `$sc.Arguments = '//B \"' + `$vbsPath + '\"'; `$sc.WorkingDirectory = `$appDir; `$sc.WindowStyle = 7; `$sc.Save(); Write-Host 'Desk Deck will now start automatically when you log into Windows!' -ForegroundColor Green"
echo.
pause
"@
Set-Content -Path (Join-Path $stageDir "Enable Auto-Start on Boot.bat") -Value $enableBat -Encoding Ascii

# Disable Auto-Start.bat
$disableBat = @"
@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "`$scPath = \"`$([Environment]::GetFolderPath('Startup'))\Desk Deck.lnk\"; if (Test-Path `$scPath) { Remove-Item `$scPath -Force }; Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'DeskDeck' -ErrorAction SilentlyContinue; Write-Host 'Desk Deck auto-start has been disabled.' -ForegroundColor Yellow"
echo.
pause
"@
Set-Content -Path (Join-Path $stageDir "Disable Auto-Start.bat") -Value $disableBat -Encoding Ascii

# HOW TO USE.txt
$readmeTxt = @"
================================================================================
                           DESK DECK (PORTABLE)
================================================================================

No installation or Node.js required!

HOW TO RUN:
1. Double-click "Start Desk Deck.bat".
   - Desk Deck will start in your Windows system tray.
   - It will automatically open http://127.0.0.1:4321 in your browser.

2. Open on your Phone (same Wi-Fi):
   - Right-click the Desk Deck icon in your system tray (bottom-right taskbar).
   - Click "Copy Phone URL" to get your local network address (e.g. http://192.168.1.xxx:4321).
   - Open that address in Chrome on your phone!

AUTO-START WITH WINDOWS:
- Double-click "Enable Auto-Start on Boot.bat" to start automatically on login.
- To disable later, double-click "Disable Auto-Start.bat".

STOPPING DESK DECK:
- Right-click the tray icon and choose "Exit Desk Deck", or
- Double-click "Stop Desk Deck.bat".

================================================================================
"@
Set-Content -Path (Join-Path $stageDir "HOW TO USE.txt") -Value $readmeTxt -Encoding Ascii

# 4. Create ZIP archive
Write-Host "Creating ZIP archive: $zipPath..." -ForegroundColor Cyan
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$stageDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

$zipSizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Done! Portable package created: $zipPath ($zipSizeMb MB)" -ForegroundColor Green
