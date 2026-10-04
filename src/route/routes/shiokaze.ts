// 汐風線（架空）: 桜ヶ丘 → みなと川 → 汐見町 → 白浜台 → 海浜公園（約9.7km）
// 運行種別 普通（4両・全駅）/ 急行（6両・汐見町通過）/ 特急（6両・途中駅すべて通過）。汐見町と海浜公園は2面4線
// stations の stopS は6両の停止位置、pass/scheduledArrival/dwell は急行の値（種別適用で route/service.ts が書き換える）
import type { Route, Sign, SpeedLimit, StationLoop } from '../types';

/** 距離標（6両停止位置基準）と 4両・6両の停止位置目標。待避線駅では標識が待避線側に寄る（world/signs.ts） */
const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((d): Sign => ({ kind: 'distance', s: stopS - d, meters: d })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
];

/** 2面4線: 待避線は自線の 5m 左（対向側は対向線の 5m 右）。分岐器 70m・制限 45km/h */
const LOOP: StationLoop = { lat: -5, turnoutLength: 70, turnoutLimitKmh: 45 };

// 曲線制限（to は編成長 100m 分を含めた解除位置）
const limits: SpeedLimit[] = [
  { from: 1100, to: 1650, kmh: 65, label: '曲線制限' },
  { from: 3000, to: 3460, kmh: 70, label: '曲線制限' },
  { from: 4260, to: 4720, kmh: 80, label: '曲線制限' },
  { from: 5500, to: 5850, kmh: 60, label: 'トンネル内曲線' },
  { from: 6800, to: 7160, kmh: 70, label: '曲線制限' },
  { from: 8300, to: 8645, kmh: 70, label: '曲線制限' },
];

export const shiokaze: Route = {
  id: 'shiokaze',
  name: '汐風線 桜ヶ丘 → 海浜公園',
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
    { type: 'straight', length: 1240 }, // → 8300（白浜台）
    { type: 'arc', radius: 700, angle: 0.35, turn: 'L' }, // → 8545
    { type: 'straight', length: 2000 }, // → 10545（海浜公園）
  ],
  // 標高: 3600〜4100 で +12m（高架）、6100 で +8m（トンネル内頂点）、8100〜8300 で +10m（橋梁）。駅・踏切は 0m
  gradients: [
    { from: 3000, to: 3600, permil: 20 },
    { from: 4100, to: 4700, permil: -20 },
    { from: 5300, to: 6100, permil: 10 },
    { from: 6100, to: 6900, permil: -10 },
    { from: 7700, to: 8100, permil: 25 },
    { from: 8300, to: 8700, permil: -25 },
  ],
  limits,
  stations: [
    { name: '桜ヶ丘', kana: 'さくらがおか', stopS: 190, platform: { from: 20, to: 200, side: 'L' }, scheduledArrival: 0 },
    { name: 'みなと川', kana: 'みなとがわ', stopS: 2600, platform: { from: 2420, to: 2620, side: 'L' }, scheduledArrival: 155, dwell: 25, stopMarkerCars: 6 },
    { name: '汐見町', kana: 'しおみちょう', stopS: 4900, platform: { from: 4720, to: 4920, side: 'L' }, scheduledArrival: 312, pass: true, loop: LOOP },
    { name: '白浜台', kana: 'しらはまだい', stopS: 7400, platform: { from: 7220, to: 7420, side: 'L' }, scheduledArrival: 466, dwell: 25, stopMarkerCars: 6 },
    { name: '海浜公園', kana: 'かいひんこうえん', stopS: 9900, platform: { from: 9720, to: 9920, side: 'L' }, scheduledArrival: 646, stopMarkerCars: 6, loop: LOOP },
  ],
  // 時刻は自動運転（ヘッドレス）の最速走行 +5% 程度を 5 秒単位に切り上げ。通過駅は arr = 通過時刻。普通の汐見町は特急の待避込み 75 秒停車
  services: [
    {
      id: 'local', name: '普通', cars: 4, kind: 'commuter-new', kindOptions: ['commuter-new', 'commuter-old'], carsOptions: [4, 6], lineLimit: 90, stops: [0, 1, 2, 3, 4],
      timetable: { 0: { arr: 0, dep: 0 }, 1: { arr: 160, dep: 185 }, 2: { arr: 350, dep: 425 }, 3: { arr: 600, dep: 625 }, 4: { arr: 795 } },
      waits: [{ station: 2, passedBy: 'limited' }],
    },
    {
      id: 'express', name: '急行', cars: 6, kind: 'commuter-old', kindOptions: ['commuter-old', 'commuter-new'], lineLimit: 100, stops: [0, 1, 3, 4],
      timetable: { 0: { arr: 0, dep: 0 }, 1: { arr: 170, dep: 195 }, 2: { arr: 340 }, 3: { arr: 485, dep: 510 }, 4: { arr: 695 } },
    },
    {
      id: 'limited', name: '特急', cars: 6, kind: 'limited', lineLimit: 110, stops: [0, 4],
      timetable: { 0: { arr: 0, dep: 0 }, 1: { arr: 140 }, 2: { arr: 250 }, 3: { arr: 380 }, 4: { arr: 520 } },
    },
  ],
  prevName: '山手台',
  nextName: '岬口',
  signs: [
    ...approachSigns(2600),
    ...approachSigns(4900),
    ...approachSigns(7400),
    ...approachSigns(9900),
  ],
  extent: { from: -400, to: 10500 },
  tracks: [0, 4],
  scenery: {
    cityZones: [
      { from: -Infinity, to: 480 }, { from: 2150, to: 2900 }, { from: 4500, to: 5100 },
      { from: 7000, to: 7700 }, { from: 9400, to: Infinity },
    ],
    endBlockS: 10600,
  },
  oncoming: [
    { spawnAt: 420, startS: 1750, cars: 6, carLen: 20, gap: 0.8, kmh: 78, lat: 4 },
    { spawnAt: 3300, startS: 4900, cars: 6, carLen: 20, gap: 0.8, kmh: 75, lat: 4 },
    { spawnAt: 7700, startS: 9000, cars: 6, carLen: 20, gap: 0.8, kmh: 70, lat: 4 },
  ],
  // 閉そく信号。駅の出発信号は停止位置の 50〜80m 先。s4560 / s9550 は待避線駅の場内信号（分岐側へ進むとき注意 Y）
  signals: [
    { id: 's240', s: 240 }, { id: 's1000', s: 1000 }, { id: 's1800', s: 1800 }, { id: 's2380', s: 2380 },
    { id: 's2650', s: 2650 }, { id: 's3400', s: 3400 }, { id: 's4150', s: 4150 }, { id: 's4560', s: 4560 }, { id: 's4980', s: 4980 },
    { id: 's5800', s: 5800 }, { id: 's6500', s: 6500 }, { id: 's7100', s: 7100 }, { id: 's7450', s: 7450 },
    { id: 's8200', s: 8200 }, { id: 's8900', s: 8900 }, { id: 's9550', s: 9550 },
  ],
  crossings: [
    { id: 'x1900', s: 1900, roadWidth: 6 },
    { id: 'x5150', s: 5150, roadWidth: 5 }, // 汐見町の出口分岐器（〜5060）の先
    { id: 'x7000', s: 7000, roadWidth: 6 },
    { id: 'x9250', s: 9250, roadWidth: 8 },
  ],
  structures: [
    { kind: 'viaduct', from: 3250, to: 4450 },
    { kind: 'tunnel', from: 5450, to: 6250 },
    { kind: 'bridge', from: 8000, to: 8450 },
  ],
};
