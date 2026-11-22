# 戦闘・フィールド・装備の設計変更記録

## 目的

2026-11-22、[振り返り記録](../incidents/2026-11-22-design-override.md)により、**既存の確定T0〜T6を参照せず、未決の販売地点と価格を無断で決めた**ことを確認した。11月15日のマップ先行設計の一部は当時の正本に十分残っていなかった。

この文書は、**記録してあった設計を無視すること**と、**重要な検討経緯を記録し忘れること**を防ぐための手順である。

## 変更前に必ず行うこと

1. `AGENTS.md`、`docs/BALANCE_PROGRESSION_CONTRACT.md`、`docs/BATTLE_BALANCE.md`、`docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`、`docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md` と該当のソースコードを確認。
2. **確定仕様／後から明示承認された変更／単なる提案／プレビューだけの仮値／未実装**を区別。新しい仕様が以前の仕様を**明示的に覆したのか**も確認する。
3. 設計上の保護対象を触るPRには、`docs/decisions/changes/YYYY-MM-DD-english-slug.json` を**同じPRで新規作成または変更**する。変更前の正本、今回の差分、影響、守ること、検証方法、指示の証拠を記載する。
4. **戦闘値、フィールドの進行、商品補正・価格など実装値を変更する場合、ユーザーが具体的に指示した原文・日付・出典が必要。** 「続けて」「室内を繋いで」「品揃えが違う」「バランス見直して」だけでは、新しい数値やティア配置の確定承認とみなさない。明示された根拠がなければ、値を書き換えず未決課題として扱う。
5. 文書だけの誤りを訂正する場合は `kind: "documentation-correction"` として、旧記述・正しい根拠・訂正理由を残す。
6. `npm test`、対象画面のブラウザ検査、PRの **Design decision gate** を確認。新たな仮値を正当化するためにテスト期待値だけ書き換えない。
7. **自動検査は記録の存在・必要項目を確認するだけで、会話の引用が本当にユーザーの言葉か証明できない。** 誤った「承認済み」の記録を作ることは禁止。必ず人が原文を照合する。ブランチ保護・必須人間レビューはGitHub側の別設定であり、この検査を追加しただけで有効にならない。

対象：`data/characters/hizuki-status.json`、`src/game/battle/rules.mjs`、`data/maps/*/armory.mjs`、潮待村の試作店舗、フィールドの地形・ワールド・移動コード、関連する戦闘・装備・進行設計書。通常の画像差し替えや非該当のUI変更には、根拠なく制約を広げない。

## 記録ファイルのフォーマット

例：`docs/decisions/changes/2026-11-22-example-subject.json`。ファイル名（`.json` を除く）と `id` を一致させる。

```json
{
  "schemaVersion": 1,
  "id": "2026-11-22-example-subject",
  "kind": "user-approved",
  "scopes": ["equipment", "balance"],
  "readBeforeEditing": [
    "docs/BALANCE_PROGRESSION_CONTRACT.md の確定値を確認",
    "src/game/battle/rules.mjs の現行値を確認"
  ],
  "previousDesign": "既存の確定仕様、以前の承認、まだ未決の事項を具体的に書く。",
  "intendedDifference": "実際に変更するID・数値・場所・時期と理由を具体的に書く。",
  "impactAnalysis": "段数・出現敵・獲得両・装備枠・旧セーブへの影響を記載する。",
  "preservedBoundaries": "変更しない確定ティア・承認済みマップ・他施設を明記する。",
  "verification": "自動テストと必要なブラウザ・実機確認を具体的に書く。",
  "userEvidence": {
    "status": "explicit-user-instruction",
    "date": "2026-11-22",
    "quote": "ここには実際に確認したユーザーの指示原文を転記する。例文を実承認扱いしない。",
    "source": "該当チャットまたは本人が書いたGitHubコメントを特定する。"
  }
}
```

**上記はJSONの形を示すための例で、実際の承認を示す記録ではない。** 利用する際はすべてのフィールドを本当の情報で埋める。

文書だけの訂正には `kind: "documentation-correction"`、`userEvidence: {"status":"documentation-only","source":"訂正根拠の文書・コミット"}` を使う。実装値の変更には使用できない。理由・差分・影響などは省略不可。

`tools/guard-design-changes.mjs` は記録の新規作成／更新と必須項目の有無だけを機械的に検査する。**引用内容の真偽、人間の承認、設計との整合性を証明する機能はない。** これは変更の追跡を義務化する仕組みであって、勝手な判断を正当化する仕組みではない。
