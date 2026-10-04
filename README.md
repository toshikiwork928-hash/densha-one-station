# densha-one-station

**▶ 遊ぶ: https://toshikiwork928-hash.github.io/densha-one-station/**

運転台視点で電車を運転するブラウザゲーム（往年の運転ゲーム風）。架空の「汐風線」を運転する。Three.js + Vite + TypeScript 製。

## 目的

Three.js で運転台視点の3D表現・簡易列車物理・スコアリングを作る練習。並行開発しやすいモジュール構成（イベントバス＋共有コンテキスト）の練習も兼ねる。

## 状態

遊べる試作（v0.2）。汐風線 桜ヶ丘 → 海浜公園（約9.7km・5駅）を収録。4系統（ゲームプレイ / 環境 / ビジュアル / 音）の並行開発と統合が完了。今後の案は [ROADMAP.md](./ROADMAP.md)。

## 内容

- **路線**: 桜ヶ丘 → みなと川 → 汐見町（通過）→ 白浜台 → 海浜公園。曲線制限・勾配（±25‰）、高架橋（3250–4450m）、トンネル（5450–6250m、内部に曲線制限）、橋梁（8000–8450m）、踏切4か所、閉そく信号15基
- **運転**: マスコン P1〜P5 / N / B1〜B8 / EB。ブレーキ立ち上がり遅れ・走行抵抗・勾配抵抗・天候による粘着低下
- **信号・ATS**: 4灯式（R / Y 45 / YG 65 / G）。見えない先行列車の在線で現示が変わる。制限超過や停止信号接近で ATS 警報 → 5秒以内に B4 以上＋確認（`A`）が無ければ非常制動。停止信号冒進も非常制動
- **駅**: 途中駅はドア開閉・停車時間・発車メロディ・車内放送。戸閉め後、出発信号が進行なら力行で発車。通過駅で止まると減点
- **ステージとモード**: 停車駅間ごと＋全線通し。モードは 通常 / 遅延回復（遅れて発車）/ 定時運転（時間と安全のみ採点）
- **採点**: 停止位置・定時・安全（速度超過・EB・停車時衝動・ATS・誤停車で減点）。駅ごとの結果表、自己ベストを localStorage に保存。停止位置±0.3m で「ピッタリ」、15m 超の行き過ぎで失格
- **リプレイと視点**: 結果画面で `R` を押すと沿線カメラ・追従・空撮を切り替えるリプレイ。走行中は `V` で 運転台 → 後方追従 → 側面
- **環境**: 時間帯（朝・昼・夕・夜）と天候（晴れ・雨・雪・霧、強さ可変）。スカイドーム・太陽と月・星・雲、影、窓の雨粒とワイパー、積雪、トンネル内の暗転。夜は前照灯・ホーム照明・沿線の街灯・窓明かりが点灯し、時間帯の切替に合わせて連続的に変化する。画質は 低 / 中 / 高
- **ビジュアル**: 20m 級4扉の通勤電車（架空塗装）を手続き生成（自列車・対向列車）。3D 運転台（マスコン・速度計・圧力計・戸閉灯・行路表が連動）。日本の街並み（戸建て・アパート・マンション・商店・架空のコンビニ・自販機・電柱と電線・田畑・竹林）、踏切（遮断かん・警報灯が連動、待機車両）、トンネル坑口・高架橋・橋梁と川。駅前ビルと木は CC0 の 3D 素材
- **音（すべてコード合成。録音サンプル不使用）**
  - VVVF: 非同期 → 同期 27P/15P/9P/5P/3P → 1パルスの音程階段、電動機の 6k±1 次高調波、歯車音。回生ブレーキは逆順、5km/h 付近で失効
  - 走行音: 転動音・風切り・高架の空洞音・急曲線のフランジ音。継ぎ目は台車配置どおりにタタン・タタン。トンネルは ConvolverNode 残響
  - 空気ブレーキ・コンプレッサ・ブレーキ鳴き、ドアチャイム・ドア開閉・オリジナル発車メロディ・ホームのざわめき
  - 車内放送: Web Speech API（ja-JP 音声がある環境のみ。無ければ無音）
  - ATS ベル/ブザー、速度超過ブザー、空気笛、踏切警報（距離減衰・ドップラー）、雨音、すれ違い
- **描画負荷の工夫**: 手続き生成物は材質ごとに結合（300m チャンク）、読込素材は材質ごとの `BatchedMesh` に集約（個体単位の視錐台カリング）、木は距離で簡易形状へ切替、遠方のチャンク・枕木・標識・信号・踏切は距離で非表示。描画コールは中画質で約 110〜180（影パス込み）

## 操作

| キー | 動作 | 場面 |
| --- | --- | --- |
| `↑` / `W` | 力行側へ1段 | 走行中 |
| `↓` / `S` | ブレーキ側へ1段 | 走行中 |
| `N` | ノッチオフ | 走行中 |
| `Space` | 非常ブレーキ（減点） | 走行中 |
| `A` | ATS 確認（B4 以上で）/ 停止後の復帰 | 走行中 |
| `H` | 警笛（長押し） | いつでも |
| `V` | 視点切替（運転台 → 後方 → 側面） | 走行中 |
| `X` | ワイパー ON/OFF | いつでも |
| `M` | 消音 切替 | いつでも |
| `Shift`+`T` / `Shift`+`Y` / `Shift`+`Q` | 時間帯 / 天候 / 画質を切替 | いつでも |
| `Enter`（または `Space`） | 出発 / もう一度 | タイトル・結果 |
| `←` / `→` | ステージ選択 | タイトル |
| `↑` / `↓` | モード選択 | タイトル |
| `R` | リプレイ開始/停止 | 結果 |
| `Esc` / `T` | タイトルへ | 結果 |

