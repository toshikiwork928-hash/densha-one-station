// 南海本線: 泉大津〜堺の実在の駅名・駅間距離・配線を参考にした海沿いの複線（10駅・10.6km）。公式の再現ではない概形。
// 駅間は南海 HANDBOOK 2025 営業キロ程表を使用。曲線の向きと大きさは地図の駅位置から読んだ概形、勾配・高架高さ・構造物の距離はゲーム向け概形。
// https://www.nankai.co.jp/lib/company/handbook/pdf/handbook2025.pdf （営業キロ程表）
// 配線の参考: 配線略図.net 南海本線（堺 / 湊〜羽衣 / 高石〜泉大津）。詳細は docs/shiokaze-reference.md。
import type { Route, Sign, Station, StationLoop } from '../types';
import { reverseRoute } from '../reverse';
import { islandZone, loopZone } from '../service';
import { stopScenes, type StopScene } from '../oncoming-stops';
import { TT, TT_UP } from './shiokaze-timetable';

const LOOP: StationLoop = { lat: -9.2, turnoutLength: 90, turnoutLimitKmh: 45 };
/** 浜寺公園の堺方面待避線: 本線の隣（4m）、ホームは待避線の外側 */
const PARK_LOOP: StationLoop = { lat: -4, turnoutLength: 90, turnoutLimitKmh: 45, outside: true };
const DISTANCES = [0, 900, 1900, 3100, 4800, 5600, 6600, 7700, 9200, 10600];
const names = [
  ['泉大津', 'いずみおおつ'], ['松ノ浜', 'まつのはま'], ['北助松', 'きたすけまつ'],
  ['高石', 'たかいし'], ['羽衣', 'はごろも'], ['浜寺公園', 'はまでらこうえん'],
  ['諏訪ノ森', 'すわのもり'], ['石津川', 'いしづがわ'], ['湊', 'みなと'], ['堺', 'さかい'],
];
/** 諏訪ノ森は上下のホームが踏切を挟んで前後にずれる（対向線側が堺方面へ OPP_SHIFT）。自線側ホームは本来の位置から半分手前へ寄せる */
const OPP_SHIFT = 260;
const SUWA = 6;
const stations: Station[] = names.map(([name, kana], i) => {
  const stopS = 180 + DISTANCES[i] - (i === SUWA ? OPP_SHIFT / 2 : 0);
  return {
    name, kana, stopS, platform: { from: stopS - 180, to: stopS + 40, side: 'L' },
    scheduledArrival: i * 100, dwell: i && i < 9 ? 25 : undefined, stopMarkerCars: 6,
    elevated: ![2, 5, 6].includes(i),
    layout: [0, 3, 9].includes(i) ? 'loop' : i === 4 ? 'hagoromo' : i === 5 ? 'hamadera' : 'relative',
    ...([0, 3, 9].includes(i) ? { loop: { ...LOOP } } : {}),
    ...(i === 5 ? { loop: { ...PARK_LOOP } } : {}),
    // 湊は島式1面2線（高架）。線路は駅の前後でホームの両側へ開く。
    ...(i === 8 ? { island: { spread: 3.2, length: 100 } } : {}),
    ...(i === SUWA ? { platformOpp: OPP_SHIFT } : {}),
  };
});

const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((d): Sign => ({ kind: 'distance', s: stopS - d, meters: d })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
  { kind: 'stopMarker', s: stopS, cars: 8 },
];
const STOP_SCENES: StopScene[] = [
  { station: 1, kind: 'commuter-new', cars: 4, kmh: 74 },
  { station: 3, kind: 'commuter-new', cars: 4, kmh: 74, loop: true },
  { station: 3, kind: 'limited', cars: 6, kmh: 90, follow: true, through: true },
  { station: 4, kind: 'commuter-old', cars: 6, kmh: 74 },
  { station: 6, kind: 'commuter-old', cars: 6, kmh: 74 },
  { station: 7, kind: 'commuter-new', cars: 4, kmh: 74 },
  { station: 8, kind: 'commuter-old', cars: 6, kmh: 74 },
];

/** 出発・場内信号と駅間の閉そく信号。駅の分岐器・島式駅の S字区間から離して配置。 */
const signals: { id: string; s: number }[] = [];
for (let i = 0; i < stations.length; i++) {
  const sta = stations[i], z = loopZone(sta), iz = islandZone(sta);
  if (i > 0) signals.push({ id: `entry-${i}`, s: z ? z.inFrom - 60 : iz ? iz.inFrom - 50 : sta.platform.from - 150 });
  // 諏訪ノ森は踏切の手前（ホーム端と踏切の間）に出発信号を置く
  if (i < 9) signals.push({ id: `departure-${i}`, s: iz ? iz.outTo + 70 : sta.stopS + (sta.platformOpp ? 45 : 65) });
  const next = stations[i + 1];
  if (next) {
    const from = z ? z.outTo + 60 : iz ? iz.outTo + 150 : sta.platform.to + 160;
    const nz = loopZone(next), niz = islandZone(next), to = nz ? nz.inFrom - 100 : niz ? niz.inFrom - 120 : next.platform.from - 200;
    const count = Math.floor((to - from) / 600);
    for (let k = 1; k <= count; k++) signals.push({ id: `block-${i}-${k}`, s: Math.round(from + (to - from) * k / (count + 1)) });
  }
}
signals.sort((a, b) => a.s - b.s);

