import type { GameContext } from '../core/context';
import { DEFAULT_PERF, type TrainPerf } from '../sim/train';
import { TERMINAL_CHECKPOINTS, terminalDistance, terminalSpeedLimit } from './terminal-ats';

/** 次の停車駅に定刻で着くための巡航速度 [km/h]。停車直前や、制限内で定刻に届かない区間では表示しない。 */
export function timetablePace(ctx: GameContext): number | null {
  const { route, state, trainEnv, track } = ctx;
  if (state.state !== 'run' || state.target < 0) return null;
  const station = route.stations[state.target];
  const distance = station.stopS - state.train.s;
  const seconds = station.scheduledArrival - state.t;
  const limit = Math.min(track.limitAt(state.train.s), state.sigLimit,
    terminalSpeedLimit(route, state.target, state.train.s), (trainEnv.perf?.vMax ?? Infinity) * 3.6);
  return cruiseSpeed(distance, seconds, state.train.v, trainEnv.perf ?? DEFAULT_PERF, limit,
    terminalDistance(route, state.target, state.train.s));
}

/** 終端照査で通常の停止曲線より低速になる区間の追加所要秒数。各照査区間の中点で速度を比較する。 */
function terminalExtraSeconds(remaining: number, cruise: number, brake: number): number {
  if (!Number.isFinite(remaining)) return 0;
  let extra = 0;
  for (let i = 1; i < TERMINAL_CHECKPOINTS.length; i++) {
    const [far, fast] = TERMINAL_CHECKPOINTS[i - 1], [near, slow] = TERMINAL_CHECKPOINTS[i];
    const length = Math.min(remaining, far) - near;
    if (length <= 0) continue;
    const middle = near + length / 2;
    const normal = Math.min(cruise, Math.sqrt(2 * brake * middle));
    const checked = (slow + (fast - slow) * (middle - near) / (far - near)) / 3.6;
    if (checked < normal) extra += length * (1 / checked - 1 / normal);
  }
  return extra;
}

function cruiseSpeed(distance: number, seconds: number, speed: number, perf: TrainPerf, limit: number, terminal: number): number | null {
  if (distance < 350 || seconds < 45) return null;
  const accel = perf.a0 * 0.65;
  const brake = perf.bMax * 0.6;
  let high = Math.min(limit / 3.6, seconds * brake, (seconds + speed / accel) / (1 / accel + 1 / brake));
  const reach = (v: number) => v * (seconds - terminalExtraSeconds(terminal, v, brake))
    - Math.max(0, v - speed) ** 2 / (2 * accel) - v ** 2 / (2 * brake);
  if (reach(high) < distance) return null;
  let low = 0;
  for (let i = 0; i < 9; i++) {
    const mid = (low + high) / 2;
    if (reach(mid) < distance) low = mid;
    else high = mid;
  }
  return high * 3.6;
}
