# MarkText Open Issues: 配布、セキュリティ

取得日: 2026-04-19 JST
対象: `marktext/marktext` の Open Issue から、`fix/security-links` で扱う範囲を抜粋。

## この worktree の目的

公式導線として見える URL、README、About 画面、配布ドキュメント、release リンクの安全性を棚卸しし、期限切れドメインや誤解を招くリンクを取り除く。

## 対象 Issue

| 優先度 | Issue | 分類 | 概要 |
| --- | --- | --- | --- |
| P0 | [#4125](https://github.com/marktext/marktext/issues/4125), [#4047](https://github.com/marktext/marktext/issues/4047), [#3443](https://github.com/marktext/marktext/issues/3443) | 配布、セキュリティ | `marktext.me` や `marktext.cc` など、ユーザーが公式導線と認識しうる URL の期限切れ、悪性サイト誘導、トロイの木馬ビルド疑い。まず公式 README、About、Web サイト、リリースリンクの棚卸しが必要。 |
| P0 | [#4140](https://github.com/marktext/marktext/issues/4140), [#4167](https://github.com/marktext/marktext/issues/4167), [#4096](https://github.com/marktext/marktext/issues/4096), [#2983](https://github.com/marktext/marktext/issues/2983) | macOS 配布 | Gatekeeper、審査、署名、Apple Silicon でのインストール失敗、Homebrew 経由の破損扱い。配布の信頼性に直結する。 |

## 直近 Issue の要点

- [#4140](https://github.com/marktext/marktext/issues/4140): macOS Gatekeeper による deprecation、実行制限の問題。
- [#4125](https://github.com/marktext/marktext/issues/4125): About セクションにある `www.marktext.me` がトロイの木馬ビルドとして報告されている。
- [#4047](https://github.com/marktext/marktext/issues/4047): GitHub repo info の `https://www.marktext.cc/` がスパムサイトへリダイレクトされる。

## 作業対象候補

- `README.md`
- `package.json`
- `src/renderer/components/about/index.vue`
- `resources/linux/marktext.appdata.xml`
- `docs/`
- `docs/i18n/`

## 対応方針

- 公式 README、About、Web サイト、release、package metadata に含まれる URL を棚卸しする。
- 期限切れまたは所有権が不明なドメインへのリンクを削除または GitHub Releases / GitHub repository に寄せる。
- macOS 配布の署名、notarization、Homebrew cask、Apple Silicon artifact は、コード修正より先に現状確認を行う。
- 多言語ドキュメントに同じ危険リンクがある場合は、英語 README と整合する範囲で更新する。

## 完了条件

- 危険または不明な公式風 URL が README、About、package metadata、主要 docs から除去されている。
- ダウンロード導線が GitHub Releases など検証可能な場所に統一されている。
- `yarn lint` で対象変更に起因する lint エラーが出ない。
