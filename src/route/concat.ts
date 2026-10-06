// 2つの区間の路線データを、境目の駅（a の終着 = b の始発。同じ形の駅）でつないで通しのデータを作る。
// a の終着駅のホーム泉大津側の端と b の始発駅のホームの端をそろえ、b の位置を offset だけずらす。
// 線形は a を境目の駅の手前（ホームの端、直線）で切り、そこから b の線形を続ける（どちらも境目の駅は直線なので方位はつながる）。
import { seaSideOf } from './service';
import type { Route, ServiceSpec, Sign, Station } from './types';

const segLen = (r: Route) => r.segments.reduce((a, g) => a + (g.type === 'straight' ? g.length : g.radius * g.angle), 0);

/** 線形を長さ len で切る（最後の要素が直線であること） */
function cutSegments(r: Route, len: number): Route['segments'] {
  const out: Route['segments'] = [];
  let acc = 0;
  for (const g of r.segments) {
    const l = g.type === 'straight' ? g.length : g.radius * g.angle;
    if (acc + l < len - 1e-9) { out.push({ ...g }); acc += l; continue; }
    if (g.type !== 'straight') throw new Error(`concat: ${r.id} の切断位置 ${len} が曲線上`);
    out.push({ type: 'straight', length: len - acc });
    return out;
  }
  throw new Error(`concat: ${r.id} の線形が ${len} m に届かない`);
}

/** 標高（勾配の積分） */
function elevationAt(r: Route, s: number): number {
  let y = r.elevation0 ?? 0;
  for (const g of r.gradients ?? []) y += (Math.min(s, g.to) - Math.min(s, g.from)) * g.permil / 1000;
  return y;
}

export interface ConcatOptions {
  id: string; name: string;
  /** 種別（停車駅・待避の station は通しの index）。timetable は生成済みのもの */
  services: ServiceSpec[];
  /** 距離標・停止位置目標 */
  signs: (stopS: number) => Sign[];
}

export function concatRoutes(a: Route, b: Route, opt: ConcatOptions): Route {
  const na = a.stations.length, joinA = a.stations[na - 1], joinB = b.stations[0];
  if (joinA.name !== joinB.name) throw new Error(`concat: 境目の駅が違う ${joinA.name} / ${joinB.name}`);
  // b の座標 + off = 通しの座標
  const off = joinA.platform.from - joinB.platform.from;
  if (Math.abs((joinA.platform.to - joinA.platform.from) - (joinB.platform.to - joinB.platform.from)) > 1e-6) throw new Error('concat: 境目の駅のホーム長が違う');
  if (Math.abs(elevationAt(a, joinA.platform.from) - elevationAt(b, joinB.platform.from)) > 1e-6) throw new Error('concat: 境目の駅の高さが違う');
  if (seaSideOf(a) !== seaSideOf(b)) throw new Error('concat: 海の側が違う');
  const sh = (s: number) => s + off;
  const ib = (i: number) => i + na - 1; // b の駅 index → 通し
  // 境目の駅は a のもの（途中駅として停車・通過。停車時間は種別適用で決まる）
  const stations: Station[] = [
    ...a.stations.map(s => ({ ...s, platform: { ...s.platform } })),
    ...b.stations.slice(1).map(s => ({ ...s, stopS: sh(s.stopS), platform: { ...s.platform, from: sh(s.platform.from), to: sh(s.platform.to) } })),
  ];
  const joinS = joinA.platform.from; // ここで a の線形を切って b へ
  const total = joinS + segLen(b);
  const clipZones = (z: { from: number; to: number }[], lo: number, hi: number) =>
    z.map(q => ({ from: Math.max(q.from, lo), to: Math.min(q.to, hi) })).filter(q => q.from < q.to);
  return {
    ...a,
    id: opt.id, name: opt.name,
    seaSide: seaSideOf(a),
    segments: [...cutSegments(a, joinS), ...b.segments.map(g => ({ ...g }))],
    gradients: [
      ...(a.gradients ?? []).filter(g => g.to <= joinS),
      ...(b.gradients ?? []).map(g => ({ ...g, from: sh(g.from), to: sh(g.to) })),
    ],
    limits: [
      ...a.limits.filter(L => L.from < joinS).map(L => ({ ...L })),
      ...b.limits.map(L => ({ ...L, from: sh(L.from), to: sh(L.to) })),
    ],
    stations,
    services: opt.services,
    prevName: a.prevName, nextName: b.nextName,
    signs: stations.slice(1).flatMap(st => opt.signs(st.stopS)),
    extent: { from: a.extent.from, to: Math.min(sh(b.extent.to), total + 400) },
    scenery: {
      cityZones: [...clipZones(a.scenery.cityZones, -Infinity, joinS), ...clipZones(b.scenery.cityZones.map(z => ({ from: sh(z.from), to: sh(z.to) })), joinS, Infinity)],
    },
    oncoming: [
      ...a.oncoming.map(o => ({ ...o, ...(o.stop ? { stop: { ...o.stop } } : {}) })),
      ...b.oncoming.map(o => ({
        ...o, spawnAt: sh(o.spawnAt), startS: sh(o.startS),
        ...(o.stop ? { stop: { ...o.stop, station: ib(o.stop.station), headS: sh(o.stop.headS), ...(o.stop.zone ? { zone: { ...o.stop.zone, inFrom: sh(o.stop.zone.inFrom), inTo: sh(o.stop.zone.inTo), outFrom: sh(o.stop.zone.outFrom), outTo: sh(o.stop.zone.outTo) } } : {}) } } : {}),
      })),
    ],
    // 信号: a は境目の駅の場内信号まで（終着側に出発信号は無い）、b は境目の駅の出発信号から
    signals: [
      ...(a.signals ?? []).filter(g => g.s < joinA.stopS).map(g => ({ id: 'a' + g.id, s: g.s })),
      ...(b.signals ?? []).map(g => ({ id: 'b' + g.id, s: sh(g.s) })),
    ].sort((p, q) => p.s - q.s),
    crossings: [
      ...(a.crossings ?? []).map(c => ({ ...c, id: 'a' + c.id })),
      ...(b.crossings ?? []).map(c => ({ ...c, id: 'b' + c.id, s: sh(c.s) })),
    ],
    structures: [
      ...(a.structures ?? []).map(st => ({ ...st, to: Math.min(st.to, joinS) })).filter(st => st.from < st.to),
      ...(b.structures ?? []).map(st => ({ ...st, from: Math.max(sh(st.from), joinS), to: sh(st.to) })).filter(st => st.from < st.to),
    ],
    // 境目の駅のタワー（共通ランドマーク）は a の側のものだけ残す
    coastalLandmarks: [
      // 向き（反転済みか）は区間データのものを持ち越す（通しの route.id の '-up' と区間の向きが合わない区間がある）
      ...(a.coastalLandmarks ?? []).map(l => ({ ...l, reversed: l.reversed ?? a.id.endsWith('-up') })),
      ...(b.coastalLandmarks ?? []).filter(l => l.kind !== 'twin-tower').map(l => ({ ...l, s: sh(l.s), reversed: l.reversed ?? b.id.endsWith('-up') })),
    ],
    precedingHeadway: undefined,
    terminalApproach: false,
  };
}
