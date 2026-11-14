# 本編への接続と開始フロー
このファイルは新リポジトリ `HiHoSir/kikokuno-hanamusubi` の現行実装の説明です。

## 単一本編ページへの統合（2026-11-12）
- ユーザーの正式な開始URLはルート `/`。タイトル→`src/opening/`（既存MP4）→`src/game/` に遷移し、**以後はトップレベルのHTMLを切り替えない**。
- `src/game/index.html` が本編の親ページ。内部の `iframe#game-scene` に既存の村・室内・フィールド・天妖の社の各描画ページをロードする。レンダラーやD-padの破壊的書き換えを避けるため、画面描画コードとHTMLは当面分離し、親ページのURLと音声プレイヤーを維持する。
- 親は `src/game/navigation/game-shell.mjs`。共通 `window.KIKOKU_GAME.navigate` によってマップ切替する。各描画ページは引き続き `window.KIKOKU_ROUTE.go` を呼ぶが、親が存在する場合は内側のページ遷移を行わず親のシーンを切り替える。
- **BGMと右上の♪サウンドボタンは親ページが一元管理。** `makeAudioEngine` はトラック変更 `switchTrack` に対応。同じ曲（村⇄室内）の場合は `Audio.pause()`、`src` 代入、再ロードを一切行わず、再生位置を保持する。村⇄フィールド、フィールド⇄社は曲だけ切り替える。各シーンの `boot.mjs` は親プレイヤーを再利用し、音声を二重生成しない。
- `src/game/navigation/entry.js` が最初の入場を管理。タイトル→オープニング→親ページは `sessionStorage` のワンタイム情報を使い、シーンHTMLの直リンクや親ページの直リンク／リロードはタイトルへ戻す。親に許可された埋め込みシーンだけは直接読み込める。`previews/` は従来どおり検査用URL。
- 里長・白妙の進行 `localStorage` とフィールド帰還座標の `sessionStorage` は維持。
- 品質確認: 自動テストは `tests/entry-routing.test.mjs` と `tests/game-shell.test.mjs`。iPhone SafariでOP終了→村→室内往復（音声無停止）→フィールド往復→天妖の社往復、音声切替、直接URLを試す。音途切れの実機確認は自動テストでは代替できない。

## 開始フロー
1. `index.html` の「はじめから」から `src/opening/index.html` を開く。
2. `assets/prologue/opening.mp4` を音声付きで再生。iPhone Safari で自動再生がブロックされた場合は画面内の再生ボタンを使う。
3. 動画の `ended` またはスキップで `src/game/` を開き、その親画面の表示フレームに鬼灯村の `scene.json` をロードして緋月を開始地点に置く。
4. 村の移動、NPC会話、建物入口での接触入場、室内からの徒歩退出、南口からのフィールド移動を利用する。
5. フィールドの鬼灯村に再接触すると村の南口へ戻る。
6. フィールドの天妖の社に接触すると親画面内で `src/game/tenyo/` の描画へ切り替える。白妙の会話が完了すると目的が「海の入り江」に進む。南側の出口から親画面内のフィールド描画へ戻る。

## 素材とデータの正本
- 天妖の社（水上聖域・採用版）：`src/game/tenyo/`、`data/maps/tenyo-sanctuary/scene.json`、`assets/tenyo/`。28×25マスで、48×32マスの旧レイヤー版は不採用。
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
- 海の入り江の個別イベントと本格的な持ち物UIは別途実装する。緋月1人の通常戦闘は `src/game/battle/` と `docs/BATTLE_SYSTEM.md` を正本とし、既存敵3種・既存戦闘BGMで本編に接続済み。

## 品質検査
- `npm test`: 台帳・既存資産の検査に加えて `tests/main-game-entry.test.mjs` の配線と素材を検査。
- iPhone Safari: オープニングの音声・終了後遷移、村での方向入力、里長会話、茶店入場と退出、村南口とフィールドの往復、天妖の社への往復、白妙との会話と目標更新。
- 絵柄・実機の再確認はGitHub Actionsとは別。検査版で採用した配置規則は `docs/VILLAGE_MAP_WORKFLOW.md` を参照。

## ゲーム操作UI（旧レポジトリを基準）
- 正本は `src/game/ui/controls.css` と `src/game/village/dialogue.css`。
- 旧 `HiHoSir/yaksha-hanamusubi/css/game.css` の最終的な4方向D-pad、半透明A/B、セーフエリア対応の浮動配置を移植。
- 村・室内・フィールド・天妖の社は同一のコントローラーを使用。AはNPCと話す／会話の文字表示を加速／次へ、Bは会話中の次送り。フィールドのBはメニュー未実装につき無効。
- 会話UIは旧版の青系背景・金縁・ピンクの話者名、36ms/文字、次の行があるときの点滅▼、横画面で左右のコントローラーを避ける配置。
- 移動入力は会話中停止し、誤入力やタッチの押しっぱなしによる移動を防止する。

