// 駅に停車する対向列車の出現設定を、駅の位置から作る（下り・上りで共通）
import type { OncomingSpec, Station, TrainKind } from './types';

/** 停車シーン1件: station = 停車する駅 index（その向きの route.stations）。種別に合う駅を指定する */
export interface StopScene {
  station: number; kind: TrainKind; cars: number; kmh: number;
  /** 種別表示（未指定は車種の既定。旧型を普通にするときなど） */
  label?: string;
  /** 2面4線駅の対向側の待避線に停車（普通の待避）。本線は同じ駅の優等列車が使う */
  loop?: boolean;
  /** 直前のシーン（待避線の普通）の後ろから出現する優等列車（同じ駅を指定する） */
  follow?: boolean;
  /** 停車せず、本線を通過する（follow とともに指定。待避線の普通の横を通過） */
  through?: boolean;
}

/** ホーム手前（from 寄り）の停止位置からの余裕 [m] */
const HEAD_MARGIN = 8;
/** 自列車がホームの何 m 手前に来たら対向列車を出現させるか（遠くで出現して見えないように） */
const SPAWN_BEFORE = 2600;
/** 待避線の普通は、後続の優等列車と合わせて早めに出現させる（優等列車が間隔を保って続くため） */
const SPAWN_BEFORE_LOOP = 3300;
/** 本線を通過する優等列車: 自列車がホームの何 m 手前に来たら出現させるか（自列車の進入に合わせて駅を通り抜ける） */
const THROUGH_BEFORE = 600;
/** 出現位置: ホーム終端の何 m 先か。ここから巡航 → 制動 → 停車（遠く・停止まで約 50 秒） */
const START_AHEAD = 800;
/** 待避線の普通に続く優等列車の出現位置: さらに何 m 後方か（普通が減速して分岐器へ入る間、追いつかない間隔） */
const FOLLOW_BEHIND = 300;

export function stopScenes(stations: Station[], scenes: StopScene[]): OncomingSpec[] {
  return scenes.map(sc => {
    const sta = stations[sc.station];
    const base = {
      cars: sc.cars, carLen: 20, gap: .8, kmh: sc.kmh, lat: 4, kind: sc.kind,
      ...(sc.label ? { label: sc.label } : {}),
      ...(sc.follow ? { follow: true } : {}),
    };
    if (sc.through) {
      // 出現位置は、先（出現側）にある次の駅に停車する対向列車の停止位置（ホーム手前端）より手前に収める
      const next = Math.min(...stations.filter(x => x.platform.from > sta.platform.to).map(x => x.platform.from));
      return { ...base, spawnAt: sta.platform.from - THROUGH_BEFORE, startS: Math.min(sta.platform.to + START_AHEAD, next - HEAD_MARGIN - sc.cars * 20 - 40) };
    }
    return {
      ...base,
      spawnAt: sta.platform.from - (sc.loop || sc.follow ? SPAWN_BEFORE_LOOP : SPAWN_BEFORE),
      startS: sta.platform.to + START_AHEAD + (sc.follow ? FOLLOW_BEHIND : 0),
      stop: { station: sc.station, headS: sta.platform.from + HEAD_MARGIN, ...(sc.loop ? { loop: true } : {}) },
    };
  });
}

/** ラッシュ時（朝・夜）に足す対向列車: 既存の停車シーン（spec.stop）が無い途中駅に、普通（新型4両 / 旧型6両を交互）を停車させる。
 *  複線で、停車シーンを持つ路線のみ（無ければ空）。出現・走路の重なりは world/oncoming.ts の canSpawn が既存編成と同じ規則で調停する */
export function rushStopScenes(stations: Station[], base: OncomingSpec[]): OncomingSpec[] {
  if (!base.some(o => o.stop)) return [];
  const used = new Set(base.flatMap(o => (o.stop ? [o.stop.station] : [])));
  const idx = stations.map((_, i) => i).filter(i => i > 0 && i < stations.length - 1 && !used.has(i));
  return stopScenes(stations, idx.map((station, k): StopScene => (k % 2
    ? { station, kind: 'commuter-old', cars: 6, kmh: 74, label: '普通' }
    : { station, kind: 'commuter-new', cars: 4, kmh: 74 })));
}

