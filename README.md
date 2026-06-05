# 青空読書 (Aozora Viewer)

青空文庫の作品を検索・閲覧・読み上げることができる、Electronベースのデスクトップアプリケーションです。
古書のようなベージュ系の背景に、エア草子風の縦書き表示で快適に読書を楽しむことができます。

## 主な機能
- **高速な検索**: ローカルの `aozora_books.csv` を使用し、作品名や著者名で瞬時に検索可能。
- **縦書き表示**: CSSの `writing-mode` を活用した、右から左へ流れる美しい縦書きレイアウト。
- **読み上げ (TTS)**: Web Speech API を利用し、選択した作品を自動で読み上げ。
- **CORS制限なし**: Electronを採用することでブラウザのセキュリティ制限を回避し、青空文庫から直接データを取得。
- **目に優しいデザイン**: 古書をイメージしたベージュ基調の落ち着いた配色。

## 必要条件
- [Node.js](https://nodejs.org/) (LTS推奨)
- [npm](https://www.npmjs.com/) (Node.jsに同梱)

## セットアップと実行

### 1. リポジトリの準備
このフォルダ（`aozora`）に移動します。

### 2. 依存関係のインストール
以下のコマンドを実行して、Electronをインストールします。

```bash
npm install
```

### 3. アプリケーションの起動
以下のコマンドでアプリを起動します。

```bash
npm start
```

## ビルド方法（実行ファイルの作成）

実行可能なバイナリ（.exe や .app）を作成するには、`electron-builder` などのツールを使用します。

### 1. ツールをインストール
```bash
npm install --save-dev electron-builder
```

### 2. ビルドの実行
ターゲットとするOSの環境で実行することが推奨されます。

```bash
# Windows向け (Windows環境で実行、またはLinux環境では wine が必要)
npx electron-builder --win

# macOS向け (macOS環境のみ可能)
npx electron-builder --mac

# Linux向け
npx electron-builder --linux
```

**Linux環境からWindows向けにビルドする場合の注意:**
上記のエラー（`wine is required`）が発生した場合は、システムに `wine` をインストールする必要があります。
- Ubuntu/Debian: `sudo apt install wine`
- その他のOS: 各パッケージマネージャーで `wine` をインストールしてください。

※ ビルド成果物は `dist` フォルダに生成されます。

## 使用しているデータ・API
- **作品リスト**: [青空文庫 公開中作家別作品一覧](https://www.aozora.gr.jp/index_pages/person_all.html) のCSVデータを使用。
- **本文データ**: [青空文庫](https://www.aozora.gr.jp/) の公式サイトより直接取得。

## ライセンス
このソフトウェアは、青空文庫の利用規約および各作品の著作権の状態に従って利用してください。
