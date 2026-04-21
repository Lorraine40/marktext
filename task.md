# MarkText 配布リンク安全化 実装タスク

このタスクは `plan.md` を実装用に細分化したものです。後続の AI エージェントは、ここに書かれた順序でファイル編集と検証に集中してください。

## 目的

Issue #4125 / #4047 で報告されている、公式に見えるが所有権や安全性が疑わしい導線を README、主要 docs、アプリ内メニュー、サンプル Markdown から取り除く。公式導線は GitHub repository と GitHub Releases に統一する。

## スコープ

### 実装対象

- `README.md`
- `docs/i18n/*.md`
- `src/main/menu/templates/help.js`
- `src/renderer/prefComponents/theme/theme.md`
- `package.json`
- `resources/linux/marktext.appdata.xml`

### 実装対象外

- `docs/OPEN_ISSUES_SUMMARY.md` は調査メモとして扱い、今回の PR 差分には含めない。
- `plan.md` と `task.md` は作業指示用ファイルとして扱い、実装 PR 差分には含めない。
- GitHub repository About、GitHub org profile など、maintainer 権限が必要な外部管理欄の変更はコード差分では行わない。
- macOS artifact の署名、notarization、Homebrew cask の deprecation 解消は別 PR とする。

## 実装前確認

- [ ] `git status --short` で既存の未追跡・変更ファイルを確認する。
- [ ] `plan.md` を UTF-8 として読み、今回の方針を再確認する。
- [ ] 次の検索で修正対象の現状を把握する。

```bash
rg -n --glob '!docs/OPEN_ISSUES_SUMMARY.md' "marktext\\.me|marktext\\.cc|https?://marktext\\.app|marktext\\.github\\.io/website|caskroom/homebrew-cask|releases/download/v0\\.17\\.1|downloads/marktext/marktext/v0\\.17\\.1" README.md docs src resources package.json electron-builder.yml .github
```

## Task 1: README の配布導線を GitHub Releases に統一する

対象: `README.md`

- [ ] ヘッダーの latest release ダウンロードバッジを `v0.17.1` 固定集計から外す。
  - 現状例: `https://img.shields.io/github/downloads/marktext/marktext/v0.17.1/total.svg`
  - 変更方針: `https://img.shields.io/github/downloads/marktext/marktext/total.svg` など、固定リリースを latest と誤認させない表現にする。
  - `alt` も `latest download` のままにせず、実態に合わせて `total downloads` などへ変更する。
- [ ] Download and Installation の OS 別ダウンロード表で、`releases/download/v0.17.1/...` の artifact 直リンクを削除する。
  - 各 OS のリンク先は `https://github.com/marktext/marktext/releases/latest` に統一する。
  - artifact 別 latest download バッジや `latest version` 表示も残さず、表の表示は `GitHub Releases` などの通常リンクへ簡素化する。
- [ ] macOS セクションから Homebrew cask を推奨導線として外す。
  - `https://github.com/caskroom/homebrew-cask` へのリンクを削除する。
  - `brew install --cask mark-text` のコードブロックは削除する。
  - macOS では GitHub Releases から取得すること、署名・notarization の警告は別途解決が必要な既知事項であることを短く明記する。
- [ ] Windows / Linux / Other の GitHub Releases 導線は維持する。
- [ ] README 内に `marktext.me`、`marktext.cc`、`marktext.app`、`marktext.github.io/website`、`caskroom/homebrew-cask`、`releases/download/v0.17.1`、`downloads/marktext/marktext/v0.17.1` が残っていないことを確認する。

## Task 2: 翻訳 README のリンクを英語 README と同じ安全方針に揃える

対象: `docs/i18n/*.md`

