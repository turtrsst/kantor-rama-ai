Add-Type -AssemblyName System.Drawing

$root = '\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders'
$diffuse = [System.Drawing.Bitmap]::FromFile((Join-Path $root 'sample_server_rack_diffuse.png'))
$emission = [System.Drawing.Bitmap]::FromFile((Join-Path $root 'sample_server_rack_emission.png'))
$preview = New-Object System.Drawing.Bitmap(320, 224)
$g = [System.Drawing.Graphics]::FromImage($preview)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#172039'))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.DrawImage($diffuse, 32, 16, 256, 384)
$g.DrawImage($emission, 32, 16, 256, 384)

# White frame at intended 64x96 asset bounds, scaled x4 but clipped to preview crop.
$pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#00f5d4'), 1)
$g.DrawRectangle($pen, 31, 15, 258, 386)
$g.Dispose(); $pen.Dispose(); $diffuse.Dispose(); $emission.Dispose()
$preview.Save((Join-Path $root 'sample_server_rack_preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()
