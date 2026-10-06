// 汐風線: 泉大津〜堺の距離・駅配置を参考にした架空の海沿い複線（10駅・10.6km）。
// 駅間は南海 HANDBOOK 2025 営業キロ程表を使用。曲率、勾配、高架高さ、構造物の距離はゲーム向け概形。
// https://www.nankai.co.jp/lib/company/handbook/pdf/handbook2025.pdf （営業キロ程表）
// 架空駅対応: 桜ヶ丘=泉大津、松浜=松ノ浜、北松原=北助松、白浜台=高石、羽根町=羽衣、
// 海浜公園=浜寺公園、松原町=諏訪ノ森、みなと川=石津川、汐見町=湊、岬口=堺。
import type { Route, Sign, Station, StationLoop } from '../types';
import { reverseRoute } from '../reverse';
import { loopZone } from '../service';
import { stopScenes, type StopScene } from '../oncoming-stops';
import { TT, TT_UP } from './shiokaze-timetable';

const LOOP: StationLoop = { lat: -9.2, turnoutLength: 90, turnoutLimitKmh: 45 };
const DISTANCES = [0, 900, 1900, 3100, 4800, 5600, 6600, 7700, 9200, 10600];
const names = [
  ['桜ヶ丘', 'さくらがおか'], ['松浜', 'まつはま'], ['北松原', 'きたまつばら'],
  ['白浜台', 'しらはまだい'], ['羽根町', 'はねまち'], ['海浜公園', 'かいひんこうえん'],
  ['松原町', 'まつばらちょう'], ['みなと川', 'みなとがわ'], ['汐見町', 'しおみちょう'], ['岬口', 'みさきぐち'],
];
const stations: Station[] = names.map(([name, kana], i) => {
  const stopS = 180 + DISTANCES[i];
  return {
    name, kana, stopS, platform: { from: stopS - 180, to: stopS + 40, side: 'L' },
    scheduledArrival: i * 100, dwell: i && i < 9 ? 25 : undefined, stopMarkerCars: 6,
    elevated: ![2, 5, 6].includes(i),
    layout: [0, 3, 9].includes(i) ? 'loop' : i === 4 ? 'hagoromo' : i === 5 ? 'hamadera' : 'relative',
    ...([0, 3, 9].includes(i) ? { loop: { ...LOOP } } : {}),
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
  { station: 7, kind: 'commuter-new', cars: 4, kmh: 74 },
  { station: 8, kind: 'commuter-old', cars: 6, kmh: 74 },
];

/** 出発・場内信号と駅間の閉そく信号。駅の分岐器から離して配置。 */
const signals: { id: string; s: number }[] = [];
for (let i = 0; i < stations.length; i++) {
  const sta = stations[i], z = loopZone(sta);
  if (i > 0) signals.push({ id: `entry-${i}`, s: z ? z.inFrom - 60 : sta.platform.from - 150 });
  if (i < 9) signals.push({ id: `departure-${i}`, s: sta.stopS + 65 });
  const next = stations[i + 1];
  if (next) {
    const from = z ? z.outTo + 60 : sta.platform.to + 160;
    const nz = loopZone(next), to = nz ? nz.inFrom - 100 : next.platform.from - 200;
    const count = Math.floor((to - from) / 600);
    for (let k = 1; k <= count; k++) signals.push({ id: `block-${i}-${k}`, s: Math.round(from + (to - from) * k / (count + 1)) });
  }
}
signals.sort((a, b) => a.s - b.s);

export const shiokaze: Route = {
  id: 'shiokaze', lineId: 'shiokaze', theme: 'coast', name: '汐風線 桜ヶ丘 → 岬口',
  lineLimit: 90, startS: 180, startClock: 10 * 3600, trainLength: 120,
  // 実区間はほぼ平坦な市街地。急な山岳カーブやトンネルを置かず、緩い沿岸の曲線にする。
  segments: [
    { type: 'straight', length: 460 },
    { type: 'arc', radius: 1400, angle: .12, turn: 'R' },
    { type: 'straight', length: 2080 },
    { type: 'arc', radius: 1800, angle: .06, turn: 'L' },
    { type: 'straight', length: 1580 },
    { type: 'arc', radius: 1500, angle: .10, turn: 'L' },
    // 海浜公園のホーム・副線を過ぎた6100mから曲げる。
    { type: 'straight', length: 1554 },
    { type: 'arc', radius: 1300, angle: .10, turn: 'R' },
    { type: 'straight', length: 1206 },
    { type: 'arc', radius: 1800, angle: .08, turn: 'R' },
    // 汐見町のホーム前で曲線を終える（8900〜9044m）。
    { type: 'straight', length: 1320 },
    { type: 'arc', radius: 1600, angle: .09, turn: 'L' },
    { type: 'straight', length: 2156 },
  ],
  // 高架/地上の指定を再現。基準地盤は0m、高架は9m。各駅ホームと分岐器は水平。
  elevation0: 9,
  gradients: [
    { from: 1300, to: 1750, permil: -20 },
    { from: 2340, to: 2790, permil: 20 },
    { from: 5140, to: 5590, permil: -20 },
    { from: 7000, to: 7450, permil: 20 },
  ],
  limits: [
    { from: 450, to: 750, kmh: 85, label: '沿岸曲線' },
    { from: 4330, to: 4670, kmh: 90, label: '曲線制限' },
    { from: 6060, to: 6350, kmh: 85, label: '公園前曲線' },
  ],
  stations,
  services: [
    {
      id: 'local', name: '普通', cars: 4, units: [4], kind: 'commuter-new',
      kindOptions: ['commuter-new', 'commuter-old'], formationOptions: [[4], [4, 2]],
      lineLimit: 90, useLoop: true, stops: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], timetable: TT.local,
      waits: [{ station: 3, passedBy: 'limited' }],
    },
    {
      id: 'express', name: '急行', cars: 6, units: [4, 2], kind: 'commuter-old',
      kindOptions: ['commuter-old', 'commuter-new'], formationOptions: [[4, 2], [4, 4], [4, 2, 2]],
      lineLimit: 100, stops: [0, 4, 9], timetable: TT.express,
    },
    { id: 'limited', name: '特急', cars: 6, units: [6], kind: 'limited', lineLimit: 110, stops: [0, 9], timetable: TT.limited },
  ],
  prevName: '灯台下', nextName: '山手台',
  signs: stations.slice(1).flatMap(st => approachSigns(st.stopS)),
  extent: { from: -400, to: 11200 }, tracks: [0, 4],
  scenery: { cityZones: [
    { from: -Infinity, to: 5300 }, { from: 6500, to: Infinity },
  ] },
  oncoming: [...stopScenes(stations, STOP_SCENES)], signals,
  // 地上駅の周辺だけ踏切。高架区間に踏切を作らない。
  crossings: [
    { id: 'north-matsubara-south', s: 1840, roadWidth: 6 },
    { id: 'north-matsubara-north', s: 2250, roadWidth: 6 },
    { id: 'park-south', s: 5950, roadWidth: 7 },
    { id: 'matsubara-south', s: 6860, roadWidth: 6 },
    { id: 'matsubara-north', s: 6970, roadWidth: 6 },
  ],
  structures: [
    { kind: 'viaduct', from: -400, to: 1740 },
    { kind: 'viaduct', from: 2350, to: 5580 },
    { kind: 'viaduct', from: 7010, to: 7930 },
    { kind: 'bridge', from: 7930, to: 8080 },
    { kind: 'viaduct', from: 8080, to: 11200 },
  ],
  // 区間内での概形配置。実測距離/橋長ではない。羽衣相当の南側へ高師浜線の高架分岐を描く。
  coastalLandmarks: [
    { kind: 'road-overpass', s: 1590, length: 155, label: '湾岸バイパス' },
    { kind: 'road-overpass', s: 2680, length: 155, label: '臨海連絡道路' },
    { kind: 'tram-overpass', s: 6310, length: 125, label: '浜寺電軌' },
    { kind: 'steel-bridge', s: 8005, length: 150, label: 'みなと川橋梁' },
    { kind: 'branch', s: 4980, length: 900, label: '羽根浜支線' },
  ],
  terminalApproach: true,
};

export const shiokazeUp: Route = reverseRoute(shiokaze, {
  id: 'shiokaze-up', name: '汐風線 岬口 → 桜ヶ丘', timetable: TT_UP,
  oncomingStops: STOP_SCENES, signs: approachSigns,
});

// 桜ヶ丘方面のみ海浜公園の3線目で急行を待避。4線駅の白浜台では両方向とも特急を待つ。
const park = shiokazeUp.stations.findIndex(s => s.name === '海浜公園');
const bay = shiokazeUp.stations.findIndex(s => s.name === '白浜台');
shiokazeUp.stations[park].loop = { ...LOOP };
shiokazeUp.services!.find(s => s.id === 'local')!.waits = [
  { station: park, passedBy: 'express' }, { station: bay, passedBy: 'limited' },
];
// 逆転後に追加した分岐器より手前へ場内信号を移す。
const parkZone = loopZone(shiokazeUp.stations[park])!;
shiokazeUp.signals = shiokazeUp.signals!.filter(s => s.s < parkZone.inFrom - 60 || s.s > parkZone.inTo);
shiokazeUp.signals.push({ id: `entry-${park}`, s: parkZone.inFrom - 60 });
shiokazeUp.signals!.sort((a, b) => a.s - b.s);
