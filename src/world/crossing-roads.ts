import type { GameContext } from '../core/context';
import { trackSpan } from '../route/service';
import { coastalThirdTracks } from './coastal-stations';
import { loopTracks } from './track-mesh';

/** 踏切の道路が接続する左右の進入路。添字は横位置の小さい側から数える。 */
export type RoadApproaches = Map<string, [boolean, boolean]>;

export function crossingSpans(ctx: GameContext) {
  const loops = loopTracks(ctx);
  const thirds = ctx.route.stations.flatMap(st => coastalThirdTracks(ctx.route, st));
  return (ctx.route.crossings ?? []).map(c => {
    let [lo, hi] = trackSpan(ctx.route, c.s, 30);
    // 警報機と遮断機は道路の両縁でも、並行する待避線・分岐器より外に立てる。
    const half = (c.roadWidth ?? 6) / 2 + 2;
    for (const s of [c.s - half, c.s, c.s + half]) {
      for (const t of loops) if (s >= t.z.inFrom && s <= t.z.outTo) {
        lo = Math.min(lo, t.lat(s)); hi = Math.max(hi, t.lat(s));
      }
      for (const t of thirds) if (s >= t.from && s <= t.to) {
        lo = Math.min(lo, t.lat(s)); hi = Math.max(hi, t.lat(s));
      }
    }
    return { c, lo, hi };
  });
}
