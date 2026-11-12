param(
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$prefix = "http://127.0.0.1:8765/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Nao foi possivel iniciar o servidor local na porta 8765."
    Write-Host $_.Exception.Message
    Read-Host "Pressione Enter para fechar"
    exit 1
}

$contentTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".js"   = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".webp" = "image/webp"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

Write-Host "Aplicacao disponivel em $prefix"
Write-Host "Mantenha esta janela aberta enquanto usa a aplicacao."
if (-not $NoLaunch) {
    Start-Process $prefix
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response

        try {
            if ($context.Request.HttpMethod -ne "GET" -and $context.Request.HttpMethod -ne "HEAD") {
                $response.StatusCode = 405
            } else {
                $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
                if ([string]::IsNullOrWhiteSpace($relativePath)) {
                    $relativePath = "index.html"
                }

                $relativePath = $relativePath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
                $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
                $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
                $separator = [System.IO.Path]::DirectorySeparatorChar
                $allowedFolders = @("IMG", "css", "js") | ForEach-Object { $_ + $separator }
                $isAllowedFile = $relativePath -eq "index.html"
                foreach ($folder in $allowedFolders) {
                    if ($relativePath.StartsWith($folder, [System.StringComparison]::OrdinalIgnoreCase)) { $isAllowedFile = $true }
                }

                if (-not $isAllowedFile -or -not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                    $response.StatusCode = 404
                } else {
                    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                    if ($contentTypes.ContainsKey($extension)) {
                        $response.ContentType = $contentTypes[$extension]
                    } else {
                        $response.ContentType = "application/octet-stream"
                    }

                    $response.Headers["Cache-Control"] = "no-store"
                    if ($context.Request.HttpMethod -eq "GET") {
                        $bytes = [System.IO.File]::ReadAllBytes($filePath)
                        $response.ContentLength64 = $bytes.Length
                        $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    }
                }
            }
        } catch {
            $response.StatusCode = 500
            Write-Host "Erro ao atender uma solicitacao: $($_.Exception.Message)"
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
