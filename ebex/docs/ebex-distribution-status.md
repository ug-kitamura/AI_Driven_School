# EBEX 配布（subtree / dual-root）— 現状サマリ

**最終更新: 2026-07-21**

EBEX を独立リポにして subtree で他リポへ配布する構想の、決定事項・実装状況・未決事項をまとめた現状ドキュメント。

- 議論の一次記録は [`grill-me-20260710.md`](grill-me-20260710.md)（当時のセッション記録。**一部が本ドキュメントで訂正されている**）
- 本ドキュメントが現状の正本。着手前にここを読むこと

---

## 1. 目的と全体像

EBEX を1つのリポとして独立させ、**subtree で他リポ（ホスト）へ配布**する。ホスト直下の `ebex/` に EBEX 一式が入り、ホスト自身の `.claude/` や `workspace/` と共存する。

```
host-repo/
├── .claude/skills/     ← ホストのスキル（社員が使う主役）
├── workspace/          ← ★ 作業データの正本（ホスト所有）
├── openspec/           ← ホストのプロジェクト仕様
├── start.bat           ← ホスト管理（ebex/start.host.bat からコピー）
└── ebex/               ← subtree（EBEX 製品）
    ├── .claude/skills/ ← 製品同梱スキル
    ├── contracts/      ← ebe-purpose.md 等
    ├── openspec/       ← 製品仕様
    └── (Next.js アプリ本体)
```

## 2. 「2層」が指すもの（誤解しやすい点）

**workspace は2層ではない。** 正本は**ホストルートのみ**で決着済み（subtree に `workspace/` は含めない）。

2層なのは**パス解決の基準**の方である。

```
appRoot     = process.cwd() = host/ebex/    → contracts/, .claude/skills/, openspec/
projectRoot = host/                         → workspace/, .claude/skills/
```

「workspace を2層にせず ebex はホスト以下のものを使う」という案は、**すでに採用済みの方針そのもの**。ただし「ebex 単体開発時は `ebex/workspace/` を使う」というフォールバックが1つ残っており、これを残すか捨てるかは未決（→ 6章 #1）。

## 3. 決定事項（grill-me-20260710）

| 項目               | 決定                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| subtree に含める   | Next.js アプリ本体 + 製品用 `.claude/` + 製品用 `openspec/`          |
| subtree に含めない | ホストの `workspace/` / `.claude/skills/` / `openspec/`              |
| workspace 正本     | **ホストルートのみ**                                                 |
| projectRoot 指定   | 環境変数 `EBEX_PROJECT_ROOT`（未設定時は appRoot にフォールバック）  |
| スキル解決         | ホスト + ebex の**両方**を和集合。同 id は**ホスト優先**             |
| スキル命名         | ebex 側は汎用名（接頭辞なし）、ホスト側は接頭辞（`A-` 等）で衝突回避 |
| openspec           | 完全分離・マージなし                                                 |
| 起動               | ホスト直下の `start.bat`（`ebex/start.host.bat` をコピー）           |
| 配信               | ebex リポの GitHub Actions が各ホストへ `subtree pull` → push        |
| 衝突回避           | ホストは `ebex/` を手編集しない。カスタムはルート側に寄せる          |

## 4. 実装状況（2026-07-21 時点でコード確認済み）

### 済んでいるもの

`lib/agent/skill-loader.ts` の複ルートスキルカタログは動作している。

```
SKILL_HOST_CONVENTIONS = ['.claude', '.cursor', '.agents', '.github']
getEbexRoot()           module位置 → cwd → cwd/ebex を探索
getSkillCatalogRoots()  [ebex, host] を返す
loadSkill / resolveSkillDir   後ろ(host)優先で解決
```

### 未着手のもの

```
EBEX_PROJECT_ROOT     コード内に一切存在しない
appRoot / projectRoot の分離
    process.cwd() 直書きが 27ファイル / 32箇所
    → 配布後は cwd = host/ebex/ なので全部が host/ebex/workspace を見に行く
      （欲しいのは host/workspace）
スキル一覧の表示順     listSkills は id のアルファベット順。
                       要望の「host → ebex の順」になっていない
start.host.bat        テンプレート未作成
配信 Actions          未着手
```

## 5. 訂正: 「#4 をやればリネーム EPERM も直る」は誤り

