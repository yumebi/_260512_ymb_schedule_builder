# schedule_builder - Windows セットアップスクリプト
# Node.js 未インストールなら winget で自動インストール → npm install → 開発起動可能な状態にする

$ErrorActionPreference = 'Stop'

function Test-Command($name) {
    $null = Get-Command $name -ErrorAction SilentlyContinue
    return $?
}

Write-Host "=== schedule_builder セットアップ ===" -ForegroundColor Cyan

# Node.js チェック
if (Test-Command 'node') {
    $nodeVer = (node -v)
    Write-Host "Node.js 検出: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "Node.js が見つかりません。winget でインストールを試みます..." -ForegroundColor Yellow
    if (-not (Test-Command 'winget')) {
        Write-Host "ERROR: winget が見つかりません。" -ForegroundColor Red
        Write-Host "Windows 10/11 の App Installer を最新化するか、https://nodejs.org/ から手動でインストールしてください。" -ForegroundColor Red
        exit 1
    }
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Write-Host ""
    Write-Host "Node.js をインストールしました。" -ForegroundColor Green
    Write-Host "★ 新しい PowerShell を開き直してから、もう一度 setup.ps1 を実行してください。" -ForegroundColor Yellow
    exit 0
}

# npm install
Write-Host ""
Write-Host "依存パッケージをインストールします (npm install)..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "=== セットアップ完了 ===" -ForegroundColor Green
Write-Host "開発起動:           npm start" -ForegroundColor White
Write-Host "Windows 配布版:     npm run build:win" -ForegroundColor White
Write-Host "Mac 配布版:         npm run build:mac" -ForegroundColor White
Write-Host "Win+Mac 同時ビルド: npm run build:all" -ForegroundColor White
Write-Host ""
Write-Host "※ Windows でインストーラ(.exe) や Mac dmg を作る場合、" -ForegroundColor Yellow
Write-Host "   署名ツール (winCodeSign) の展開にシンボリックリンク作成権限が必要です。" -ForegroundColor Yellow
Write-Host "   設定 → プライバシーとセキュリティ → 開発者向け → 開発者モード を ON にしてください。" -ForegroundColor Yellow