- タイトル画面は「ステージ」「環境」「サウンド」「操作」のタブ。環境（時間帯・天候・強さ・画質）と音量は localStorage に保存
- ゲームパッド（standard mapping）: 十字上下・LB/RB でノッチ、A で開始・ATS確認、B で EB、X でノッチオフ、Y で視点、Back でリプレイ、L3 で1軸レバーモード
- タッチ端末は画面右下のボタン（力行・ブレーキ・ATS・EB・視点）

## 実行方法

```bash
cd apps/densha-one-station
npm install
npm run dev        # 開発サーバー（http://localhost:8765）
npm run typecheck  # 型チェック
npm run build      # dist/ へ本番ビルド（base: './' のため GitHub Pages のサブパスでも動作）
npm run preview    # ビルド結果の確認
```

並行作業用に `.claude/launch.json`（worktree ルート）へ `densha`(8765) / `densha-a`〜`densha-d`(8771〜8774) を定義。開発時は `window.__densha` で GameContext を参照できる。


### 公開用リポジトリの更新

公開は、このディレクトリの中身をルートに置いた独立の公開 repo で行う（この個人 repo からは直接公開しない）。

1. このディレクトリを公開 repo へコピー（`node_modules/` と `dist/` は除く）
2. `deploy/pages.yml` を公開 repo の `.github/workflows/pages.yml` として置く
3. 公開 repo の Settings > Pages > Source を「GitHub Actions」にする
4. 公開 repo の `main` へ push すると `npm ci && npm run build` → `dist/` が GitHub Pages へ公開される

## 構成

```text
src/
├─ main.ts                 # 組み立てと描画ループのみ
├─ core/
│  ├─ events.ts            # 型付きイベントバス（EventMap に全イベント定義）
│  ├─ context.ts           # GameContext / GameActions 型（ctx.light = 連続的な夜/トンネル係数）
│  ├─ config.ts, rng.ts, dom.ts
├─ route/
│  ├─ types.ts, track.ts, index.ts
│  └─ routes/shiokaze.ts（既定）, sakuragaoka.ts（旧1区間版）
├─ sim/train.ts            # 列車運動（ノッチ→加速度、ブレーキ遅れ、抵抗、勾配・粘着）
├─ game/
│  ├─ state.ts             # ゲーム状態・ステージ・モード
│  ├─ loop.ts              # 状態遷移・走行ステップ・停車/通過駅・GameActions
│  ├─ signals.ts, preceding.ts  # 閉そく信号・先行列車・ATS
│  ├─ scoring.ts, ranking.ts    # 採点・自己ベスト
│  └─ replay.ts            # 走行記録とリプレイ
├─ input/keyboard.ts, touch.ts, gamepad.ts
├─ ui/hud.ts, meter.ts, overlay.ts（タイトルのタブ・結果画面）, styles.css
├─ render/renderer.ts, camera.ts（運転台・外部・リプレイ）
├─ env/                    # 時間帯・天候・空・影・降水・窓の雨粒とワイパー・夜間照明・画質・タイトルの環境タブ
├─ audio/                  # 合成音（VVVF・走行・ブレーキ・駅・放送・警報・環境音）と音量設定
└─ world/
   ├─ index.ts             # ワールド生成順の管理・素材読込
   ├─ track-mesh.ts, terrain.ts, structures.ts, crossings.ts, signals.ts, signs.ts, stations.ts
   ├─ town-jp.ts           # 日本の街並み（手続き生成、300m チャンク）
   ├─ scenery.ts, scenery-batch.ts, assets.ts  # 素材の読込・前処理・BatchedMesh 配置・木の LOD
   ├─ emu.ts, player-train.ts, oncoming.ts, cab.ts  # 車両・3D 運転台
   ├─ batch.ts             # 手続き生成用のジオメトリ結合・明るさ係数の購読
   └─ cull.ts              # 距離カリング
deploy/pages.yml           # 公開 repo 用 GitHub Pages ワークフロー
```

## 依存

- three ^0.170.0（npm）、Vite 6、TypeScript 5
- 3D素材（すべて CC0、実行時に CDN から読込。リポジトリには含めない）
  - [Kenney](https://kenney.nl) City Kit Commercial（駅前の商業ビル・遠景ビル。GitHub ミラー `GeorgeQLe/assets-3d-city` をコミット SHA 固定で jsDelivr 経由）
  - [Quaternius](https://quaternius.com) Nature Pack（木・植え込み）・Buildings Pack 3（中層ビル）（ミラー `trebeljahr/quaternius-showcase`、SHA 固定）
  - 読込に失敗した素材は簡易モデル（箱・円錐）で代替
- 車両・住宅・踏切・運転台・標識テクスチャ・音はすべてコード生成
- 要ネット接続（素材の CDN 取得のため）

## 公開可否

可。3D素材はすべて CC0（帰属表示不要だが出典を記載）。駅名・路線名・店名・塗装は架空で、実在の路線・事業者・商標は使っていない。