/** 諏訪ノ森の対向線側ホームは踏切の先にずれるので、そこに停車する対向列車の停止位置・出現位置も同じだけずらす。 */
const shiftOpp = (list: ReturnType<typeof stopScenes>, station: number, d: number) => list.map(o => o.stop?.station === station
  ? { ...o, spawnAt: o.spawnAt + d, startS: o.startS + d, stop: { ...o.stop, headS: o.stop.headS + d } } : o);

export const shiokaze: Route = {
  id: 'shiokaze', lineId: 'shiokaze', theme: 'coast', name: '南海本線 泉大津 → 堺',
  lineLimit: 90, startS: 180, startClock: 10 * 3600, trainLength: 120,
  // 地図の駅位置から読んだ曲がり: 泉大津〜高石は北東へほぼ直線（松ノ浜〜北助松で少し左へ）、高石〜羽衣で左へ約20°、羽衣〜浜寺公園でさらに左へ約14°、
  // 浜寺公園〜湊は直線的で、諏訪ノ森を出たところで右へ曲がり（石津川橋梁へ上る）、石津川〜湊は直線、堺へ向けて少しずつ右へ寄る。
  segments: [
    { type: 'straight', length: 1200 },
    { type: 'arc', radius: 1700, angle: .176, turn: 'L' },     // 松ノ浜〜北助松（1200〜1499m）
    { type: 'straight', length: 2280.8 },
    { type: 'arc', radius: 1430, angle: .35, turn: 'L' },      // 高石〜羽衣（3781〜4281m）
    { type: 'straight', length: 819.5 },
    { type: 'arc', radius: 1300, angle: .245, turn: 'L' },     // 羽衣を出て高架を下りながら（5100〜5418m）
    { type: 'straight', length: 1611.5 },
    { type: 'arc', radius: 1200, angle: .14, turn: 'R' },      // 諏訪ノ森を出てすぐのカーブ兼上り坂（7030〜7198m）
    { type: 'straight', length: 2702 },                         // 石津川橋梁・石津川・湊は直線
    { type: 'arc', radius: 1800, angle: .09, turn: 'R' },      // 湊〜堺（9900〜10062m）
    { type: 'straight', length: 1138 },
  ],
  // 高架/地上の指定を再現。基準地盤は0m、高架は9m。各駅ホームと分岐器は水平。
  // 羽衣を出てすぐ高架を下り（5030m〜）、諏訪ノ森を出て上り坂（7000〜7360m）で石津川橋梁へ。
  elevation0: 9,
  gradients: [
    { from: 1250, to: 1610, permil: -25 },   // 松ノ浜（高架）から北助松（地上）へ下る
    { from: 2570, to: 2930, permil: 25 },    // 北助松（地上）から高石（高架）へ上る。高石の分岐器（下り3000m〜、上りは出口側が下りの2940mまで）は水平
    { from: 5030, to: 5390, permil: -25 },
    { from: 7000, to: 7360, permil: 25 },
  ],
  limits: [
    { from: 1190, to: 1620, kmh: 90, label: '沿岸曲線' },
    { from: 3770, to: 4401, kmh: 85, label: '曲線制限' },
    { from: 5090, to: 5539, kmh: 80, label: '曲線制限' },
    { from: 7020, to: 7318, kmh: 80, label: '曲線制限' },
  ],
  stations,
  services: [
    {
      id: 'local', name: '普通', cars: 4, units: [4], kind: 'commuter-new',
      kindOptions: ['commuter-new', 'commuter-old'], formationOptions: [[4], [4, 2]],
      lineLimit: 90, useLoop: true, stops: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], timetable: TT.local,
      waits: [{ station: 3, passedBy: 'limited' }, { station: 5, passedBy: 'express' }],
    },
    {
      id: 'express', name: '急行', cars: 6, units: [4, 2], kind: 'commuter-old',
      kindOptions: ['commuter-old', 'commuter-new'], formationOptions: [[4, 2], [4, 4], [4, 2, 2]],
      lineLimit: 100, stops: [0, 4, 9], timetable: TT.express,
    },
    { id: 'limited', name: '特急', cars: 6, units: [6], kind: 'limited', lineLimit: 110, stops: [0, 9], timetable: TT.limited },
  ],
  prevName: '忠岡', nextName: '七道',
  signs: stations.slice(1).flatMap(st => approachSigns(st.stopS)),
  extent: { from: -400, to: 11200 }, tracks: [0, 4],
  scenery: { cityZones: [
    { from: -Infinity, to: 5300 }, { from: 6500, to: Infinity },
  ] },
  oncoming: shiftOpp([...stopScenes(stations, STOP_SCENES)], SUWA, OPP_SHIFT), signals,
  // 地上駅の周辺だけ踏切。高架区間に踏切を作らない。諏訪ノ森は上下ホームの間の踏切。
  crossings: [
    { id: 'north-matsubara-south', s: 1840, roadWidth: 6 },
    { id: 'north-matsubara-north', s: 2250, roadWidth: 6 },
    { id: 'park-south', s: 6040, roadWidth: 7 },
    { id: 'suwanomori', s: 6710, roadWidth: 6 },
  ],
  structures: [
    { kind: 'viaduct', from: -400, to: 1610 },
    { kind: 'viaduct', from: 2570, to: 5395 },
    { kind: 'viaduct', from: 7010, to: 7390 },
    { kind: 'bridge', from: 7390, to: 7540 },
    { kind: 'viaduct', from: 7540, to: 11200 },
  ],
  // 区間内での概形配置。実測距離/橋長ではない。羽衣の南側へ高師浜線の高架分岐を描く。
  coastalLandmarks: [
    { kind: 'road-overpass', s: 1720, length: 155, side: -1, label: '湾岸バイパス' },
    { kind: 'road-overpass', s: 2440, length: 155, side: 1, label: '臨海連絡道路' },
    { kind: 'tram-overpass', s: 6310, length: 125, label: '阪堺電軌' },
    { kind: 'steel-bridge', s: 7465, length: 150, label: '石津川橋梁' },
    { kind: 'branch', s: 4980, length: 900, label: '高師浜線' },
    // 羽衣駅直結のタワー: 泉大津寄りのホーム端（上り線の右側）。direction=1 は +z が s 増加方向。上りでは reverseRoute が反転する。
    { kind: 'tower', s: stations[4].platform.from - 24, side: 1, direction: 1, label: '羽衣駅直結タワー' },
  ],
  terminalApproach: true,
};

