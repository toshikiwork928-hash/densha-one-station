# 引き継ぎ資料（densha-one-station）

作成: 2026-10-08。Claude Code のセッションから、Codex など別のエージェントへ作業を引き継ぐための資料。
ゲームの内容（遊べるもの・操作）は [README.md](../README.md)、これまでの完了項目と残りの案は [ROADMAP.md](../ROADMAP.md) にある。この文書は「どう作られているか」「どう作るか」「何が残っているか」を書く。

読む順のおすすめ: 1 → 2 → 9（守ること）→ 11（未着手のプラン）→ 担当する作業に関係する章。

---

## 1. 前提

- リポジトリ: `toshikiwork928-hash/toshiki-lab`（個人の学習用モノレポ）。このアプリは `apps/densha-one-station`。既定ブランチは **`master`**
- 公開: GitHub Pages。**別の公開用リポジトリ** `toshikiwork928-hash/densha-one-station` の `main` に push すると、GitHub Actions がビルドして公開する（手順は 8章）。URL: https://toshikiwork928-hash.github.io/densha-one-station/
- 技術: Three.js（0.170）+ Vite + TypeScript。描画するものはすべてコードで生成する（車両・駅・街並み・音）。外部の 3D 素材は CC0 の木とビルだけ（実行時に CDN から読む。`src/world/assets.ts`）
- 共通規則: リポジトリ直下の `AGENTS.md`。会話・コメント・コミットメッセージは日本語。commit・push・PR はユーザーが明示したときだけ（最近は「PR まで作ってよい、マージと公開は元のセッションで」という運用）
- ユーザーは南海電鉄の実物に詳しい。配線・運用・車両の指摘はたいてい正しいので、実物の資料で裏を取ってから直す

## 2. 全体の構成

```
src/
  main.ts          組み立てと描画ループだけ
  core/            config（定数）・context（共有コンテキスト）・events（イベントバス）・rng（決定的な乱数）
  route/           路線データと運行のルール（描画しない）
    types.ts         路線データの型（Route / Station / ServiceSpec / OncomingSpec …）
    track.ts         線形 → trackAt(s)・at(s, lat, y)
    service.ts       種別の適用（applyService）・待避線・島式の S字・ホームの側 など
    routes/*.ts      各コースのデータ（shiokaze = 泉大津→堺、kishiwada = 泉大津→岸和田、namba = 堺→なんば、mountain = 高野線 …）
    reverse.ts       逆向きのコースを自動生成（'-up'）
    concat.ts        2区間をつないだ通しコース（through.ts）
    day-patterns.ts  時間帯ごとの普通の待避・走行中の追い越し
    oncoming-stops.ts 対向列車の停車シーン・種別の割り当て（旧方式）
  game/            運行・採点（loop.ts が本体。signals・overtake・preceding・meet・scoring・replay）
  sim/train.ts     列車の物理（車種ごとの加速・減速）
  world/           3D の生成（景観・駅・車両・対向列車など）。index.ts が組み立て
  env/             空・時間帯・天候・影・夜の明かり
  audio/           音（すべて Web Audio で合成）・車内放送（Web Speech）
  ui/              HUD・タイトル画面・車両プレビュー
  data/            生成済みのデータ（osm/*.json = 沿線の地図データ、oncoming-meets.json = 実ダイヤのすれ違い）
  debug/           開発用（autodrive = 自動運転、clearance、scene-inspector）
scripts/           検証・データ生成（Node で esbuild して実行）
```

- **GameContext**（`core/context.ts`）: グローバル変数の代わりに、route・track・state・scene・camera・renderer・events・rng などをまとめて各モジュールに渡す
- **イベントバス**（`core/events.ts`）: `frame`（毎フレーム）・`reset`・`serviceChange`・`envChange`・`doorOpen` など。モジュール同士は直接呼ばずにイベントでつなぐ
- **乱数**: `ctx.rng` は生成順で結果が変わる。景観など後から足すものは **独自の乱数**（`createRng(固定シード)`）を使い、`ctx.rng` を消費しない（ほかの生成結果がずれるため）

## 3. 座標系とコースのデータ

