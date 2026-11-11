# 鬼灯村 NPC素材 4方向・歩行版

共通店員、畑仕事の村人、村人、年配の村人、子ども、鐘守と、オープニングから本編に引き継ぐ里長・さとこ・お澄の9種です。`walk-preview.gif` で4方向の歩行ループを、`preview.png` で4方向の待機絵を確認できます。

茶店 `teahouse`、道具屋 `shop`、宿 `inn`、兵具屋 `armory` は、すべて `npc-walk.json` の `shop-clerk` を参照します。施設ごとの会話や処理は各施設のデータで設定できます。

## オープニングに合わせる人物

旧リポジトリ `HiHoSir/yaksha-hanamusubi` の[採用済みオープニング映像](https://github.com/HiHoSir/yaksha-hanamusubi/blob/26136fef4e73bcea60a73edf4e02cd252b3976d0/assets/prologue/pixel-v2/prologue-pixel-v2-complete.mp4)をそのまま使う方針です。映像の組み込み時は旧版の[接続仕様と開始後の里長イベント](https://github.com/HiHoSir/yaksha-hanamusubi/blob/26136fef4e73bcea60a73edf4e02cd252b3976d0/assets/prologue/pixel-v2/INTEGRATION.md)と[音声クレジット](https://github.com/HiHoSir/yaksha-hanamusubi/blob/26136fef4e73bcea60a73edf4e02cd252b3976d0/assets/prologue/pixel-v2/CREDITS.md)を参照します。

| ID | 人物 | 引き継ぐ特徴 |
| --- | --- | --- |
| `chief` | 里長 | 白髪・白髭、苔色の羽織、茶の袴。旧版では映像終了後、最初の進行を担当。 |
| `satoko` | さとこ（里子） | 黒褐色のボブ、山吹色の上衣、赤い帯、青緑の短パン。映像前半で緋月と会話。 |
| `osumi` | お澄 | まとめ髪と小花、くすんだ紫の着物、生成りの前掛け。映像後半に登場。 |

3人は旧版の4方向歩行シートを80×112 pxのコマに変換し、輪郭と足元を鬼灯村用に揃えました。出典のパスとコミットは各素材の `origin`、必須IDは `requiredSprites` に記録しています。

## スプライトシート

`sprites/` の各透過PNGは240×448 pxです。鬼灯村の緋月と同じ80×112 pxのコマと足元アンカー (40, 106) を使います。

| 行番号 | 向き | 0列目 | 1列目 | 2列目 |
| ---: | --- | --- | --- | --- |
| 0 | 前（下） | 待機 | 歩行A | 歩行B |
| 1 | 後ろ（上） | 待機 | 歩行A | 歩行B |
| 2 | 右 | 待機 | 歩行A | 歩行B |
| 3 | 左 | 待機 | 歩行A | 歩行B |

歩行中は進んだ距離に応じて列番号 `1 → 0 → 2 → 0` を繰り返し、停止時は0列目を表示します。シート内のコマ原点は `(列 × 80, 行 × 112)`、マップ上の描画原点は `(足元X − 40, 足元Y − 106)` です。