// ---------- 停車シーンの間引き（自然な頻度にする） ----------

/** 編成ごとの扱い: stop = 設定どおり（停車・待避線・通過など） / run = 停車せず走行中にすれ違うだけ / off = 出さない */
export type OncomingMode = 'stop' | 'run' | 'off';

/** 文字列 → 32bit シード（FNV-1a）。決定的な乱数用（ctx.rng とは独立） */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OncomingPlanItem { spec: OncomingSpec; kind: TrainKind; rush: boolean }

/** 対向列車ごとの扱いを決める。同じ seedKey（路線・方向・自列車の種別・時間帯）なら常に同じ結果（プレイ中に矛盾しない）。
 *  法則:
 *  - 駅に停車する対向列車は全線で 2〜4 本（ラッシュ時の朝・夜は 3〜5 本）。2面4線駅の待避線の普通（と後続の優等列車）は固定で1回に数える
 *  - 隣り合う駅には続けて停車させない / 停車駅の並びで同じ種別を続けない
 *  - 自列車が通過する駅への停車は最大1回（ラッシュ時 2 回。選ばれにくい）
 *  - 停車に選ばれなかったものは、最大3本（ラッシュ時 4 本）が停車せず走行中にすれ違うだけの編成になる（残りは出さない）
 *  ラッシュ用の編成（rush）は、ラッシュ時以外は出さない */
export function planOncoming(items: OncomingPlanItem[], opt: { seedKey: string; rushHour: boolean; passStations: Set<number> }): OncomingMode[] {
  const rng = mulberry32(hashSeed(opt.seedKey));
  const modes: OncomingMode[] = items.map(it => (it.rush && !opt.rushHour ? 'off' : 'stop'));
  const cand: number[] = [];
  const chosen: { station: number; kind: TrainKind }[] = [];
  items.forEach((it, i) => {
    const sp = it.spec.stop;
    if (modes[i] === 'off' || !sp) return;
    if (sp.loop) chosen.push({ station: sp.station, kind: it.kind }); else cand.push(i);
  });
  const want = (opt.rushHour ? [3, 4, 4, 5] : [2, 3, 3, 4])[Math.floor(rng() * 4)];
  const order = cand
    .map(i => ({ i, key: rng() * (opt.passStations.has(items[i].spec.stop!.station) ? 3 : 1) }))
    .sort((a, b) => a.key - b.key).map(x => x.i);
  const picked = new Set<number>();
  const ok = (i: number, strictKind: boolean): boolean => {
    const sp = items[i].spec.stop!, kind = items[i].kind;
    if (chosen.some(c => Math.abs(c.station - sp.station) < 2)) return false;
    if (opt.passStations.has(sp.station) && [...picked].filter(j => opt.passStations.has(items[j].spec.stop!.station)).length >= (opt.rushHour ? 2 : 1)) return false;
    if (!strictKind) return true;
    const lo = chosen.filter(c => c.station < sp.station).sort((a, b) => b.station - a.station)[0];
    const hi = chosen.filter(c => c.station > sp.station).sort((a, b) => a.station - b.station)[0];
    return lo?.kind !== kind && hi?.kind !== kind;
  };
  // 1周目: 種別規則も守って目標数まで。足りなければ2周目で種別規則を緩め、最低数（通常 2・ラッシュ 3）まで
  const minWant = Math.min(want, opt.rushHour ? 3 : 2);
  for (const strict of [true, false]) {
    const target = strict ? want : minWant;
    for (const i of order) {
      if (chosen.length >= target) break;
      if (picked.has(i) || !ok(i, strict)) continue;
      picked.add(i); chosen.push({ station: items[i].spec.stop!.station, kind: items[i].kind });
    }
  }
  // 停車に選ばれなかったもの: 一部を走行中のすれ違い（通常 最大3本・ラッシュ 最大4本）にし、残りは出さない
  let runs = 0;
  for (const i of order) {
    if (picked.has(i)) continue;
    if (runs < (opt.rushHour ? 4 : 3) && rng() < .65) { modes[i] = 'run'; runs++; } else modes[i] = 'off';
  }
  return modes;
}
