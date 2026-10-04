// 汐風線（架空）: 桜ヶ丘 → みなと川 → 汐見町 → 白浜台 → 松原町 → 海浜公園 → 岬口（高架駅、約11.6km）
// 運行種別（停車パターンは下り。上りは逆順）
//   普通: 全駅停車。汐見町で急行を待ち合わせ（乗り換え）、海浜公園で特急の通過待ち
//   急行: 桜ヶ丘 → （みなと川 通過）→ 汐見町（普通と接続）→ （白浜台・松原町 通過）→ 海浜公園 → 岬口
//   特急: 桜ヶ丘 → 汐見町 → 岬口（海浜公園で普通を追い抜き）
// 汐見町・松原町・海浜公園は島式ホーム2面4線（普通は外側の待避線、急行・特急は本線）
// stations の stopS は6両の停止位置、pass/scheduledArrival/dwell は急行の値（種別適用で route/service.ts が書き換える）
import type { Route, Sign, SpeedLimit, StationLoop } from '../types';
import { reverseRoute } from '../reverse';
import { TT, TT_UP } from './shiokaze-timetable';

/** 距離標（6両停止位置基準）と 4両・6両の停止位置目標。待避線駅では標識が待避線側に寄る（world/signs.ts） */
const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((d): Sign => ({ kind: 'distance', s: stopS - d, meters: d })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
];

/** 島式2面4線: 待避線は自線の 9.2m 左（対向側は対向線の 9.2m 右）、間に幅 6m の島式ホーム。分岐器 90m・制限 45km/h */
const LOOP: StationLoop = { lat: -9.2, turnoutLength: 90, turnoutLimitKmh: 45 };

// 曲線制限（to は編成長 100m 分を含めた解除位置）
// 半径とカントから: R500 → 70、R600 → 80、R650/700 → 85、R800 → 90、R900 → 95
const limits: SpeedLimit[] = [
  { from: 1100, to: 1650, kmh: 85, label: '曲線制限' },
  { from: 3000, to: 3460, kmh: 80, label: '曲線制限' },
  { from: 4260, to: 4720, kmh: 90, label: '曲線制限' },
  { from: 5500, to: 5850, kmh: 70, label: 'トンネル内曲線' },
  { from: 6800, to: 7160, kmh: 85, label: '曲線制限' },
  { from: 7960, to: 8305, kmh: 85, label: '曲線制限' },
  { from: 10205, to: 10575, kmh: 95, label: '曲線制限' },
];