- **s**: 線路に沿った距離 [m]。自列車は s が増える向きに走る。**lat**: 横位置 [m]。進行方向に対して **左が負・右が正**
- `track.at(s, lat, y)` で 3D の点、`track.trackAt(s)` で向き（phi）。`track.pathLat(s)` は自列車の通る横位置
- 線路の本数と横位置: `route.tracks`（例 `[0, 4]` = 自線 0・対向線 4）、`route.trackProfiles`（線ごとの横位置の折れ線。複々線の外へ開く等）、`route.extraTracks`（車庫・高野線・待避線など描画用の線）、`ServiceSpec.lane`（種別ごとの走る線の折れ線）
- **駅**（`Station`）: `stopS`（6両の停止位置）、`platform {from, to, side}`、`layout`（relative / island / loop / hagoromo / hamadera / custom）、`loop`（2面4線の待避線。`outside: true` は待避線の外側にだけホームがある＝浜寺公園の堺方面）、`island`（島式1面2線の S字）、`customPlatforms`（custom 駅のホームの形。ホームの側は `customPlatformSide()` で横位置から決まる）
- **種別**（`ServiceSpec`）: 停車駅・時刻表（`timetableByTime`）・待避（`waitsByTime`）・走行中の追い越し（`runPassesByTime`）・車種（`kindOptions`・`unitKinds`）・ホームの側（`platformSides`）・番線名（`trackNames`）。`applyService(route, id)` が route の駅情報を種別に合わせて書き換える（停車・停止位置・待避線に入るか・ドアの側）
- **逆向き・通し**: `reverseRoute` が s と lat を反転して逆向きを作る（逆向きで変わる走行線・ドアの側は、逆向き側のデータで指定し直す）。`concatRoutes` が泉大津でつないで堺〜岸和田を作る
- **堺〜なんばの専用景観**は上り（`namba`）の座標で書いてあり、下り（`namba-up`）では `world/namba-frame.ts` が座標を写した ctx を渡す（s' = 全長 − s、lat' = 4 − lat）
- **建物を置かない範囲**: `route.reserved`（車庫・駅ビル・高架の交差など）

## 4. 描画（Three.js）の作り方

- **レンダラ**（`render/renderer.ts`）: ACES のトーンマッピング。スマホは antialias なし・pixelRatio 1。画質（低・中・高）は `env/settings.ts`
- **結合描画**（`world/batch.ts`）: `GeoBatch` に部品（`P.box`・`P.cyl` など）を行列 `M(x, y, z, 回転, 拡大…)` と頂点色で積み、**材質ごとに1メッシュへ結合**する。駅・構造物・街並みはこれで描画コールを抑える。部品は増やしても描画コールは増えない（三角形は増える）
- **読込素材**（`world/assets.ts`・`scenery-batch.ts`）: 木とビルを `BatchedMesh` に材質ごとにまとめ、個体単位で視錐台カリング
- **チャンクと距離カリング**（`world/cull.ts`）: 街並み・架線などは約300m のチャンクに分け、カメラからの距離で丸ごと非表示。`cullByDistance(ctx, obj, maxDist)` に登録したものは visible をここが管理する（他から visible を触らない）
- **LOD**: 木は距離で簡易形状に切り替え（`npm run verify:scenery` が検査）
- **夜の明かり**: `onLight(ctx, (night, tunnel) => …)` で窓明かり・灯具を切り替える。光源そのものは `env/night-lights.ts`
- **描画の雰囲気**: `render/illustrated.ts`（イラスト風の切り替え）、`env/look.ts`
- **車両**（`world/train-models.ts`・`world/trains/*`）: 1両 = 材質別に結合した数個のメッシュ。形状・材質は車種ごとに共有し、行先 LED（canvas テクスチャ、`trains/common.ts`）だけ編成ごと。ドアは `TrainCar.setDoors(open, side)`（side は進行方向に対する L/R）。車体長は `carLenOf()`（20m、2000系・2300系・30000系は 18m）
- **負荷の目安**: 中画質で描画コール約 110〜180。測るときは dev サーバーで `window.__densha.renderer.info.render`（triangles・calls）を見る。建物が多い区間（堺の近く）は三角形が増えやすい

