// 南海空港線の走行データ。泉佐野〜りんくうタウン〜関西空港を一続きのコースにする。
import type { Route, ServiceSpec, Sign, Station } from '../types';
import { airportService } from '../service';
import { concatRoutes } from '../concat';
import { izumisano } from './izumisano';
import { configureAirportLayout } from './airport-layout';
import { AT, KT_AIRPORT } from './airport-timetable';

const DIST = [0, 1900, 8800];
const names: [string, string][] = [['泉佐野', 'いずみさの'], ['りんくうタウン', 'りんくうたうん'], ['関西空港', 'かんさいくうこう']];
const stations: Station[] = names.map(([name, kana], i) => {
  const stopS = 180 + DIST[i];
  return { name, kana, stopS, platform: { from: stopS - 180, to: stopS + 40, side: 'R' }, scheduledArrival: 0,
    dwell: i === 1 ? 25 : undefined, stopMarkerCars: 8, elevated: i !== 2, layout: 'custom', headEnd: i === 2 };
});
const signs = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((meters): Sign => ({ kind: 'distance', s: stopS - meters, meters })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
  { kind: 'stopMarker', s: stopS, cars: 8 },
];
const services: ServiceSpec[] = [
  { id: 'local', name: '普通', cars: 4, units: [4], kind: 'commuter-new', kindOptions: ['commuter-new', 'commuter-old'], formationOptions: [[4], [4, 2], [6]], lineLimit: 90, stops: [0, 1, 2], timetable: AT.local },
  airportService([0, 1, 2], AT.airport),
  { id: 'limited', name: '特急ラピートβ', cars: 6, units: [6], kind: 'limited', lineLimit: 110, stops: [0, 1, 2], timetable: AT.limited },
];

export const airport: Route = {
  id: 'airport', lineId: 'airport', theme: 'coast', name: '南海空港線 泉佐野 → 関西空港',
  lineLimit: 90, startS: 180, startClock: 10 * 3600, trainLength: 120, seaSide: 1,
  segments: [
    { type: 'straight', length: 535 }, { type: 'arc', radius: 550, angle: 1.55, turn: 'R' },
    { type: 'straight', length: 1000 }, { type: 'arc', radius: 1200, angle: .25, turn: 'L' },
    { type: 'straight', length: 3940 }, { type: 'arc', radius: 950, angle: 1.35, turn: 'L' },
    { type: 'straight', length: 1600 },
  ],
  elevation0: 9, gradients: [{ from: 260, to: 660, permil: 35 }, { from: 1050, to: 1610, permil: -25 },
    { from: 2410, to: 3090, permil: 15 }, { from: 6450, to: 6870, permil: -20 },
    { from: 7730, to: 8530, permil: -8.5 }],
  limits: [{ from: 535, to: 1390, kmh: 85, label: '曲線制限' }], stations, services,
  prevName: '井原里', nextName: undefined, signs: stations.slice(1).flatMap(s => signs(s.stopS)), extent: { from: -400, to: 9032 }, tracks: [0, 4],
  scenery: { cityZones: [{ from: -Infinity, to: Infinity }] },
  // りんくうタウンまでの市街地高架と空港連絡橋を経て、空港島側で地上へ下ろす。
  // 空港島の高架を降り、掘割を通って人工地盤下のホームに入る。
  structures: [{ kind: 'viaduct', from: -400, to: 7960 }], oncoming: [], crossings: [],
  signals: [320, 960, 1640, 2210, 2980, 3750, 4520, 5290, 6060, 6830, 7600, 8370].map(s => ({ id: 'airport-' + s, s })),
  terminalApproach: true, terminalAtsOnly: true, fullCourseOnly: true,
};
for (const v of airport.services!) { v.destination = '関西空港'; v.destinationKana = 'かんさいくうこう'; }

const fullServices: ServiceSpec[] = [
  { ...services[0], stops: [0, 1, 2, 3, 4, 5, 6, 7, 8], timetable: KT_AIRPORT.local },
  { ...services[1], stops: [0, 2, 6, 7, 8], timetable: KT_AIRPORT.airport },
  { ...services[2], stops: [0, 6, 7, 8], timetable: KT_AIRPORT.limited },
];
export const airportThrough = concatRoutes(izumisano, airport, { id: 'airport-through', name: '南海本線・空港線 岸和田 → 関西空港', services: fullServices, signs });
airportThrough.lineId = airport.lineId;
airportThrough.terminalApproach = true;
airportThrough.terminalAtsOnly = true;
airportThrough.fullCourseOnly = true;
configureAirportLayout(airport);
configureAirportLayout(airportThrough);
