Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\code\phone_dock"
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\code\phone_dock\tray.ps1""", 0, False
