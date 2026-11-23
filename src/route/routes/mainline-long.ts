// 堺または岸和田で既存区間をつなぎ、両区間の停車駅・待避・走行時間を通し運転に引き継ぐ。
import { waitDwell } from '../../game/overtake';
import { concatRoutes } from '../concat';
import { realWaitsOf } from '../real-diagram';
import type { Route, ServiceSpec, Sign, TimeOfDay } from '../types';
import { izumisano, izumisanoUp } from './izumisano';
import { namba, nambaUp } from './namba';
import { through, throughUp } from './through';

const times: TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];
const signs = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((meters): Sign => ({ kind: 'distance', s: stopS - meters, meters })),
  ...[4, 6, 8].map((cars): Sign => ({ kind: 'stopMarker', s: stopS - (cars === 4 ? 20 : 0), cars })),
];

function joinTimes(a: ServiceSpec['timetable'], b: ServiceSpec['timetable'], join: number, dwell: number) {
  const dep = a[join].arr + dwell;
  const table = { ...a, [join]: { arr: a[join].arr, dep } };
  const offset = dep - (b[0].dep ?? b[0].arr);
  for (const [index, stop] of Object.entries(b)) {
    if (+index > 0) table[join + +index] = {
      arr: offset + stop.arr, ...(stop.dep != null ? { dep: offset + stop.dep } : {}),
    };
  }
  return table;
}

function longCourse(a: Route, b: Route, id: string): Route {
  const join = a.stations.length - 1;
  const pairs = a.services!.map(first => ({ first, second: b.services!.find(v => v.id === first.id)! }));
  const services = pairs.map(({ first, second }): ServiceSpec => {
    // 線路・番線は concatRoutes が両区間の座標を合わせて設定する。
    const { lane, laneLimits, trackNames, platformSides, ...spec } = first;
    return {
      ...spec, useLoop: first.useLoop || second.useLoop, precedingLocalApart: second.precedingLocalApart,
      stops: [...first.stops, ...second.stops.filter(i => i > 0).map(i => i + join)],
      timetable: joinTimes(first.timetable, second.timetable, join, 25),
    };
  });
  const route = concatRoutes(a, b, { id, name: `南海本線 ${a.stations[0].name} → ${b.stations.at(-1)!.name}`, services, signs });
  route.terminalApproach = b.terminalApproach;
  route.fullCourseOnly = true;
  const local = route.services!.find(v => v.id === 'local')!;
  const { first, second } = pairs.find(p => p.first.id === 'local')!;
  local.timetableByTime = {};
  local.waitsByTime = {};
  local.runPassesByTime = {};
  const realWaits = realWaitsOf(id);
  for (const time of times) {
    const aWaits = first.waitsByTime?.[time] ?? [];
    const bWaits = second.waitsByTime?.[time] ?? [];
    // 両区間に接続駅の待避があれば、先に到着する区間の列車順に合わせる。
    const waits = realWaits?.[time]?.map(([name, passedBy]) => {
      const station = route.stations.findIndex(s => s.name === name);
      if (station < 0) throw new Error(`${id}: 待避駅「${name}」がありません`);
      return { station, passedBy };
    }) ?? [...aWaits, ...bWaits.filter(w => w.station !== 0 || !aWaits.some(x => x.station === join))
      .map(w => ({ ...w, station: join + w.station }))];
    local.waitsByTime[time] = waits;
    local.runPassesByTime[time] = [...(first.runPassesByTime?.[time] ?? []),
      ...(second.runPassesByTime?.[time] ?? []).map(p => ({ ...p, from: join + p.from, to: join + p.to }))];
    const passers = waits.filter(w => w.station === join).map(w => route.services!.find(v => v.id === w.passedBy)!);
    const dwell = passers.length ? waitDwell(route, join, passers, local.cars) : 25;
    local.timetableByTime[time] = joinTimes(first.timetableByTime?.[time] ?? first.timetable,
      second.timetableByTime?.[time] ?? second.timetable, join, dwell);
  }
  return route;
}

export const nambaKishiwada = longCourse(nambaUp, throughUp, 'namba-kishiwada-up');
export const kishiwadaNamba = longCourse(through, namba, 'kishiwada-namba');
export const sakaiIzumisano = longCourse(throughUp, izumisano, 'sakai-izumisano-up');
export const izumisanoSakai = longCourse(izumisanoUp, through, 'izumisano-sakai');
