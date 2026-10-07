// 駅に停車する対向列車の出現設定を、駅の位置から作る（下り・上りで共通）
import type { OncomingSpec, OncomingStop, ServiceId, Station, TimeOfDay, TrainKind } from './types';

/** 停車シーン1件: station = 停車する駅 index（その向きの route.stations）。種別に合う駅を指定する */
export interface StopScene {
  station: number; kind: TrainKind; cars: number; kmh: number;
  /** 種別表示（未指定は車種の既定。旧型を普通にするときなど） */
  label?: string;
  /** 2面4線駅の対向側の待避線に停車（普通の待避）。本線は同じ駅の優等列車が使う */
  loop?: boolean;
  /** 対向側の待避線区間を明示する（自線側の待避線の鏡像でない駅） */
  zone?: OncomingStop['zone'];
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
      stop: { station: sc.station, headS: sta.platform.from + HEAD_MARGIN, ...(sc.loop ? { loop: true } : {}), ...(sc.zone ? { zone: sc.zone } : {}) },
    };
  });
}

/** ラッシュ時（朝・夜）に足す対向列車: 既存の停車シーン（spec.stop）が無い途中駅に、普通（新型4両 / 旧型6両 / 1000系6両の順）を停車させる。
 *  複線で、停車シーンを持つ路線のみ（無ければ空）。出現・走路の重なりは world/oncoming.ts の canSpawn が既存編成と同じ規則で調停する */
