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

## 横画面専用の現行ルール
- 本編は横画面のみ。縦向きでは親の回転案内を出し、画面回転では再読み込み・BGMリセット・移動入力保持を行わない。
- フィールドは正方形からの切り抜きではなく投影レンダラーに横画面幅を渡して描画する。旧 fieldViewportCrop、object-fit:cover、下108pxの不透明な操作帯は復活させない。
- 村・室内・天妖の社・戦闘でも横画面の縦横比を崩さず、地形・建物・緋月の個別アセットを引き伸ばさない。
- 横画面基準・画面別の検査状況は docs/LANDSCAPE_LAYOUT_REVIEW.md を参照。未検査を実機合格としない。


## 戦闘バランス・装備・探索経路の仕様変更ガード（2026-11-22）

**既存の確定設計を先に読み、未決定事項をAIが決めたことにしない。** 2026-11-22の重大なレビュー漏れは `docs/incidents/2026-11-22-design-override.md` に経緯と原因を記録した。

- 攻守・段成長・敵・報酬・装備品の性能／価格・入手時期・村へのティア割当・フィールド経路を変更する前に、必ず `docs/BALANCE_PROGRESSION_CONTRACT.md`、`docs/BATTLE_BALANCE.md`、`docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md`、`docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`、`data/characters/hizuki-status.json`、関係する実装コードを読む。
- **確定／後日ユーザーが承認／アシスタントによる提案／独立プレビュー用の仮値／未実装**を区別してから作業する。 関係する現行状態の入口は `docs/decisions/CURRENT_STATUS.md`。そこから必ず元の正本・コードへたどる。前の承認を覆すときは、それを明示したユーザーの指示が必要。承認されていない数値や施設・入手場所を補完しない。
- **室内接続、商品ラインナップの差別化、続けて、バランス検査**は、それだけで数値の新規決定・変更の承認にはならない。村間距離と所持金だけを根拠に確定T0〜T6や仮の店の商品を勝手に弱体化・強化しない。
- **仕様／店舗／地形／遭遇の保護対象を編集・削除・改名するPRは、同じPRで `docs/decisions/changes/YYYY-MM-DD-*.json` を新規作成または更新する。`affectedFiles` に変更した保護対象パス（改名前・削除前も含む）を正確に列挙する。** 既存の仕様・今回の変更・影響・保護する原則・検査・ユーザー指示の原文を記載する。原文や出典が不明なら、仕様変更せず不足情報として扱う。詳しくは `docs/decisions/README.md`。
- `.github/workflows/repository-guard.yml` はPR時に `tools/guard-design-changes.mjs` を実行し、変更根拠の**記録漏れ**を検出する。ただし自動検査はユーザーが実際に承認したことまでは確認できない。AIが存在しない承認発言を作ることを厳禁とする。承認の実在は別途レビューで照合する。
- 変更後は `npm test` と関連ブラウザ検査、可能な範囲の実機検証を分けて報告する。**テストが通ることと設計に従っていることは別物**。未接続の休憩所やダンジョンを実装済みとして説明しない。

## 実装・検査・公開
- コード変更前は現行実装と原因を調査してから最小範囲を修正する。
- `npm test` とゲーム固有の検査を行う。GitHub Actions、Pages、iPhone実機Safariは独立した検査として扱い、未実施を成功と報告しない。
- GitHub反映依頼には連携から反映し、コミットSHAと検証結果を確認する。連携権限がない場合は反映済みと偽らない。
