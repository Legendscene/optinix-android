# Generates Optinix launcher icon / adaptive-icon / splash / mipmap PNGs from the
# workspace logo.png (NEVER modify the source logo — everything below is derived).
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/make-logo-assets.ps1
# Writes into:
#   - <repo>/assets/                    (referenced by app.json for future prebuilds)
#   - <repo>/android/app/src/main/res/  (manual res patch; android/ is generated)
#   - C:\O\android/app/src/main/res     (the build mirror used for release builds)
#
# PNG only: the existing ic_launcher*.webp files are deleted first so resource
# names are unique (webp + png with the same name = duplicate resource error).

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $repo
$sourceLogo = Join-Path $workspace 'logo.png'

$repoRes = Join-Path $repo 'android/app/src/main/res'
$mirrorRes = 'C:\O\android\app\src\main\res'
$assetsDir = Join-Path $repo 'assets'

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function ConvertFrom-HexColor([string]$hex) {
    $h = $hex.TrimStart('#')
    if ($h.Length -eq 6) {
        return [System.Drawing.Color]::FromArgb(
            255,
            [Convert]::ToInt32($h.Substring(0, 2), 16),
            [Convert]::ToInt32($h.Substring(2, 2), 16),
            [Convert]::ToInt32($h.Substring(4, 2), 16)
        )
    }
    return [System.Drawing.Color]::FromArgb(
        [Convert]::ToInt32($h.Substring(0, 2), 16),
        [Convert]::ToInt32($h.Substring(2, 2), 16),
        [Convert]::ToInt32($h.Substring(4, 2), 16),
        [Convert]::ToInt32($h.Substring(6, 2), 16)
    )
}

# --- 1. Glyph bounding box (logo has baked-in black margins) -------------------
$src = [System.Drawing.Bitmap]::new($sourceLogo)
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
$stride = 4
for ($y = 0; $y -lt $src.Height; $y += $stride) {
    for ($x = 0; $x -lt $src.Width; $x += $stride) {
        $p = $src.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 90) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
$src.Dispose()
"Glyph bbox: ($minX,$minY)-($maxX,$maxY) = $($maxX - $minX + 1) x $($maxY - $minY + 1) of $sourceLogo"
$glyphRect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX), ($maxY - $minY))

# --- 2. Canvas renderer ------------------------------------------------------
function New-CanvasImage([int]$size, [string]$bgHex, [double]$contentFraction, [string]$outPath) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    if ($bgHex) {
        $g.Clear((ConvertFrom-HexColor $bgHex))
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }
    # Fit the glyph bbox into contentFraction * size, centred.
    $content = [int][math]::Round($size * $contentFraction)
    $scale = [math]::Min($content / [double]$glyphRect.Width, $content / [double]$glyphRect.Height)
    $w = [int][math]::Round($glyphRect.Width * $scale)
    $h = [int][math]::Round($glyphRect.Height * $scale)
    $x = [int][math]::Floor(($size - $w) / 2)
    $y = [int][math]::Floor(($size - $h) / 2)
    $srcBitmap = [System.Drawing.Bitmap]::new($sourceLogo)
    $g.DrawImage($srcBitmap, (New-Object System.Drawing.Rectangle($x, $y, $w, $h)), $glyphRect, [System.Drawing.GraphicsUnit]::Pixel)
    $srcBitmap.Dispose()
    $g.Dispose()
    $dir = Split-Path -Parent $outPath
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    "wrote $outPath ($size px, fraction $contentFraction, bg $(if ($bgHex) { $bgHex } else { 'transparent' }))"
}

# --- 3.expo app.json assets --------------------------------------------------
New-CanvasImage 1024 '#000000' 0.76 (Join-Path $assetsDir 'icon.png')
New-CanvasImage 1024 $null     0.62 (Join-Path $assetsDir 'adaptive-icon.png')
New-CanvasImage 1024 $null     0.50 (Join-Path $assetsDir 'splash.png')

# --- 4. Res trees: legacy + adaptive mipmaps ---------------------------------
$roots = @($repoRes, $mirrorRes) | Where-Object { Test-Path $_ }
if (-not $roots) { throw 'No res roots found' }

$roundSizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
$fgSizes    = @{ 'mdpi' = 108; 'hdpi' = 162; 'xhdpi' = 216; 'xxhdpi' = 324; 'xxxhdpi' = 432 }

foreach ($root in $roots) {
    # Delete the generated webp launchers so PNG replaces them without duplicates.
    Get-ChildItem -Path "$root\mipmap-*" -Directory | ForEach-Object {
        Get-ChildItem -Path $_.FullName -Filter 'ic_launcher*.webp' -File -ErrorAction SilentlyContinue |
            Remove-Item -Force
    }

    foreach ($dirName in $roundSizes.Keys) {
        $size = $roundSizes[$dirName]
        New-CanvasImage $size '#000000' 0.80 (Join-Path "$root\mipmap-$dirName" 'ic_launcher.png')
        New-CanvasImage $size '#000000' 0.80 (Join-Path "$root\mipmap-$dirName" 'ic_launcher_round.png')
    }
    foreach ($dirName in $fgSizes.Keys) {
        $size = $fgSizes[$dirName]
        New-CanvasImage $size $null 0.62 (Join-Path "$root\mipmap-$dirName" 'ic_launcher_foreground.png')
    }

    # Adaptive icon XMLs (API 26+): black background + our logo foreground.
    $anydpi = Join-Path $root 'mipmap-anydpi-v26'
    New-Item -ItemType Directory -Force -Path $anydpi | Out-Null
    $adaptiveXml = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
'@
    $adaptiveXml | Set-Content -Path (Join-Path $anydpi 'ic_launcher.xml') -Encoding UTF8
    $adaptiveXml | Set-Content -Path (Join-Path $anydpi 'ic_launcher_round.xml') -Encoding UTF8
    "patched $anydpi"
}
"done"
