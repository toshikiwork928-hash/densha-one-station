// 逆向き（上り）の路線データを下りのデータから作る。s' = 全長 - s で写し、右カーブ ↔ 左カーブ、勾配の符号を反転。
// 自列車は下りの対向線（横位置 4）を走るが、進行方向から見ると左側の線路なので横位置はそのまま [0, 4] で表せる（駅・待避線は左右対称）
import { islandZone, loopZone } from './service';
import { stopScenes, type StopScene } from './oncoming-stops';
import type { Route, ServiceSpec, Sign, SpeedLimit, Station } from './types';

/** 下りの全長（線形要素の合計） */
const totalLength = (r: Route) => r.segments.reduce((a, g) => a + (g.type === 'straight' ? g.length : g.radius * g.angle), 0);

/** 距離標（6両停止位置基準）と 4両・6両の停止位置目標 */
const approachSigns = (stopS: number): Sign[] => [
  ...[500, 300, 200, 100, 50].map((d): Sign => ({ kind: 'distance', s: stopS - d, meters: d })),
  { kind: 'stopMarker', s: stopS - 20, cars: 4 },
  { kind: 'stopMarker', s: stopS, cars: 6 },
];

export function reverseRoute(down: Route, opt: { id: string; name: string; timetable: Record<string, ServiceSpec['timetable']>; /** 下りの停車駅 index で指定した対向列車の停車（上りでは駅 index を反転して配置） */ oncomingStops?: StopScene[] }): Route {
  const L = totalLength(down), m = (s: number) => L - s;
  const n = down.stations.length, ri = (i: number) => n - 1 - i;
  // 標高: 下りの終点側の標高から始める
  let endY = 0;
  for (const g of down.gradients ?? []) endY += (g.to - g.from) * g.permil / 1000;
  const stations: Station[] = [...down.stations].reverse().map(st => {
    const from = m(st.platform.to), to = m(st.platform.from), ahead = st.platform.to - st.stopS;
    return { ...st, platform: { ...st.platform, from, to }, stopS: to - ahead, scheduledArrival: 0, dwell: undefined, pass: undefined };
  });
  const len = down.trainLength;
  const limits: SpeedLimit[] = down.limits.map(Lm => {
    const a = m(Lm.to - len), b = m(Lm.from); // 曲線区間そのもの
    return { ...Lm, from: a, to: b + len };
  }).sort((p, q) => p.from - q.from);
  const services: ServiceSpec[] = (down.services ?? []).map(v => ({
    ...v,
    stops: v.stops.map(ri).sort((a, b) => a - b),
    waits: v.waits?.map(w => ({ ...w, station: ri(w.station) })),
    timetable: opt.timetable[v.id] ?? {},
  }));
  const crossings = (down.crossings ?? []).map(c => ({ ...c, id: 'u' + c.id, s: m(c.s) })).sort((a, b) => a.s - b.s);
  const structures = (down.structures ?? []).map(st => ({ ...st, from: m(st.to), to: m(st.from) })).sort((a, b) => a.from - b.from);
  // 閉そく信号: 出発信号（停止位置の 60m 先）、2面4線駅の場内信号（入口分岐器の 90m 手前）、間は約 700m ごと
  const fixed: number[] = [];
  stations.forEach((st, i) => {
    const iz = islandZone(st);
    // 島式1面2線駅: S字区間（線路の横ずれ）に信号機が掛からないよう、区間の外に出発信号・場内信号を置く
    if (i < n - 1) fixed.push(iz ? iz.outTo + 70 : st.stopS + 60);
    const z = loopZone(st);
    if (z && i > 0) fixed.push(z.inFrom - 90);
    if (iz && i > 0) fixed.push(iz.inFrom - 50);
  });
  fixed.sort((a, b) => a - b);
  const sig: number[] = [];
  for (let k = 0; k < fixed.length; k++) {
    sig.push(fixed[k]);
    const nx = fixed[k + 1] ?? stations[n - 1].stopS - 200;
    const gap = nx - fixed[k], cnt = Math.floor(gap / 750);
    for (let j = 1; j <= cnt; j++) {
      let s = fixed[k] + gap * j / (cnt + 1);
      for (const c of crossings) if (Math.abs(s - c.s) < 25) s = c.s - 30;
      // 島式駅の S字区間（信号機の横位置と線路が重なる）には置かない
      if (stations.some(q => { const iz = islandZone(q); return iz && s > iz.inFrom - 20 && s < iz.outTo + 20; })) continue;
      sig.push(Math.round(s));
    }
  }
  const startS = stations[0].stopS;
  return {
    ...down,
    id: opt.id,
    name: opt.name,
    startS,
    elevation0: endY,
    segments: [...down.segments].reverse().map(g => g.type === 'arc' ? { ...g, turn: g.turn === 'L' ? 'R' : 'L' } : { ...g }),
    gradients: (down.gradients ?? []).map(g => ({ from: m(g.to), to: m(g.from), permil: -g.permil })).sort((a, b) => a.from - b.from),
    limits,
    stations,
    services,
    prevName: down.nextName,
    nextName: down.prevName,
    signs: stations.slice(1).flatMap(st => approachSigns(st.stopS)),
    extent: { from: m(down.extent.to), to: m(down.extent.from) },
    scenery: {
      cityZones: down.scenery.cityZones.map(z => ({ from: m(z.to), to: m(z.from) })).sort((a, b) => a.from - b.from),
      endBlockS: m(down.extent.from) + 110,
    },
    // 対向列車（下り列車）: 走り抜けるものは下りの出現位置を同じ距離で写し、駅に停車するものは上りの駅の位置から作り直す
    oncoming: [
      ...down.oncoming.filter(o => !o.stop).map(o => ({ ...o, spawnAt: startS + (o.spawnAt - down.startS), startS: startS + (o.startS - down.startS) })),
      ...stopScenes(stations, (opt.oncomingStops ?? []).map(sc => ({ ...sc, station: ri(sc.station) }))),
    ],
    signals: sig.map(s => ({ id: 'u' + Math.round(s), s })),
    crossings,
    structures,
  };
}
