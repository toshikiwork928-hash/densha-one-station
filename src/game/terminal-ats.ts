import { serviceOf } from '../route/service';
import type { Route } from '../route/types';

// ゲーム用の終端進入速度。予告の後、停止位置までの距離に応じて連続照査する。
export const TERMINAL_CHECKPOINTS = [[1000, 65], [600, 45], [300, 35], [120, 25], [50, 15], [0, 10]] as const;

/** 途中にある指定駅では、その駅を本来の行先とする列車だけを終端照査する。 */
export function terminalDistance(route: Route, target: number, s: number): number {
  const station = route.stations[target];
  if (!route.terminalApproach || !station) return Infinity;
  if (target !== route.stations.length - 1 && !(route.destinationApproach === station.name &&
      serviceOf(route, route.activeServiceId)?.destination === station.name)) return Infinity;
  return station.stopS - s;
}

export function terminalSpeedLimit(route: Route, target: number, s: number): number {
  const d = terminalDistance(route, target, s);
  if (d > 1000) return Infinity;
  if (d <= 0) return 10;
  for (let i = 0; i < TERMINAL_CHECKPOINTS.length - 1; i++) {
    const [far, fast] = TERMINAL_CHECKPOINTS[i], [near, slow] = TERMINAL_CHECKPOINTS[i + 1];
    if (d >= near) return slow + (fast - slow) * (d - near) / (far - near);
  }
  return 10;
}
