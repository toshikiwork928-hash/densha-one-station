// 南海本線と空港線の区間データを各方向の走行線でつなぐ。
import type { Route, ServiceSpec, Sign } from '../types';
import { concatRoutes } from '../concat';
import { reverseRoute, totalLength } from '../reverse';
import { airport, airportThrough } from './airport';
import { izumisanoUp } from './izumisano';
import { through, throughUp } from './through';
import { namba, nambaUp } from './namba';
import { IT } from './airport-inbound-timetable';
import { AT_UP, KT_UP, NT_AIRPORT } from './airport-return-timetable';

const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map(meters => ({ kind: 'distance' as const, s: stopS - meters, meters })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
  { kind: 'stopMarker', s: stopS, cars: 8 },
];

export const airportUp = reverseRoute(airport, {
  id: 'airport-up', name: '南海空港線 関西空港 → 泉佐野', timetable: AT_UP, signs: approachSigns,
});

const length = totalLength(airport);
airportUp.airportBridge = { from: length - airport.airportBridge!.to, to: length - airport.airportBridge!.from, islandAtStart: true };
airportUp.noInfill = airport.noInfill?.map(z => ({ from: length - z.to, to: length - z.from }));
airportUp.terminalApproach = false;
for (const v of airportUp.services!) {
  v.destination = v.id === 'local' ? '泉佐野' : 'なんば';
  v.destinationKana = v.id === 'local' ? 'いずみさの' : 'なんば';
  v.lane = airportUp.trackProfiles!['0'];
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
// 空港発の普通も泉佐野6番線から本線に合流する。
const airportLane = sano.services!.find(v => v.id === 'airport')!;
const localLane = sano.services!.find(v => v.id === 'local')!;
localLane.lane = airportLane.lane;
localLane.laneLimits = airportLane.laneLimits;
const stationNames = [...airportUp.stations,...sano.stations.slice(1),...through.stations.slice(1),...namba.stations.slice(1)].map(st => st.name);
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
const shortServices = airportUp.services!.map(({lane, trackNames, platformSides, ...train}) => {
  const end = stationNames.indexOf('岸和田');
  const stops = train.id === 'local' ? stationNames.slice(0, end + 1).map((_, i) => i)
    : services.find(s => s.id === train.id)!.stops.filter(i => i <= end);
  return { ...train, destination: 'なんば', destinationKana: 'なんば', stops, timetable: KT_UP[train.id as keyof typeof KT_UP] };
});
export const airportThroughUp = concatRoutes(airportUp, sano, {
  id: 'airport-through-up', name: '南海本線・空港線 関西空港 → 岸和田', services: shortServices, signs,
});
const middle = concatRoutes(airportThroughUp, through, {
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

// 下りは各区間の下り線を使う。なんばでは空港急行が6番線、ラピートが9番線から出発する。
const outboundServices = services.map(train => ({
  ...train, destination: '関西空港', destinationKana: 'かんさいくうこう',
  stops: train.stops.map(i => stationNames.length - 1 - i).reverse(),
  timetable: NT_AIRPORT[train.id as keyof typeof NT_AIRPORT],
}));
const nambaToKishiwada = concatRoutes(nambaUp, throughUp, {
  id: 'airport-outbound-kishiwada', name: '南海本線 なんば → 岸和田', services: outboundServices, signs,
});
export const airportOutbound = concatRoutes(nambaToKishiwada, airportThrough, {
  id: 'airport-namba', name: '南海本線・空港線 なんば → 関西空港', services: outboundServices, signs,
});
const offset = nambaToKishiwada.stations.at(-1)!.platform.from - airportThrough.stations[0].platform.from;
airportOutbound.airportBridge = { from: offset + airportThrough.airportBridge!.from, to: offset + airportThrough.airportBridge!.to };
airportOutbound.noInfill = [...(nambaToKishiwada.noInfill ?? []),
  ...(airportThrough.noInfill ?? []).map(z => ({from: offset + z.from, to: offset + z.to}))];
airportOutbound.lineId = 'airport';
airportOutbound.terminalApproach = true;
airportOutbound.terminalAtsOnly = true;
airportOutbound.fullCourseOnly = true;
