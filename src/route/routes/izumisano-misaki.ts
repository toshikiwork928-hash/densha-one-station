// 南海本線 泉佐野〜みさき公園の独立コース（10駅・17.9km）。景観の作り込みとダイヤ再現の前の「走れる」版。
// 線形・勾配は src/data/geometry/south.json（OSM の中心線と国土地理院の標高から scripts/route-geometry.ts が作った下書き）を切り出す。
// 営業キロは南海の公式値（泉佐野起点: 羽倉崎2.1、吉見ノ里3.4、岡田浦4.8、樽井6.6、尾崎9.1、鳥取ノ荘10.6、箱作12.6、淡輪16.2、みさき公園17.9）。
// 駅は既存の駅形で近似（尾崎の2面4線・みさき公園の島式2面は未再現）。泉佐野は岸和田〜泉佐野コースと同じ島式3面4線・駅舎。
// 種別は普通と特急サザンだけ（日中の実際の運転）。対向列車・踏切・OSM の街並みは未作成。docs/spec-south-courses.md
import type { ExtraTrack, LatProfile, Route, Segment, ServiceSpec, Sign, SpeedLimit, Station } from '../types';
import { mirrorProfile, reverseRoute } from '../reverse';
import { setDestinations } from '../service';
import SOUTH from '../../data/geometry/south.json';
import { IZUMISANO_PLATFORMS } from './izumisano';
import { SM, SM_UP } from './izumisano-misaki-timetable';

/** 座標: ゲームの s = 営業キロの s（泉佐野 0）+ START。泉佐野の停止位置が 180（ホームは 0〜220） */
const START = 180;
const names: [string, string][] = [
  ['泉佐野', 'いずみさの'], ['羽倉崎', 'はぐらざき'], ['吉見ノ里', 'よしみのさと'], ['岡田浦', 'おかだうら'], ['樽井', 'たるい'],
  ['尾崎', 'おざき'], ['鳥取ノ荘', 'とっとりのしょう'], ['箱作', 'はこつくり'], ['淡輪', 'たんのわ'], ['みさき公園', 'みさきこうえん'],
];
const KM = [0, 2100, 3400, 4800, 6600, 9100, 10600, 12600, 16200, 17900];
const LAST = names.length - 1;
/** 路線データの終端（みさき公園の停止位置の先 400m） */
const END = START + KM[LAST] + 400;

/** 線形の切り出し: 営業キロ [from, to] の直線・円弧（円弧は途中で切れたら角度を按分）。前に prepend [m] の直線を足す */
function sliceSegments(from: number, to: number, prepend: number): Segment[] {
  const out: Segment[] = prepend > 0 ? [{ type: 'straight', length: prepend }] : [];
  let acc = 0;
  for (const g of SOUTH.segments as Segment[]) {
    const len = g.type === 'straight' ? g.length : g.radius * g.angle;
    const a = Math.max(acc, from), b = Math.min(acc + len, to);
    acc += len;
    if (b <= a) continue;
    const f = (b - a) / len;
    out.push(g.type === 'straight' ? { type: 'straight', length: b - a } : { ...g, angle: g.angle * f });
  }
  return out;
}
const segments = sliceSegments(0, END - START, START);

/** 曲線の速度制限: 半径から 2.6√R km/h（5km/h 刻みに切り下げ）、60km/h を下限、85km/h 以上は制限なし。ゲーム用の概算で、実際の制限速度ではない */
function curveLimits(): SpeedLimit[] {
  const out: SpeedLimit[] = [];
  let s = 0;
  for (const g of segments) {
    if (g.type === 'arc') {
      const kmh = Math.max(60, Math.floor(2.6 * Math.sqrt(g.radius) / 5) * 5), len = g.radius * g.angle;
      if (kmh < 85) out.push({ from: Math.round(s - 40), to: Math.round(s + len + 20), kmh, label: '曲線制限' });
      s += len;
    } else s += g.length;
  }
  return out;
}

// 泉佐野駅: 島式3面4線（岸和田〜泉佐野コースと同じ。横位置はゲーム用の概形）。コースは泉佐野から南へ出る。
// 構内は外側下り線(T1 -9.2)・下り本線(T2 0)・上り本線(T3 9.2)・外側上り線(T4 18.4)が平行で、ホームの先で T1 と T4 が本線へ合流する（南の分岐は 300〜550m）。
// 空港線は描かない（泉佐野以南に空港線の分岐は無く、このコースの種別は空港系統を含まない）。
const MAIN_UP: LatProfile = [[-400, 9.2], [300, 9.2], [550, 4]];
const OUTER_DOWN: LatProfile = [[-400, -9.2], [300, -9.2], [550, 0]];
const OUTER_UP: LatProfile = [[-400, 18.4], [300, 18.4], [550, 4]];
const EXTRA: ExtraTrack[] = [
  { id: 'izumisano-t1', lat: OUTER_DOWN, from: -400, to: 550, ownDeck: false },
  { id: 'izumisano-t4', lat: OUTER_UP, from: -400, to: 550, ownDeck: false },
];

