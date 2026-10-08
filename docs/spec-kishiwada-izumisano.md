# 岸和田〜泉佐野

独立した7駅・8.0kmのコース。上下方向で普通、急行、空港急行、特急サザン、特急ラピートβを運転できる。

## 駅と配線

- 岸和田からの営業距離は、蛸地蔵0.9km、貝塚2.6km、二色浜4.4km、鶴原5.3km、井原里6.4km、泉佐野8.0km。
- 岸和田は既存コースと同じ高架の2面4線。蛸地蔵・二色浜・鶴原・井原里は地上の相対式、貝塚は地上の2面4線。
- 泉佐野は高架の3面5線。1・2番、3・4番、5・6番の島式ホームを置く。4・5番は同じ線路を両側から挟む。
- 下り普通は泉佐野1番、急行・サザンは2番、空港急行・ラピートβは3番へ入る。上りは本線系統5番、空港系統6番から発車する。実際の全列車の番線を再現するものではない。
- 泉佐野の分岐器は45km/h。ホーム区間は直線・水平。岸和田側と泉佐野側に高架への勾配を置く。
- 前駅・次駅の駅名表示は和泉大宮・羽倉崎。泉佐野以南の線路・運行は含めない。

## ダイヤと景観

自列車の時刻表は既存の自動運転による最速走行から余裕を加えて作るゲーム用ダイヤ。普通は全駅、急行・空港急行は岸和田・貝塚・泉佐野、サザン・ラピートβは岸和田・泉佐野に停車する。この区間の普通に待避イベントは設定していない。

対向列車は鉄道運用Hubの平日ダイヤと駅営業キロから、コース内ですれ違う時刻・位置を計算する。既存コースの対向データは変更しない。

OSMの本線中心線157点を基準に、沿線の建物3,953、道路790、面219、ランドマーク43を配置する。駅間の向きの変化を簡略化した曲線に写す。鉄道線の高架タグを参考に岸和田南側・泉佐野北側の高架区間を置く。

## 再現の限界

営業キロ以外の寸法、線路横位置、曲線半径、勾配、屋根の形はゲーム用の概形。駅舎の個別外観は未再現。OSMの道路・線路交点から選んだ踏切は、現地写真との照合が未完了。貝塚〜二色浜の橋梁タグの構造・高さ・河川名は不明のため、個別橋梁モデルは置かない。

## 出典

- [南海電鉄公式路線図（2025年4月1日）](https://www.nankai.co.jp/sites/default/files/imce/pdf/lib/traffic/railmap/pdf/routemap_nankailine_250401.pdf) — 駅・営業キロ。
- [南海電鉄 泉佐野駅](https://www.nankai.co.jp/traffic/station/izumisano.html)、[公式構内図](https://www.nankai.co.jp/sites/default/files/2022-06/izumisano.png) — ホームと番線。
- [配線略図.net 南海本線](https://www.haisenryakuzu.net/documents/pr/nankai/main/) — 配線の概形。
- [OpenStreetMap](https://www.openstreetmap.org/copyright) — © OpenStreetMap contributors、ODbL 1.0。沿線データは `src/data/osm/kishiwada-izumisano.json`、生データはGit管理外の `node_modules/.cache/osm/`。
- [鉄道運用Hub 南海電鉄](https://unyohub.2pd.jp/railroad_nankai/) — 対向ダイヤ。取得データはGit管理外の `node_modules/.cache/unyohub/`。

## 再生成と検証

```powershell
npm run timetable -- --izumisano-only
npm run oncoming:meets -- --new-route-only=izumisano
npm run oncoming:meets -- --new-route-only=izumisano-up
npm run osm:scenery -- --course=kishiwada-izumisano --offline
npm run verify:routes
npm run verify:clearance -- --route=izumisano
npm run verify:clearance -- --route=izumisano-up
npm run verify:scenery
npm run build
```

OSMのoffline再生成は生データのキャッシュが必要。オンライン取得は `--offline` を外す。景観確認は `?inspect=1&route=izumisano` と `?inspect=1&route=izumisano-up` を使う。

2026年10月9日の確認では、ビルド・運行回帰・景観LOD検証が成功。新コースの上下5種別すべてで建築限界の違反0群。ホームの直線・水平、踏切とホームの分離、泉佐野の種別別走行線・開扉側も検査した。既存コースの対向データが変更前と一致することを確認した。
