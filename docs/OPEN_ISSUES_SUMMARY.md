# MarkText Open Issues: main process クラッシュ

取得日: 2026-04-19 JST
対象: `marktext/marktext` の Open Issue から、`fix/main-process-crash` で扱う範囲を抜粋。

## この worktree の目的

main process 側の例外でアプリ全体が落ちる問題を優先して潰す。特に menu 構築、ショートカット、ログ出力、保存処理の null / pipe / window 状態不整合を扱う。

## 対象 Issue

| 優先度 | Issue | 分類 | 概要 |
| --- | --- | --- | --- |
| P1 | [#4165](https://github.com/marktext/marktext/issues/4165), [#4153](https://github.com/marktext/marktext/issues/4153), [#4130](https://github.com/marktext/marktext/issues/4130) | main process クラッシュ | ショートカット削除後の menu 構築時 `null.push`、`electron-log` の `EPIPE`、Save As 時のクラッシュ。起動、保存、ログ出力の安定性に関わる。 |

## 直近 Issue の要点

- [#4165](https://github.com/marktext/marktext/issues/4165): ショートカット削除後、main process の menu 構築で `Cannot read properties of null (reading 'push')`。
- [#4153](https://github.com/marktext/marktext/issues/4153): `electron-log` の console transport が閉じた pipe に書き込み、main process が `EPIPE` で落ちる。
- [#4130](https://github.com/marktext/marktext/issues/4130): Save As 時のクラッシュ。保存対象 tab、window、pathname の状態不整合を疑う。

## 作業対象候補

- `src/main/menu/`
- `src/main/keyboard/`
- `src/main/exceptionHandler.js`
- `src/main/windows/editor.js`
- `src/main/menu/actions/file.js`
- `src/main/filesystem/`

## 対応方針

- menu template / shortcut entry の null や空配列を許容できる形にする。
- shortcut 削除後の設定値を読み込んでも menu 構築が落ちないようにする。
- `electron-log`、stdout、stderr の `EPIPE` ハンドリングを確認し、閉じた pipe への書き込みで process を終了させない。
- Save As は current tab、BrowserWindow、pathname、markdown が欠けるケースを防御し、ユーザー操作として失敗を返す。

## 完了条件

- 対象 Issue の再現手順で main process がクラッシュしない。
- 失敗時は例外終了ではなく、ログ出力またはユーザー通知に落ちる。
- main process 関連の unit / lint が通る。
