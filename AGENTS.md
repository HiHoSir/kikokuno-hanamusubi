# 鬼哭の花結び — 新制作リポジトリ共通規則

## 正本と対象
- 正本は `HiHoSir/kikokuno-hanamusubi` の `main`。これは第1作『鬼哭の花結び』用の新規制作環境。
- 旧 `HiHoSir/yaksha-hanamusubi` と続編 `HiHoSir/kikokuno-hanachigiri` の実装・アセット・採用状態を無断移植しない。
- 制作前に本書、関連する `.agents/skills/<name>/SKILL.md`、`docs/REPOSITORY_POLICY.md`、`assets/manifest.json` と実ファイルを確認。読めない規則・未確認の承認状態を推測しない。
- ゲームの現行入口は `index.html`。村・室内・フィールド・天妖の社の本編実装は `src/` と `data/` を正本とし、採用素材は `assets/manifest.json` と一致させる。天妖の社の接続仕様は `docs/TENYO_SHRINE.md`。

## スキルの唯一の保存先
- 画像やアセットの生成・編集・変換: `.agents/skills/asset-design/SKILL.md`
- 鬼灯村の建物・室内・NPC配置・会話・入退場・iPhone検査: `.agents/skills/build-hozuki-village/SKILL.md`。この作業の制作手順はリポジトリ内の正本に従い、リポジトリ外のマップ制作スキルを参照しない。
- 地形タイル・小物・NPCの画像制作は `.agents/skills/asset-design/SKILL.md` の該当テンプレートを使う。
- 緋月のキャラクターデザイン・立ち絵・歩行・戦闘ポーズ: `docs/characters/HIZUKI_CANON.md` と `.agents/skills/hizuki-character/SKILL.md`（asset-design併用）
- 新規スキル作成前に既存の役割を確認し、重複する場合は既存スキルを修正。新設時はこの一覧を更新。ルート直下に `skills/` を作らない。

## 命名の禁止事項
- 新規素材のID・パス・設定キーは**役割・方向・セル寸法**などの検証可能な属性で命名する。AIが考えた仮称、制作日、候補名、通称を正式な識別子に昇格させない。
- 移行元の旧称は `origin.path` や `sourceOriginalPath` といった**出典メタデータにだけ**残す。新ゲームの `variants`・デフォルト値・アセットID・ファイル名には流用しない。
- 新しい識別子を追加する前に `assets/manifest.json`、関連データ、検査、旧識別子の使用先を照合し、呼称の増殖・二重管理を防ぐ。詳細は `docs/REPOSITORY_POLICY.md`。

## 保存先とバージョン管理
- `assets/` は採用済みの実ゲーム素材だけ。**全てのファイル**を `assets/manifest.json` に登録する。IDとパスは一意にする。
- 生成途中・未承認・比較・デバッグ出力はGit管理対象外の `work/` に置く。`old/`・`backup/`・`experimental/`を置き場にしない。履歴保存はGitと元のリポジトリを利用する。
- ユーザーが保存を依頼したBGM候補パックは `review/audio/bgm-pack/` に保管する。対象はOGG、MIDI、同梱README。
- 採用ファイルを `-final2` や `-copy` として増やさない。同一の安定パスを更新し、過去版はGit履歴から取り出す。
- `new-` 等の暫定版名を採用素材に残さない。新旧が同用途なら新版のみを正式名で1件保存し、旧画像はリポジトリに残さない（Git履歴または元リポジトリで復元）。異なるサイズ・役割の素材は個別用途を確認して区別する。
- 再編集に必要な原本のみ `source-assets/` に保存し、台帳の `sourcePath` で紐づける。完成画像の複製を原本として保管しない。
- `src/`: ゲームコード、`data/`: ゲームデータ、`docs/`: 現行仕様、`tools/`: 共通ツール、`tests/`: 検査。

## 画像制作の原則
- 既存素材の再利用・加工が可能なら新規生成しない。生成前に用途、占有、32pxグリッドとの関係、接続方向、視点、出力寸法、透過、接地、判定、遮蔽、承認済み外見を確定する。
- 仕様確認用の画像・比較画像を勝手に生成しない。画像加工で修復可能なら再生成しない。
- 生成結果・採用候補・採用済み・ゲーム実装・公開を混同しない。

## 本編の単一ページと音声の責務
- タイトルはルート `index.html`、オープニングは `src/opening/`、本編の唯一の実行ページは `src/game/index.html`。本編の村・室内・フィールド・天妖の社・戦闘は**親ページから読み込む内側の描画ページ**とし、独立して開始しない。
- `src/game/navigation/game-shell.mjs` の親画面でBGMを継続再生する。村と室内は同一のトラック `village` のまま再生位置を一切リセットしない。個別描画ページで別BGMプレイヤーを作らない。
- 画面間移動は `window.KIKOKU_ROUTE.go(遷移先)` のみ使用。親ページにいる場合は `window.KIKOKU_GAME.navigate` へ移譲する。 `location.assign` による画面切替は禁止。
- 新規の本編画面は `src/game/navigation/game-shell.mjs` の許可ルート・BGM割当、`src/game/navigation/entry.js`、`tests/entry-routing.test.mjs`、`tests/game-shell.test.mjs` を一緒に更新する。直URLと更新はタイトルへ戻す。検査専用 `previews/` は対象外。詳細は `docs/GAME_ENTRY.md`。

## 実装・検査・公開
- コード変更前は現行実装と原因を調査してから最小範囲を修正する。
- `npm test` とゲーム固有の検査を行う。GitHub Actions、Pages、iPhone実機Safariは独立した検査として扱い、未実施を成功と報告しない。
- GitHub反映依頼には連携から反映し、コミットSHAと検証結果を確認する。連携権限がない場合は反映済みと偽らない。
