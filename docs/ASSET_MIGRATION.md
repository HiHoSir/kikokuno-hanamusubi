# フィールド・村の素材移行記録

## 移行元と選別
- 元リポジトリ: `HiHoSir/yaksha-hanamusubi`、固定コミット: `26136fef4e73bcea60a73edf4e02cd252b3976d0`
- フィールド: `js/landscape.js` の `specs` と `load()` の実読込対象36画像を選別。
- 原本を読み、PNGシグネチャを確認。GitHubの移行元・先Blob SHA一致を照合し、無変換で登録。
- `assets/manifest.json` に新しい安定パス、元ファイルパス、出典コミット、用途を登録。
- 旧版・試作・関連しないゲームコードは移していない。元リポジトリ内のファイルも削除していない。

## 注意と未完了
新リポジトリは素材保管基盤であり、ゲームコードはまだない。従って新パスでの実描画・フィールド歩行・グリッド接続・公開・実機Safariは未検証。
旧実装由来の素材は移行された正本**候補群**であり、移行後のゲーム表現まで自動的に承認したことは意味しない。

## 鬼灯村
次の移行では `js/hozuki-village-game.js` が使用する `assets/maps/hozuki-village-v1` と `js/settlement-map/catalog.js` 内で実際に配置されているチップを基準にする。比較用 `reference.png` 等は原則移さない。
