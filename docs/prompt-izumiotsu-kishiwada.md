# 新しいセッションへの依頼文（泉大津〜岸和田・特急サザン）

下の「依頼文」を、新しいセッションの最初のメッセージとして貼り付ける。仕様の詳細は [spec-izumiotsu-kishiwada.md](./spec-izumiotsu-kishiwada.md)、堺〜難波の計画は [plan-sakai-namba.md](./plan-sakai-namba.md)。

---

## 依頼文（ここから貼る）

電車運転ゲーム `apps/densha-one-station`（Three.js + Vite + TypeScript、リポジトリ toshikiwork928-hash/toshiki-lab）の続きをやる。

**最初に読むもの**: `apps/densha-one-station/AGENTS.md`（リポジトリ直下の AGENTS.md）、`README.md`、`ROADMAP.md`、`docs/spec-izumiotsu-kishiwada.md`（今回の仕様書）、`docs/plan-sakai-namba.md`、`docs/shiokaze-reference.md`、`docs/integration-handoff.md`。

**今回の目的**: 南海本線の新コース「泉大津〜岸和田」と、特急サザンを作る。詳細は仕様書のとおり。要点:
- 泉大津 → 忠岡 → 春木 → 和泉大宮 → 岸和田。泉大津を出ると地上へ降り、和泉大宮までは地上、和泉大宮から岸和田へ高架で登る。岸和田駅は**屋内式**（屋根が完全につながっていて、ホームに入ると外が見えない）。
- 泉大津の東側に、**90年代初頭に建てられた2棟並びのタワーマンション**（描画だけ。堺〜泉大津のコースでも同じ位置に見える共通ランドマークに）。
- **特急サザン**を追加: 8両固定 = 10000系 4両（岸和田側）+ 7100系 4両（難波側）、抵抗制御。出発時の放送は「この電車は、一部座席指定、特急サザン{行き先}行きです。次は〜」。行き先は列車の本来の行先（下り: 和歌山市）。ユニットごとに車種が違う編成の表現が要る。
- 普通車の放送の一部を変える（変更点は、作業前に私に聞くこと）。
- 配線は https://www.haisenryakuzu.net/documents/pr/nankai/main/ の `figures/011_04.svg` と `011_05.svg`（`curl -sL` で取れる XML）。線路の形（直線・カーブ）は地図を検索して読む。足りなければ私が画像を用意する。サイトや地図が読めないときは、作業前に言うこと。
- 既存の「堺〜泉大津」は変えない。区間の境目の泉大津の形は既存とそろえる。

**進め方（前回のセッションで効いたやり方）**:
1. まず仕様書を読んだうえで、要確認の項目（外観・停車駅・最高速度・タワーの高さなど）を整理して、私に質問するか、調査して案を示す。
2. master から作業ブランチを切る（例 `claude/izumiotsu-kishiwada`）。Codex も同じリポジトリで作業するので、作業前に master を取り込み、こまめにコミットと push をする。コミット・push・PR は、私の指示（または事前の了承）があるときだけ。
3. 実装はサブエージェントに分けて並行で進める。担当範囲（触るファイル）を重ならないように指定する。例:
   - 路線データ・時刻表・信号（`route/*`、`game/*`、`scripts/timetable.ts`）
   - 岸和田の屋内駅・高架・景観・泉大津のタワー（`world/*`）
   - サザンの車両（10000系の外観、ユニットごとに車種が違う編成: `world/trains/*`、`world/train-models.ts`、`route/service.ts`、`ui/*`）
   - 放送（`audio/announce-text.ts`）
   - 各エージェントには、dev サーバーの別のポート（`.claude/launch.json` の densha-a〜d）を割り当て、ブラウザは自分のタブだけを触らせる。
4. 完了したら、独立したエージェントにレビューさせる（回帰・左右の取り違え・上りの反転・負荷）。
5. 検証をすべて通す: `npm run typecheck`・`npm run build`・`npm run verify:routes`・`npm run verify:scenery`・`npm run verify:clearance -- --all`（約15分。長いので最後に1回）。画面確認は、別カメラで描いた画像（`ctx.renderer.render` → `toDataURL` → `<img>` を重ねて screenshot）が確実。
6. 汐風線（南海本線の泉大津〜堺）・高野線・Codex が追加した機能（イラスト調描画 `render/illustrated.ts`、車両プレビュー、4視点、一時停止、HUD）を壊さないこと。

**公開の手順**（私の指示があったときだけ）:
- 公開は GitHub Pages。公開用のリポジトリは別で、toshikiwork928-hash/densha-one-station の main に、`apps/densha-one-station` の中身（`README.md`・`ROADMAP.md`・`index.html`・`package.json`・`package-lock.json`・`tsconfig.json`・`vite.config.ts`・`src/`・`scripts/`・`docs/`）をコピーして push する。main への push で、GitHub Actions が自動でビルドして公開する。
- 公開リポジトリの `docs/` には、私がアップロードした参考画像が入っていることがある。同期のときに、**消さない**こと（前に誤って消して戻した）。
- 公開前に、`git pull` で公開側の最新を取り込む（Codex や私が直接 push していることがある）。

**使える知見**:
- 実名の駅を使っているが、塗装・店名は架空。タイトル画面に「実在の路線・駅を参考にした概形」と書いてある。
- 検証用の QA 自動運転は、dev のとき `window.__qa.run('local'|'express'|'limited', stageId?)`（`src/debug/autodrive.ts`）。読み込み完了まで数秒待つ。1回の JS 実行で全線1本まで。
- 内部 ID は互換のため変えない（`shiokaze`・`mountain`、localStorage キー、ファイル名）。
- 画像は、Claude が読めるのはセッションの画像フォルダ（`C:\Users\...\AppData\Local\Temp\claude\...\images\`）に入ったものだけのことがある。読めなければ、私に言うこと。

---

## 補足（依頼者向けメモ）

- 普通車の放送の変更点（どの文面をどう変えるか）は、新セッションで伝える。
- サザンの外観（10000系）の参考写真があれば、`docs/` に置くか、セッションに貼ると精度が上がる（前回、7100系・8300系・50000系で効果があった）。
- 負荷（起動時間・メモリ・実機 fps）は、新コースを足したあとで測る。
