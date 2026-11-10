# 鬼灯村の緋月基準配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 承認された俯瞰イラストの雰囲気を、緋月の大きさ・直線の道・歩ける村へ反映する。
**Architecture:** 既存の独立PNGを使い、配置と足元判定をscene.jsonに記録する。土道・川・橋は地面タイルに再構築する。画像の構図や村の外周寸法を固定条件にはしない。
**Tech Stack:** Canvas/ES modules, Python/Pillow/NumPy/SciPy, Node tests, GitHub Pages.
**Spec:** ユーザー承認済み「桜咲く鬼灯村と川辺の鐘楼」の全景イラストと、このチャットの指示。`docs/VILLAGE_WALK_REVIEW.md`。

## Global Constraints
- 画面倍率1.0。緋月は80×112コマを0.5倍、足元(40,106)のまま。
- 道は水平・垂直の直線。村の必要面積は建物と畑・通路から決める。
- 入口と裏回り、屋根と軒の既存方式を維持し、縮尺変更後に再検査。
- 本編素材の採用とは別の公開歩行検査。変更範囲は村用プレビューとその仕様・検査・再構築ツール。

## Review Focus
- 大きくした屋根が裏の緋月を全コマで消さないこと。
- 家の入口・畑へ実際の衝突半径で到達できること。
- 橋の両岸に引っかからず、橋の脇から水へ入らないこと。
- 木や柵が直線の道と建物の入口を塞がないこと。
- 同時に進む洞窟の更新を上書きしないこと。

### Task 1: 縮尺・配置・地面を揃える
Files: `previews/village-walk/map/scene.json`, `map/terrain.png`, `map/collision.png`, `tools/build-village-walk-ground.py`, `tests/village-walk-render.test.mjs`.
- [x] 扉55px以上と縦横道の回帰検査を追加し、旧配置で失敗を確認。
- [x] 原画から0.625倍で戸口を調整し、緋月を基準に配置を再構成。
- [x] 道・川・橋・地面と足元判定を、同じ配置から再構築。
- [x] 全入口・畑・橋・鐘撞堂への到達、裏側の頭、川岸の停止を検査。

### Task 2: 配信と目視確認
Files: `previews/village-walk/walk.mjs`, `index.html`, `docs/VILLAGE_WALK_REVIEW.md`.
- [x] 場所の目印を使った確認用フォーカスを新座標へ追従させる。
- [x] ブラウザで縮尺・道・植栽・重なりを確認し、観察した不具合を直す。
- [x] 最新gh-pagesの木へ村の差分だけを反映。公開したsceneと画像を照合。
- [x] iPhone実機未確認の範囲と、今回の確認結果を報告。