## 全画面表示とiPhoneのテキスト選択抑止
- 本編の村・室内・フィールド・天妖の社はゲーム領域を `100dvh` と全幅で表示。HUD、D-pad、A/Bの安全領域は `env(safe-area-inset-*)` に追従。
- フィールドは正方形レンダリングの縦横比を維持して `object-fit:cover` で画面いっぱいに配置。細長い画面では左右または上下が一部トリミングされる。
- `src/game/ui/controls.css` の `-webkit-user-select:none` ほか、`selection-guard.mjs` で選択、ドラッグ、長押しのコンテキストメニューを禁止。入力の `pointerdown` やタップを抑止しない。
- タイトルから本編までWebアプリ設定 `src/game/app.webmanifest` とApple用metaタグを共有。Safari通常タブではブラウザUIを消せないため、ブラウザの共有メニューから「ホーム画面に追加」してWebアプリとして開けばアドレスバーなしで利用可能。
- QA: iPhone Safari縦横、ノッチ・ホームバーとの非重複、画面内の長押し選択不可、A/BとD-padの継続操作、フィールドのトリミングとカメラを点検。ホーム画面からの起動も別途実機確認。

## BGM・SE実装（2026-11-12）
- BGM正本は `assets/audio/bgm/`。ユーザー提供のBGMパックから新規採用し、音源の重複を避けるため旧 `review/audio/bgm-pack/*.ogg` は移動。対応MIDIは `review/` に残し、ゲームが参照しない。
- 現行画面: タイトル→`title.ogg`、鬼灯村・室内→`village.ogg`、フィールド→`field.ogg`、天妖の社→`prologue-theme.ogg`。オープニング動画の音はそのまま使用し、BGMの二重再生を禁止。
- `dungeon.ogg` / `battle.ogg` / `se/battle-encounter.ogg` は採用アセットとして登録済み。未実装シーンからはまだ再生しない。社では、元の水音 `assets/tenyo/waterfall-loop.m4a` を音声設定に従って小音量で重ねる。
- `src/game/audio/audio.mjs` は本編の親画面に1つだけプレイヤーを保持し、BGMの曲別ループ開始秒数、音量管理、ゲームでのSE合成、サウンドON/OFF保存、iPhone Safariの音声アンロック・バックグラウンド停止・復帰を担当。
- タイトル・村・室内・フィールド・天妖の社右上の `♪ 再生` ボタンで音声を許可。ブラウザ側で無音自動再生が制限されても、操作ボタンのタップで再試行。設定は `kikokuno-hanamusubi-audio-enabled` に保存。
- 軽い暫定合成SE: 決定・キャンセル・会話開始・歩行入力・会話の文字。正式SE素材が承認されたら `audio.mjs` で置換する。長押しに伴う音の連打はしない。
- iPhone Safari実機の音量・ループ継ぎ目・着信や画面ロック後の復帰・画面遷移時のBGM変更は未検証。

- 村⇄室内は親プレイヤーを止めずに同じBGMと再生位置を保持。旧ページ遷移向けの短期再生位置保存は互換用として残す。異なる曲への切替後、Safariで再生許可が遮断された場合は親画面の♪ボタンから復帰。古い再生Promiseが復帰を妨げないよう連番で制御。

## フィールド共通コマンドメニュー（2026-11-14）

- 本編親ページ `src/game/index.html` に桃太郎伝説風の簡潔なコマンド窓を重ね、深藍色と金縁で天外魔境風の雰囲気を足す。メニューは親側で開閉するため村・室内・フィールド・社で同じUIになり、シーンHTMLもBGMも切り替えない。戦闘中は開かない。
- 「道具」では既存薬草／茶店の食べ物を消費して体力回復。「術」ではつむぎをフィールド回復に使用し、糸遊は戦闘専用。「装備」「強さ」は戦闘と共通の保存済みステータスを読み込む。「設定」は親の音声切替を使用。
- 「記録」は真のゲームセーブ機能がないため選択不可とし、実装済みのように見せない。メニューを開くと移動の押しっぱなし入力を解除。スマートフォンは画面ボタンで操作、キーボードはMで開く、Escape/Backspaceで閉じる。
- GitHub Actionsの実ブラウザ検査で縦390×844/横900×390の2画面を確認し、ステータス・道具表示・BGM無停止・シーン不遷移を回帰検査する。Safari実機の視認・タップは別途確認。
