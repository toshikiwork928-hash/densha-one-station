// 時間帯ごとのダイヤのパターン（平日）。普通の待避・待ち合わせと、複々線の走行中の追い越しを駅名で指定する（2026-10-07 のユーザー指定）。
//   昼（デイタイム）: 和歌山方面の普通は高石で特急の通過待ち・泉大津で空港急行と接続。なんば方面は泉大津で空港急行と接続・高石で特急の通過待ち
//   朝ラッシュ: なんば行きの普通は粉浜〜岸里玉出で後続の優等に抜かれる。和歌山方面は岸里玉出〜粉浜で抜かれ、堺1番線で急行を待ち合わせ
//   夕ラッシュ: 和歌山方面は粉浜あたりで抜かれ、浜寺公園で急行の通過待ち、泉大津で特急の通過待ちと急行の待ち合わせ。
//              なんば方面は泉大津で特急・急行に抜かれ、堺まで先着、堺から先は岸里玉出で急行に抜かれる
//   夜: 和歌山方面は堺まで先着、浜寺公園で特急・急行の通過待ち、泉大津で特急の通過待ちと急行の待ち合わせ。なんば方面は泉大津で特急・急行に抜かれるのみ
// 特急が急行を追い抜くことは無いので、同じ駅では特急 → 急行の順に待つ。コースの終着駅の待避は到着前の放送で案内するだけ、始発駅の待避はしない
import { serviceOf } from './service';
import type { Route, RunPass, ServiceId, TimeOfDay, Wait } from './types';
import { LOCAL_TT } from './routes/local-timetables';

const TIMES: TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];
type WaitDef = [station: string, passedBy: ServiceId];
type PassDef = [from: string, to: string, passedBy: ServiceId];

/** route の普通に時間帯のパターンを入れる（指定の無い時間帯は待避なし）。時刻表は scripts/timetable.ts が生成した LOCAL_TT */
export function setLocalPatterns(route: Route, p: { waits?: Partial<Record<TimeOfDay, WaitDef[]>>; passes?: Partial<Record<TimeOfDay, PassDef[]>> }): void {
  const local = serviceOf(route, 'local');
  if (!local) return;
  const at = (name: string) => {
    const i = route.stations.findIndex(s => s.name === name);
    if (i < 0) throw new Error(`day-patterns: ${route.id} に駅 ${name} が無い`);
    return i;
  };
  local.waitsByTime = Object.fromEntries(TIMES.map(t => [t, (p.waits?.[t] ?? []).map(([n, by]): Wait => ({ station: at(n), passedBy: by }))]));
  local.runPassesByTime = Object.fromEntries(TIMES.map(t => [t, (p.passes?.[t] ?? []).map(([a, b, by]): RunPass => ({ from: at(a), to: at(b), passedBy: by }))]));
  const tt = LOCAL_TT[route.id];
  if (tt) local.timetableByTime = tt;
}

/** 和歌山方面（堺 → 泉大津・岸和田）の待避 */
export const WAKAYAMA_WAITS: Partial<Record<TimeOfDay, WaitDef[]>> = {
  morning: [['堺', 'express']],
  noon: [['高石', 'limited'], ['泉大津', 'airport']],
  evening: [['浜寺公園', 'express'], ['泉大津', 'limited'], ['泉大津', 'express']],
  night: [['浜寺公園', 'limited'], ['浜寺公園', 'express'], ['泉大津', 'limited'], ['泉大津', 'express']],
};
/** なんば方面（岸和田・泉大津 → 堺）の待避 */
export const NAMBA_WAITS: Partial<Record<TimeOfDay, WaitDef[]>> = {
  noon: [['泉大津', 'airport'], ['高石', 'limited']],
  evening: [['泉大津', 'limited'], ['泉大津', 'express']],
  night: [['泉大津', 'limited'], ['泉大津', 'express']],
};
/** 区間にある駅だけ残す */
export const within = (route: Route, w: Partial<Record<TimeOfDay, WaitDef[]>>): Partial<Record<TimeOfDay, WaitDef[]>> =>
  Object.fromEntries(Object.entries(w).map(([t, list]) => [t, list!.filter(([n]) => route.stations.some(s => s.name === n))]));
