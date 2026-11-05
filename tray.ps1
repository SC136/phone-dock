# Desk Deck Windows System Tray Host
# Runs the server in the background and keeps a persistent icon in the taskbar.

[CmdletBinding()]
param()

$mutex = New-Object System.Threading.Mutex($false, "Global\DeskDeckTrayMutex")
if (-not $mutex.WaitOne(0, $false)) {
    exit
}

# The mutex only covers this session; a second host can still appear from another
# desktop/elevation, and two watchdogs spawn duplicate servers. Refuse to run alongside one.
$otherHost = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*phone_dock*' -and
    $_.CommandLine -like '*tray.ps1*' -and $_.ProcessId -ne $PID
}
if ($otherHost) { exit }

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class WinDpiAwareness {
  public static IntPtr PerMonitorAwareV2 { get { return new IntPtr(-4); } }
  public static IntPtr PerMonitorAware { get { return new IntPtr(-3); } }

  [DllImport("user32.dll")]
  public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

  [DllImport("shcore.dll")]
  public static extern int SetProcessDpiAwareness(int value);

  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();
}
"@

function Enable-HighDpiAwareness {
  foreach ($ctx in @([WinDpiAwareness]::PerMonitorAwareV2, [WinDpiAwareness]::PerMonitorAware)) {
    try {
      if ([WinDpiAwareness]::SetProcessDpiAwarenessContext($ctx)) { break }
    } catch {}
  }
  try { [WinDpiAwareness]::SetProcessDpiAwareness(2) | Out-Null } catch {}
  try { [WinDpiAwareness]::SetProcessDPIAware() | Out-Null } catch {}
}

Enable-HighDpiAwareness

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

$root = $PSScriptRoot
if (-not $root -or -not (Test-Path $root)) { $root = (Get-Location).Path }
Set-Location $root

$nodeExe = Join-Path $root 'node.exe'
if (-not (Test-Path $nodeExe)) { $nodeExe = Join-Path $root 'bin\node.exe' }
if (-not (Test-Path $nodeExe)) { $nodeExe = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $nodeExe)) {
    $nodeCmd = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($nodeCmd) { $nodeExe = $nodeCmd } else { $nodeExe = 'node' }
}

function Get-LanUrl {
    try {
        $ips = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' }).IPAddress
        if (-not $ips) {
            $ips = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' }).IPAddress
        }
        $first = $ips | Select-Object -First 1
        if ($first) { return "http://$($first):4321" }
    } catch {}
    return "http://127.0.0.1:4321"
}

# The OS TCP table is unreliable on this machine (it reports no listener while the
# server answers fine), so "is the server up?" is asked over HTTP instead.
function Test-ServerUp {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4321/api/stats" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

$script:serverProc = $null
if (-not (Test-ServerUp)) {
    $script:serverProc = Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru
} else {
    try {
        $owner = (Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue).OwningProcess
        if ($owner) { $script:serverProc = Get-Process -Id $owner -ErrorAction SilentlyContinue }
    } catch {}
}

# Set up Tray Icon
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Text = "Desk Deck"

$icoPath = Join-Path $root "public\favicon.ico"
if (Test-Path $icoPath) {
    try {
        $notify.Icon = New-Object System.Drawing.Icon($icoPath)
    } catch {
        $notify.Icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip

# 1. Open Dashboard
$itemDash = $menu.Items.Add("Open Dashboard")
$itemDash.Font = New-Object System.Drawing.Font($itemDash.Font, [System.Drawing.FontStyle]::Bold)
$itemDash.Add_Click({
    Start-Process "http://127.0.0.1:4321"
})

# 2. Copy Phone URL
$itemCopy = $menu.Items.Add("Copy Phone URL")
$itemCopy.Add_Click({
    $url = Get-LanUrl
    [System.Windows.Forms.Clipboard]::SetText($url)
    $notify.ShowBalloonTip(2000, "Desk Deck", "Copied to clipboard:`n$url", [System.Windows.Forms.ToolTipIcon]::Info)
})

# 3. Open Phone URL in Browser
$itemOpenPhone = $menu.Items.Add("Open Phone URL")
$itemOpenPhone.Add_Click({
    $url = Get-LanUrl
    Start-Process $url
})

$menu.Items.Add("-") | Out-Null

# 4. Restart Server
$itemRestart = $menu.Items.Add("Restart Server")
$itemRestart.Add_Click({
    if ($script:serverProc -and -not $script:serverProc.HasExited) {
        Stop-Process -Id $script:serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 600
    $script:serverProc = Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru
    $notify.ShowBalloonTip(2000, "Desk Deck", "Server restarted.", [System.Windows.Forms.ToolTipIcon]::Info)
})

$menu.Items.Add("-") | Out-Null

# Watchdog: restarts the server only if it has exited and does not answer over HTTP.
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({
    if (-not $script:serverProc -or $script:serverProc.HasExited) {
        if (-not (Test-ServerUp)) {
            $script:serverProc = Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru
        }
    }
})
$timer.Start()

# 5. Exit
$itemExit = $menu.Items.Add("Exit Desk Deck")
$itemExit.Add_Click({
    $timer.Stop()
    $timer.Dispose()
    if ($script:serverProc -and -not $script:serverProc.HasExited) {
        Stop-Process -Id $script:serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    $notify.Visible = $false
    $notify.Dispose()
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    [System.Windows.Forms.Application]::Exit()
})

$notify.ContextMenuStrip = $menu
$notify.Add_DoubleClick({
    Start-Process "http://127.0.0.1:4321"
})

$notify.Visible = $true
$lanUrl = Get-LanUrl
$notify.ShowBalloonTip(3000, "Desk Deck Running", "Dashboard: http://127.0.0.1:4321`nPhone: $lanUrl`nRight-click tray icon to manage.", [System.Windows.Forms.ToolTipIcon]::Info)

[System.Windows.Forms.Application]::Run()
