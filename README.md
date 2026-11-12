# 鬼哭の花結び — 新制作リポジトリ

旧実装の不要データを持ち込まず、AIによる誤ったファイルの増殖と採用素材の混同を防ぐ制作基盤です。開始は[タイトル画面](index.html)から。オープニングの後は[本編の共通ゲーム画面](src/game/index.html)に入り、村・室内・フィールド・天妖の社の移動で**トップレベルのページを切り替えません**。BGMは親画面で管理するため、村と室内は同じ曲を止めずに継続できます。各エリアの個別HTMLの直リンクはタイトルへ戻ります。フィールドでは一定歩数後、承認済み敵グラフィックを使う緋月1人の戦闘（たたかう・術・道具・防御・逃走）が開始し、勝敗に応じてフィールドまたは村へ戻ります。海の入り江以降は今後の実装です。

## はじめに読む
- [AGENTS.md](AGENTS.md) — AIの共通ルール
- [docs/REPOSITORY_POLICY.md](docs/REPOSITORY_POLICY.md) — ディレクトリ、素材台帳、採用手順
- [.agents/skills/asset-design/SKILL.md](.agents/skills/asset-design/SKILL.md) — 素材生成・加工
- [鬼灯村の制作・歩行検査](.agents/skills/build-hozuki-village/SKILL.md) — 建物・室内・NPC・会話・入退場・iPhone検査
- [天妖の社の本編実装と往復検査](docs/TENYO_SHRINE.md) — 社への入退場・白妙イベント・採用素材
- [鬼灯村の制作手順と再現方法](docs/VILLAGE_MAP_WORKFLOW.md) — 屋外と室内の実装、素材の規格、固定版と確認手順
- [assets/manifest.json](assets/manifest.json) — 採用素材の唯一の台帳（移行済み素材を登録）

## 将来の保存先
`src/` はコード、`data/` はマップ・イベントのJSON、`assets/` は採用素材、`source-assets/` は必要な原本。`tools/` は共通処理、`tests/` は検査、`docs/` は現行仕様、`.agents/skills/` は再利用手順です。

Gitは空フォルダを保持しないため、`src/`、`data/`、`source-assets/` は使う段階で作成します。`old/` を追加しません。中間出力は無視設定した `work/` に置きます。

## 自動検査
Node.js 20以降。npmパッケージ追加は不要です。

```sh
npm test
npm run check
```

GitHub Actionsでもpush・PR時に検査します。直接mainへpushする場合、Actionsは**事後検出**であり、push前の強制阻止ではありません。画像の画風、ライセンス、実機動作は別途確認が必要です。