export const shiokaze: Route = {
  id: 'shiokaze',
  name: '汐風線 桜ヶ丘 → 岬口',
  // 速度制限・制限解除の標識は種別（編成長・分岐器）ごとに world/signs.ts が limits から生成
  lineLimit: 90,
  startS: 190,
  startClock: 10 * 3600,
  trainLength: 100,
  segments: [
    { type: 'straight', length: 1100 },
    { type: 'arc', radius: 700, angle: 0.5, turn: 'R' }, // → 1450
    { type: 'straight', length: 1550 }, // → 3000（みなと川）
    { type: 'arc', radius: 600, angle: 0.6, turn: 'L' }, // → 3360
    { type: 'straight', length: 900 }, // → 4260
    { type: 'arc', radius: 800, angle: 0.45, turn: 'R' }, // → 4620
    { type: 'straight', length: 880 }, // → 5500（汐見町）
    { type: 'arc', radius: 500, angle: 0.5, turn: 'L' }, // → 5750（トンネル内）
    { type: 'straight', length: 1050 }, // → 6800
    { type: 'arc', radius: 650, angle: 0.4, turn: 'R' }, // → 7060
    { type: 'straight', length: 900 }, // → 7960（白浜台）
    { type: 'arc', radius: 700, angle: 0.35, turn: 'L' }, // → 8205
    { type: 'straight', length: 2000 }, // → 10205（松原町 8650、海浜公園 9560）
    { type: 'arc', radius: 900, angle: 0.3, turn: 'R' }, // → 10475
    { type: 'straight', length: 1700 }, // → 12175（岬口）
  ],
  // 標高: 3600〜4100 で +12m（高架）、6100 で +8m（トンネル内頂点）、7850〜7950 で +10m（橋梁）、10510〜 で +9m（岬口の高架）。他の駅・踏切は 0m
  gradients: [
    { from: 3000, to: 3600, permil: 20 },
    { from: 4100, to: 4700, permil: -20 },
    { from: 5300, to: 6100, permil: 10 },
    { from: 6100, to: 6900, permil: -10 },
    { from: 7450, to: 7850, permil: 25 },
    { from: 7950, to: 8350, permil: -25 },
    { from: 10060, to: 10510, permil: 20 },
  ],
  limits,
  stations: [
    { name: '桜ヶ丘', kana: 'さくらがおか', stopS: 190, platform: { from: 20, to: 200, side: 'L' }, scheduledArrival: 0 },
    { name: 'みなと川', kana: 'みなとがわ', stopS: 2600, platform: { from: 2420, to: 2620, side: 'L' }, scheduledArrival: 155, dwell: 25, stopMarkerCars: 6 },
    { name: '汐見町', kana: 'しおみちょう', stopS: 4900, platform: { from: 4720, to: 4920, side: 'L' }, scheduledArrival: 312, pass: true, loop: LOOP },
    { name: '白浜台', kana: 'しらはまだい', stopS: 7400, platform: { from: 7220, to: 7420, side: 'L' }, scheduledArrival: 466, dwell: 25, stopMarkerCars: 6 },
    { name: '松原町', kana: 'まつばらちょう', stopS: 8650, platform: { from: 8470, to: 8670, side: 'L' }, scheduledArrival: 560, dwell: 25, stopMarkerCars: 6, loop: LOOP },
    { name: '海浜公園', kana: 'かいひんこうえん', stopS: 9560, platform: { from: 9380, to: 9580, side: 'L' }, scheduledArrival: 646, dwell: 25, stopMarkerCars: 6, loop: LOOP },
    { name: '岬口', kana: 'みさきぐち', stopS: 11840, platform: { from: 11660, to: 11860, side: 'L' }, scheduledArrival: 850, stopMarkerCars: 6, elevated: true },
  ],
  // 時刻は shiokaze-timetable.ts（scripts/timetable.ts で生成）
  services: [
    {
      id: 'local', name: '普通', cars: 4, units: [4], kind: 'commuter-new', kindOptions: ['commuter-new', 'commuter-old'], formationOptions: [[4], [4, 2]], lineLimit: 90, useLoop: true,
      stops: [0, 1, 2, 3, 4, 5, 6],
      timetable: TT.local,
      // 下り: 汐見町で急行（停車・接続）、海浜公園で特急（通過）を待つ（上りは反転して 海浜公園で特急、汐見町で急行）
      waits: [{ station: 2, passedBy: 'express' }, { station: 5, passedBy: 'limited' }],
    },
    {
      id: 'express', name: '急行', cars: 6, units: [4, 2], kind: 'commuter-old', kindOptions: ['commuter-old', 'commuter-new'], formationOptions: [[4, 2], [4, 4], [4, 2, 2]], lineLimit: 100,
      stops: [0, 2, 5, 6],
      timetable: TT.express,
    },
    {
      id: 'limited', name: '特急', cars: 6, units: [6], kind: 'limited', lineLimit: 110,
      stops: [0, 2, 6],
      timetable: TT.limited,
    },
  ],
  prevName: '山手台',
  nextName: '灯台下',
  signs: [
    ...approachSigns(2600),
    ...approachSigns(4900),
    ...approachSigns(7400),
    ...approachSigns(8650),
    ...approachSigns(9560),
    ...approachSigns(11840),
  ],
  extent: { from: -400, to: 12110 },
  tracks: [0, 4],
  scenery: {
    cityZones: [
      { from: -Infinity, to: 480 }, { from: 2150, to: 2900 }, { from: 4500, to: 5100 },
      { from: 7000, to: 7700 }, { from: 8300, to: 9000 }, { from: 9060, to: 9960 }, { from: 11160, to: Infinity },
    ],
    endBlockS: 12220,
  },
  oncoming: [
    { spawnAt: 420, startS: 1750, cars: 6, carLen: 20, gap: 0.8, kmh: 78, lat: 4 },
    { spawnAt: 3300, startS: 4900, cars: 6, carLen: 20, gap: 0.8, kmh: 75, lat: 4 },
    { spawnAt: 7700, startS: 8660, cars: 6, carLen: 20, gap: 0.8, kmh: 70, lat: 4 },
  ],
  // 閉そく信号。駅の出発信号は停止位置の 50〜80m 先。s4560 / s8300 / s9210 は待避線駅の場内信号（分岐側へ進むとき注意 Y）
  signals: [
    { id: 's240', s: 240 }, { id: 's1000', s: 1000 }, { id: 's1800', s: 1800 }, { id: 's2380', s: 2380 },
    { id: 's2650', s: 2650 }, { id: 's3400', s: 3400 }, { id: 's4150', s: 4150 }, { id: 's4560', s: 4560 }, { id: 's4980', s: 4980 },
    { id: 's5800', s: 5800 }, { id: 's6500', s: 6500 }, { id: 's7100', s: 7100 }, { id: 's7450', s: 7450 },
    { id: 's7860', s: 7860 }, { id: 's8300', s: 8300 }, { id: 's8730', s: 8730 }, { id: 's9210', s: 9210 }, { id: 's9640', s: 9640 },
    { id: 's10560', s: 10560 }, { id: 's11160', s: 11160 }, { id: 's11610', s: 11610 },
  ],
  crossings: [
    { id: 'x1900', s: 1900, roadWidth: 6 },
    { id: 'x5150', s: 5150, roadWidth: 5 }, // 汐見町の出口分岐器（〜5060）の先
    { id: 'x7000', s: 7000, roadWidth: 6 },
    { id: 'x9020', s: 9020, roadWidth: 8 },
  ],
  structures: [
    { kind: 'viaduct', from: 3250, to: 4450 },
    { kind: 'tunnel', from: 5450, to: 6250 },
    { kind: 'bridge', from: 7700, to: 8110 },
    { kind: 'viaduct', from: 10260, to: 12110 },
  ],
};

/** 上り（岬口 → 桜ヶ丘）。下りのデータを反転して作る */
export const shiokazeUp: Route = reverseRoute(shiokaze, { id: 'shiokaze-up', name: '汐風線 岬口 → 桜ヶ丘', timetable: TT_UP });
