# MarkText 配布リンク安全化修正計画

## Summary

- 目的は、Issue #4125 / #4047 で報告されている「公式に見えるが所有権・安全性が疑わしい導線」を、コード・README・主要 docs から排除し、公式導線を GitHub repository / GitHub Releases に統一すること。
- macOS Gatekeeper / notarization / Homebrew deprecation 系の Issue #4140 / #4096 / #2983 は、同じ PR では「危険導線を増やさないドキュメント整理」までを扱う。GitHub Releases は所有権を確認できる公式導線として案内するが、macOS artifact の署名・notarization 問題が解決済みだとは書かない。署名・notarization の実修正は Apple Developer 証明書と release secrets が必要な別作業として分離する。
- GitHub repo About 欄に残る `www.marktext.me` はリポジトリ内の差分では直せないため、maintainer 権限で更新する外部作業として明記する。`marktext.cc` は Issue #4047 で報告されているが、現在の repo About からは確認できないため、org profile など外部管理欄に残っていないか maintainer 側で確認する作業として扱う。

## Key Changes

- [README.md](README.md)
  - ヘッダーの「latest release」ダウンロードバッジが `v0.17.1` の集計に固定されているため、`latest` または全体集計など誤解のない表現へ変更する。
  - 直接 `releases/download/v0.17.1/...` に固定している macOS / Windows / Linux のダウンロード表を、各 artifact 直リンクではなく `https://github.com/marktext/marktext/releases/latest` へ寄せる。
  - macOS セクションの Homebrew cask 案内は、Gatekeeper 警告が確認されているため推奨導線から外す。書く場合は「Homebrew cask は現在 Gatekeeper 警告の対象。所有権を確認できる配布元は GitHub Releases だが、macOS の署名・notarization 問題は別途解決が必要」と分けて明記する。
  - 「latest version」バッジが実際には `v0.17.1` 固定に見える箇所は、誤解を避ける文言に変更する。

- [docs/i18n](docs/i18n)
  - `marktext.github.io/website` を「公式サイト」扱いしている翻訳 README のリンクを、英語 README と同じく GitHub repository / releases へ統一する。単純に全件を repo root へ寄せず、英語 README と同じ対応で `Website` は repo root、`Features` は `#features`、`Downloads` は `#download-and-installation`、`Development` は `#development`、`Contribution` は `#contribution` へ置換する。
  - 各翻訳にある `v0.17.1` 固定バッジ、`releases/download/v0.17.1/...` 固定リンク、`caskroom/homebrew-cask` 推奨文を、英語 README の方針に合わせて更新する。
  - 翻訳品質を深追いせず、リンク先と安全上の意味が英語版と一致する最小変更に留める。

- [src/main/menu/templates/help.js](src/main/menu/templates/help.js)
  - 現状 `Website...` は `https://github.com/marktext/marktext` を開いており、危険ドメインには向いていないため基本維持する。
  - ただしラベルが「Website...」だと GitHub About の危険 URL と混同されやすいため、`Project on GitHub...` など GitHub 導線だと分かる文言へ変更する。
  - `Watch on GitHub...` と同じ URLになる重複は許容しない。`Website...` は `Project on GitHub...` に変更し、`Watch on GitHub...` は `Releases...` に変更して `https://github.com/marktext/marktext/releases/latest` を開くようにする。

- [src/renderer/prefComponents/theme/theme.md](src/renderer/prefComponents/theme/theme.md)
  - サンプル Markdown 内の `http://marktext.app` は、Issue #4125 で危険導線として言及されている `marktext.app` と同じドメインのため、サンプル文でも残さない。
  - 公式導線として使う必要がないサンプルリンクなので、`https://example.com` のような予約済みサンプル用ドメインへ置換する。

- Package / Linux metadata
  - [package.json](package.json) と [resources/linux/marktext.appdata.xml](resources/linux/marktext.appdata.xml) は現状 GitHub URL を指しており、危険ドメインへの変更は入れない。
  - appdata の homepage は `https://github.com/marktext/marktext/` のまま維持し、必要なら `<url type="help">` や `<url type="bugtracker">` も GitHub に限定する。

- 外部管理作業
  - GitHub repository About の website を `www.marktext.me` から `https://github.com/marktext/marktext` または空欄に変更する。
  - GitHub org profile など maintainer 権限が必要な外部管理欄に `marktext.cc` が残っていないか確認し、存在する場合は削除または GitHub org/repo に変更する。
  - この外部変更は PR 差分では検証できないため、PR 本文に maintainer checklist として残し、repo About と org profile の両方を明示する。

## Test Plan

- `rg -n --glob '!docs/OPEN_ISSUES_SUMMARY.md' "marktext\\.me|marktext\\.cc|https?://marktext\\.app|marktext\\.github\\.io/website|caskroom/homebrew-cask|releases/download/v0\\.17\\.1|downloads/marktext/marktext/v0\\.17\\.1" README.md docs src resources package.json electron-builder.yml .github`
  - PR 対象ファイルに危険・旧導線・固定バージョン導線が残らないことを確認する。`src/renderer/prefComponents/theme/theme.md` のサンプル `http://marktext.app` も残さない。
  - `marktext.appdata.xml` のようなファイル名由来の文字列を誤検出しないよう、`marktext.app` は URL 形式だけを検出対象にする。
- `rg -n "github.com/marktext/marktext/releases/latest|github.com/marktext/marktext" README.md docs/i18n src/main/menu/templates/help.js package.json resources/linux/marktext.appdata.xml`
  - 公式導線が GitHub repository / latest Releases に統一されていることを確認する。
- `yarn lint`
  - JS/Vue 側のラベル変更で lint regression がないことを確認する。
- ドキュメントのみの変更が中心なら、ビルドや e2e は必須にしない。ただし `help.js` を変更した場合は lint を必須にする。

## Assumptions

- `docs/OPEN_ISSUES_SUMMARY.md` は今回の調査メモとして扱い、PR 差分には含めない。根拠は PR 本文や maintainer checklist に要約し、危険 URL を含む調査メモを docs として追加しない。
- `src/renderer/prefComponents/theme/theme.md` はサンプル文書だが、危険導線と同じ `marktext.app` を含むため今回の修正対象に含める。
- 2026-04-19 時点で GitHub Issue #4125 は `www.marktext.me` / `marktext.app`、Issue #4047 は `www.marktext.cc` の危険導線を報告しており、どちらも open。現在の repo About では `www.marktext.me` は確認できるが、`marktext.cc` は確認できないため、org profile など maintainer 権限が必要な外部管理欄の確認事項として扱う。Issue #4140 / #4096 / #2983 は macOS Gatekeeper / Homebrew / arm64 artifact の配布信頼性問題として扱う。
- 署名、notarization、Homebrew cask の deprecation 解消は、Apple Developer 証明書・notarization credentials・release workflow secrets の設計が必要な別 PR とする。
- 参照元: [#4125](https://github.com/marktext/marktext/issues/4125), [#4047](https://github.com/marktext/marktext/issues/4047), [#4140](https://github.com/marktext/marktext/issues/4140), [#4096](https://github.com/marktext/marktext/issues/4096), [#2983](https://github.com/marktext/marktext/issues/2983), GitHub API の repo `homepage` / GitHub repo About 表示