export const shiokazeUp: Route = reverseRoute(shiokaze, {
  id: 'shiokaze-up', name: '南海本線 堺 → 泉大津', timetable: TT_UP,
  oncomingStops: STOP_SCENES, signs: approachSigns,
});

// 諏訪ノ森: reverseRoute が写した下りの自線側ホームは、上りでは対向線側のホーム。自線側（泉大津方面）ホームは対向線側より OPP_SHIFT だけ手前にある。
{
  const suwa = shiokazeUp.stations[9 - SUWA], old = suwa.stopS;
  suwa.platform = { ...suwa.platform, from: suwa.platform.from - OPP_SHIFT, to: suwa.platform.to - OPP_SHIFT };
  suwa.stopS -= OPP_SHIFT;
  const dep = shiokazeUp.signals!.find(g => g.s === old + 60);
  if (dep) dep.s = suwa.stopS + 45;
}

// 下りは浜寺公園の本線隣の待避線で優等列車の通過を待つ。上りは泉大津方面の副線（島式の外側線）。両方向とも高石では特急を待つ。
// 上りの浜寺公園は reverseRoute が下りの待避線（堺方面）の設定を写すので、泉大津方面側の副線へ入れ替える。
const park = shiokazeUp.stations.findIndex(s => s.name === '浜寺公園');
const bay = shiokazeUp.stations.findIndex(s => s.name === '高石');
shiokazeUp.stations[park].loop = { ...LOOP };
shiokazeUp.services!.find(s => s.id === 'local')!.waits = [
  { station: park, passedBy: 'express' }, { station: bay, passedBy: 'limited' },
];
// 逆転後に追加した分岐器より手前へ場内信号を移す。
const parkZone = loopZone(shiokazeUp.stations[park])!;
shiokazeUp.signals = shiokazeUp.signals!.filter(s => s.s < parkZone.inFrom - 110 || s.s > parkZone.inTo);
shiokazeUp.signals.push({ id: `entry-${park}`, s: parkZone.inFrom - 110 });
shiokazeUp.signals!.sort((a, b) => a.s - b.s);
// 上りの浜寺公園には堺方面の副線（ホームは外側）があり、そこに停まる対向列車は置かない。ラッシュ用の自動追加を避けるため、出現しない印の編成を置く。
shiokazeUp.oncoming.push({ spawnAt: 1e9, startS: 0, cars: 4, carLen: 20, gap: .8, kmh: 74, lat: 4, kind: 'commuter-new', stop: { station: park, headS: 0 } });
