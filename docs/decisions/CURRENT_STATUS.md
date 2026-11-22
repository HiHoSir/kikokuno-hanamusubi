# 現行設計の確認表（2026-11-22）

> 第一作『鬼哭の花結び』：**`HiHoSir/kikokuno-hanamusubi` 専用**。実装や確定仕様を上書きする新規企画書ではない。
> **最初に読む索引**。仕様値の原本は `data/characters/hizuki-status.json`、`docs/BALANCE_PROGRESSION_CONTRACT.md`、現行コード。過去の記述は**作成時点の記録**であって、最新の実装状況とは限らない。

## 設計・実装・承認状態

| テーマ | 承認・実装状態 | 正本／照合先 | 次の変更前に解消すること |
| --- | --- | --- | --- |
| **B式v2・T0〜T6** | **確定。T1攻+20／守+14、T2攻+42／守+30、以降も原本維持** | `data/characters/hizuki-status.json`、`docs/BALANCE_PROGRESSION_CONTRACT.md`、`tests/approved-progression-contract.test.mjs` | 新品の値を村の距離で独断調整しない。部位別配分・二重適用を検証 |
| **初回必要心** | **実装済み：段1→2は32**（一般式とは初回だけ別）。上限99、ラスボス想定40 | `src/game/battle/rules.mjs`、`docs/BATTLE_BALANCE.md` | `hizuki-status.json` の一般式欄に初回例外の注記がなく、表記差を監査中。原本値を無断変更しない |
| **鬼灯村の個別装備** | **販売実装済み：4部位・合計攻+4／守+7**。T1確定値との**不一致が未解決** | `src/game/battle/rules.mjs`、`tests/approved-progression-contract.test.mjs`、[現行装備台帳](../EQUIPMENT_CURRENT_PLAYABLE.md) | 承認済み個別販売を勝手に書き換えない。T1との合算規則を明示的に整理 |
| **4村体制** | **ユーザー決定：鬼灯村を含め合計4村**。3つの新村の名前・フィールド座標は試作・未承認 | `docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md`、[PR #64](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/64) | 村を増やすためにティア数を変更しない |
| **潮待村プレビュー** | **独立プレビュー稼働**。兵具屋・宿・茶店と民家の室内接続は実装済み。**本編フィールド未接続** | `data/maps/shiomachi-village/scene.mjs`、`src/game/shiomachi/`、[PR #68](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/68) | マップ・室内の動作検査と、本編のシナリオ/旧セーブの影響を確認 |
| **既存地域の装備入手状況** | **鬼灯村＝本編販売4点、天妖の社／海の入り江＝装備入手なし、潮待村＝プレビューのみ**。ゲーム内定義から集約する台帳モジュールを追加 | [現行装備台帳](../EQUIPMENT_CURRENT_PLAYABLE.md)、`src/game/equipment/current-availability.mjs` | 地名やティアとショップ実装を混同せず、装備の追加前に必ず台帳と原案を照合 |
| **潮待村の装備** | **デモ専用・未承認**。正式な装着・セーブ・戦闘反映なし。128両案は撤回済み | `data/maps/shiomachi-village/armory.mjs`、[PR #72](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/72) | 原案の地域別到達段・敵・ティア数値との整合性が確認できるまで値を確定しない |
| **装備ティアの入手場所** | **未確定**。天妖の社後T1／入り江T2などは11月15日の**当初配置仮説**。潮待村=T2は承認されていない | `docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`、`docs/BALANCE_PROGRESSION_CONTRACT.md` | 実際の到達段・洞窟経路・地域敵の進行を先に評価 |
| **序盤の敵** | **実装済み：野の小鬼・化け狸・鬼火**。最初の道路区間に出現帯を設定。9〜13歩間隔 | `src/game/battle/rules.mjs`、`src/field/walk.mjs`、`tests/map-progression-audit.test.mjs` | 海・森・滝・祠の仮の敵を実装済みとみなさない |
| **フィールド道順** | **80×80、32pxグリッド**。道路メタデータは42／42／30／20／60／30マス。実通行判定の最短経路は**鬼灯村→天妖の社43歩／社→入り江33歩**で、11月15日の旧検討と一致。残り区間は未計測 | `data/maps/field/terrain.js`、`tools/audit-map-progression.mjs`、`tools/qa-field-route-playability.mjs`、`docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md` | 今後のマップ変更で歩数・遭遇数の変化をブラウザ再測定。実戦回数は未検証 |
| **休憩所・行商人** | **未実装**。フィールドに地点データがあっても入店・販売はできない | `data/maps/field/terrain.js`、`src/field/walk.mjs` | 存在しない中間装備更新地点を作った前提でバランス変更しない |
| **山越え必須洞窟** | **ユーザーが了承したマップ設計方針／本編接続は未実装** | `docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`、現在の `src/field/world.js` | 北への探索経路、入口位置、歩行テストを実装する際に原案と照合 |

## 読み違いの防止

1. **「確定」と「実装」は異なる**。装備ティアの数値が確定していても、各店でそれを買えるという意味ではない。
2. **「以前の計画」と「現在の実装」も異なる**。過去の資料に「潮待村の室内は未実装」とあっても、それはPR #68以前の初期試作時点の記述。作成日と後続PRを必ず確認する。
3. **足りない記録は勝手に補完しない**。11月15日のマップ先行設計は [PR #73](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/73) で再録したが、すべてが承認されていたことを意味しない。
4. **PRの数値変更は出典必須**。実装変更時は `docs/decisions/README.md` の変更記録を同じPRに添付する。削除・改名も含め保護対象ファイルのパスを記録する。
5. `npm test` が通っても、ユーザーの明示承認があったとは証明できない。根拠の原文確認と実画面検査は別工程。

## 当面の未解決事項

- T1の確定攻+20／守+14と鬼灯村の4点合計攻+4／守+7の関係。
- 潮待村の**正式装備性能・価格・入手段階・本編への接続**。
- 山越え洞窟を含む北部の実装、実走エンカウント数、海の入り江以北の敵の出現分布。
- **何を確認して仕様変更を許可したのか**の原文根拠がない変更は実装しない。

過去の仕様無視・記録欠落の詳細：[2026-11-22 振り返り](../incidents/2026-11-22-design-override.md)。
