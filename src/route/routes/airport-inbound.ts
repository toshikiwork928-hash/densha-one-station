// 南海本線・空港線の通し上りコース。既存区間を関西空港側から順に連結する。
import type { Route, ServiceSpec, Sign } from '../types';
import { concatRoutes } from '../concat';
import { reverseRoute, totalLength } from '../reverse';
import { airport } from './airport';
import { izumisanoUp } from './izumisano';
import { through } from './through';
import { namba } from './namba';
import { IT } from './airport-inbound-timetable';

const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map(meters => ({ kind: 'distance' as const, s: stopS - meters, meters })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
  { kind: 'stopMarker', s: stopS, cars: 8 },
];

const first = reverseRoute(airport, {
  id: 'airport-inbound-airport', name: '南海空港線 関西空港 → 泉佐野', timetable: IT,
});

const length = totalLength(airport);
first.airportBridge = { from: length - airport.airportBridge!.to, to: length - airport.airportBridge!.from, islandAtStart: true };
first.noInfill = airport.noInfill?.map(z => ({ from: length - z.to, to: length - z.from }));
for (const v of first.services!) {
  v.lane = first.trackProfiles!['0'];
  v.trackNames = { 0: '2番線', 1: '4番線', 2: '6番線' };
  v.platformSides = { 0: 'R', 1: 'R', 2: 'R' };
}

// 泉佐野では空港線の上下線が外側の2線、本線の上下線が内側の2線を通る。
// 境目を越えて同じレールが続くよう、泉佐野〜岸和田側も外側の線を基準にする。
const sano = structuredClone(izumisanoUp);
for (const [base,id] of [[0,'izumisano-t4'],[4,'izumisano-t1']] as const) {
  const outer = sano.extraTracks!.find(t => t.id === id)!;
  const inner = sano.trackProfiles![base];
  sano.trackProfiles![base] = outer.lat;
  outer.lat = inner;
}
const stationNames = [...first.stations,...sano.stations.slice(1),...through.stations.slice(1),...namba.stations.slice(1)].map(st => st.name);
const stopsFor = (names: string[]) => names.map(name => {
  const i = stationNames.indexOf(name);
  if (i < 0) throw new Error('上りコースに駅がありません: ' + name);
  return i;
});
const services: ServiceSpec[] = (['airport','limited'] as const).map(id => {
  const { lane, platformSides, trackNames, ...train } = airport.services!.find(v => v.id === id)!;
  const stops = id === 'airport'
    ? ['関西空港','りんくうタウン','泉佐野','貝塚','岸和田','春木','泉大津','羽衣','堺','天下茶屋','新今宮','なんば']
    : ['関西空港','りんくうタウン','泉佐野','岸和田','堺','天下茶屋','新今宮','なんば'];
  return { ...train, destination: 'なんば', destinationKana: 'なんば', stops: stopsFor(stops), timetable: IT[id] };
});
const signs = approachSigns;
const airportToKishiwada = concatRoutes(first, sano, {
  id: 'airport-inbound-kishiwada', name: '南海本線・空港線 関西空港 → 岸和田', services, signs,
});
const middle = concatRoutes(airportToKishiwada, through, {
  id: 'airport-inbound-middle', name: '南海本線・空港線 関西空港 → 堺', services, signs,
});
const route: Route = concatRoutes(middle, namba, {
  id: 'airport-namba-up', name: '南海本線・空港線 関西空港 → なんば', services, signs,
});

// concatRoutes は区間ごとの走行線を自動連結する。終点だけは頭端駅として明示する。
route.lineId = 'airport';
route.terminalApproach = true;
route.terminalAtsOnly = true;
route.fullCourseOnly = true;


export const airportInbound = route;
