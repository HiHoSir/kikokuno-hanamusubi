# 潮待村をフィールドへ配置（2026-11-22）

正本は第一作 `HiHoSir/kikokuno-hanamusubi`。**既存の海の入り江は残したまま、潮待村を別マップのまま本編フィールドに配置する**。ユーザー指示：「とりあえずさっき作った村をフィールドに配置しよう」。

## 配置

| 項目 | 実装 |
| --- | --- |
| 追加する地点 | 潮待村（鬼灯村とは別の集落、現行2村目） |
| フィールド入口 | **セル (53,51)・(54,51)**（村の絵の左右2マス） |
| 海の入り江 | フィールド南岸の砂浜セル (49,53) |
| 表現 | 鬼灯村と共通のフィールド用 `assets/field/objects/village.png` を原寸64×32pxで表示 |
| 村本体 | `data/maps/shiomachi-village/scene.mjs`、`src/game/shiomachi/` の**既存の42×54マップ**を原寸・同じカメラ倍率で利用 |
| 出入り | フィールドの村の絵のどちらかに踏み込むと `src/game/shiomachi/`。村の南口から `src/field/?from=shiomachi` に戻る |
| フィールド帰還 | 入口に踏み込む**直前の安全なセル**を sessionStorage に記録し、帰還時に使う。情報がない場合は入口に隣接する安全なセルを探索 |
| 本編の共通画面 | 新しいページ遷移や別タブではなく `src/game/navigation/game-shell.mjs` の許可ルート。フィールドと同じBGMを使い、遷移による曲の再スタートを避ける |
| 保存 | 既存の手動／自動セーブに `shiomachi` の位置を追加。室内で保存した場合も外観の安全な最終位置へ戻る。戦闘・両・既存スロットを破壊しない |

## ユーザー承認済みの既存仕様を保護

- **フィールドにだけ32px地形格子制約**がある。潮待村の家・人物・屋内・港・桟橋は**原寸のまま**で、再スケールしない。
- 村の北の海岸線・既存建物4棟・NPC4名・宿／兵具屋／茶店と網職人の家・室内への歩行入場は**同じ実装を共用**する。既存プレビュー `previews/shiomachi-village/` も引き続き検査可能で、新規のレビューHTMLを増やさない。
- **本編の兵具屋は4点を個別販売する。** 購入・装着・保存を本編の共通システムに接続済み。茶店では本編の食品購入・貝殻買取を行う。独立プレビューと村の宿は試用サービス。品揃えと価格は [装備台帳](EQUIPMENT_CURRENT_PLAYABLE.md) を参照。
- 海の入り江のシナリオ潮平・貝殻・釣り道具・鬼灯村兵具屋を変更しない。休憩所や洞窟は未実装のまま。
- 潮待村はセル (53,51)・(54,51)。入り江のフィールド復帰地点から最短5歩。

## 検査

- `node --test tests/shiomachi-village.test.mjs tests/save-load.test.mjs tests/entry-routing.test.mjs tests/game-shell.test.mjs`：プレビュー維持、正規ゲーム許可ルート、保存と復帰
- `node tools/qa-field-route-playability.mjs`：実当たり判定で鬼灯村→社43歩、社→入り江37歩、入り江→潮待村5歩の経路を検査
- `node tools/qa-shiomachi-field-roundtrip.mjs`：本編の親画面で現実の移動入力を使って**フィールドから入る→家・NPCが読み込まれる→村内で保存→南口から出る→安全な元位置へ戻る**。本編での兵具購入・装着・保存も確認
- `.github/workflows/field-route-qa.yml` のGitHub Actionsに結果とスクリーンショットを保存。**Chromium検査とiPhone Safari実機承認は別**。

## 承認記録

`docs/decisions/changes/2026-11-22-connect-shiomachi-to-field.json` に変更前の制約・本件の原文・変更と保存/経路への影響を記録する。
