#!/usr/bin/env bash
# schedule_builder - macOS / Linux セットアップスクリプト
# Node.js 未インストールなら Homebrew (Mac) / nvm (Linux) で自動インストールを試みる

set -e

echo "=== schedule_builder セットアップ ==="

if command -v node >/dev/null 2>&1; then
    echo "Node.js 検出: $(node -v)"
else
    echo "Node.js が見つかりません。インストールを試みます..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew >/dev/null 2>&1; then
            echo "Homebrew が必要です。先に https://brew.sh からインストールしてください。"
            exit 1
        fi
        brew install node
    else
        # Linux: nvm 経由でインストール
        if [ ! -d "$HOME/.nvm" ]; then
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        fi
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install --lts
        nvm use --lts
    fi
    echo "Node.js インストール完了: $(node -v)"
fi

echo ""
echo "依存パッケージをインストールします (npm install)..."
npm install

echo ""
echo "=== セットアップ完了 ==="
echo "開発起動:       npm start"
echo "Mac 配布版:     npm run build:mac"
echo "Windows 配布版: npm run build:win  (※Windows上で実行)"
