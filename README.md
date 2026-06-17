# 青空読書 (Aozora Viewer)

青空文庫の作品を検索・閲覧・読み上げることができる、Flutterベースのマルチプラットフォーム（Windows, macOS, iOS, Android）アプリケーションです。
Material 3 に準拠したモダンで目に優しいダークテーマと、美しい和風明朝フォント（さわらび明朝）を組み込み、快適な読書空間を提供します。

## 主な機能
- **マルチプラットフォーム対応**: Flutter の強みを活かし、PC（Windows, macOS）とモバイル（iOS, Android）の両方に対応。
- **超高速な書籍検索**: ローカルに内蔵された `aozora_books.csv` データベースを瞬時にパース・インクリメンタル検索。
- **オフライン対応（自動キャッシュ）**: 一度読み込んだ作品は端末内に自動保存されるため、次回からはインターネット接続がない環境（オフライン）でも読書が可能です。
- **しおり（読書進捗）保存**: 各作品のスクロール位置（読了率%）を自動で保存・管理。いつでもしおりを挟んだ位置から読書を再開できます。
- **音声読み上げ (TTS)**: プラットフォームネイティブの高性能TTS（音声合成）エンジンを使用し、ハンズフリーで小説の朗読を聴くことができます。
- **目に優しいダークデザイン**: 読書時の目の疲労を軽減するため、コントラストを調整した美しいダークテーマを採用。

## 必要条件
- [Flutter SDK](https://flutter.dev/docs/get-started/install) (推奨: v3.19.0 以上)
- [Dart SDK](https://dart.dev/)

## セットアップと実行

### 1. 依存関係の解決
リポジトリのルートディレクトリで以下のコマンドを実行します。

```bash
flutter pub get
```

### 2. アプリケーションの起動
任意のデバイスまたはシミュレーターを起動し、以下のコマンドを実行します。

```bash
flutter run
```

### 3. テストの実行
```bash
flutter test
```

## 各プラットフォーム向けビルド方法

### Windows
```bash
flutter build windows --release
```
※ ビルドされた成果物は `build/windows/x64/runner/Release/` に出力されます。

### macOS
```bash
flutter build macos --release
```
※ ビルドされた成果物は `build/macos/Build/Products/Release/` に出力されます。

### Android
```bash
flutter build apk --release
```

### iOS
```bash
flutter build ios --release
```

## CI/CD (自動ビルドとリリース)
GitHub Actions が設定されており、リポジトリに `v*`（例: `v1.2.0`）形式のバージョンタグをプッシュすると、GitHub Runners 上で Windows / macOS 向けのリリースビルドが自動で実行され、成果物が GitHub Releases に自動アップロードされます。

## 使用しているデータ・API
- **作品リスト**: [青空文庫API用データ](https://docs.google.com/spreadsheets/d/1n04e6POI04TBt-3HJUH10-T5cxhPZHcBWmFA4tSHjqE/edit?gid=288090143#gid=288090143) のCSVデータ (`aozora_books.csv`)。
- **本文データ**: [青空文庫](https://www.aozora.gr.jp/) の公式サイトより直接取得（Shift_JIS自動デコード対応）。
