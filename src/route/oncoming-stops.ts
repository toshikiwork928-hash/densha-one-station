// 駅に停車する対向列車の出現設定を、駅の位置から作る（下り・上りで共通）
import type { OncomingSpec, Station, TrainKind } from './types';

/** 停車シーン1件: station = 停車する駅 index（その向きの route.stations）。種別に合う駅を指定する */
export interface StopScene { station: number; kind: TrainKind; cars: number; kmh: number }

/** ホーム手前（from 寄り）の停止位置からの余裕 [m] */
const HEAD_MARGIN = 8;
/** 自列車がホームの何 m 手前に来たら対向列車を出現させるか（遠くで出現して見えないように） */
const SPAWN_BEFORE = 2600;
/** 出現位置: ホーム終端の何 m 先か。ここから巡航 → 制動 → 停車（遠く・停止まで約 50 秒） */
const START_AHEAD = 800;

export function stopScenes(stations: Station[], scenes: StopScene[]): OncomingSpec[] {
  return scenes.map(sc => {
    const sta = stations[sc.station];
    return {
      spawnAt: sta.platform.from - SPAWN_BEFORE,
      startS: sta.platform.to + START_AHEAD,
      cars: sc.cars, carLen: 20, gap: .8, kmh: sc.kmh, lat: 4, kind: sc.kind,
      stop: { station: sc.station, headS: sta.platform.from + HEAD_MARGIN },
    };
  });
}
