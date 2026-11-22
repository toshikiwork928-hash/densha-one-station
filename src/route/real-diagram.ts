// 実ダイヤの自列車（2026-11-05 のユーザー指定）。時間帯ごと・向きごと・種別ごとに実際の列車を1本だけ決め、どのコース（区間）もその列車の時刻で走る。
// コースの分け方はゲームの容量のためで、なんば（和歌山市・和歌山港、空港系統は関西空港）から通しで走る1本を区間ごとに遊ぶ形（選び方は scripts/real-diagram.ts）
//   - その時間帯に実際の列車が無い種別・区間は選べない（selectableServices・stagesOf）。例: 日中の急行、朝のなんば発・夜のなんば行のラピートβ
//   - 開始時刻（route.startClock）は、その列車がコース（区間）の始発駅を出る実際の時刻。なんばから遠い区間ほど遅くなる。対向列車は startClock + t で動く
//   - 途中駅の発車を実列車の時計に合わせ、通常駅の到着は標準停車時間から、待避駅の到着は駅間の走行時間から推定する。
//   - 終着の到着: 列車の終点は実際の到着時刻、途中駅は発車の30秒前（待避で長く停まる駅はゲームの最速で着く）。Hub に途中駅の到着時刻が無いため
// データは src/data/real-diagram.json（npm run real:diagram が鉄道運用Hub の時刻表から作る。CC BY 4.0、平日、2024-12-21 改正）
import data from '../data/real-diagram.json';
import { START_CLOCK } from '../core/config';
import type { Route, ServiceId, TimeOfDay } from './types';
import { applyMountainRealDiagram } from './mountain-real-diagram';

export interface RealTrain {
  svc: ServiceId;
  /** 列車番号・始発駅・行先（実際の列車の） */
  no: string; origin: string; to: string;
  /** 区間の始発駅・終着駅の名前 */
  from: string; end: string;
  /** 区間の始発駅の発車時刻 [s since 0:00] */
  start: number;
  /** 途中の停車駅の発車（始発駅の発車からの秒） */
  dep: Record<string, number>;
  /** 終着駅の到着（始発駅の発車からの秒）。-1 はゲームの最速で着く（待避で長く停まる駅） */
  arr: number;
}
type Day = { trains: RealTrain[]; waits: [string, ServiceId][] };
const ROUTES = (data as unknown as { routes: Record<string, Partial<Record<TimeOfDay, Day>>> }).routes;

const todOf = (route: Route): TimeOfDay => route.timeOfDay ?? 'noon';
/** route の時間帯の実ダイヤ。実ダイヤの無いコース（高野線など）は null */
export const realDayOf = (route: Route, tod: TimeOfDay = todOf(route)): Day | null => ROUTES[route.id]?.[tod] ?? null;

/** 普通の待避（駅名・相手）。実ダイヤの無いコースは undefined（day-patterns.ts の指定を使う） */
export function realWaitsOf(routeId: string): Partial<Record<TimeOfDay, [string, ServiceId][]>> | undefined {
  const r = ROUTES[routeId];
  return r ? Object.fromEntries(Object.entries(r).map(([t, d]) => [t, d!.waits])) : undefined;
}

/** 区間 from → to（駅 index）を走る、その種別の実際の列車。区間がちょうど合うもの、無ければ区間を含むいちばん短いもの */
export function realTrainFor(route: Route, svc: ServiceId | undefined, from: number, to: number, tod: TimeOfDay = todOf(route)): RealTrain | null {
  const day = realDayOf(route, tod);
  if (!day || !svc) return null;
  const ix = (name: string) => route.stations.findIndex(s => s.name === name);
  let best: RealTrain | null = null, bestLen = Infinity;
  for (const e of day.trains) {
    if (e.svc !== svc) continue;
    const a = ix(e.from), b = ix(e.end);
    if (a < 0 || b < 0 || a > from || b < to) continue;
    const len = a === from && b === to ? -1 : b - a;
    if (len < bestLen) { best = e; bestLen = len; }
  }
  return best;
}

/** その時間帯に実際の列車がある種別か（実ダイヤの無いコースは常に true） */
export function realServiceAvailable(route: Route, svc: ServiceId, tod: TimeOfDay = todOf(route)): boolean {
  const day = realDayOf(route, tod);
  return !day || day.trains.some(e => e.svc === svc);
}

/**
 * 選んだ種別・区間の実際の列車に合わせて、駅の時刻（scheduledArrival・dwell）と開始時刻を書き換える。applyService の後に呼ぶ。
 * 実際の列車が無い（実ダイヤの無いコース）ときは開始時刻を時間帯の既定（START_CLOCK）にして null を返す
 */
export function applyRealDiagram(route: Route, svc: ServiceId | undefined, from: number, to: number): RealTrain | null {
  const e = realTrainFor(route, svc, from, to);
  route.startClock = START_CLOCK[todOf(route)] ?? START_CLOCK.noon;
  if (!e) {
    applyMountainRealDiagram(route, from);
    return null;
  }
  const st = route.stations, n = st.length;
  const a = st.findIndex(s => s.name === e.from), z = st.findIndex(s => s.name === e.end);
  const waits = new Set((route.services?.find(v => v.id === svc)?.waits ?? []).map(w => w.station));
  const gArr = st.map(s => s.scheduledArrival), gDep = st.map((s, i) => i === 0 ? s.scheduledArrival : s.scheduledArrival + (s.dwell ?? 20));
  // e.start はコース内で e.from を出る時計。途中駅から始める場合も同じ列車の時計を保つ。
  route.startClock = e.start - gDep[a];
  let prev = a;
  for (let i = a + 1; i <= z; i++) {
    if (st[i].pass) continue;
    const previousDeparture = prev === a ? gDep[a] : st[prev].scheduledArrival + (st[prev].dwell ?? 0);
    const run = gArr[i] - gDep[prev];
    const dwell = gDep[i] - gArr[i];
    const realDeparture = e.dep[st[i].name];
    let arrival = previousDeparture + run;
    let departure = arrival + dwell;
    if (i === z) {
      if (e.arr >= 0) arrival = gDep[a] + e.arr;
      departure = arrival + dwell;
    } else if (realDeparture != null) {
      departure = gDep[a] + realDeparture;
      // 待避駅の余裕はホームで使い、通常駅の余裕は駅間の走行に回す。
      arrival = waits.has(i) ? Math.min(arrival, departure - 25) : departure - dwell;
    }
    // 公開時刻のない通過駅は、前駅の発車から次駅の到着までの走行時間に比例配分する。
    for (let j = prev + 1; j < i; j++) {
      const progress = (gArr[j] - gDep[prev]) / run;
      st[j].scheduledArrival = Math.round(previousDeparture + progress * (arrival - previousDeparture));
    }
    st[i].scheduledArrival = Math.round(arrival);
    if (i < n - 1 || st[i].dwell != null) st[i].dwell = Math.round(departure) - st[i].scheduledArrival;
    prev = i;
  }
  return e;
}
