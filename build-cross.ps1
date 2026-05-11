# schedule_builder - Cross-build helper (Win + Mac)
# 開発者モードの確認 → 古いキャッシュ削除 → ビルド実行

$ErrorActionPreference = 'Stop'

Write-Host "=== schedule_builder Cross-Build ===" -ForegroundColor Cyan
Write-Host ""

# 開発者モード判定
$devMode = $null
try {
    $devMode = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
} catch {}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

if ($devMode -ne 1 -and -not $isAdmin) {
    Write-Host "[NG] 開発者モード OFF / 管理者でもありません" -ForegroundColor Red
    Write-Host ""
    Write-Host "winCodeSign アーカイブの展開にシンボリックリンク作成権限が必要です。" -ForegroundColor Yellow
    Write-Host "以下のいずれかを実施してください：" -ForegroundColor Yellow
    Write-Host "  A) 設定 → プライバシーとセキュリティ → 開発者向け → 開発者モード を ON" -ForegroundColor White
    Write-Host "  B) PowerShell を管理者として起動して、このスクリプトを再実行" -ForegroundColor White
    exit 1
}

if ($devMode -eq 1) {
    Write-Host "[OK] 開発者モード ON を検出" -ForegroundColor Green
} elseif ($isAdmin) {
    Write-Host "[OK] 管理者権限で実行中" -ForegroundColor Green
}

# 失敗の残骸を残した winCodeSign キャッシュを削除
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
if (Test-Path $cacheDir) {
    Write-Host ""
    Write-Host "古い winCodeSign キャッシュを削除..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force $cacheDir
    Write-Host "削除完了" -ForegroundColor Green
}

# 既存の dist もクリア
$distDir = Join-Path $PSScriptRoot "dist"
if (Test-Path $distDir) {
    Write-Host "古い dist を削除..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force $distDir
}

Write-Host ""
$target = $args[0]
switch ($target) {
    'win' {
        Write-Host "Windows をビルドします..." -ForegroundColor Cyan
        npm run build:win
    }
    'mac' {
        Write-Host "Mac をビルドします（Windows 上ではクロスビルド扱い、追加ツールが必要な場合あり）..." -ForegroundColor Cyan
        npm run build:mac
    }
    default {
        Write-Host "Windows をビルドします（Mac は macOS 上でしかビルドできません）..." -ForegroundColor Cyan
        npm run build:win
    }
}

Write-Host ""
Write-Host "=== ビルド完了 ===" -ForegroundColor Green
Write-Host "成果物: $distDir" -ForegroundColor White
Get-ChildItem $distDir -File | Where-Object { $_.Extension -in '.exe', '.dmg', '.zip' } | Select-Object Name, @{N='Size(MB)';E={[Math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
