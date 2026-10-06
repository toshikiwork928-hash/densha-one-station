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
