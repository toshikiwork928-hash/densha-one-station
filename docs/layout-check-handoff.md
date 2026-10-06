# 汐風線レイアウト点検 引き継ぎ（2026-10-06 時点・作業途中）

追記: Codexが `2cef95d` から引き継いで修正した。以降の内容は修正前の調査記録。修正内容・検証結果は [layout-check-results.md](./layout-check-results.md) を参照。

担当範囲: `src/route/routes/shiokaze*.ts`、`route/service.ts`・`reverse.ts`、`world/` の駅・線路・構造物・景観。
ユーザー報告: 「4線から2線に合流するときの描写がおかしい（壁がめり込んでいる）」。
意図（壊さないこと）: 泉大津〜堺モチーフの10駅、高架7駅/地上3駅、2か所のバイパス下くぐり、路面電車高架下くぐり、石津川（みなと川）鉄橋、羽衣（羽根町）の描画専用支線、終着の速度照査。

## 状態

- **ゲーム本体のコードは未修正**。追加したのは検査用の2ファイルだけ。`npm run typecheck` は通る。commit なし。
- 追加ファイル
  - `src/debug/clearance.ts`: 建築限界チェッカー（開発用。ゲームからは読み込まない）。走行線 = `trackLines`（複線の各線・単線の交換線/副線）＋ `loopTracks`（2面4線の待避線。自線側・対向側）＋海浜公園の第3線（`coastal-stations.ts` と同じ式を複製）。限界はレール面（線路基準 0.38m）から 0.05〜0.4m: 1.25m、0.4〜1.15m: 1.55m（ホーム端 1.6m を許す）、1.15〜4.5m: 1.9m。三角形を 12m 以下まで4分割し、頂点の s・横位置・高さの範囲で走行線に届かないものを省いたうえで 0.4m 間隔に標本化。BatchedMesh は個体のバウンディングボックス表面で判定。列車・地面・空・電線は対象外。
  - `scripts/check-clearance.ts`: 上記を Node で実行（DOM・canvas をスタブ化し、列車なしでワールドを組み立てる。読込素材は簡易モデルで代替）。汐風線 下り/上り×普通/急行/特急、霧峰線 下り/上り。違反があれば終了コード 1。
  - 実行（package.json にはまだ登録していない）:
    ```bash
    npx esbuild scripts/check-clearance.ts --bundle --platform=node --format=esm --external:three --outfile=node_modules/.cache/check-clearance.mjs --log-level=warning --loader:.css=empty
    node node_modules/.cache/check-clearance.mjs        # 1ケース約80秒、全8ケースで約10分
    CLR_DEBUG=1 node node_modules/.cache/check-clearance.mjs   # 重いメッシュを stderr に表示
    ```
    出力は一度に出るので、リダイレクトする場合は終了まで待つ。`package.json` に `"verify:clearance"` として登録すると便利（未実施）。
  - ブラウザ内実行（`import('/src/debug/clearance.ts')` → `checkClearance(__densha)`）は可能だが、他エージェントの編集による HMR 再読込で途中で切れやすい。Node 版を推奨。

## 検査結果（汐風線 下り・普通のみ完走。142群）