- [ ] `marktext.github.io/website` を公式サイト扱いしているリンクを GitHub repository / anchors に置換する。
  - `Website`: `https://github.com/marktext/marktext`
  - `Features`: `https://github.com/marktext/marktext#features`
  - `Downloads`: `https://github.com/marktext/marktext#download-and-installation`
  - `Development`: `https://github.com/marktext/marktext#development`
  - `Contribution`: `https://github.com/marktext/marktext#contribution`
  - 既存が `#features` のような相対 anchor でも、英語 README と同じ absolute GitHub anchor に正規化する。
  - badge wrapper の `href="https://marktext.github.io/website"` も残さず、英語 README と同じく GitHub repository / releases / ローカル license など実態に合うリンクへ揃える。
- [ ] 各翻訳のヘッダーにある `v0.17.1` 固定ダウンロードバッジを固定リリースではない表現に変更する。
  - 英語 README と同じ URL・同じ `alt` 方針に揃える。
- [ ] 各翻訳の OS 別ダウンロード表にある `releases/download/v0.17.1/...` の artifact 直リンクを削除する。
  - リンク先は `https://github.com/marktext/marktext/releases/latest` に統一する。
  - artifact 別 latest download バッジや `latest version` / 各言語の同等表現も残さず、英語 README と同じく通常リンクへ簡素化する。
  - 翻訳本文の品質改善は深追いしない。安全上の意味とリンク先が英語 README と一致すればよい。
- [ ] 各翻訳の macOS セクションから Homebrew cask 推奨文と `https://github.com/caskroom/homebrew-cask` を削除する。
  - 可能なら各言語で「GitHub Releases からダウンロードする」内容へ最小置換する。
  - 翻訳が難しい場合は、既存文を短く残しつつ危険な Homebrew cask 導線だけを削る。
  - `brew install --cask mark-text` のコードブロックや `Homebrew-Cask` の導入案内は残さない。
  - `../../docs/brew-cask.gif` など Homebrew cask 導線の画像参照も削除する。
- [ ] Arabic の HTML table 形式など、Markdown 表と構造が異なる翻訳も同じ方針で処理する。
- [ ] `docs/i18n` 内に `marktext.github.io/website`、`caskroom/homebrew-cask`、`releases/download/v0.17.1`、`downloads/marktext/marktext/v0.17.1` が残っていないことを確認する。

## Task 3: Help メニューの GitHub 導線を明確化する

対象: `src/main/menu/templates/help.js`

- [ ] `Website...` のラベルを `Project on GitHub...` に変更する。
  - URL は `https://github.com/marktext/marktext` のまま維持する。
- [ ] `Watch on GitHub...` は `Project on GitHub...` と同じ URL の重複になるため、`Releases...` に変更する。
  - URL は `https://github.com/marktext/marktext/releases/latest` に変更する。
- [ ] その他の Help メニュー項目は不要に変更しない。
- [ ] JS の構文、カンマ、セミコロン有無など既存スタイルを維持する。

## Task 4: サンプル Markdown の危険ドメインを予約済みサンプルドメインに置換する

対象: `src/renderer/prefComponents/theme/theme.md`

- [ ] `[dummy](http://marktext.app)` を `[dummy](https://example.com)` に変更する。
- [ ] サンプル文のその他の文言は不要に変更しない。

## Task 5: Package / Linux metadata は GitHub 導線のみを維持する

対象: `package.json`, `resources/linux/marktext.appdata.xml`

- [ ] `package.json` の `homepage`、`repository`、`bugs` などが GitHub を指していることを確認する。
- [ ] `resources/linux/marktext.appdata.xml` の homepage/help/bugtracker などの URL が GitHub を指していることを確認する。
- [ ] 危険ドメインへの変更は入れない。
- [ ] `marktext.appdata.xml` というファイル名由来の `marktext.app` は検出対象にしない。URL 形式の `http://marktext.app` / `https://marktext.app` だけを問題にする。

## Task 6: PR 本文用の maintainer checklist を残す

コード差分では変更できないため、実装完了後の作業報告に PR 本文用 snippet として次を含める。

