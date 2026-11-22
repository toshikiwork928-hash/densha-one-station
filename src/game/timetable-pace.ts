import type { GameContext } from '../core/context';
import { terminalSpeedLimit } from './terminal-ats';

/** 次の停車駅に定刻で着くための巡航速度 [km/h]。停車直前や、制限内で定刻に届かない区間では表示しない。 */
export function timetablePace(ctx: GameContext): number | null {
  const { route, state, trainEnv, track } = ctx;
  if (state.state !== 'run' || state.target < 0) return null;
  const station = route.stations[state.target];
  const distance = station.stopS - state.train.s;
  const seconds = station.scheduledArrival - state.t;
  if (distance < 350 || seconds < 45) return null;

  // 加速と停車前の減速に使う距離を見込む。走行中は残り時間で計算し直すので、勾配や信号で遅れれば目安も変わる。
  const speed = state.train.v;
  const accel = (trainEnv.perf?.a0 ?? 0.7) * 0.65;
  const brake = (trainEnv.perf?.bMax ?? 1) * 0.6;
  const limit = Math.min(track.limitAt(state.train.s), state.sigLimit,
    terminalSpeedLimit(route, state.target, state.train.s), (trainEnv.perf?.vMax ?? Infinity) * 3.6);
  let high = Math.min(limit / 3.6, seconds * brake, (seconds + speed / accel) / (1 / accel + 1 / brake));
  const reach = (v: number) => v * seconds - Math.max(0, v - speed) ** 2 / (2 * accel) - v ** 2 / (2 * brake);
  if (reach(high) < distance) return null;
  let low = 0;
  for (let i = 0; i < 9; i++) {
    const mid = (low + high) / 2;
    if (reach(mid) < distance) low = mid;
    else high = mid;
  }
  return high * 3.6;
}
