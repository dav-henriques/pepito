# ---------------------------------------------------------------------------
#  Servidor estático mínimo (Windows, sem Node/Python).
#  Uso:  powershell -ExecutionPolicy Bypass -File tools/serve.ps1 [-Port 5173]
#  Depois abra http://localhost:5173
#
#  Obs.: o jogo também funciona abrindo o index.html direto (duplo clique),
#  este servidor é só uma conveniência para testar como se estivesse hospedado.
# ---------------------------------------------------------------------------
param(
  [int]$Port = 5173,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$Root = [IO.Path]::GetFullPath($Root)
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.webp' = 'image/webp'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.md' = 'text/plain; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servindo $Root em http://localhost:$Port/  (Ctrl+C para parar)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $path.TrimStart('/')))
    if (-not $full.StartsWith($Root) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('404')
    } else {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($full)
    }
    $res.Headers.Add('Cache-Control', 'no-store')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    Write-Host "Erro: $_"
  } finally {
    $res.Close()
  }
}