**この主張は取り下げる。**

```
誤った主張:  workspace を Next プロジェクトルートの外へ出せば
             監視範囲から外れてフォルダリネームの EPERM も消える

実際:        原因は外部エディタ（VSCode）がディレクトリハンドルを保持すること。
             VSCode はホストルート全体を開いて監視するため、
             workspace が host/ 直下へ移っても監視範囲の中。
             → 配布対応では直らない。
```

**根拠**（会社PCでの検証）:

- 本番モード（`next start` = ファイル監視なし）でも dev と同じく再現した → `next dev` の watcher 説は**棄却**
- **VSCode を閉じると再現しなくなる** → 保持者は外部エディタ側
- `files.watcherExclude` を入れても再発、エディタタブを全部閉じても変わらず
- **後から作ったフォルダはリネームできる** → 再帰ウォッチャーではなく「そのフォルダに個別に触れた履歴を持つ何か」が保持している

決定打は `resmon` の「関連付けられたハンドル」でフォルダ名を検索し保持プロセスを特定すること。会社PCでのみ発生するため調査は保留中。

**結果として、#4 の動機は「subtree 配布したい」の1つだけになった。** 「厄介な問題の恒久対策でもある」という理由付けは根拠を失ったため、優先度は下がる。

## 6. 未決事項

| #   | 論点                                                   | メモ                                                                                                                            |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ebex 単体開発時に `ebex/workspace/` を残すか           | 残す＝フォールバック分岐が要る。捨てる＝単体開発の置き場が消える                                                                |
| 2   | `EBEX_PROJECT_ROOT` か自動検出か                       | 推奨は「env var + 起動時に自動検出と突き合わせて警告」。誤設定でホストの作業データが `ebex/workspace/` に溜まるのが最悪シナリオ |
| 3   | AI_Driven_School との関係                              | ADS を canonical ホストにする案は未回答のまま                                                                                   |
| 4   | `node_modules/` `.next/` の subtree 混入               | `ebex/.gitignore` に閉じ込める必要あり（ebex 自身の .gitignore にはある）                                                       |
| 5   | `workspace/.meta/` の所在                              | セッション・お気に入り・diagnostics。ホスト側に付くはずだが明文化されていない                                                   |
| 6   | `next.config.ts` の `outputFileTracingRoot: __dirname` | appRoot 固定。projectRoot 配下を読むので本番ビルドで問題が出ないか要検証                                                        |
| 7   | `.claude/skills/openspec-*/` が gitignore 対象         | 配布物に含まれない。ホストがどう入手するか未定                                                                                  |
| 8   | ホストの `.vscode/settings.json`                       | `files.watcherExclude` を配布テンプレートに含めるか（リネーム問題の緩和。ただし5章のとおり決定打ではない）                      |

## 7. 進め方の提案

```
1. grill-me を再走して 6章の未決を潰す
     → 本ドキュメントを更新する（grill-me-20260710.md は履歴として温存）

2. 先に「表示順 host → ebex」だけ切り出す
     → skill-loader 内で完結。dual-root 本体と独立して出せる小さい change

3. dual-root 本体は change を2つに分ける
     3a. getProjectRoot() 導入 + 27ファイルの置換（中身は process.cwd() のまま＝挙動不変）
     3b. EBEX_PROJECT_ROOT を読ませて実際に分離
     → 3a を単独でマージできれば、3b のレビュー範囲が劇的に小さくなる
```

**3a について**: 以前「原因不明の不具合（リネーム EPERM）の切り分けを優先する」として一度取り下げたが、**その不具合の原因が EBEX の外だと判明したため、取り下げ理由は消えている**。再開して問題ない。

なお `getProjectRoot()` は fs アクセスを持たせないこと（`process.cwd()` はファイルシステムを触らない。将来の dual-root 版も起動時1回のキャッシュで済ませる）。

## 関連ドキュメント

- [`grill-me-20260710.md`](grill-me-20260710.md) — 配布・ホスト構成の一次議論記録（5章の内容で一部訂正）
- [`grill-me-20260706.md`](grill-me-20260706.md) — 3ペイン設計
- `openspec/specs/ebex-agent-skill-runtime/spec.md` — 複ルートスキルカタログの現行仕様
