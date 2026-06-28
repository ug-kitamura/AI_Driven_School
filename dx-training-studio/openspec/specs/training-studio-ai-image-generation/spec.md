# training-studio-ai-image-generation Specification

## Purpose
TBD - created by archiving change pane4-ai-generation-and-settings. Update Purpose after archive.
## Requirements
### Requirement: API キー未設定時は生成できない

**AI API キー**（`AI_API_KEY` または `x-ai-api-key`、解決優先順位は workspace-settings に従う）が未設定のとき、生成 API は失敗を返さなければならない（SHALL）。AI タブは生成を実行し、失敗レスポンスに基づき設定ダイアログまたは `.env.local` への導線を示さなければならない（SHALL）。

#### Scenario: キー未設定で生成拒否

- **WHEN** AI API キーが未設定である
- **AND** ユーザーが生成を試みる
- **THEN** 生成 API は 401 等で失敗する
- **AND** 設定を促すメッセージが表示される

### Requirement: AI タブの挿入は UP タブと同等である

AI タブ staging 画像の挿入操作は、UP タブと同様に `images/ai/<filename>` を `images/<filename>` へコピー（promote）し、staging 側を削除してはならない（MUST NOT）。続けて編集モードの CodeMirror において、選択範囲があればその範囲を、なければカーソル位置に `![{alt}](images/{filename})` を挿入しなければならない（SHALL）。`alt` は生成 API が返した短い説明を用いなければならない（SHALL）。HTML コメント `<!-- … -->` を挿入操作だけで削除してはならない（MUST NOT）。プレビュー・差分モードでは挿入してはならない（MUST NOT）。

#### Scenario: 挿入で promote と Markdown が追加される

- **WHEN** ユーザーが編集モードで AI タブから staging 画像を挿入する
- **THEN** `images/<filename>` が作成される
- **AND** カーソル位置または選択範囲に `![短い alt](images/<filename>)` が反映される
- **AND** `images/ai/<filename>` は残る
- **AND** 既存の `<!-- プロンプト -->` コメントはそのまま残る

### Requirement: AI タブはプロンプト入力と UP 同型 staging を提供する

AI タブは UP タブと同型のレイアウトとし、上部に **実線枠** のプロンプト入力エリア（複数行可）、その直下に **生成**・**自動入力**・**リセット** 操作（同一行・左寄せ、生成のみ primary）、下部に `images/ai/` の staging サムネイルグリッド（挿入・削除・拡大）を表示しなければならない（SHALL）。Markdown 内の画像スロット一覧を表示してはならない（MUST NOT）。生成中は **生成** ボタン付近にスピナーまたは同等の進行表示を示さなければならない（SHALL）。成功・失敗メッセージは AI タブ内バナーのみに表示し、他タブや Pane 共通ヘッダー直下に表示してはならない（MUST NOT）。

#### Scenario: プロンプトから生成できる

- **WHEN** ユーザーが AI タブにプロンプトを入力し生成を実行する
- **THEN** staging グリッドに新しい PNG が表示される
- **AND** スロット一覧 UI は表示されない

#### Scenario: 生成中にスピナーが表示される

- **WHEN** ユーザーが生成を実行する
- **AND** API 応答を待っている
- **THEN** 生成ボタン付近に進行中表示が出る

#### Scenario: AI タブの通知は AI ビュー内のみ

- **WHEN** AI タブで生成が成功または失敗する
- **AND** ユーザーが UP タブを表示している
- **THEN** 当該メッセージは UP タブには表示されない

### Requirement: 画像生成はプロンプトとレッスン全文を Claude に渡す

`POST /api/images/generate` は、リクエスト body の **prompt**（AI タブ入力）と **lesson**（未保存 `content` 全文）を受け取らなければならない（SHALL）。`canonicalPath` やスロット ID を要求してはならない（MUST NOT）。生成のみでは Markdown を変更してはならない（MUST NOT）。

#### Scenario: プロンプトと全文が API に含まれる

- **WHEN** ユーザーがプロンプトを入力して生成する
- **THEN** Claude 呼び出しにプロンプト文字列とレッスン `content` 全文が含まれる

### Requirement: visual-explainers グラフィックで PNG 化する

