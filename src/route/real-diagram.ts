// 実ダイヤの自列車（2026-11-05 のユーザー指定）。時間帯ごと・向きごと・種別ごとに実際の列車を1本だけ決め、どのコース（区間）もその列車の時刻で走る。
// コースの分け方はゲームの容量のためで、なんば（和歌山市・和歌山港、空港系統は関西空港）から通しで走る1本を区間ごとに遊ぶ形（選び方は scripts/real-diagram.ts）
//   - その時間帯に実際の列車が無い種別・区間は選べない（selectableServices・stagesOf）。例: 日中の急行、朝のなんば発・夜のなんば行のラピートβ
//   - 開始時刻（route.startClock）は、その列車がコース（区間）の始発駅を出る実際の時刻。なんばから遠い区間ほど遅くなる。対向列車は startClock + t で動く
//   - 時刻表は、最高速度を変えずに実際の発車時刻に合わせる。ゲームの時刻表（自動運転の最速 +5%）より実際が遅い所は、
//     停車駅の到着を「実際の発車 − ゲームの停車時間」まで遅らせ、待避のある駅は早く着いて実際の発車まで待つ。ゲームの方が遅い所はゲームの時刻のまま
//   - 終着の到着: 列車の終点は実際の到着時刻、途中駅は発車の30秒前（待避で長く停まる駅はゲームの最速で着く）。Hub に途中駅の到着時刻が無いため
// データは src/data/real-diagram.json（npm run real:diagram が鉄道運用Hub の時刻表から作る。CC BY 4.0、平日、2024-12-21 改正）
import data from '../data/real-diagram.json';
import { START_CLOCK } from '../core/config';
import type { Route, ServiceId, TimeOfDay } from './types';

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
  if (!e) return null;
  const st = route.stations, n = st.length;
  const a = st.findIndex(s => s.name === e.from), z = st.findIndex(s => s.name === e.end);
  const waits = new Set((route.services?.find(v => v.id === svc)?.waits ?? []).map(w => w.station));
  const gArr = st.map(s => s.scheduledArrival), gDep = st.map((s, i) => i === 0 ? s.scheduledArrival : s.scheduledArrival + (s.dwell ?? 20));
  const arr = gArr.slice(), dep = gDep.slice(), base = gDep[a];
  let prev = a;
  for (let i = a + 1; i < n; i++) {
    if (st[i].pass) { arr[i] = gArr[i] + dep[prev] - gDep[prev]; dep[i] = arr[i]; continue; }
    const run = gArr[i] - gDep[prev], dwell = gDep[i] - gArr[i], arrMin = dep[prev] + run;
    const target = i === z ? (e.arr >= 0 ? base + e.arr : null) : i < z && e.dep[st[i].name] != null ? base + e.dep[st[i].name] : null;
    if (target == null) { arr[i] = arrMin; dep[i] = arrMin + dwell; }
    else if (i === z) { arr[i] = Math.max(arrMin, target); dep[i] = arr[i] + dwell; }
    else {
      // 待避のある駅は早く着いて待つ（優等列車の通過・発車を待つ時間が要る）。ほかの駅はゲームの停車時間を保ったまま到着を遅らせる
      arr[i] = waits.has(i) ? arrMin : Math.max(arrMin, target - dwell);
      dep[i] = Math.max(arr[i] + dwell, target);
    }
    prev = i;
  }
  for (let i = a + 1; i < n; i++) {
    st[i].scheduledArrival = Math.round(arr[i]);
    if (!st[i].pass && (i < n - 1 || st[i].dwell != null)) st[i].dwell = Math.round(dep[i]) - Math.round(arr[i]);
  }
  route.startClock = e.start - base;
  return e;
}
