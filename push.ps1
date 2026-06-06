# YMB Schedule Builder - Push スクリプト
# バージョンを +1 してコミット → GitHub へプッシュ

$ErrorActionPreference = 'Stop'

Write-Host "=== YMB Schedule Builder Push ===" -ForegroundColor Cyan
Write-Host ""

# バージョンインクリメント
Write-Host "バージョンをインクリメント中..." -ForegroundColor Cyan
node scripts/bump-version.js

# package.json をステージ＆コミット
$version = (Get-Content package.json | ConvertFrom-Json).version
git add package.json
git commit -m "chore: v$version (version bump)"

Write-Host ""
Write-Host "プッシュ中..." -ForegroundColor Cyan
git push origin master

Write-Host ""
Write-Host "=== 完了: v$version をプッシュしました ===" -ForegroundColor Green
