// 区間ごとの専用景観を、運転コースの駅位置と進行方向に合わせる。
import type { GameContext } from '../core/context';
import type { Track } from '../route/track';
import type { Route } from '../route/types';
import { totalLength } from '../route/reverse';
import { sectionFrame } from './section-frame';

export function downFrame(ctx: GameContext, base: Route): GameContext | null {
  if (ctx.route.id === base.id) return ctx;
  const frame = sectionFrame(base, ctx.route);
  if (!frame) return null;
  const length = totalLength(base), real = ctx.track;
  const { rev, mapS, mapL } = frame;
  const sign = rev ? -1 : 1;
  const track: Track = {
    trackAt(s) {
      const t = real.trackAt(mapS(s)), lat = mapL(0);
      return { ...t, x: t.x + t.rx * lat, z: t.z + t.rz * lat,
        phi: t.phi + (rev ? Math.PI : 0), rx: sign * t.rx, rz: sign * t.rz };
    },
    at: (s, lat, y) => real.at(mapS(s), mapL(lat), y),
    gradeAt: s => sign * real.gradeAt(mapS(s)),
    limitAt: s => real.limitAt(mapS(s)),
    length,
    pathLat: s => mapL(real.pathLat(mapS(s))),
    pathAt: (s, lat, y) => real.pathAt(mapS(s), sign * lat, y),
  };
  // 列車の位置も区間固有の距離に戻す。区間外では境界からの距離を保つ。
  const start = mapS(0), end = mapS(length);
  const unmap = (s: number) => {
    if (sign * (s - start) <= 0) return sign * (s - start);
    if (sign * (s - end) >= 0) return length + sign * (s - end);
    let lo = 0, hi = length;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (sign * (s - mapS(mid)) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const train = new Proxy(ctx.state.train, { get: (t, k) => k === 's' ? unmap(t.s) : Reflect.get(t, k) });
  const state = new Proxy(ctx.state, { get: (st, k) => k === 'train' ? train : Reflect.get(st, k) });
  return { ...ctx, route: base, track, state };
}
