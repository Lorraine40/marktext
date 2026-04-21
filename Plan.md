# main process クラッシュ修正計画

## Summary

`docs/OPEN_ISSUES_SUMMARY.md` の P1 対象、[#4165](https://github.com/marktext/marktext/issues/4165)、[#4153](https://github.com/marktext/marktext/issues/4153)、[#4130](https://github.com/marktext/marktext/issues/4130) を 1 本の安定化パッチとして扱う。目的は、ショートカット削除、閉じた stdout/stderr pipe、Save As 操作の不整合で main process が落ちない状態にすること。

## Key Changes

- ショートカット削除時のメニュー構築を防御する。
  - `src/main/keyboard/shortcutHandler.js` の `getAccelerator(id)` は、未設定・空文字・不正値を Electron menu に渡さないため `undefined` を返す仕様に統一する。
  - `keybindings.json` の値が `''` の場合は「ショートカットなし」として保持し、`Menu.buildFromTemplate()` には `null` を混入させない。
  - `src/main/menu/index.js` の `_buildEditorMenu()` と `_buildSettingMenu()` に、メニュー構築失敗時のログ出力を追加する。必要な場合のフォールバックは空メニューではなく、同じメニュー構造から `accelerator` だけを除去した template で再構築する。空メニューにすると `sourceCodeModeMenuItem` など既存コードが期待する menu item が欠落し、別の null 参照を作るため避ける。
  - menu item 参照側も防御する。`addEditorMenu()` と `updateMenuItem()` は `getMenuItemById()` が `null` を返す可能性を考慮し、メニュー構築 fallback 後も window 生成・menu 更新が落ちないようにする。

- `EPIPE` を process 終了にしない。
  - `src/main/exceptionHandler.js` に stdout/stderr の `error` listener を追加し、`code === 'EPIPE'` かつ stdout/stderr への write 失敗と判断できるものだけを既知の console pipe 終了として握りつぶす。
  - `setupExceptionHandler()` の `uncaughtException` でも stdout/stderr 由来の `EPIPE` を特別扱いし、error dialog や `MARKTEXT_EXIT_ON_ERROR` の終了経路に流さない。単に `code === 'EPIPE'` だけで全例外を無視しない。
  - `src/main/index.js` の logger 初期化後も `electron-log` の file transport は維持し、console transport 由来の pipe エラーだけを抑止する。

- Save As の入力と window 状態を検証する。
  - `src/main/menu/actions/file.js` の `mt::response-file-save-as` は handler 引数で payload を destructuring しない。`async (e, payload) => { try { ... } }` の形にして、`validateSavePayload(payload)` の後で `id`、`filename`、`markdown`、`pathname`、`options`、`defaultPath` を取り出す。payload 自体が `undefined` の場合も関数本体の `try/catch` で処理できるようにする。
  - `BrowserWindow.fromWebContents(e.sender)` が `null`、destroy 済み、payload 欠落の場合は保存処理に入らず return する。`e.sender` が生存していれば `mt::tab-save-failure` を返し、sender も使えない場合はログだけに落とす。
  - `markdown` は文字列必須、`options.encoding` と line ending 関連値は存在必須として検証し、不正な場合は保存処理に入らない。
  - `dialog.showSaveDialog()` の例外、キャンセル、`filePath` 未選択を明確に分け、キャンセルは成功扱いで何も通知しない。
  - Save As 後の watcher 更新は、既存 pathname がある場合だけ `window-change-file-path` を使い、未保存タブは `window-add-file-path` に限定する。
  - renderer 側の `src/renderer/store/editor.js` では `currentFile` が空、`id` なし、`markdown` 非文字列の場合に IPC を送らず、必要なら user notification にする。
  - Save As の失敗経路に関係する `src/renderer/store/editor.js` の `console.err` typo は `console.error` に直す。

## Interfaces

- 外部 API や保存ファイル形式は変更しない。
- IPC channel 名は既存の `mt::editor-ask-file-save-as`、`mt::response-file-save-as`、`mt::tab-save-failure`、`mt::set-pathname` を維持する。
- 内部ヘルパーとして `isIgnorablePipeError(error)` と `validateSavePayload(payload)` を追加してよい。どちらも main process 内限定で export は不要、テストが必要なら named export にする。

## Test Plan

- Unit:
  - 既存の `yarn run unit` は renderer webpack config ベースで `src/renderer` 中心に組まれているため、main process module 全体を無理に import するテストは避ける。
  - main process の処理は import 時に IPC handler 登録などの副作用があるため、必要な検証対象を副作用のない pure helper に切り出して named export する。少なくとも `isIgnorablePipeError(error)`、`validateSavePayload(payload)` を直接テストできる形にする。
  - `handleResponseForSaveAs(e, payload)` 全体の unit test は Electron mock が大きくなる場合は無理に増やさず、payload 検証 helper と manual/integration 確認で補う。
  - `getAccelerator()` が通常 accelerator を返し、削除済み shortcut は `undefined` を返すこと。
  - `keybindings.json` で全 shortcut を `''` にした状態でも editor menu template と settings menu template が構築できること。fallback を使う場合は、空メニューではなく必要な menu item ID を維持した template になることも確認する。
  - stdout/stderr 由来の `EPIPE` error が listener と `uncaughtException` 経路で app 終了・error dialog に進まないこと。stdout/stderr 以外の `EPIPE` は通常の例外処理に残ること。
  - Save As payload 欠落、`markdown: null`、`options: null`、`BrowserWindow.fromWebContents()` が `null` の各ケースで throw せず失敗通知またはログになること。payload 欠落は destructuring 前に落ちないことを明示的に確認する。
- Manual / integration:
  - Windows: Settings でショートカットを削除後、ファイルを開いて main process が落ちないこと。
  - macOS/Linux: stdout/stderr pipe を閉じた起動環境で `electron-log` console 出力を発生させても main process が落ちないこと。
  - Linux/Kubuntu 系: Markdown を開き、Save As ダイアログで保存先フォルダを変更してもクラッシュせず、保存またはキャンセルが正常に戻ること。
- Verification commands:
  - `yarn run lint`
  - `yarn run pack:main`
  - pure helper の unit test を追加できた場合は `yarn run unit`
  - 可能なら `yarn run pack:renderer`

## Assumptions

- 対象範囲は P1 の main process crash 3 件に限定し、UI の大幅な保存フロー刷新や Electron/electron-log の依存更新は行わない。
- `docs/OPEN_ISSUES_SUMMARY.md` は文字化けしているが、GitHub Issue 本文と照合して上記 3 件を正とする。
- 既存の IPC 互換性を優先し、renderer から main への payload shape は変えず、受信側検証を追加する。