| 場所 s（下り） | 内容 | 原因 | 状態 |
|---|---|---|---|
| -76〜-53、333〜356（桜ヶ丘）、3024〜3047、3433〜3456（白浜台）。岬口も同様のはず（下りでは extent 端付近） | **高架の高欄（壁）が待避線の分岐器部を貫通**（離隔0m、高さ0.07〜0.77m）。報告の不具合の正体 | `structures.ts` の高架床版・地覆・高欄が `L0-3.3`〜`L1+3.3`（-3.3〜7.3m）固定。待避線（-9.2m / 対向側 13.2m）は分岐器区間（ホーム端の100m手前〜160m先）で床版の外に出て**宙に浮き**、S字で -3.3m を横切る所で高欄にめり込む | 未修正 |
| 同上の分岐器区間 | 待避線区間の架線柱（`catenary.ts` の kind 'loop'、`pl = L0 + lat - 3.3` = -12.5m）が床版外で宙に立つ | 同上（床版が広がっていない） | 未修正（床版拡幅で解消見込み） |
| 各島式ホーム（桜ヶ丘 s57〜193、白浜台 3174〜3294 など） | ホーム上の人が線路中心から1.76〜1.9m（黄色線の外）に立つ | `stations.ts` `buildIsland` の人配置 `sx*(1.2+rnd*1.4)`（ホーム中心から）。ホーム端3mに近すぎる | 未修正。`1.0+rnd*1.0` 程度へ |
| 全駅の距離標・停止位置目標（stopSigns）、制限標（limitSigns） | 板の内側端が線路中心から1.55〜1.77m（高さ1.5〜3.1m） | `signs.ts` の既定 lat -2.0/-2.2 に板幅0.7〜1.0m。内側端が1.9m未満 | 未修正。lat を板幅/2+2.0 程度へ外す（霧峰線も同じ関数） |

その他の確認待ち（コード読みで見つけた候補。検査では未確定）:

- **海浜公園の第3線**（`coastal-stations.ts`、s 5510〜5910）: 起点 5510 は高架区間（〜5580）内。5510〜5580 で第3線が床版外に浮き、s≈5546 で高欄（-3.3m）を横切る見込み。上りは対向側（13.2m）。
- **海浜公園の架線柱**: kind 'station' で `pl = L0-7.4` = -7.4m。第3線（-9.2m）から1.8mでホーム上に立つ見込み。
- **踏切がホームを横切る**: `park-south` s5620（海浜公園ホーム 5600〜5820 の中）、`matsubara-south` s6630（松原町ホーム 6600〜6820 の中）。ホーム外（ホーム端の外側）へ移すのが妥当。海浜公園側は 5590 以前が勾配・高架なので、ホームの先（5830 以降。第3線の分岐もまたぐ）を検討。
- **高架相対式駅のホーム**: 高欄（-3.3m、高さ1.15m）がホーム床（1.1m）から5cm出る。ホーム区間は高欄を下げるか床版をホーム外縁まで広げる。
- **羽根町の支線ホームへの階段**（`coastal-stations.ts`）: 主線ホーム x=-4.1±1.1 から下りる階段が高架床版（-3.3m より外側）を貫通する見込み（線路への干渉ではない）。

## 修正方針（推奨）

1. `structures.ts`（海側 theme の viaduct/bridge）: 床版・地覆・高欄の横位置を s の関数にする。左端 = `min(L0-3.3, 待避線lat(s)-3.3, 第3線lat(s)-3.3)`、右端も同様（`loopTracks(ctx)` と第3線の式を使う。`extrudeFn` が使える）。高架駅のホーム区間は高欄をホーム床より下げる。橋脚 `pier()` も拡幅部の外側の線の下に柱を追加し、梁を延ばす。霧峰線は `buildMountainSpan` 経由なので影響しない。
2. 第3線の式を `coastal-stations.ts` から export して、structures・catenary・clearance で共用する（今は clearance に複製）。
3. `catenary.ts`: 海浜公園のホーム区間の柱を第3線の外（`outer-3.3`）へ。
4. `signs.ts` の既定 lat と `stations.ts` の人配置を上記のとおり調整。
5. 踏切2か所をホーム外へ移動（`shiokaze.ts` の crossings。上りは reverse で自動）。
6. 修正後: 本検査を全8ケースで違反0、`npm run typecheck`・`npm run build`・`npm run verify:routes`、`__qa.run` で汐風線 下り/上り×普通/急行/特急と霧峰線の罰点0、運転台・外部視点で分岐器部・高架端・跨線橋・鉄橋・支線を撮影確認。

ブラウザ確認は `preview_start` name "densha-a"（port 8771）、`?inspect=1&route=shiokaze-up` で地点選択できる。描画（before/after の撮影）は未実施。
