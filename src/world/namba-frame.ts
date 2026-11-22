// 堺〜なんばの専用景観（なんばターミナル・住ノ江検車区・七道の商業施設・高野線など）は上り（堺 → なんば、route.id = 'namba'）の座標で書いてある。
// 下り（なんば → 堺、'namba-up'）と空港 inbound では、上りの座標（s, 横位置）を実線形へ写す ctx を渡して、同じ物理位置に描く。
//   s' = 全長 − s、lat' = 4 − lat（上りの対向線 4 が下りの自線 0）。進行方向・右向きも反転する
import type { GameContext } from '../core/context';
import type { Track } from '../route/track';
import { namba } from '../route/routes/namba';
import { totalLength } from '../route/reverse';
import { sectionFrame } from './section-frame';

/** 専用景観に渡す ctx（上りの座標）。堺〜なんばを含まないコースは null */
export function nambaFrame(ctx: GameContext): GameContext | null {
  if (ctx.route.id === 'namba') return ctx;
  if (ctx.route.id === 'airport-namba-up') return airportInbound(ctx);
  if (ctx.route.id !== 'namba-up') return null;
  const L = totalLength(namba), C = 4, real = ctx.track;
  const track: Track = {
    // 線路基準の点（横位置 0）は上りの自線 = 下りの横位置 C。trackAt(s) から t.x + t.rx * lat で組む押し出し形状も同じ位置になる
    trackAt(s) { const t = real.trackAt(L - s); return { ...t, x: t.x + t.rx * C, z: t.z + t.rz * C, phi: t.phi + Math.PI, rx: -t.rx, rz: -t.rz }; },
    at: (s, lat, y) => real.at(L - s, C - lat, y),
    gradeAt: s => -real.gradeAt(L - s),
    limitAt: s => real.limitAt(L - s),
    length: real.length,
    pathLat: s => C - real.pathLat(L - s),
    pathAt: (s, lat, y) => real.pathAt(L - s, -lat, y),
  };
  // 自列車の位置（高野線の電車の出現判定など）も上りの s で見せる
  const train = new Proxy(ctx.state.train, { get: (t, k) => k === 's' ? L - t.s : Reflect.get(t, k) });
  const state = new Proxy(ctx.state, { get: (st, k) => k === 'train' ? train : Reflect.get(st, k) });
  return { ...ctx, route: namba, track, state };
}

/**
 * 関西空港→なんばの合成コースへ、なんば区間の専用景観を写す。
 * 共通駅の位置を基準にするため、空港区間の長さを固定値で仮定しない。
 */
export function airportInbound(ctx: GameContext): GameContext | null {
  if (ctx.route.id !== 'airport-namba-up') return null;
  const frame = sectionFrame(namba, ctx.route);
  if (!frame) return null;
  const real = ctx.track, L = totalLength(namba);
  const map = (s: number) => frame.mapS(s);
  const unmap = (s: number) => {
    let lo = 0, hi = L;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2;
      if (map(mid) < s) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const track: Track = {
    trackAt(s) {
      const t = real.trackAt(map(s));
      return { ...t, phi: t.phi, rx: t.rx, rz: t.rz };
    },
    at: (s, lat, y) => real.at(map(s), frame.mapL(lat), y),
    gradeAt: s => real.gradeAt(map(s)),
    limitAt: s => real.limitAt(map(s)),
    length: L,
    pathLat: s => frame.mapL(real.pathLat(map(s))),
    pathAt: (s, lat, y) => real.pathAt(map(s), frame.mapL(lat), y),
  };
  const train = new Proxy(ctx.state.train, { get: (t, k) => k === 's' ? unmap(t.s) : Reflect.get(t, k) });
  const state = new Proxy(ctx.state, { get: (st, k) => k === 'train' ? train : Reflect.get(st, k) });
  return { ...ctx, route: namba, track, state };
}