生成は Claude が **図 1 ブロック** 分の HTML 断片（`#capture-root` 内）を出力し、Playwright で PNG 化して `images/ai/<filename>` に保存しなければならない（SHALL）。デザイン品質規則の SSoT は `contracts/image-slot-contract.md` の「生成品質」セクションとし、リポジトリ外のスキル・HTML ファイルへの参照を用いてはならない（MUST NOT）。規則には構造図 + UI mock のグラフィック語彙、`custom.*` 配色・Lucide・surface カード、図内テキスト可・図外説明段落不可を含めなければならない（SHALL）。

HTML の横幅は **640〜960 CSS px を目安** とし、UI mock（エディタ・ターミナル等）は広め、フロー図・カードグリッドは狭めとする（SHALL）。768px 固定幅を要求してはならない（MUST NOT）。横並び過多で overflow しそうな場合は縦積みレイアウトを優先してよい（MAY）。

Playwright キャプチャは `#capture-root` の `scrollWidth` / `scrollHeight`（body padding 込み）に viewport を合わせ、`deviceScaleFactor` 2 で **要素全体** を PNG 化しなければならない（SHALL）。固定 viewport 768×600 と `boundingBox` + `page.screenshot({ clip })` のみでキャプチャしてはならない（MUST NOT）。横方向または縦方向に overflow するコンテンツの端が PNG から欠落してはならない（MUST NOT）。

生成 PNG の物理ピクセル長辺は **2048px 以下** でなければならない（SHALL）。超過時はアスペクト比を維持して縮小しなければならない（SHALL）。背景はライトとし、アプリのダークテーマに依存してはならない（SHALL）。

テキストは **図コンポーネント内**（ステップラベル・カード内短説明・UI mock 内ラベル等）に限り、4 ステップフロー例と同程度まで許容する（SHALL）。図コンポーネント **外** の導入段落・まとめ・キャプションを出力してはならない（MUST NOT）。任意で図全体のタイトル 1 行（h3 等）を含めてよい（MAY）。

#### Scenario: 生成成功で ai staging に PNG ができる

- **WHEN** ユーザーがプロンプトで生成を実行する
- **AND** Claude と Playwright が成功する
- **THEN** `images/ai/<filename>.png` が staging に作成される

#### Scenario: 契約に従った HTML が生成される

- **WHEN** Claude が図解 HTML を生成する
- **THEN** 出力は単一 diagram ブロック内に収まる
- **AND** 図コンポーネント外に説明段落を含まない

#### Scenario: 横長 UI mock の右端が PNG に含まれる

- **WHEN** 生成 HTML の `#capture-root` の `scrollWidth` が viewport 初期幅（768 CSS px）を超える
- **AND** Playwright が PNG 化する
- **THEN** 出力 PNG の CSS 幅（物理幅 ÷ deviceScaleFactor）は `scrollWidth` 以上である
- **AND** 右端のコンテンツが欠落していない

#### Scenario: 縦長コンテンツの下端が PNG に含まれる

- **WHEN** 生成 HTML の `#capture-root` の `scrollHeight` が viewport 初期高（600 CSS px）を超える
- **AND** Playwright が PNG 化する
- **THEN** 出力 PNG の CSS 高さ（物理高 ÷ deviceScaleFactor）は `scrollHeight` 以上である
- **AND** 下端のコンテンツが欠落していない

#### Scenario: 長辺上限で正規化される

- **WHEN** キャプチャ直後の PNG 物理長辺が 2048px を超える
- **THEN** 保存前にアスペクト比を維持して長辺が 2048px 以下になるよう縮小される

### Requirement: 小さい生成 PNG は警告を返す

生成 PNG の CSS 幅（物理幅 ÷ deviceScaleFactor）が **480px 未満** のとき、生成 API は成功レスポンスに `warning` 文字列を含めなければならない（SHALL）。PNG は staging に保存し、生成自体は拒否してはならない（MUST NOT）。AI タブは `warning` がある場合、当該タブ内バナーに表示しなければならない（SHALL）。

#### Scenario: 小 PNG 生成時に警告が返る

- **WHEN** 生成 HTML が CSS 幅 480px 未満の PNG になる
- **AND** 生成 API が成功する
- **THEN** レスポンスに非空の `warning` が含まれる
- **AND** `images/ai/<filename>.png` は staging に作成される

#### Scenario: AI タブで警告バナーが表示される

- **WHEN** 生成 API が `warning` 付きで成功する
- **THEN** AI タブ内バナーに当該警告が表示される

#### Scenario: 通常サイズでは warning を含めない

