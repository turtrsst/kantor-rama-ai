Add-Type -AssemblyName System.Drawing

$width = 64
$height = 96

# --- 1. DIFFUSE BITMAP ---
$diffuse = New-Object System.Drawing.Bitmap($width, $height)
$gDiff = [System.Drawing.Graphics]::FromImage($diffuse)
$gDiff.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gDiff.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gDiff.Clear([System.Drawing.Color]::Transparent)

# Drop shadow beneath rack base (y = 80..86)
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
$gDiff.FillEllipse($shadowBrush, 4, 76, 56, 12)
$shadowBrush.Dispose()

# Slim charcoal chassis, framed in a 3/4 top-down silhouette.
# The 64x96 frame keeps atlas compatibility; the rack itself occupies x=18..46.
$chassisDark = [System.Drawing.ColorTranslator]::FromHtml('#0d1014')
$chassisBase = [System.Drawing.ColorTranslator]::FromHtml('#202328')
$chassisLight = [System.Drawing.ColorTranslator]::FromHtml('#3a3d42')
$chassisEdge = [System.Drawing.ColorTranslator]::FromHtml('#5a5d63')

$bEdge = New-Object System.Drawing.SolidBrush($chassisEdge)
$bDark = New-Object System.Drawing.SolidBrush($chassisDark)
$bBase = New-Object System.Drawing.SolidBrush($chassisBase)
$bLight = New-Object System.Drawing.SolidBrush($chassisLight)

# Slim outer chassis, 28px wide and tall.
$gDiff.FillRectangle($bEdge, 18, 12, 28, 68)
$gDiff.FillRectangle($bDark, 19, 13, 26, 66)
$gDiff.FillRectangle($bBase, 20, 14, 24, 64)

# Visible top plane: stepped rear overhang creates oblique 3/4 depth.
$gDiff.FillRectangle($bLight, 17, 8, 30, 5)
$gDiff.FillRectangle($bEdge, 19, 6, 26, 2)
$gDiff.FillRectangle($bBase, 21, 4, 22, 2)
$gDiff.FillRectangle($bLight, 20, 14, 2, 64)
$gDiff.FillRectangle($bEdge, 42, 14, 2, 64)

# Rack blades: dense vertical bays, each with compact indicator clusters.
$bladeBase = [System.Drawing.ColorTranslator]::FromHtml('#15171a')
$bladeLine = [System.Drawing.ColorTranslator]::FromHtml('#292c30')
$bladeHigh = [System.Drawing.ColorTranslator]::FromHtml('#4b4f55')
$bBlade = New-Object System.Drawing.SolidBrush($bladeBase)
$bBLine = New-Object System.Drawing.SolidBrush($bladeLine)
$bBHigh = New-Object System.Drawing.SolidBrush($bladeHigh)

for ($i = 0; $i -lt 10; $i++) {
    $sy = 16 + ($i * 6)
    $gDiff.FillRectangle($bBlade, 22, $sy, 20, 4)
    $gDiff.FillRectangle($bBLine, 22, $sy + 3, 20, 1)
    $gDiff.FillRectangle($bBHigh, 22, $sy, 20, 1)
}

# Cable bundles: prominent, colorful coils leading from chassis to floor and ceiling.
$cBlue = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#2563eb'))
$cRed  = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#dc2626'))
$cGreen = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#16a34a'))

# Downward bundles (floor)
$gDiff.FillRectangle($cBlue, 14, 76, 4, 14)
$gDiff.FillRectangle($cRed, 10, 78, 4, 10)
$gDiff.FillRectangle($cGreen, 48, 76, 6, 12)

# Upward bundle (ceiling/rear)
$gDiff.FillRectangle($cBlue, 20, 0, 4, 8)
$gDiff.FillRectangle($cGreen, 36, 0, 4, 8)

$gDiff.Dispose()
$bEdge.Dispose(); $bDark.Dispose(); $bBase.Dispose(); $bLight.Dispose()
$bBlade.Dispose(); $bBLine.Dispose(); $bBHigh.Dispose()
$cBlue.Dispose(); $cRed.Dispose(); $cGreen.Dispose()

$diffusePath = "\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\sample_server_rack_diffuse.png"
$diffuse.Save($diffusePath, [System.Drawing.Imaging.ImageFormat]::Png)
$diffuse.Dispose()

# --- 2. EMISSION BITMAP ---
$emission = New-Object System.Drawing.Bitmap($width, $height)
$gEm = [System.Drawing.Graphics]::FromImage($emission)
$gEm.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gEm.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gEm.Clear([System.Drawing.Color]::Transparent)

$cGreen = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#00ff88'))
$cCyan  = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#00e5ff'))
$cAmber = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffb703'))
$cRed   = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ff0055'))

# Place indicators in clustered patches across slots.
for ($i = 0; $i -lt 10; $i++) {
    $sy = 16 + ($i * 6)
    if ($i % 2 -eq 0) {
        $gEm.FillRectangle($cGreen, 36, $sy + 1, 2, 2)
        $gEm.FillRectangle($cCyan, 39, $sy + 1, 2, 2)
    } else {
        $gEm.FillRectangle($cRed, 36, $sy + 1, 2, 2)
        $gEm.FillRectangle($cGreen, 39, $sy + 1, 2, 2)
    }
}

# Emission from rear vertical cable gaps and top slot glow
$gEm.FillRectangle($cCyan, 20, 0, 1, 8)
$gEm.FillRectangle($cGreen, 42, 0, 1, 8)

$gEm.Dispose()
$cGreen.Dispose(); $cCyan.Dispose(); $cAmber.Dispose(); $cRed.Dispose()

$emissionPath = "\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\sample_server_rack_emission.png"
$emission.Save($emissionPath, [System.Drawing.Imaging.ImageFormat]::Png)
$emission.Dispose()

Write-Output "Assets created: $diffusePath and $emissionPath"