export function rushStopScenes(stations: Station[], base: OncomingSpec[]): OncomingSpec[] {
  if (!base.some(o => o.stop)) return [];
  const used = new Set(base.flatMap(o => (o.stop ? [o.stop.station] : [])));
  const idx = stations.map((_, i) => i).filter(i => i > 0 && i < stations.length - 1 && !used.has(i));
  const rot: Omit<StopScene, 'station'>[] = [
    { kind: 'commuter-new', cars: 4, kmh: 74 },
    { kind: 'commuter-old', cars: 6, kmh: 74, label: '普通' },
    { kind: 'commuter-1000', cars: 6, kmh: 74, label: '普通' },
  ];
  return stopScenes(stations, idx.map((station, k): StopScene => ({ station, ...rot[k % rot.length] })));
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

export interface OncomingPlanItem { spec: OncomingSpec; kind: TrainKind; rush: boolean; /** 本数合わせの予備（走行中のすれ違いだけ。meets に足りない分だけ使う） */ extra?: boolean }

/** 対向列車ごとの扱いを決める。同じ seedKey（路線・方向・自列車の種別・時間帯）なら常に同じ結果（プレイ中に矛盾しない）。
 *  法則:
 *  - 駅に停車する対向列車は全線で 2〜4 本（ラッシュ時の朝・夜は 3〜5 本）。2面4線駅の待避線の普通（と後続の優等列車）は固定で1回に数える
 *  - 隣り合う駅には続けて停車させない / 停車駅の並びで同じ種別を続けない
 *  - 自列車が通過する駅への停車は最大1回（ラッシュ時 2 回。選ばれにくい）
 *  - 停車に選ばれなかったものは、最大3本（ラッシュ時 4 本）が停車せず走行中にすれ違うだけの編成になる（残りは出さない）
 *  ラッシュ用の編成（rush）は、ラッシュ時以外は出さない */
export function planOncoming(items: OncomingPlanItem[], opt: {
  seedKey: string; rushHour: boolean; passStations: Set<number>; /** 本数の多さ 0〜2（時間帯と向き。未指定はラッシュなら 2） */ level?: number;
  /** 種別の格ごとの本数の比率（HOURLY）。あれば、停車する普通が比率を超える分を走行中のすれ違いへ回す（すれ違いの種別は runClasses で決める） */
  share?: Record<TrainClass, number>;
  /** 出す編成の総数の目安。あれば、停車に選ばれなかった編成と予備（extra）から、総数がこれに届くまで走行中のすれ違いにする */
  meets?: number;
}): OncomingMode[] {
  const level = opt.level ?? (opt.rushHour ? 2 : 0);
  const rng = mulberry32(hashSeed(opt.seedKey));
  const modes: OncomingMode[] = items.map(it => (it.extra || (it.rush && !opt.rushHour) ? 'off' : 'stop'));
  const cand: number[] = [];
  const chosen: { station: number; kind: TrainKind }[] = [];
  items.forEach((it, i) => {
    const sp = it.spec.stop;
    if (modes[i] === 'off' || !sp) return;
    if (sp.loop) chosen.push({ station: sp.station, kind: it.kind }); else cand.push(i);
  });
  const want = ([[2, 3, 3, 4], [3, 3, 4, 4], [3, 4, 4, 5]][level])[Math.floor(rng() * 4)];
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
  if (opt.meets != null) {
    // 総数の目安まで: 停車に選ばれなかった編成 → 予備（均等に間引いて使う）の順
    let need = Math.max(0, opt.meets - items.filter((_, i) => modes[i] !== 'off' && !(cand.includes(i) && !picked.has(i))).length);
    for (const i of order) {
      if (picked.has(i)) continue;
      if (need > 0) { modes[i] = 'run'; need--; } else modes[i] = 'off';
    }
    const extras = items.map((_, i) => i).filter(i => items[i].extra);
    const use = Math.min(need, extras.length);
    for (let j = 0; j < use; j++) modes[extras[Math.floor((j + .5) * extras.length / use)]] = 'run';
  } else for (const i of order) {
    if (picked.has(i)) continue;
    if (runs < (level ? 4 : 3) && rng() < .65) { modes[i] = 'run'; runs++; } else modes[i] = 'off';
  }
  // 普通の停車が比率を超える分は、停車をやめて走行中のすれ違いへ（種別は runClasses で優等列車になる）。停車は最低 1 本残す（待避線の普通がいれば 0 本でもよい）
  if (opt.share) {
    const shown = opt.meets ?? items.filter((_, i) => modes[i] !== 'off').length;
    const total = opt.share.local + opt.share.kyuko + opt.share.tokkyu;
    // 待避線の普通（固定）も普通の1本に数える
    const loopLocals = items.filter((it, i) => modes[i] !== 'off' && it.spec.stop?.loop && classOfSpec(it.spec, it.kind) === 'local').length;
    const localMax = Math.max(loopLocals ? 0 : 1, Math.round(shown * opt.share.local / total) - loopLocals);
    const localStops = [...picked].filter(i => classOfSpec(items[i].spec, items[i].kind) === 'local');
    for (const i of localStops.slice(localMax).reverse()) {
      if (picked.size <= (loopLocals ? 0 : 1)) break;
      modes[i] = 'run'; picked.delete(i);
    }
  }
  return modes;
}

// ---------- 種別の格ごとの本数（平日ダイヤ） ----------

/** 種別の格: 普通 / 急行系（急行・空港急行。区間急行・準急の分も含める） / 特急（ラピート・サザン） */
export type TrainClass = 'local' | 'kyuko' | 'tokkyu';
/** 片方向・1時間あたりの本数（南海本線の平日ダイヤ。ユーザー指定 2026-10-07）。
 *  特急はラピート・サザンが交互に各 2 本（全時間帯）。日中の急行系は空港急行のみ（急行は走らない）。区間急行・準急は作らず急行系に含める */
export const HOURLY: Record<TimeOfDay, Record<TrainClass, number>> = {
  noon: { local: 4, kyuko: 4, tokkyu: 4 },
  morning: { local: 6, kyuko: 10, tokkyu: 4 },
  evening: { local: 6, kyuko: 8, tokkyu: 4 },
  night: { local: 6, kyuko: 8, tokkyu: 4 },
};

/** 対向列車の設定の格（種別表示 → 車種の既定の順に判定） */
export function classOfSpec(spec: OncomingSpec, kind: TrainKind = spec.kind ?? 'commuter-new'): TrainClass {
  const label = spec.label;
  if (label) return label.includes('特急') || label.includes('サザン') ? 'tokkyu' : label.includes('急行') ? 'kyuko' : 'local';
  return kind === 'limited' || kind === 'southern-10000' || kind === 'limited-30000' ? 'tokkyu' : kind === 'commuter-old' ? 'kyuko' : 'local';
}

/** 走行中にすれ違う編成（停車しない編成。待避線の普通に続く優等列車は除く）の格を決める。
 *  停車する編成も含めた全体が share の比率に近づくように、足りない格から順に割り当て、同じ格が続かないように並べる。
 *  戻り値は items と同じ並び（すれ違いでない要素は null） */
export function runClasses(items: OncomingPlanItem[], modes: OncomingMode[], share: Record<TrainClass, number>, seedKey: string): (TrainClass | null)[] {
  const isRun = (i: number) => modes[i] === 'run' || (modes[i] === 'stop' && !items[i].spec.stop && !items[i].spec.follow);
  const slots = items.map((_, i) => i).filter(isRun);
  const fixed: Record<TrainClass, number> = { local: 0, kyuko: 0, tokkyu: 0 };
  items.forEach((it, i) => { if (modes[i] !== 'off' && !isRun(i)) fixed[classOfSpec(it.spec, it.kind)]++; });
  const classes: TrainClass[] = ['local', 'kyuko', 'tokkyu'];
  const total = classes.reduce((a, c) => a + share[c], 0), m = slots.length + classes.reduce((a, c) => a + fixed[c], 0);
  // 全体の目標本数（最大剰余）から停車分を引いた残りを、すれ違いの枠へ
  const exact = classes.map(c => m * share[c] / total), target = exact.map(Math.floor);
  const rest = m - target.reduce((a, b) => a + b, 0);
  exact.map((x, k) => [x - target[k], k]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, k]) => target[k]++);
  const need = classes.map((c, k) => Math.max(0, target[k] - fixed[c]));
  // 枠と必要数の差は比率で埋める / 削る
  while (need.reduce((a, b) => a + b, 0) < slots.length) { const k = [0, 1, 2].sort((a, b) => share[classes[b]] / (need[b] + 1) - share[classes[a]] / (need[a] + 1))[0]; need[k]++; }
  while (need.reduce((a, b) => a + b, 0) > slots.length) { const k = [0, 1, 2].filter(j => need[j] > 0).sort((a, b) => share[classes[a]] / need[a] - share[classes[b]] / need[b])[0]; need[k]--; }
  // 並べ方: 残りの多い格から、直前と同じ格を避けて取る（開始は seedKey で決める）
  const rng = mulberry32(hashSeed(seedKey + '|class'));
  const left = [...need], seq: TrainClass[] = [];
  let prev = -1;
  for (let n = 0; n < slots.length; n++) {
    const order = classes.map((_, j) => j).filter(j => left[j] > 0).sort((a, b) => left[b] - left[a] || rng() - .5);
    const k = order.find(j => j !== prev) ?? order[0];
    seq.push(classes[k]); left[k]--; prev = k;
  }
  const out: (TrainClass | null)[] = items.map(() => null);
  slots.forEach((i, n) => { out[i] = seq[n]; });
  return out;
}