- **WHEN** 生成 PNG の CSS 幅が 480px 以上である
- **AND** 生成 API が成功する
- **THEN** レスポンスに `warning` フィールドは含まれない、または空である

### Requirement: 生成時に AI がスラッグと alt を決定する

Claude 応答は HTML 断片に加え、**ファイルスラッグ**（`[a-z0-9-]+`、拡張子 `.png` はサーバー付与）と **短い alt 文**（挿入 Markdown 用、1 行）を構造化して返すか、サーバーが同等情報をパースしなければならない（SHALL）。保存ファイル名は `{slug}.png` とし、`images/` 直下および `images/uploaded/`・`images/ai/`・`images/web/` のいずれかに同名が存在する場合は `{slug}-2.png`・`{slug}-3.png` … と連番でユニーク化しなければならない（SHALL）。

#### Scenario: 初回 slug で保存

- **WHEN** AI が `git-push-flow` をスラッグとし、同名ファイルが存在しない
- **THEN** `images/ai/git-push-flow.png` に保存される

#### Scenario: 衝突時に連番

- **WHEN** `images/git-push-flow.png` が既に存在する
- **AND** AI が同じスラッグ `git-push-flow` を提案する
- **THEN** `images/ai/git-push-flow-2.png` に保存される

### Requirement: AI タブはプロンプト自動入力とリセットを提供する

AI タブのプロンプト入力エリア直下に、左から **生成**・**自動入力**・**リセット** の操作を同一行・左寄せで配置しなければならない（SHALL）。**生成** のみ primary（強調）スタイルとし、**自動入力**・**リセット** は非 primary としなければならない（SHALL）。

**自動入力** を実行したとき:

- 編集モードでカーソルが HTML コメント `<!-- … -->` **内** にある場合、プロンプト欄に当該コメントの内部テキスト（trim 済み）を設定しなければならない（SHALL）。Claude 呼び出しは行ってはならない（MUST NOT）。
- カーソルがコメント **外** にある場合、`POST /api/images/suggest-prompt` を呼び出し、返却されたプロンプト文字列でプロンプト欄を **上書き** しなければならない（SHALL）。

**リセット** を実行したとき、プロンプト欄を空文字列にしなければならない（SHALL）。

自動入力の Claude 呼び出し中は、生成と同様に進行中表示（スピナー等）を **自動入力** ボタン付近に示さなければならない（SHALL）。自動入力中・生成中は相互に操作を無効化してよい（MAY）。

#### Scenario: コメント内で自動入力

- **WHEN** 編集モードでカーソルが `<!-- 4 ステップのフロー -->` 内にある
- **AND** ユーザーが自動入力を実行する
- **THEN** プロンプト欄に `4 ステップのフロー` が設定される
- **AND** suggest-prompt API は呼ばれない

#### Scenario: コメント外で自動入力

- **WHEN** 編集モードでカーソルが HTML コメント外にある
- **AND** ユーザーが自動入力を実行する
- **THEN** suggest-prompt API が lesson と cursorOffset を受け取る
- **AND** 返却 prompt でプロンプト欄が上書きされる

#### Scenario: リセットでプロンプトが空になる

- **WHEN** プロンプト欄に文字列がある
- **AND** ユーザーがリセットを実行する
- **THEN** プロンプト欄は空になる

### Requirement: プロンプト提案 API を提供する

`POST /api/images/suggest-prompt` は、リクエスト body の **lesson**（未保存 `content` 全文）と任意の **cursorOffset**（CodeMirror 文字 offset、省略時 0）を受け取らなければならない（SHALL）。Anthropic API キーが未設定のときは 401 等で失敗しなければならない（SHALL）。

成功時は `{ prompt: string }` を返さなければならない（SHALL）。`prompt` は AI タブの画像生成プロンプトとしてそのまま用いられる図解指示文（HTML コメント相当）でなければならない（SHALL）。Markdown 本文は変更してはならない（MUST NOT）。

Claude 呼び出しには、レッスン metadata・全文 body・カーソル付近のテキストスニペットを含めなければならない（SHALL）。

#### Scenario: suggest-prompt 成功

- **WHEN** API キーが設定されている
- **AND** クライアントが lesson と cursorOffset を POST する
- **THEN** 200 で `{ prompt }` が返る
- **AND** prompt は非空の文字列である

#### Scenario: キー未設定で suggest 拒否

- **WHEN** API キーが未設定である
- **AND** クライアントが suggest-prompt を POST する
- **THEN** 401 等で失敗する

