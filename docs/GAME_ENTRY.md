# 本編への接続と開始フロー
このファイルは新リポジトリ `HiHoSir/kikokuno-hanamusubi` の現行実装の説明です。

## 開始フロー
1. `index.html` の「はじめから」から `src/opening/index.html` を開く。
2. `assets/prologue/opening.mp4` を音声付きで再生。iPhone Safari で自動再生がブロックされた場合は画面内の再生ボタンを使う。
3. 動画の `ended` またはスキップから `src/game/village/` を開き、鬼灯村の `scene.json` に定義された開始地点へ緋月を置く。
4. 村の移動、NPC会話、建物入口での接触入場、室内からの徒歩退出、南口からのフィールド移動を利用する。
5. フィールドの鬼灯村に再接触すると村の南口へ戻る。

## 素材とデータの正本
- 村ランタイム: `src/game/village/`
- 室内ランタイム: `src/game/interiors/`
- フィールド: `src/field/`
- 村マップとNPC: `data/maps/hozuki-village/scene.json` / `residents.json`
- 村の描画用素材: `assets/village/scene/` / `assets/village/interiors/furniture.png`
- 緋月・NPCキャラ画像は `assets/characters/` の既存アセットを再利用
- すべて `assets/manifest.json` に登録。検査用 `previews/` は本編から参照しない。

## 物語の導入
- 初期目標は「里長の話を聞こう」。
- 里長との会話を最後まで読むと、結び札を受け取った進行状態が `localStorage` の `kikokuno-hanamusubi-chapter-one` に `shrine` として保存され、目標が「天妖の社へ向かおう」に更新される。
- 以降の天妖の社イベント、持ち物UI、戦闘等は別途実装する。完成していない要素を実装済みとして扱わない。

## 品質検査
- `npm test`: 台帳・既存資産の検査に加えて `tests/main-game-entry.test.mjs` の配線と素材を検査。
- iPhone Safari: オープニングの音声・終了後遷移、村での方向入力、里長会話、茶店入場と退出、村南口とフィールドの往復。
- 絵柄・実機の再確認はGitHub Actionsとは別。検査版で採用した配置規則は `docs/VILLAGE_MAP_WORKFLOW.md` を参照。

## ゲーム操作UI（旧レポジトリを基準）
- 正本は `src/game/ui/controls.css` と `src/game/village/dialogue.css`。
- 旧 `HiHoSir/yaksha-hanamusubi/css/game.css` の最終的な4方向D-pad、半透明A/B、セーフエリア対応の浮動配置を移植。
- 村・室内・フィールドは同一のコントローラーを使用。AはNPCと話す／会話の文字表示を加速／次へ、Bは会話中の次送り。フィールドのBはメニュー未実装につき無効。
- 会話UIは旧版の青系背景・金縁・ピンクの話者名、36ms/文字、次の行があるときの点滅▼、横画面で左右のコントローラーを避ける配置。
- 移動入力は会話中停止し、誤入力やタッチの押しっぱなしによる移動を防止する。
