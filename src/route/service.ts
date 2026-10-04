// 運行種別（普通・急行・特急）の適用と、2面4線駅の待避線の形状
// route は各モジュールが参照を保持しているので、種別の切替は route の中身を書き換えて反映する（元データは初回に退避）
import type { Route, ServiceId, ServiceSpec, SpeedLimit, Station, TrainKind } from './types';

/** 1両の長さ [m] */
export const CAR_LEN = 20;
/** 停止位置目標 stopS の基準両数（短い編成は手前に止める） */
export const BASE_CARS = 6;
/** n 両編成の停止位置のずれ [m]（4両 → 20m 手前） */
export const stopOffset = (cars: number): number => Math.max(0, BASE_CARS - cars) * 10;

/** 待避線の区間（入口分岐器 inFrom..inTo、出口分岐器 outFrom..outTo） */
export interface LoopZone { inFrom: number; inTo: number; outFrom: number; outTo: number; lat: number; limit: number }

/** 駅の待避線区間。入口分岐器はホーム端の 10m 手前まで、出口分岐器はホーム端の 70m 先（出発信号の先）から */
export function loopZone(sta: Station): LoopZone | null {
  const L = sta.loop;
  if (!L) return null;
  const inTo = sta.platform.from - 10, outFrom = sta.platform.to + 70;
  return { inFrom: inTo - L.turnoutLength, inTo, outFrom, outTo: outFrom + L.turnoutLength, lat: L.lat, limit: L.turnoutLimitKmh };
}

/** 待避線への振れ 0..1（分岐器内は S 字） */
export function loopShape(z: LoopZone, s: number): number {
  if (s <= z.inFrom || s >= z.outTo) return 0;
  if (s >= z.inTo && s <= z.outFrom) return 1;
  const u = s < z.inTo ? (s - z.inFrom) / (z.inTo - z.inFrom) : (z.outTo - s) / (z.outTo - z.outFrom);
  return (1 - Math.cos(Math.PI * u)) / 2;
}

/** 路線の待避線区間一覧（station index 付き） */
export function loopZones(route: Route): (LoopZone & { index: number })[] {
  const out: (LoopZone & { index: number })[] = [];
  route.stations.forEach((sta, index) => { const z = loopZone(sta); if (z) out.push({ ...z, index }); });
  return out;
}

/** 自列車の走行位置の横ずれ [m]（停車する 2面4線駅では待避線へ入る）。stations[].pass は種別適用後の値 */
export function playerPathLat(route: Route, s: number): number {
  let lat = 0;
  for (const sta of route.stations) {
    if (!sta.enterLoop || !sta.loop) continue;
    const z = loopZone(sta)!;
    if (s > z.inFrom && s < z.outTo) lat += z.lat * loopShape(z, s);
  }
  return lat;
}

/** 線路側の横ずれ（種別に関係なく待避線に沿う）。s が待避線区間外なら 0 */
export function stationLoopLat(route: Route, s: number): number {
  let lat = 0;
  for (const sta of route.stations) {
    const z = loopZone(sta);
    if (z && s > z.inFrom && s < z.outTo) lat += z.lat * loopShape(z, s);
  }
  return lat;
}

interface Base { stations: Station[]; limits: SpeedLimit[]; trainLength: number; startS: number; lineLimit: number }
const bases = new WeakMap<Route, Base>();

export const serviceOf = (route: Route, id: ServiceId | undefined): ServiceSpec | undefined =>
  route.services?.find(s => s.id === id) ?? route.services?.[0];

/** 編成の合計両数 */
export const carsOf = (units: readonly number[]): number => units.reduce((a, n) => a + n, 0);
/** 編成の表示（4+2 など。1ユニットは両数のみ） */
export const unitsLabel = (units: readonly number[]): string => units.length > 1 ? `${units.join('+')}` : String(units[0]);
const sameUnits = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

const defaults = new WeakMap<ServiceSpec, { kind: TrainKind; units: number[] }>();
/** 選択した車種・編成を route.services へ反映（選択肢にないものは既定値）。旧形式の保存（両数のみ）は同じ両数の最初の編成へ */
export function applyVehicles(route: Route, sel: Partial<Record<ServiceId, { kind: TrainKind; units?: number[]; cars?: number }>>): void {
  for (const svc of route.services ?? []) {
    let d = defaults.get(svc);
    if (!d) { d = { kind: svc.kind, units: [...svc.units] }; defaults.set(svc, d); }
    const v = sel[svc.id], opts = svc.formationOptions ?? [d.units];
    svc.kind = v && svc.kindOptions?.includes(v.kind) ? v.kind : d.kind;
    svc.units = [...(v && (opts.find(o => (v.units ? sameUnits(o, v.units) : carsOf(o) === v.cars)) ?? undefined) || d.units)];
    svc.cars = carsOf(svc.units);
  }
}

/** 種別を route へ反映（停車駅・時刻・停止位置・編成長・制限）。何度呼んでもよい */
export function applyService(route: Route, id: ServiceId | undefined): ServiceSpec | undefined {
  const svc = serviceOf(route, id);
  if (!svc) return undefined;
  let b = bases.get(route);
  if (!b) {
    b = { stations: route.stations.map(s => ({ ...s, platform: { ...s.platform } })), limits: route.limits.map(L => ({ ...L })), trainLength: route.trainLength, startS: route.startS, lineLimit: route.lineLimit };
    bases.set(route, b);
  }
  const len = svc.cars * CAR_LEN, off = stopOffset(svc.cars);
  route.trainLength = len;
  route.lineLimit = svc.lineLimit ?? b.lineLimit; // 種別ごとの最高速度（曲線・分岐器の制限は共通）
  route.startS = b.startS - off;
  route.stations.forEach((sta, i) => {
    const base = b.stations[i], tt = svc.timetable[i];
    sta.pass = svc.stops.includes(i) ? undefined : true;
    sta.stopS = base.stopS - off;
    sta.scheduledArrival = tt?.arr ?? base.scheduledArrival;
    sta.dwell = tt?.dep != null ? tt.dep - tt.arr : undefined;
    sta.stopMarkerCars = svc.cars;
    sta.enterLoop = !!sta.loop && !sta.pass && !!svc.useLoop;
    // 島式ホーム: 待避線に入ると右側、本線は左側がホーム
    sta.platform.side = sta.loop ? (sta.enterLoop ? 'R' : 'L') : base.platform.side;
  });
  // 曲線制限の解除位置は編成長に合わせる（元データは base.trainLength 分を含む）
  const lim: SpeedLimit[] = b.limits.map(L => ({ ...L, to: L.to - b.trainLength + len }));
  // 待避線に入る 2面4線駅: 入口分岐器から出口分岐器を後部が抜けるまで分岐器制限
  route.stations.forEach(sta => {
    const z = loopZone(sta);
    if (!z || !sta.enterLoop) return;
    lim.push({ from: z.inFrom, to: z.outTo + len, kmh: z.limit, label: '分岐器制限' });
  });
  lim.sort((a, c) => a.from - c.from);
  route.limits.splice(0, route.limits.length, ...lim);
  return svc;
}
