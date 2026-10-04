# densha-one-station

「電車でGO!」風の1駅だけ運転するブラウザゲーム。Three.js製。

**▶ 遊ぶ: https://toshikiwork928-hash.github.io/densha-one-station/**

## 目的

Three.js で運転台視点の3D表現・簡易列車物理・スコアリングを1ファイルで作る練習。

## 状態

遊べる試作。1区間（桜ヶ丘 → みなと川、約2.4km）のみ。

## 内容

- 運転台視点。左側走行（複線の左側を走る）。直線 → 右カーブ（制限65km/h）→ 直線 → 停車駅
- 沿線: 住宅・中層建物・駅前ビル・木を CC0 の3D素材で配置（InstancedMesh で描画）
- 対向列車: 右側の線路をすれ違う6両編成。接近時に警笛、すれ違い時に風切り音
- マスコン: P1〜P5 / N / B1〜B8 / EB。ブレーキ立ち上がり遅れ・走行抵抗あり
- 採点（100点満点）: 停止位置 50 / 定時 30 / 安全 20（速度超過・EB・停車時衝動で減点）
- 停止位置±0.3m で「ピッタリ」。15m超の行き過ぎで失格
- 効果音は WebAudio で合成（モーター音・走行音・ジョイント音・チャイム・警笛）

## 操作

| キー | 動作 |
| --- | --- |
| `↑` / `W` | 力行側へ1段 |
| `↓` / `S` | ブレーキ側へ1段 |
| `N` | ノッチオフ |
| `Space` | 非常ブレーキ |
| `Enter` | 開始 / リトライ |

タッチ端末は画面右下のボタンで操作。

## 実行方法

`index.html` をブラウザで開く。開けない場合はローカルサーバー経由:

```bash
python -m http.server 8000
```

→ http://localhost:8000

## 依存

- Three.js 0.170.0（jsDelivr CDN から import map で読込。ビルド不要）
- 3D素材（すべて CC0、実行時に CDN から読込。リポジトリには含めない）
  - [Kenney](https://kenney.nl) City Kit Suburban / City Kit Commercial（GitHub ミラー `GeorgeQLe/assets-3d-city` をコミットSHA固定で jsDelivr 経由）
  - [Quaternius](https://quaternius.com) Nature Pack・Buildings Pack 3（ミラー `trebeljahr/quaternius-showcase`、SHA固定）
  - Quaternius High Speed Front / Wagon（Poly Pizza 配信。車体を銀＋緑帯に塗り替えて使用）
  - 読込に失敗した素材は簡易モデル（箱・円錐・箱型車両）で代替
- 要ネット接続（CDN 取得のため）

## 公開可否

可。3D素材はすべて CC0（帰属表示不要だが README に出典を記載）。標識テクスチャ・音はコード生成。駅名は架空。