## 5. 景観の作り方

### 手続き生成（地図データ以前からある仕組み）
- `world/town-jp.ts`: 戸建て・アパート・商店・電柱と電線・田畑など。チャンク単位で結合
- `world/scenery.ts`: 遠景の山・読込素材（木・ビル）の配置
- `world/structures.ts`（高架橋・橋）、`catenary.ts`（架線）、`track-mesh.ts`（線路）、`crossings.ts`（踏切）
- 駅: `stations.ts`（相対式・島式などの共通形）、`coastal-stations.ts`（羽衣・浜寺公園などの特殊形）、`custom-stations.ts`（custom 駅のホーム）、`indoor-station.ts`（岸和田の屋内駅）、`namba-terminal.ts`（なんば）
- ランドマークは専用モジュール（`namba-landmarks.ts`・`coastal-landmarks.ts`・`hankai-tram.ts`・`izumiotsu-towers.ts`・`sumiyoshi-taisha.ts` など）

### 地図データ（OpenStreetMap）からの配置
- 手順の詳細は [docs/osm-scenery.md](./osm-scenery.md)
- `scripts/osm-scenery.ts` が Overpass API から線路の両側約300m の建物・道路・緑地・川を取り、**コースの座標（s, lat）へ写して**簡略化し、`src/data/osm/<区間>.json` に書く。写し方は、路線データと同じく「駅間ごとに営業キロへ伸縮」
- `world/osm-town.ts` がそのデータで建物・道路・緑地を置く。同じ区間を含むコース（上下・通し）でも同じ位置に出る
- 実行: `npm run osm:scenery -- --course=namba`（`sakai-izumiotsu`・`izumiotsu-kishiwada`）。**クラウド環境からは Overpass につながらない**ので、取得はローカルで行う。Overpass は混むと 504 を返すので間をおいて再試行。`npm ci` は `node_modules/.cache/osm` の一時保存を消す
- 出典の表示: 「© OpenStreetMap contributors（ODbL）」を README に書く
- Google マップ・ストリートビュー・航空写真は **見るだけ**（位置・雰囲気の確認）。画像や形をデータに写さない
- **見た目の確認は、素材を読み込める環境（ローカルの dev サーバー）で行う**。クラウド環境では素材の木・ビルが読めず、更地に見える不具合を見落としたことがある
- 景観を変えたら **建築限界の検査**（`npm run verify:clearance`）を必ず流す。線路・待避線・分かれる線のそばに建物がかかると違反になる

## 6. 運行（ダイヤ・待避・対向列車）

- **時刻表**: `npm run timetable` が種別ごとの自動運転から到着・通過時刻を計算して `routes/*-timetable.ts` を作る（走行時間 +5%）
- **時間帯**: 開始時刻は 朝 7:30・日中 10:00・夕 17:30・夜 21:30（`core/config.ts` の `START_CLOCK`）
- **自列車側の待避・待ち合わせ・接続・走行中の追い越し**（`route/day-patterns.ts`）: **ユーザーが指定したもの。変更しないこと**（不具合の修正で位置を変えるときもユーザーに確認する）
- 普通は待避線のある駅で、待避・待ち合わせがある時だけ待避線に入る。ただし待避線の外側にしかホームがない駅（浜寺公園の堺方面）は常に待避線
- 自列車を抜く列車（`game/overtake.ts` + `world/overtaking.ts`）、複々線の走行中の追い越し（`world/run-pass.ts`、描画だけ）、先行列車（`game/preceding.ts`）
- **対向列車**（`world/oncoming.ts`）
  - 南海本線の全10方向・全4時間帯は `src/data/oncoming-timetable.json` と `world/oncoming-timetable.ts` の共通処理。列車番号、種別、停車駅、0時からの発車秒を保持し、`route.startClock + state.t` で運行する。プレイヤーの位置・種別で対向列車の発車や本数を変えない。描画範囲外の列車も運行し、近い車両モデルだけ再利用して表示する。
  - 生成: `npm run oncoming:meets -- --timetable`。鉄道運用Hub（https://unyohub.2pd.jp/railroad_nankai/）の平日時刻表（2024-12-21改正）を利用。原時刻表は `node_modules/.cache/unyohub` のみ。各開始時刻の10分前から、その時間帯の最長コース所要時間＋10分までに区間を横切る列車を収録する。ダイヤ改正・駅位置変更時は再生成する。旧 `oncoming-meets.json` は比較用に残す。
  - 原データは分単位の発車時刻で、到着時刻・実信号位置は含まない。同区間・同種別の短い所要時間と加減速から到着時刻を推定し、余分な時間は駅での待避へ割り当てる。加減速・戸扱いが収まらない場合は早発せず遅らせる。秒単位の実運行を再現するものではない。
  - 普通は待避線・複々線の緩行線を使用。堺の上り普通は3番線、下り普通は1番線。空港急行は泉佐野の空港側線路。ゲーム用の進路占有を調べ、同じ線の先行列車の最後尾から300m以上を確保し、停車ホームが空くまで後続を駅手前に保持する。実閉そくの位置ではない。
  - 単線の高野線は `game/meet.ts` の交換駅・出発信号・構内進入完了までの占有を維持する。桜ヶ丘は従来の1編成。両者も `verify:oncoming` の検証対象。
  - 開発用: `window.__oncomingDebug()` で列車番号・種別・横位置・停車駅・安全上の遅れ秒を確認できる。一時停止中は時計を進めず、再開始では運行と車両表示を初期化する。
