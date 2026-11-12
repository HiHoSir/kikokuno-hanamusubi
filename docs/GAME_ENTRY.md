# 本編への接続と開始フロー
このファイルは新リポジトリ `HiHoSir/kikokuno-hanamusubi` の現行実装の説明です。

## 開始フロー
1. `index.html` の「はじめから」から `src/opening/index.html` を開く。
2. `assets/prologue/opening.mp4` を音声付きで再生。iPhone Safari で自動再生がブロックされた場合は画面内の再生ボタンを使う。
3. 動画の `ended` またはスキップから `src/game/village/` を開き、鬼灯村の `scene.json` に定義された開始地点へ緋月を置く。
4. 村の移動、NPC会話、建物入口での接触入場、室内からの徒歩退出、南口からのフィールド移動を利用する。
5. フィールドの鬼灯村に再接触すると村の南口へ戻る。
6. フィールドの天妖の社に接触すると本編の `src/game/tenyo/` へ入場。白妙の会話が完了すると目的が「海の入り江」に進む。南側の出口からフィールドへ戻る。

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
- 白妙との会話を最後まで読むと、同じキーが `cove` に更新され、海の入り江の潮平を探す目標になる。里長との再会話でも進捗は戻らない。
- ゲーム進行の共通ロジックは `src/game/story/chapter-one.mjs`。天妖の社の位置・当たり判定・素材・QAは `docs/TENYO_SHRINE.md` を参照。
- 海の入り江の個別イベント、持ち物UI、戦闘等は別途実装する。

## 品質検査
- `npm test`: 台帳・既存資産の検査に加えて `tests/main-game-entry.test.mjs` の配線と素材を検査。
- iPhone Safari: オープニングの音声・終了後遷移、村での方向入力、里長会話、茶店入場と退出、村南口とフィールドの往復、天妖の社への往復、白妙との会話と目標更新。
- 絵柄・実機の再確認はGitHub Actionsとは別。検査版で採用した配置規則は `docs/VILLAGE_MAP_WORKFLOW.md` を参照。

## ゲーム操作UI（旧レポジトリを基準）
- 正本は `src/game/ui/controls.css` と `src/game/village/dialogue.css`。
- 旧 `HiHoSir/yaksha-hanamusubi/css/game.css` の最終的な4方向D-pad、半透明A/B、セーフエリア対応の浮動配置を移植。
- 村・室内・フィールドは同一のコントローラーを使用。AはNPCと話す／会話の文字表示を加速／次へ、Bは会話中の次送り。フィールドのBはメニュー未実装につき無効。
- 会話UIは旧版の青系背景・金縁・ピンクの話者名、36ms/文字、次の行があるときの点滅▼、横画面で左右のコントローラーを避ける配置。
- 移動入力は会話中停止し、誤入力やタッチの押しっぱなしによる移動を防止する。

## 全画面表示とiPhoneのテキスト選択抑止
- 本編3画面はゲーム領域を `100dvh` と全幅で表示。HUD、D-pad、A/Bの安全領域は `env(safe-area-inset-*)` に追従。
- フィールドは正方形レンダリングの縦横比を維持して `object-fit:cover` で画面いっぱいに配置。細長い画面では左右または上下が一部トリミングされる。
- `src/game/ui/controls.css` の `-webkit-user-select:none` ほか、`selection-guard.mjs` で選択、ドラッグ、長押しのコンテキストメニューを禁止。入力の `pointerdown` やタップを抑止しない。
- タイトルから本編までWebアプリ設定 `src/game/app.webmanifest` とApple用metaタグを共有。Safari通常タブではブラウザUIを消せないため、ブラウザの共有メニューから「ホーム画面に追加」してWebアプリとして開けばアドレスバーなしで利用可能。
- QA: iPhone Safari縦横、ノッチ・ホームバーとの非重複、画面内の長押し選択不可、A/BとD-padの継続操作、フィールドのトリミングとカメラを点検。ホーム画面からの起動も別途実機確認。

## BGM・SE実装（2026-11-12）
- BGM正本は `assets/audio/bgm/`。ユーザー提供のBGMパックから新規採用し、音源の重複を避けるため旧 `review/audio/bgm-pack/*.ogg` は移動。対応MIDIは `review/` に残し、ゲームが参照しない。
- 現行画面: タイトル→`title.ogg`、鬼灯村・室内→`village.ogg`、フィールド→`field.ogg`、天妖の社→`prologue-theme.ogg`。オープニング動画の音はそのまま使用し、BGMの二重再生を禁止。
- `dungeon.ogg` / `battle.ogg` / `prologue-theme.ogg` / `se/battle-encounter.ogg` は採用アセットとして登録済み。未実装シーンからはまだ再生しない。
- `src/game/audio/audio.mjs` は1ページ1プレイヤー、BGMの曲別ループ開始秒数、音量管理、ゲームでのSE合成、サウンドON/OFF保存、iPhone Safariの音声アンロック・バックグラウンド停止・復帰を担当。
- タイトル・村・室内・フィールド・天妖の社右上の `♪ 再生` ボタンで音声を許可。ブラウザ側で無音自動再生が制限されても、操作ボタンのタップで再試行。設定は `kikokuno-hanamusubi-audio-enabled` に保存。
- 軽い暫定合成SE: 決定・キャンセル・会話開始・歩行入力・会話の文字。正式SE素材が承認されたら `audio.mjs` で置換する。長押しに伴う音の連打はしない。
- iPhone Safari実機の音量・ループ継ぎ目・着信や画面ロック後の復帰・画面遷移時のBGM変更は未検証。

- 同じ村BGMを使う屋外⇄室内の画面遷移では直前の再生位置を短期間引き継ぐ。遷移後の再生許可がSafariに遮断された場合は次のタップで復帰。古い再生Promiseが復帰を妨げないよう連番で制御。