- [ ] GitHub repository About の website を `www.marktext.me` から `https://github.com/marktext/marktext` または空欄へ変更する。
- [ ] GitHub org profile など外部管理欄に `marktext.cc` が残っていないか確認し、残っていれば削除または GitHub org/repo に変更する。
- [ ] macOS 署名、notarization、Homebrew cask deprecation 解消は別 PR として扱うことを明記する。

## 検証

### 必須検索

- [ ] 危険・旧導線・固定バージョン導線が PR 対象から消えていることを確認する。

```bash
rg -n --glob '!docs/OPEN_ISSUES_SUMMARY.md' "marktext\\.me|marktext\\.cc|https?://marktext\\.app|marktext\\.github\\.io/website|caskroom/homebrew-cask|releases/download/v0\\.17\\.1|downloads/marktext/marktext/v0\\.17\\.1" README.md docs src resources package.json electron-builder.yml .github
```

期待結果:

- `docs/OPEN_ISSUES_SUMMARY.md` を除き、該当なし。
- `marktext.appdata.xml` のファイル名由来の文字列はこの検索条件では拾わない。

- [ ] Homebrew cask 推奨文、install command、関連画像参照が README / 翻訳 README から消えていることを確認する。

```bash
rg -n "brew-cask|homebrew cask|Homebrew-Cask|brew install --cask mark-text" README.md docs/i18n
```

期待結果:

- 該当なし。
- もし macOS の既知事項として Homebrew cask を明示的に残す必要がある場合でも、`brew install --cask mark-text`、`https://github.com/caskroom/homebrew-cask`、`brew-cask.gif` は残さない。

- [ ] artifact 別 latest download バッジや `latest version` 表示が README / 翻訳 README から消えていることを確認する。

```bash
rg -n "img\\.shields\\.io/github/downloads/marktext/marktext/latest/marktext-|latest version" README.md docs/i18n
```

期待結果:

- 該当なし。
- 各言語の翻訳済み alt で同等の artifact 別 latest download バッジが残っていないか、OS 別ダウンロード表も目視確認する。

- [ ] GitHub repository / latest Releases の導線が残っていることを確認する。

```bash
rg -n "github.com/marktext/marktext/releases/latest|github.com/marktext/marktext" README.md docs/i18n src/main/menu/templates/help.js package.json resources/linux/marktext.appdata.xml
```

期待結果:

- README、翻訳 README、Help メニュー、package/appdata metadata で GitHub 導線が確認できる。

- [ ] README、各翻訳 README、Help メニューに latest Releases 導線が残っていることを確認する。

```bash
rg -n "https://github.com/marktext/marktext/releases/latest" README.md docs/i18n src/main/menu/templates/help.js
```

期待結果:

- `README.md`、すべての `docs/i18n/*.md`、`src/main/menu/templates/help.js` で該当が確認できる。

### 必須 lint

- [ ] `help.js` を変更したため lint を実行する。

```bash
yarn lint
```

期待結果:

- lint が成功する。
- 依存関係や環境要因で実行できない場合は、実行不能理由と表示されたエラーを PR / 作業報告に残す。

## 完了条件

- [ ] `README.md` と `docs/i18n/*.md` に危険・旧導線・固定 `v0.17.1` artifact 直リンクが残っていない。
- [ ] アプリ Help メニューの `Website...` 表示が GitHub project と分かるラベルになっている。
- [ ] `Watch on GitHub...` と同一 URL の重複が解消され、latest Releases へ行けるメニューがある。
- [ ] `theme.md` のサンプルリンクが `https://example.com` になっている。
- [ ] `package.json` と `resources/linux/marktext.appdata.xml` は GitHub URL のみを維持している。
- [ ] 必須検索と `yarn lint` の結果が記録されている。
- [ ] `git status --short` で、実装 PR に含めない `docs/OPEN_ISSUES_SUMMARY.md`、`plan.md`、`task.md` 以外の意図しない変更がないことを確認している。
- [ ] 外部管理作業は作業報告内の PR 本文用 checklist snippet として残されている。