/** すれ違う編成の車両・両数・種別表示。格ごとに順に回す（k = その格の何本目）。towardWakayama = 対向列車が和歌山方面へ向かう */
export function runConsist(cls: TrainClass, k: number, tod: TimeOfDay, towardWakayama: boolean): Pick<OncomingSpec, 'kind' | 'cars' | 'units' | 'unitKinds' | 'label' | 'kmh'> & { id: ServiceId } {
  type C = Pick<OncomingSpec, 'kind' | 'cars' | 'units' | 'unitKinds' | 'label'> & { id: ServiceId };
  const local: C[] = [
    { id: 'local', kind: 'commuter-new', cars: 4, units: [4], label: '普通' },
    { id: 'local', kind: 'commuter-old', cars: 6, units: [4, 2], label: '普通' },
    { id: 'local', kind: 'commuter-1000', cars: 6, units: [6], label: '普通' },
  ];
  const airport: C[] = [
    { id: 'airport', kind: 'commuter-new', cars: 8, units: [4, 4], label: '空港急行' },
    { id: 'airport', kind: 'commuter-old', cars: 8, units: [4, 4], label: '空港急行' },
  ];
  // ラッシュ時は急行（6・8両）と空港急行を交互に
  const kyuko: C[] = tod === 'noon' ? airport : [
    { id: 'express', kind: 'commuter-old', cars: 6, units: [4, 2], label: '急行' }, airport[0],
    { id: 'express', kind: 'commuter-1000', cars: 6, units: [6], label: '急行' }, airport[1],
    { id: 'express', kind: 'commuter-old', cars: 8, units: [4, 4], label: '急行' },
  ];
  // サザンは和歌山方の 4両が 10000系（座席指定車）
  const sk: TrainKind[] = towardWakayama ? ['southern-10000', 'commuter-old'] : ['commuter-old', 'southern-10000'];
  const southern: C = { id: 'southern', kind: sk[0], cars: 8, units: [4, 4], label: '特急サザン', unitKinds: sk };
  const tokkyu: C[] = [{ id: 'limited', kind: 'limited', cars: 6, units: [6], label: '特急ラピートβ' }, southern];
  const list = cls === 'local' ? local : cls === 'kyuko' ? kyuko : tokkyu;
  const c = list[k % list.length];
  return { ...c, kmh: cls === 'local' ? 80 : cls === 'kyuko' ? 95 : 105 };
}
