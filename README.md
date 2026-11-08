# 鬼哭の花結び — 新制作リポジトリ

旧実装の不要データを持ち込まず、AIによる誤ったファイルの増殖と採用素材の混同を防ぐための初期基盤です。ゲーム本体や採用画像は**未導入**です。

## はじめに読む
- [AGENTS.md](AGENTS.md) — AIの共通ルール
- [docs/REPOSITORY_POLICY.md](docs/REPOSITORY_POLICY.md) — ディレクトリ、素材台帳、採用手順
- [.agents/skills/asset-design/SKILL.md](.agents/skills/asset-design/SKILL.md) — 素材生成・加工
- [.agents/skills/create-grid-map-art/SKILL.md](.agents/skills/create-grid-map-art/SKILL.md) — 村・マップチップ・NPC・キャラ制作
- [assets/manifest.json](assets/manifest.json) — 採用素材の唯一の台帳（初期登録0件）

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
