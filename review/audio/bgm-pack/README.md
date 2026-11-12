# BGM原本管理 — 『鬼哭の花結び』採用音源 / 『鬼哭の花契り』候補
作成日: 2026-11-11 / 32kHz ステレオ OGG Vorbis / サンプリング音源方式
Tani採用確定の7点だけを集めたものです。旧版（v5/v9、無印v8、battle v1、battle_jingle v1）は入れていません。

## 収録曲（用途 / ファイル / BPM / 長さ / ループ開始）
- タイトル: title_bgm_v1.ogg / 88 BPM / 88.9秒 / ループ開始 10.91秒（前奏のあと本編へ）
- オープニング: theme_sfc_v8rev.ogg / 96 BPM / 81.6秒 / ループ開始 10.0秒
- フィールド: theme_sfc_v10.ogg / 132 BPM / 52.5秒 / ループ開始 7.27秒（イントロ約7秒のあとAへ）
- 村・町: mura_bgm_v1.ogg / 94 BPM / 62.9秒 / ループ開始 0秒（全編ループ）
- ダンジョン: dungeon_bgm_v1.ogg / 76 BPM / 52.1秒 / ループ開始 0秒（全編ループ）
- バトル: battle_bgm_v2.ogg / 156 BPM / 40.1秒 / ループ開始 1.54秒（イントロ1小節のあと）
- バトル突入SE: battle_se_v2.ogg / — / 3.9秒 / ループなし（ワンショット、バトルBGMへ直結）

OGGには LOOPSTART / LOOPLENGTH タグが入っています（battle_se_v2.ogg を除く）。
各曲の .mid は打ち直し・編曲用の同内容MIDIです。

## 音の基準（Taniの好みとして記録済み）
- 重心は中低音寄り（フィールド v9 2754Hz→v10で下げ済み、オープニング v7 2567Hz→v8 2015Hz）
- 笛はビブラート弱め、壮大寄り・長調で高揚感、バトルは祭り感ではなく行進感＋金管ユニゾン
- v10 / v8rev は音割れ対策済み（ループ点クロスフェード＋3次補間＋緩いリミッタ）。その分、全体音量は少し下がっています。

## 使わない旧版（このZIPには含みません）
theme_sfc_v5 / v9、theme_sfc_v8（無印）、battle_bgm_v1、battle_jingle_v1
※ theme_sfc_v4alt.* はモカのv4とは別物のため、ここには含めていません。

## 別途あり（このパックには含めていません）
- SEパック se_pack_v1.zip（11点、2026-11-11作成）— Taniが「SEじゃなくってBGM」と訂正した経緯があり、採用未確認のため別ファイルのままです。

## 2026-11-12: 『鬼哭の花結び』本編に採用済みの音源配置
元のOGGファイルは複製を避けるため `assets/audio/` に移動しました。MIDIは編集原本としてこのフォルダに残します。
- title_bgm_v1.ogg → `assets/audio/bgm/title.ogg`（ループ開始 10.91 秒）
- theme_sfc_v10.ogg → `assets/audio/bgm/field.ogg`（ループ開始 7.27 秒）
- mura_bgm_v1.ogg → `assets/audio/bgm/village.ogg`（ループ開始 0 秒）
- dungeon_bgm_v1.ogg → `assets/audio/bgm/dungeon.ogg`（ループ開始 0 秒）
- battle_bgm_v2.ogg → `assets/audio/bgm/battle.ogg`（ループ開始 1.54 秒）
- theme_sfc_v8rev.ogg → `assets/audio/bgm/prologue-theme.ogg`（ループ開始 10 秒）
- battle_se_v2.ogg → `assets/audio/se/battle-encounter.ogg`（SE）

オープニング動画 `assets/prologue/opening.mp4` は映像に含まれる音声を再生します。
個別SEパックはまだ採用されていないため、ゲーム中の短い操作SEはコードによる暫定合成音です。
