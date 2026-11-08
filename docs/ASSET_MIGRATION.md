# フィールド・村の素材移行記録

## 移行元と選別
- 元リポジトリ: `HiHoSir/yaksha-hanamusubi`、固定コミット: `26136fef4e73bcea60a73edf4e02cd252b3976d0`
- フィールド: `js/landscape.js` の `specs` と `load()` の実読込対象36画像を調査し、新版で置き換わった旧版3件を除く33画像を選別。
- 原本を読み、PNGシグネチャを確認。GitHubの移行元・先Blob SHA一致を照合し、無変換で登録。
- `assets/manifest.json` に新しい安定パス、元ファイルパス、出典コミット、用途を登録。
- 旧版・試作・関連しないゲームコードは移していない。元リポジトリ内のファイルも削除していない。

## 注意と未完了
新リポジトリは素材保管基盤であり、ゲームコードはまだない。従って新パスでの実描画・フィールド歩行・グリッド接続・公開・実機Safariは未検証。
旧実装由来の素材は移行された正本**候補群**であり、移行後のゲーム表現まで自動的に承認したことは意味しない。

## 鬼灯村（第二段階）
- 現行 `js/hozuki-village-game.js` が読み込む `assets/maps/hozuki-village-v1/layout.json`、`collision.json` と地面画像を移行。
- 実配置JSONに現れる31テンプレート（合計678配置）をカタログから照合し、使用中のPNGのみ移行。全村エディタの素材や旧プレビューを一括移植していない。
- PNG32件（地面1＋パーツ31）を原本と同一Blob SHAで移行。整理後のフィールド画像33件を合わせ、採用素材台帳は**65件**。
- 配置・判定JSONはバイトを変更せず `data/maps/hozuki-village/layout.json`、`collision.json` へ移し、画像と物理設定を分離。
- 元の相対パスを参照する旧ランタイムはコピーしていない。新ランタイムでのパス解決・画像合成・歩行・描画順は未検証。
- NPCキャラクター画像・室内素材・比較用 reference.png は今回の移行対象外。旧リポジトリは削除していない。

## 2026-11-09 新旧整理
- 旧版 `village.png`、`torii.png`、`cave.png`（旧 `places-v1` 由来）を新リポジトリから削除。新版 `field-map-objects-v3` 由来を優先。
- `new-` 付きの正式登録名9件を、`village.png`、`torii.png`、`cave-large.png`、`house.png`、`fort.png`、`pagoda.png`、`trees.png`、`mountain-small.png`、`mountain-large.png` に統一。各画像のGit blob SHAは不変。
- ゲーム本体のコードは移行していないため、描画時には新版に統一された `assets/manifest.json` のパスを参照すること。

## 2026-11-09 緋月のフィールド・村歩行アセット（正しい依頼対象）
- フィールドの標準表示: SD 32px版 `assets/characters/hizuki/walk-sd-32.png`（旧 `field-sd-v3`）。12コマ、96×128px。
- 鬼灯村の標準表示: Hana版 `assets/characters/hizuki/walk-hana-80x112.png`（旧 `hana-20261107`）。12コマ、240×448px。
- エリア別のデフォルトと画像セル順、足元アンカーなどは `data/characters/hizuki-walk.json` に記録。両方ともエリアで選択できる異なる表示スタイルであり、新旧の置き換え関係ではない。
- SDのユーザー編集原本を `source-assets/characters/hizuki/walk-sd-editor.json` に元バイトのまま保管。編集JSONの方向順は正面・背面・左・右、完成PNGの行順は正面・背面・右・左。混同しない。
- 元の3ファイルと転送後のGit blob SHAを照合。PNG生成や画素変換は行わない。
- **旧ゲームの描画コードは移植していない。** 画像と台帳の登録は完了したが、新ゲームの描画・歩行・足元位置・Safari表示は未検証。
- この前に誤って移行したフィールド・村の地形／建物65件は今回変更していない。緋月2件と合わせ、登録は67件。これら65件の取扱いは別途判断が必要。
