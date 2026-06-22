# YMB Schedule Builder

ガントチャート式スケジュール作成アプリ（Windows / macOS 対応デスクトップアプリ）。
工程・担当・営業日数を入力するだけで、ガントチャートを自動生成します。
プロジェクトファイルへの保存、Excel（横方向 / 縦方向）への出力に対応しています。

---

## 主な機能

- **ガントチャート自動生成** — 工程の開始日・終了日をリアルタイムで描画
- **営業日計算** — 土日・祝日を除いた営業日ベースでスケジュールを算出
- **祝日自動取得** — インターネットから日本の祝日データを取得して反映
- **担当マスタ管理** — 担当者を自由に追加・編集・削除
- **工程カラー設定** — プリセット18色 + OS ネイティブカラーピッカーで色指定
- **Excel 出力（横方向 / 縦方向）** — 日付軸を列 or 行に展開した2種類のレイアウトで出力
- **最近使ったファイル** — 直近8件を記録してメニューからすぐに開ける
- **自動保存** — 編集内容を自動保存し、次回起動時に前回のデータを復元
- **ドラッグ＆ドロップ** — 工程の並び順をドラッグで変更

---

## 開発環境のセットアップ

### 必要なもの

- [Node.js](https://nodejs.org/) LTS 版

### セットアップ（Windows）

```powershell
# 依存パッケージのインストール（Node.js が未インストールの場合は自動で導入）
.\setup.ps1

# 開発モードで起動
npm start
```

### セットアップ（macOS / Linux）

```bash
npm install
npm start
```

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | [Electron](https://www.electronjs.org/) v33 |
| UI | HTML / CSS / Vanilla JavaScript |
| Excel 出力 | [ExcelJS](https://github.com/exceljs/exceljs) v4 |
| ビルドツール | [electron-builder](https://www.electron.build/) v25 |
| 祝日データ | [holidays-jp.github.io](https://holidays-jp.github.io/) |

---

## ダウンロード

[Releases](../../releases) から最新版をダウンロードしてください。push 毎に GitHub Actions が自動ビルド・公開します。

### Windows

| ファイル | 説明 |
|---|---|
| `YMB Schedule Builder Setup x.x.x.exe` | インストーラ版（スタートメニュー登録） |
| `YMB Schedule Builder x.x.x.exe` | ポータブル版（インストール不要） |

> コード署名をしていないため、インストール・起動時に **Windows Defender SmartScreen** が警告を表示する場合があります。
> 「詳細情報」→「実行」を選択してください。

### macOS

| ファイル | 説明 |
|---|---|
| `YMB Schedule Builder-x.x.x.dmg` | Intel Mac 用（x64） |
| `YMB Schedule Builder-x.x.x-arm64.dmg` | Apple Silicon 用（M1 / M2 / M3） |

> macOS では初回起動時に「開発元が未確認」と表示される場合があります。
> Finder でファイルを右クリック →「開く」を選択してください。

---

## ライセンス

[MIT License](./LICENSE) © 2026 ymb
