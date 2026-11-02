Add-Type -AssemblyName System.Drawing

function Render-StreamDeckFrame([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = $size / 32.0

    # 1. Beveled Chassis
    $pad = 1.5 * $scale
    $w = $size - (3.0 * $scale)
    $r = 5.0 * $scale

    $chassis = New-Object System.Drawing.Drawing2D.GraphicsPath
    $chassis.AddArc($pad, $pad, $r * 2, $r * 2, 180, 90)
    $chassis.AddArc($pad + $w - ($r * 2), $pad, $r * 2, $r * 2, 270, 90)
    $chassis.AddArc($pad + $w - ($r * 2), $pad + $w - ($r * 2), $r * 2, $r * 2, 0, 90)
    $chassis.AddArc($pad, $pad + $w - ($r * 2), $r * 2, $r * 2, 90, 90)
    $chassis.CloseFigure()

    # Deep dark slate chassis fill
    $chassisBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
    $g.FillPath($chassisBrush, $chassis)

    # Crisp metallic border
    $chassisBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 100, 116, 139), [Math]::Max(1.0, 1.2 * $scale))
    $g.DrawPath($chassisBorder, $chassis)

    # 2. Four Backlit Tactile Keycaps (Desk Deck Modes)
    # Top-Left:  Cyan / Sky 400 (PC Stats & Telemetry)
    # Top-Right: Azure / Indigo 400 (Clock & Ambient)
    # Bot-Left:  Amber / Orange 400 (Weather Forecast)
    # Bot-Right: Emerald / Green 400 (Stream Deck Actions)
    $keys = @(
        @{ x = 5.0 * $scale; y = 5.0 * $scale; c = [System.Drawing.Color]::FromArgb(255, 56, 189, 248);  border = [System.Drawing.Color]::FromArgb(255, 186, 230, 253) },
        @{ x = 17.5 * $scale; y = 5.0 * $scale; c = [System.Drawing.Color]::FromArgb(255, 129, 140, 248); border = [System.Drawing.Color]::FromArgb(255, 199, 210, 254) },
        @{ x = 5.0 * $scale; y = 17.5 * $scale; c = [System.Drawing.Color]::FromArgb(255, 251, 146, 60);  border = [System.Drawing.Color]::FromArgb(255, 254, 215, 170) },
        @{ x = 17.5 * $scale; y = 17.5 * $scale; c = [System.Drawing.Color]::FromArgb(255, 52, 211, 153);  border = [System.Drawing.Color]::FromArgb(255, 167, 243, 208) }
    )

    $kw = 9.5 * $scale
    $kr = 2.2 * $scale

    foreach ($k in $keys) {
        $kp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $kp.AddArc($k.x, $k.y, $kr * 2, $kr * 2, 180, 90)
        $kp.AddArc($k.x + $kw - ($kr * 2), $k.y, $kr * 2, $kr * 2, 270, 90)
        $kp.AddArc($k.x + $kw - ($kr * 2), $k.y + $kw - ($kr * 2), $kr * 2, $kr * 2, 0, 90)
        $kp.AddArc($k.x, $k.y + $kw - ($kr * 2), $kr * 2, $kr * 2, 90, 90)
        $kp.CloseFigure()

        $kb = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, $k.c.R, $k.c.G, $k.c.B))
        $g.FillPath($kb, $kp)

        $kpBorder = New-Object System.Drawing.Pen($k.border, [Math]::Max(1.0, 1.2 * $scale))
        $g.DrawPath($kpBorder, $kp)
    }

    $g.Dispose()
    return $bmp
}

function Build-MultiDIBIcon([System.Drawing.Bitmap[]]$srcList, [string]$outPath) {
    $fs = [System.IO.File]::Create($outPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([uint16]0)
    $bw.Write([uint16]1) # Icon
    $bw.Write([uint16]$srcList.Count)

    $offset = 6 + (16 * $srcList.Count)
    $frames = @()

    foreach ($src in $srcList) {
        $w = $src.Width
        $h = $src.Height
        $andRowBytes = [Math]::Ceiling($w / 32.0) * 4
        $imageSize = 40 + ($w * $h * 4) + ($andRowBytes * $h)

        $bw.Write([byte]$w)
        $bw.Write([byte]$h)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
        $bw.Write([uint32]$imageSize)
        $bw.Write([uint32]$offset)

        $offset += $imageSize

        $ms = New-Object System.IO.MemoryStream
        $fbw = New-Object System.IO.BinaryWriter($ms)

        $fbw.Write([uint32]40)
        $fbw.Write([int32]$w)
        $fbw.Write([int32]($h * 2))
        $fbw.Write([uint16]1)
        $fbw.Write([uint16]32)
        $fbw.Write([uint32]0)
        $fbw.Write([uint32]($w * $h * 4))
        $fbw.Write([int32]0)
        $fbw.Write([int32]0)
        $fbw.Write([uint32]0)
        $fbw.Write([uint32]0)

        for ($y = $h - 1; $y -ge 0; $y--) {
            for ($x = 0; $x -lt $w; $x++) {
                $c = $src.GetPixel($x, $y)
                $fbw.Write([byte]$c.B)
                $fbw.Write([byte]$c.G)
                $fbw.Write([byte]$c.R)
                $fbw.Write([byte]$c.A)
            }
        }

        $andMask = New-Object byte[] ($andRowBytes * $h)
        for ($y = 0; $y -lt $h; $y++) {
            for ($x = 0; $x -lt $w; $x++) {
                $c = $src.GetPixel($x, ($h - 1 - $y))
                if ($c.A -eq 0) {
                    $byteIdx = ($y * $andRowBytes) + [Math]::Floor($x / 8.0)
                    $bitIdx = 7 - ($x % 8)
                    $andMask[$byteIdx] = $andMask[$byteIdx] -bor (1 -shl $bitIdx)
                }
            }
        }
        $fbw.Write($andMask)
        $frames += ,$ms.ToArray()
        $fbw.Close()
        $ms.Dispose()
    }

    foreach ($f in $frames) {
        $bw.Write($f)
    }

    $bw.Close()
    $fs.Close()
}

$bmp16 = Render-StreamDeckFrame 16
$bmp32 = Render-StreamDeckFrame 32
$outPath = 'C:\code\phone_dock\public\favicon.ico'

Build-MultiDIBIcon @($bmp16, $bmp32) $outPath

$bmp16.Dispose()
$bmp32.Dispose()

Write-Output "Successfully built native multi-res icon at $outPath"
