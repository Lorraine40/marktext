# main process クラッシュ修正 実装タスク

## 目的

`Plan.md` の内容を実装専用タスクに分解する。後続エージェントは本ファイルを上から順に進め、対象 Issue [#4165](https://github.com/marktext/marktext/issues/4165)、[#4153](https://github.com/marktext/marktext/issues/4153)、[#4130](https://github.com/marktext/marktext/issues/4130) の main process クラッシュを潰す。

対象は以下の 3 系統に限定する。

- ショートカット削除後の menu 構築クラッシュを防ぐ。
- 閉じた stdout/stderr pipe への書き込みで `EPIPE` が出ても process を終了させない。
- Save As の payload / window / pathname 状態不整合で落ちないようにする。

## 共通方針

- 外部 API、保存ファイル形式、IPC channel 名は変更しない。
- 既存 channel `mt::editor-ask-file-save-as`、`mt::response-file-save-as`、`mt::tab-save-failure`、`mt::set-pathname` を維持する。
- 大規模な保存フロー刷新、Electron / electron-log の依存更新、UI 仕様変更は行わない。
- main process module は import 時の副作用が大きい。テストが必要な処理は pure helper に切り出して named export し、最小範囲だけ検証する。
- テスト対象 helper は、可能な限り import 副作用のない module に置く。`src/main/menu/actions/file.js` や `src/main/menu/index.js` のように import 時に IPC 登録や Electron 依存が動く file へ直接置く場合は、unit test から直接 import しない。
- 既存の lint ルールに合わせる。セミコロンなし、2 space indent、ASCII で書けるコードは ASCII にする。

## 現状の要点

- `src/main/keyboard/shortcutHandler.js`
  - `getAccelerator(id)` は `this.keys.get(id)` が falsy の場合 `null` を返している。
  - `keybindings.json` の空文字は `_loadLocalKeybindings()` で `''` として保存される。
  - menu template 側は `accelerator: keybindings.getAccelerator(...)` を大量に使っており、`null` が `Menu.buildFromTemplate()` に渡る可能性がある。
- `src/main/menu/index.js`
  - `_buildEditorMenu()` と `_buildSettingMenu()` は `Menu.buildFromTemplate()` の例外を捕捉していない。
  - `addEditorMenu()` は `sourceCodeModeMenuItem` などが必ず取れる前提で `.checked` / `.enabled` を触っている。
  - `updateMenuItem()` は old/new の item が必ず取れる前提で `.checked` をコピーしている。
  - exported `getMenuItemById()` は `Menu.getApplicationMenu()` が `null` の場合を考慮していない。
- `src/main/exceptionHandler.js`
  - `setupExceptionHandler()` は全 `uncaughtException` を `handleError()` に渡す。
  - stdout/stderr の `error` listener はない。
  - `handleError()` は `MARKTEXT_EXIT_ON_ERROR` があると process を終了する。
- `src/main/index.js`
  - `initializeLogger()` で `electron-log` の console/file transport を設定している。
  - 起動初期に `process.stdout.write(...)` を直接呼ぶ箇所がある。
- `src/main/menu/actions/file.js`
  - `mt::response-file-save-as` handler が引数で `{ id, filename, markdown, pathname, options, defaultPath }` を destructuring しており、payload 欠落で handler 本体に入る前に落ちる。
  - `BrowserWindow.fromWebContents(e.sender)` が `null` の場合を考慮していない。
  - `dialog.showSaveDialog()` の例外、キャンセル、`filePath` なしの扱いが分離されていない。
  - Save As 後、`pathname` がある場合は `window-change-file-path`、未保存タブは `window-add-file-path` を使う必要がある。
- `src/renderer/store/editor.js`
  - Save As 応答時に `currentFile.id` しか検証していない。
  - `markdown` が文字列でないケースを main に送れる。
  - `console.err` typo がある。

## タスク 1: ショートカット削除後の menu 構築を防御する

### 1-1. `getAccelerator()` の戻り値を統一する

対象: `src/main/keyboard/shortcutHandler.js`

実装:

- 必要なら `normalizeMenuAccelerator(value)` のような副作用のない helper を追加し、`getAccelerator(id)` はその helper を通して戻り値を決める。
- `getAccelerator(id)` は、未設定・空文字・非文字列・不正 accelerator の場合に `undefined` を返す。
- 有効な文字列 accelerator の場合だけその文字列を返す。
- 空文字は `keybindings.json` 上の「ショートカットなし」として保持するが、Electron menu template には渡さない。
- `null` は返さない。Electron menu の `accelerator` property に `null` が入る経路を消す。

注意:

- `_loadLocalKeybindings()` の空文字保存ロジックは残す。
- `registerEditorKeyHandlers()` は現状どおり `accelerator && accelerator.length > 1` で十分だが、`this.keys` に `''` が残る前提を崩さない。
- unit test では `Keybindings` class を無理に instantiate しない。constructor が keyboard layout / native-keymap へ触るため、テストが重くなる場合は `normalizeMenuAccelerator()` の pure helper を検証対象にする。

受け入れ条件:

- `keybindings.json` で任意 shortcut が `''` の場合、`getAccelerator(id)` が `undefined` を返す。
- 通常 shortcut は従来どおり文字列を返す。

### 1-2. menu template 構築の fallback を追加する

対象: `src/main/menu/index.js`、必要なら `src/main/menu/templateGuard.js`

実装:

- `_buildEditorMenu(recentUsedDocuments)` で `Menu.buildFromTemplate(menuTemplate)` を `try/catch` する。
- 例外時は `log.error` で menu 構築失敗と例外を記録する。
- fallback は空メニューにしない。元の template 構造を保ったまま、全階層から `accelerator` property だけを除去した template で `Menu.buildFromTemplate()` を再試行する。
- `_buildSettingMenu()` も macOS の `configSettingMenu(this._keybindings)` に同じ fallback を適用する。
- Linux/Windows の settings menu は現状どおり `{ menu: null, type: MenuType.SETTINGS }` のままでよい。

推奨 helper:

- `stripAcceleratorsFromTemplate(template)` を追加する。unit test で直接検証する場合は、`src/main/menu/templateGuard.js` のような副作用のない module に置き、`src/main/menu/index.js` から import する。
- 配列と item object を再帰的に shallow clone し、`accelerator` key を除外する。
- `submenu` が配列の場合も再帰処理する。Electron の `Menu` instance を受ける想定は不要。
- 必要なら `buildMenuFromTemplateWithFallback(template, label)` のような helper にして、editor/settings で共用する。
- `buildMenuFromTemplateWithFallback()` は Electron の `Menu.buildFromTemplate()` を呼ぶため、unit test では deep mock を避け、`stripAcceleratorsFromTemplate()` の構造維持だけを検証してよい。

受け入れ条件:

- fallback 後も `sourceCodeModeMenuItem`、`typewriterModeMenuItem`、`focusModeMenuItem`、`sideBarMenuItem`、`tabBarMenuItem` など既存コードが参照する item ID が残る。
- fallback が発動しても window menu 登録と application menu 更新が落ちない。

### 1-3. menu item 参照を null-safe にする

対象: `src/main/menu/index.js`

実装:

- `addEditorMenu(window, options)` で `sourceCodeModeMenuItem` が取れない場合は log を出し、`.checked` を触らない。
- `typewriterModeMenuItem` と `focusModeMenuItem` も存在確認してから `.enabled = false` にする。
- `updateMenuItem(oldMenus, newMenus, id)` は `oldMenus` / `newMenus` / item が欠ける場合に throw せず、log を出して return する。
- exported `getMenuItemById(menuId)` は `Menu.getApplicationMenu()` が `null` の場合に `null` を返す。

受け入れ条件:

- fallback menu や application menu 未設定時でも `Cannot read properties of null` を出さない。
- menu item が欠けた場合はクラッシュではなくログになる。

## タスク 2: stdout/stderr 由来の `EPIPE` を握りつぶす

### 2-1. pipe error 判定 helper を追加する

対象: `src/main/exceptionHandler.js`

実装:

- `isIgnorablePipeError(error, stream)` を追加する。
- `error` が存在し、`error.code === 'EPIPE'` の場合のみ候補にする。
- `stream` が `process.stdout` または `process.stderr` の場合は true を返す。
- `stream` が渡されない `uncaughtException` 経路では、stack/message から stdout/stderr write 由来と判断できる場合のみ true を返す。
- 単に `code === 'EPIPE'` だけで全例外を無視しない。
- `Socket` という語だけでは stdout/stderr 由来と判断しない。通常 socket / network 系の `EPIPE` まで握りつぶさないようにする。
- テストのために named export してよい。

判定の目安:

- listener 経路: `isIgnorablePipeError(error, process.stdout)` / `isIgnorablePipeError(error, process.stderr)` で true。
- uncaughtException 経路: `error.code === 'EPIPE'` かつ stack または message に `write` と `stdout` / `stderr` / `process.stdout` / `process.stderr` / `_stdout` / `_stderr` / `console` / `electron-log` など stdio / console 由来を示す情報がある場合だけ true。
- `Socket` を判定に使う場合は、上記の stdio / console 由来の語と組み合わせる。`Socket` 単独の `EPIPE` は false に倒す。
- 判断が難しい場合は false に倒し、通常の `handleError()` に流す。

受け入れ条件:

- stdout/stderr listener で受けた `EPIPE` は true。
- stdout/stderr 以外の `EPIPE` は false。
- `EACCES` など他 code は false。

### 2-2. stdout/stderr error listener を登録する

対象: `src/main/exceptionHandler.js`

実装:

- `setupExceptionHandler()` 内で `process.stdout` と `process.stderr` に `error` listener を登録する。
- listener は `isIgnorablePipeError(error, stream)` が true の場合だけ return する。
- false の場合は `handleError(ERROR_MSG_MAIN, error, 'main')` に流す。
- 多重登録を避けるため、module scope に boolean flag を置くか、`setupExceptionHandler()` が複数回呼ばれても同じ listener を重ねない形にする。

受け入れ条件:

- 閉じた pipe に console/electron-log が書いても main process の error dialog / exit に進まない。
- stdout/stderr 以外の stream error は通常の例外処理に残る。

### 2-3. `uncaughtException` 経路で stdout/stderr `EPIPE` を除外する

対象: `src/main/exceptionHandler.js`

実装:

- `process.on('uncaughtException', error => { ... })` の先頭で `isIgnorablePipeError(error)` を確認する。
- true の場合はログも dialog も exit もせず return する。
- false の場合は現状どおり `handleError(ERROR_MSG_MAIN, error, 'main')` に流す。

受け入れ条件:

- `MARKTEXT_EXIT_ON_ERROR=1` でも stdout/stderr 由来 `EPIPE` では `process.exit(1)` しない。
- stdout/stderr 由来ではない `EPIPE` や他例外は従来どおり処理される。

### 2-4. logger 初期化後の console transport を維持する

対象: `src/main/index.js`

実装:

- `electron-log` の file transport 設定は変えない。
- `log.transports.console.level` は現状の意図を維持する。
- `initExceptionLogger()` 呼び出し後も、Task 2-2 / 2-3 で console transport 由来の pipe error だけが抑止されることを確認する。

受け入れ条件:

- file log は引き続き出る。
- console transport を丸ごと無効化するだけの対応にしない。

### 2-5. 直接 stdout write の扱いを明確にする

対象: `src/main/index.js`、必要なら `src/main/exceptionPipeGuard.js`

実装:

- `process.stdout.write(...)` を直接呼ぶ箇所は、閉じた stdout pipe で throw し得るため確認する。
- `setupExceptionHandler()` より後に実行される直接 write は、必要なら `safeStdoutWrite(message)` のような helper で包み、`EPIPE` だけを無視する。
- `setupExceptionHandler()` より前に実行される unsupported OS path の write は、対象外にする場合は理由をコメントまたは検証記録に残す。対象に含める場合は、exception handler に依存しない同期 try/catch で `EPIPE` だけを無視する。
- `EPIPE` 以外の write error は握りつぶさない。

受け入れ条件:

- 閉じた stdout pipe に対する直接 write が、この修正範囲で想定する起動経路を落とさない。
- `electron-log` console transport を無効化せず、直接 write の例外だけを最小限に扱う。

## タスク 3: Save As の入力と window 状態を検証する

### 3-1. Save As payload validation helper を追加する

対象: `src/main/menu/actions/file.js`、`src/main/menu/actions/saveAsGuard.js`

実装:

- `validateSavePayload(payload)` を追加する。unit test で直接検証するため、`src/main/menu/actions/saveAsGuard.js` のような import 副作用のない module に置き、`src/main/menu/actions/file.js` から import する。
- payload が object でない場合は invalid。
- `id` は non-empty string 必須。
- `markdown` は文字列必須。
- `options` は object 必須。
- `options.encoding` は object 必須。既存の `writeMarkdownFile()` が期待する shape を壊さない。
- `options.encoding.encoding` は non-empty string 必須。
- `options.encoding.isBom` は未指定または boolean を許容する。
- `options.lineEnding` は `lf` または `crlf` 必須。
- `options.adjustLineEndingOnSave` は boolean 必須。
- `options.trimTrailingNewline` は number 必須。既存値域を変えず、renderer が送る値を valid にする。
- `filename`、`pathname`、`defaultPath` は文字列または falsy を許容する。ただし文字列でない truthy 値は invalid。
- 戻り値は実装しやすい形でよい。推奨は `{ valid: boolean, reason?: string }`。
- テストのために named export してよい。

受け入れ条件:

- `undefined` payload、`markdown: null`、`options: null` が invalid になる。
- `id` 欠落、空文字、文字列でない値は invalid になる。
- `options.encoding` が object でない、`options.encoding.encoding` が欠落、`options.lineEnding` が `lf` / `crlf` 以外、`options.adjustLineEndingOnSave` が boolean でない場合は invalid になる。
- 正常な renderer payload は valid になる。
- invalid でも throw しない。

### 3-2. `mt::response-file-save-as` handler の destructuring を遅らせる

対象: `src/main/menu/actions/file.js`

実装:

- handler signature を `async (e, payload) => { ... }` に変更する。
- 関数本体全体を `try/catch` で囲む。
- 先に `const sender = e && e.sender` のように sender を退避し、以降の失敗通知はこの sender が送信可能な場合だけ使う。
- `validateSavePayload(payload)` を通した後で `id`、`filename`、`markdown`、`pathname`、`options`、`defaultPath` を取り出す。
- invalid payload の場合は保存処理に入らない。
- `e.sender` が使える場合は `mt::tab-save-failure` で失敗理由を返す。
- sender が使えない場合は `log.error` のみにする。
- 既存の `writeMarkdownFile(...).then(...).catch(...)` chain は、可能な限り `await writeMarkdownFile(...)` に寄せる。外側の `try/catch` が dialog、write、post-save IPC/send の例外をまとめて捕捉できる形にする。
- `then` 内に `win.webContents.send(...)` を残すと外側 `try/catch` で捕捉できない例外が残るため避ける。

受け入れ条件:

- payload 欠落時に handler 引数 destructuring で落ちない。
- invalid payload は保存処理、dialog 表示、filesystem write に進まない。
- write 成功後の IPC / `.send()` 中の例外も uncaught にならない。

### 3-3. BrowserWindow と sender を検証する

対象: `src/main/menu/actions/file.js`

実装:

- `const win = BrowserWindow.fromWebContents(sender)` の結果が `null` の場合は保存処理に入らない。
- `win.isDestroyed()` が true の場合に return する。
- `e.sender` または `win.webContents` が destroy 済みの場合は `.send()` しない。
- 失敗通知用に `notifySaveAsFailure(sender, id, message)` のような小 helper を作ってよい。
- `win === null` または destroyed の場合でも、sender が送信可能なら `notifySaveAsFailure(sender, id, message)` で `mt::tab-save-failure` を返す。sender も使えない場合だけ log のみにする。
- `notifySaveAsFailure()` は、`sender && !sender.isDestroyed()` を確認してから `.send()` する。通知 helper 自体も throw しないようにする。
- Save As 成功後に使う `win.webContents.send(...)` も、送信直前に `win` / `webContents` の生存確認を行う。

受け入れ条件:

- window が閉じた後に Save As 応答が届いても throw しない。
- 通知できる場合だけ `mt::tab-save-failure` を返す。

### 3-4. Save dialog 結果を分岐する

対象: `src/main/menu/actions/file.js`

実装:

- `dialog.showSaveDialog()` は `try/catch` で例外を捕捉する。
- `canceled === true` はユーザーキャンセルとして成功扱いにし、通知せず return する。
- `filePath` が空の場合も保存処理に入らず return する。
- `filePath` がある場合だけ `path.resolve(filePath)` して書き込む。
- Save As handler に新しい拡張子補完ロジックを追加しない。既存の `writeMarkdownFile()` / `writeFile()` 経由の拡張子付与挙動を維持する。

受け入れ条件:

- dialog 例外は `mt::tab-save-failure` または log になる。
- キャンセル時は failure 通知を出さない。
- `filePath` なしで `writeMarkdownFile()` を呼ばない。

### 3-5. Save As 後の watcher 更新を pathname 有無で分ける

対象: `src/main/menu/actions/file.js`

実装:

- `alreadyExistOnDisk` は `!!pathname` のままでよいが、分岐を明確にする。
- `pathname` がない未保存タブ:
  - `ipcMain.emit('window-add-file-path', win.id, filePath)`
  - `ipcMain.emit('menu-add-recently-used', filePath)`
  - `win.webContents.send('mt::set-pathname', { id, pathname: filePath, filename: path.basename(filePath) })`
- `pathname` があり、`pathname !== filePath`:
  - `ipcMain.emit('window-change-file-path', win.id, filePath, pathname)`
  - `win.webContents.send('mt::set-pathname', { id, pathname: filePath, filename: path.basename(filePath) })`
- `pathname` があり、`pathname === filePath`:
  - `ipcMain.emit('window-file-saved', win.id, filePath)`
  - `win.webContents.send('mt::tab-saved', id)`
- どの `.send()` も webContents が destroy 済みでないことを確認する。

受け入れ条件:

- 未保存タブでは `window-change-file-path` を使わない。
- 既存ファイルの別名保存では `window-change-file-path` を使う。
- 同じ path への保存は `window-file-saved` と `mt::tab-saved` になる。

## タスク 4: renderer 側 Save As 送信を防御する

対象: `src/renderer/store/editor.js`

実装:

- `LISTEN_FOR_SAVE_AS` の `mt::editor-ask-file-save-as` listener で `currentFile` を検証する。
- `currentFile` が空、`id` がない、`markdown` が文字列でない場合は IPC を送らない。
- `options = getOptionsFromState(state.currentFile)` が object でない場合も IPC を送らない。
- 必要に応じて `notice.notify()` で保存失敗をユーザー通知する。通知を追加する場合は既存文言に合わせ、過剰に出さない。
- `LISTEN_FOR_SET_PATHNAME` 内の `console.err` を `console.error` に直す。

受け入れ条件:

- 不正な currentFile で Save As を押しても main process に不正 payload を送らない。
- typo 修正後、unknown tab のログ出力で新たな例外が出ない。

## タスク 5: テストを追加する

### 5-1. pure helper の unit test

対象候補:

- `test/unit/specs/main-crash-guards.spec.js`
- helper は可能な限り副作用のない module に分離する。例: `src/main/exceptionPipeGuard.js`、`src/main/menu/actions/saveAsGuard.js`、`src/main/menu/templateGuard.js`。
- `src/main/menu/actions/file.js` のように import 時に `ipcMain.on(...)` を登録する module から helper を直接 import するテストは避ける。
- `src/main/keyboard/shortcutHandler.js` の `Keybindings` constructor は keyboard layout / native-keymap に触るため、unit test で直接 instantiate しない。accelerator 判定は副作用のない helper に切り出して検証する。

実装:

- `isIgnorablePipeError(error, stream)` のテスト:
  - stdout stream + `code: 'EPIPE'` は true。
  - stderr stream + `code: 'EPIPE'` は true。
  - stdout/stderr 以外 + `code: 'EPIPE'` は false。
  - `code: 'EACCES'` は false。
  - `uncaughtException` 相当の stdout/stderr write stack は true。
  - stdout/stderr と判断できない `EPIPE` は false。
- `validateSavePayload(payload)` のテスト:
  - 正常 payload は valid。
  - `undefined` payload は invalid。
  - `markdown: null` は invalid。
  - `options: null` は invalid。
  - `options.encoding` 欠落は invalid。
  - line ending 関連値欠落は invalid。
- accelerator helper / `getAccelerator()` のテスト:
  - pure helper に通常 accelerator を渡すと文字列を返す。
  - pure helper に `''` / `null` / 非文字列 / 不正 accelerator を渡すと `undefined` を返す。
  - `getAccelerator(id)` がその helper を使うことは、軽い wiring test が可能なら確認する。難しい場合は pack と手動確認で補う。

注意:

- 現在の `test/unit/index.js` は `../../src/renderer` を coverage import している。main process module 全体を import すると IPC 登録などの副作用が出るため、必要なら helper を副作用のない file に分離する。
- 既存 test runner に main helper を載せるのが重い場合、タスク 5 は pure helper test を最小限にし、手動検証を厚めに記録する。

### 5-2. menu fallback の検証

実装候補:

- helper `stripAcceleratorsFromTemplate(template)` を副作用のない module から named export し、unit test で template の構造と id が残ることを確認する。
- Electron `Menu.buildFromTemplate()` 自体の deep mock は避けてよい。

受け入れ条件:

- nested submenu の `accelerator` が除去される。
- `id`、`label`、`type`、`click`、`submenu` 構造は残る。

## タスク 6: 手動 / integration 確認

実施する確認:

- Windows:
  - Settings でショートカットを削除し、`keybindings.json` に `''` が入る状態にする。
  - Settings 画面を開いても main process が落ちないことを確認する。
  - ファイルを開き、editor menu の構築で main process が落ちないことを確認する。
  - Windows の settings menu は現状どおり `{ menu: null, type: MenuType.SETTINGS }` なので、settings menu の `Menu.buildFromTemplate()` fallback 発動は macOS で確認する。
- Linux / macOS:
  - stdout/stderr pipe を閉じた起動環境で console/electron-log 出力を発生させる。
  - `EPIPE` で main process が落ちないことを確認する。
- Linux/Kubuntu 系:
  - Markdown を開く。
  - Save As ダイアログで保存先フォルダを変更する。
  - 保存またはキャンセルが正常に戻り、main process がクラッシュしないことを確認する。
- Save As edge cases:
  - 未保存タブを Save As。
  - 既存ファイルを別パスへ Save As。
  - 既存ファイルを同じパスへ Save As。
  - dialog cancel。
  - window close 直後の応答で throw しないこと。

## 検証コマンド

基本:

```sh
yarn run lint
yarn run pack:main
```

テストを追加した場合:

```sh
yarn run unit
```

可能なら:

```sh
yarn run pack:renderer
```

## 完了条件

- `keybindings.json` で shortcut を削除しても `Menu.buildFromTemplate()` 由来で main process が落ちない。
- menu fallback が空メニューではなく、既存 item ID を維持した menu になる。
- stdout/stderr 由来の `EPIPE` は error dialog / `MARKTEXT_EXIT_ON_ERROR` の exit 経路に流れない。
- 対象起動経路の直接 `process.stdout.write(...)` も、閉じた pipe で main process を落とさないか、対象外理由が検証記録に残っている。
- stdout/stderr 由来ではない例外は従来の exception handler に残る。
- Save As で payload 欠落、invalid markdown/options、window 破棄済み、dialog cancel、dialog 例外が throw にならない。
- Save As 成功時の watcher 更新が pathname 有無に応じて正しい IPC event になる。
- renderer から明らかに不正な Save As payload を送らない。
- `yarn run lint` と `yarn run pack:main` が通る。追加テストがある場合は `yarn run unit` も通るか、失敗理由を明記する。

## 実装順序

1. `getAccelerator()` を修正し、menu template に `null` accelerator が入らない状態を作る。
2. menu fallback helper と null-safe menu item 更新を入れる。
3. `isIgnorablePipeError()` と stdout/stderr listener を入れ、`uncaughtException` を防御する。
4. 直接 stdout write の `EPIPE` 扱いを確認し、必要な最小防御を入れる。
5. Save As payload validation と handler の `try/catch` / `await` 化を入れる。
6. renderer の Save As 送信防御と `console.err` typo を直す。
7. pure helper test を追加する。
8. lint / pack / unit を実行し、手動確認項目の実施可否を記録する。

## 作業時の注意

- `docs/OPEN_ISSUES_SUMMARY.md` と `Plan.md` はこの作業の前提資料。実装タスク中に内容を書き換えない。
- dirty worktree にはユーザー作成の未追跡ファイルがある。不要な revert / reset はしない。
- `src/main/menu/actions/file.js` は保存、export、rename、move など多くの IPC を持つため、Save As handler 以外の挙動を変えない。
- `src/main/exceptionHandler.js` の `handleError()` はアプリ全体の例外処理なので、一般例外を握りつぶす条件を広げすぎない。
- `src/main/menu/index.js` の fallback で空メニューを返すと別の null 参照を誘発するため、必ず同じ menu 構造を維持する。