- 高野線のモブ（なんば付近を走る電車）: `world/koya-traffic.ts`。同じ向きは 80 秒以上・出現位置の前方 500m を空ける。開発用 `window.__koyaDebug()`
- なんばの留置: `world/namba-parked.ts`（車止め側の端を自列車の停止位置 `NAMBA_STOP` にそろえる。高野線1番線は除く）

## 7. 検証

| コマンド | 内容 | 時間 |
|---|---|---|
| `npm run typecheck` | 型 | 数秒 |
| `npm run verify:oncoming` | 全コースの対向列車（本数・停車・進路占有・途中開始・単線交換） | 実行環境による |
| `npm run verify:routes` | 全コース・全種別の自動運転（停止位置・定時・待避・放送の文・時間帯 114 運行） | 約10分 |
| `npm run verify:scenery` | 木の LOD | 数秒 |
| `npm run verify:clearance` | 建築限界（全コース・全種別で線路の周りに物がかからないか） | 40〜60分。裏で流す |

dev サーバー（`npm run dev`、または `.claude/launch.json` の `densha`）での確認に使う開発用のフック:
- `window.__densha`（GameContext）、`window.__advance(秒, dt, hook)`（描画せずに時間を進める）
- `window.__qa.run(種別, 'all', 秒)`（全線を自動運転）、`window.__qa.hook`（自動運転の1ステップ）
- 時間帯を変える: タイトル画面で `__densha.events.emit('envChange', { timeOfDay: 'morning' })`
- コースを変える: `localStorage['densha.selection.v1']` の `routeId` を書き換えて再読み込み

## 8. 公開（GitHub Pages）の手順

公開用リポジトリはアプリのフォルダを**ルートに置いた**別リポジトリ。master の変更を差分で当てる。
追加・修正作業は、必要な検証・画面確認・Pages更新・公開結果の確認までで1セット。`pub/` と `pub.patch` は本体リポジトリへコミットしない。
1. 公開用リポジトリを clone（`git clone https://github.com/toshikiwork928-hash/densha-one-station.git pub`）
2. 前回公開した master のコミットから今回のコミットまでの差分を作る:
   `git diff --binary <前回> <今回> --relative=apps/densha-one-station -- apps/densha-one-station ':!apps/densha-one-station/legacy' > pub.patch`
3. `pub` で `git apply pub.patch`。**`legacy/` は公開しない**。公開側だけにある `.github/workflows/pages.yml` と `docs/image-*.webp` は残す
4. master のアプリと `pub` の中身が一致するか比べる（`legacy`・`.github`・公開側だけの画像を除いて `diff -r`）
5. `pub` で `npm ci && npm run build` が通るか確かめる（`dist/` は commit しない）
6. commit して `main` に push → Actions（Deploy to GitHub Pages）の成功を確認 → 公開ページの `assets/index-*.js` の名前が今回のビルドと同じか確認
- 公開済みの最新: master `afc637b` 相当以降は、PR ごとに公開している（公開用リポジトリのコミット履歴を見る）

