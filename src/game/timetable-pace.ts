import type { GameContext } from '../core/context';
import { DEFAULT_PERF, type TrainPerf } from '../sim/train';
import { terminalSpeedLimit } from './terminal-ats';

/** 次の停車駅に定刻で着くための巡航速度 [km/h]。停車直前や、制限内で定刻に届かない区間では表示しない。 */
export function timetablePace(ctx: GameContext): number | null {
  const { route, state, trainEnv, track } = ctx;
  if (state.state !== 'run' || state.target < 0) return null;
  const station = route.stations[state.target];
  const distance = station.stopS - state.train.s;
  const seconds = station.scheduledArrival - state.t;
  const limit = Math.min(track.limitAt(state.train.s), state.sigLimit,
    terminalSpeedLimit(route, state.target, state.train.s), (trainEnv.perf?.vMax ?? Infinity) * 3.6);
  return cruiseSpeed(distance, seconds, state.train.v, trainEnv.perf ?? DEFAULT_PERF, limit);
}

function cruiseSpeed(distance: number, seconds: number, speed: number, perf: TrainPerf, limit: number): number | null {
  if (distance < 350 || seconds < 45) return null;
  const accel = perf.a0 * 0.65;
  const brake = perf.bMax * 0.6;
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