const stations: Station[] = names.map(([name, kana], i) => {
  const stopS = START + KM[i];
  return {
    name, kana, stopS, platform: { from: stopS - 180, to: stopS + 40, side: 'L' },
    scheduledArrival: i * 100, dwell: i && i < LAST ? 25 : undefined, stopMarkerCars: 6,
    elevated: i === 0, layout: i === 0 ? 'custom' : 'relative',
    ...(i === 0 ? { customPlatforms: IZUMISANO_PLATFORMS, mainTrack: '2番線' } : {}),
  };
});
const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((d): Sign => ({ kind: 'distance', s: stopS - d, meters: d })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 }, { kind: 'stopMarker', s: stopS, cars: 6 }, { kind: 'stopMarker', s: stopS, cars: 8 },
];
// 信号は岸和田〜泉佐野コースと同じ作り方（相対式の駅: 場内信号と出発信号、駅間は約600mごとの閉そく）
const signals: { id: string; s: number }[] = [];
for (let i = 0; i < stations.length; i++) {
  const sta = stations[i];
  if (i > 0) signals.push({ id: `entry-${i}`, s: sta.platform.from - 150 });
  if (i < LAST) signals.push({ id: `departure-${i}`, s: sta.stopS + 65 });
  const next = stations[i + 1];
  if (next) {
    const from = sta.platform.to + 160, to = next.platform.from - 200;
    for (let k = 1; k <= Math.floor((to - from) / 600); k++) signals.push({ id: `block-${i}-${k}`, s: Math.round(from + (to - from) * k / (Math.floor((to - from) / 600) + 1)) });
  }
}
signals.sort((a, b) => a.s - b.s);

// 勾配: 泉佐野の高架（営業キロ 0〜1781）を最後の360mで地面へ下ろし（-25‰、9m）、その先は国土地理院の標高からの下書き
const VIADUCT_END = START + 1781;
const gradients = [
  { from: VIADUCT_END - 360, to: VIADUCT_END, permil: -25 },
  ...(SOUTH.gradients as { from: number; to: number; permil: number }[])
    .filter(g => g.from + START >= VIADUCT_END && g.to + START <= END)
    .map(g => ({ from: g.from + START, to: g.to + START, permil: g.permil })),
];

const services: ServiceSpec[] = [
  { id: 'local', name: '普通', cars: 4, units: [4], kind: 'commuter-new', kindOptions: ['commuter-new', 'commuter-old', 'commuter-1000'], formationOptions: [[4], [4, 2], [6]], lineLimit: 90, stops: names.map((_, i) => i), timetable: SM.local },
  { id: 'southern', name: '特急サザン', cars: 8, units: [4, 4], kind: 'southern-10000', unitKinds: ['southern-10000', 'commuter-old'], lineLimit: 110, stops: [0, 5, 9], timetable: SM.southern },
];

export const izumisanoMisaki: Route = {
  id: 'izumisano-misaki', lineId: 'shiokaze', theme: 'coast', name: '南海本線 泉佐野 → みさき公園',
  lineLimit: 90, startS: START, startClock: 10 * 3600, trainLength: 120, seaSide: 1,
  segments, elevation0: 9, gradients,
  limits: curveLimits(),
  stations, services,
  prevName: '井原里', nextName: '孝子', signs: stations.slice(1).flatMap(st => approachSigns(st.stopS)),
  extent: { from: -400, to: END }, tracks: [0, 4], trackProfiles: { 4: MAIN_UP },
  deckJoin: [{ from: -400, to: 600 }],
  scenery: { cityZones: [{ from: -Infinity, to: START + 11500 }, { from: START + 15500, to: Infinity }] },
  oncoming: [], signals, crossings: [],
  structures: [{ kind: 'viaduct', from: -400, to: VIADUCT_END }],
  extraTracks: EXTRA,
  terminalApproach: false,
};
// 下りの走行線と番線（ゲーム用の割り当て。泉佐野の割り当てと同じ）: 普通は外側下り線(T1)の1番（ドア右）、サザンは下り本線(T2)の2番（ドア左）。
for (const v of izumisanoMisaki.services!) {
  const outer = v.id === 'local';
  v.lane = outer ? OUTER_DOWN : [[0, 0]];
  v.trackNames = { 0: outer ? '1番線' : '2番線' };
  v.platformSides = { 0: outer ? 'R' : 'L' };
  if (outer) v.laneLimits = [{ from: 300, to: 580, kmh: 45, label: '泉佐野分岐器' }];
}
setDestinations(izumisanoMisaki.services!, 'wakayama');

export const izumisanoMisakiUp: Route = reverseRoute(izumisanoMisaki, { id: 'izumisano-misaki-up', name: '南海本線 みさき公園 → 泉佐野', timetable: SM_UP, signs: approachSigns });
// 上りの走行線と番線: 普通・サザンとも上り本線(T3)の5番（ドア左）に着く
for (const v of izumisanoMisakiUp.services!) {
  if (v.id === 'southern') { v.kind = 'commuter-old'; v.unitKinds = ['commuter-old', 'southern-10000']; }
  v.lane = mirrorProfile(izumisanoMisaki, MAIN_UP);
  v.trackNames = { [LAST]: '5番線' };
  v.platformSides = { [LAST]: 'L' };
}
setDestinations(izumisanoMisakiUp.services!, 'namba');