## 9. 守ること・ユーザーの好み

- ゲームの動き（ダイヤ・待避・停止位置）を変えるときは、`verify:routes` を必ず通す
- 実物への寄せ方は「そっくり同じ」ではなく「構造を再現」。省略・繰り返しは許容、ぎゅうぎゅうに詰めない
- 車両: 2300系は高野線（橋本〜極楽橋）専用。羽衣（高師浜線）・汐見橋線・なんば付近の高野線の各停は 2000系。ラピートは表示「特急ラピートβ」・放送「ラピートベータ」（対向列車は時間帯で α/β）。サザン（10000系）は 7100系と同じ抵抗制御の音
- 対向列車は多すぎても少なすぎてもダメ。実際のダイヤが基準
- 画像（写真・航空写真）をリポジトリに入れない。参考にだけ使う
- 返答は日本語で、結論を先に

## 10. 主な出典

- 線路形状・景観: © OpenStreetMap contributors（ODbL）
- 配線: 配線略図.net（南海本線の図）
- 時刻表・運用: 南海電鉄の時刻表、鉄道運用Hub（運用表データは CC BY 4.0、編成表データは著作権放棄）
- 3D 素材: Kenney City Kit・Quaternius（CC0）

## 11. 未着手のプラン（ユーザーの要望。上から優先）

| # | プラン | 状態・メモ |
|---|---|---|
| 1 | **景観の作り直し（全区間）** | ローカルのセッションで作業中（ブランチ `claude/awesome-raman-0eee6f`）。PR が出たらマージ・公開 |
| 2 | **駅舎の構造を全駅で実物に寄せる** | 既存27駅を写真照合。新今宮・天下茶屋の大屋根、羽衣・石津川・松ノ浜などの上屋と背面壁、駅ごとの支材・屋根形をローカルで反映。未公開。出典・維持した形・工事中や写真に写らない部分は `docs/station-architecture-reference.md`。今回は配線・停止位置を変更していない |
| 3 | **遊べる車両を増やす**（1000系・9000系・12000系） | Codex で作業中（ブランチ `codex/densha-playable-trains`） |
| 4 | **岸和田〜泉佐野の新コース** | ローカルで上下7駅・8.0km、5種別、泉佐野3面5線、OSM景観、対向ダイヤを追加。未公開。仕様・再生成・未確認箇所は `docs/spec-kishiwada-izumisano.md`。駅舎の個別外観・踏切の現地照合は未完了 |
| 5 | **高野線 なんば〜堺東の新設** + 泉北線の車両 | 規模が最大。なんば〜岸里玉出の高野線は描画だけある（`koya-traffic.ts`）。本線より最高速度が低く曲線が多い・本数が多い。運用Hub に高野線系統のデータもある（railroad_id は別） |
| 6 | **Autoモード（見るだけ）** | 自動運転（`debug/autodrive.ts` の hook）をゲームのモードにし、視点（運転台・俯瞰・前方斜め・全景）を自動で切り替える |
| 7 | **なんば駅探索モード** | なんば到着後だけ、自由に動かせるカメラで構内を歩く。コンコース・階段などの作り込みが別に必要 |
| 8 | **負荷測定とスマホの画質自動調整** | ROADMAP の残り。景観の作り直しで三角形が増えた区間がある |
| 9 | 対向列車の小さな課題 | 前の列車がまだ走路にいると、出現の機会を逃して1本見送ることがある（例: 堺→なんばの朝の特急で、天下茶屋に停車中の普通の後ろのラピートα）。ユーザー報告「住吉大社あたりで普通とすれ違った直後に七道でも普通」（実ダイヤどおりなら問題なし） |
| 10 | なんば〜岸和田の通し | 保留（ユーザー判断）。作るなら景観の区間ごとの読み込みが必要 |
