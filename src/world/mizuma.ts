// 水間鉄道の貝塚駅（見た目だけ。南海の線路にはつながない）: 頭端の2線・島式ホームと上屋・車止め・駅舎・架線柱、水間観音方面へ曲がって離れる線路。
// 座標は岸和田〜泉佐野の下り（route/routes/mizuma.ts）。上りは world/down-frame.ts の写しで同じ物理位置に描く。ctx.rng は使わない
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { MIZUMA_BUILDING, MIZUMA_MAIN, MIZUMA_PLATFORM, MIZUMA_TRACKS } from '../route/routes/mizuma';
import { GeoBatch, M, P } from './batch';

const GAUGE = .535;
type V = [number, number];

/** 折れ線を約 step [m] ごとの点に分ける */
function densify(line: V[], step: number): V[] {
  const out: V[] = [line[0]];
  for (let i = 0; i + 1 < line.length; i++) {
    const [s0, l0] = line[i], [s1, l1] = line[i + 1], n = Math.max(1, Math.ceil(Math.hypot(s1 - s0, l1 - l0) / step));
    for (let k = 1; k <= n; k++) out.push([s0 + (s1 - s0) * k / n, l0 + (l1 - l0) * k / n]);
  }
  return out;
}

export function buildMizuma(ctx: GameContext): void {
  const { track, scene } = ctx, b = new GeoBatch();
  // 地面の高さ: 貝塚は地上駅で、地面は線路の高さに沿う（上りの写しの ctx では地形が上りの座標のままなので、線路の高さで取る）
  const g = (s: number) => track.trackAt(s).y;
  /** s-lat の2点の間の箱（下端 y0 = 地面から、高さ h・幅 w） */
  const seg = (a: V, c: V, y0: number, h: number, w: number, col: number, key = 'm') => {
    const A = track.at(a[0], a[1], 0), C = track.at(c[0], c[1], 0), L = Math.hypot(C.x - A.x, C.z - A.z);
    if (L < .02) return;
    b.add(key, P.boxB, M((A.x + C.x) / 2, g((a[0] + c[0]) / 2) + y0, (A.z + C.z) / 2, Math.atan2(C.x - A.x, C.z - A.z), w, h, L + .02), col);
  };
  const off = (p: V, q: V, d: number): [V, V] => {
    const ds = q[0] - p[0], dl = q[1] - p[1], L = Math.hypot(ds, dl) || 1, ns = -dl / L * d, nl = ds / L * d;
    return [[p[0] + ns, p[1] + nl], [q[0] + ns, q[1] + nl]];
  };
  // 線路: 道床・レール・枕木
  for (const line of [...MIZUMA_TRACKS, MIZUMA_MAIN]) {
    const pts = densify(line, 2);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], c = pts[i + 1];
      seg(a, c, 0, .22, 2.8, 0x8a8378);
      for (const d of [-GAUGE, GAUGE]) { const [p, q] = off(a, c, d); seg(p, q, .24, .14, .07, 0xb8bcc2); }
      const A = track.at(a[0], a[1], 0), C = track.at(c[0], c[1], 0), yaw = Math.atan2(C.x - A.x, C.z - A.z);
      for (let k = 0; k < 3; k++) { const u = (k + .5) / 3, p = track.at(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, 0); b.add('m', P.boxB, M(p.x, g(a[0]) + .2, p.z, yaw, 2.0, .14, .22), 0x6b6259); }
    }
  }
  // 車止め（なんば側の端）
  for (const line of MIZUMA_TRACKS) {
    const [s, l] = line[0], p = track.at(s - 1, l, 0), t = track.trackAt(s);
    b.add('m', P.boxB, M(p.x, g(s), p.z, -t.phi, 2.4, 1.2, .6), 0xc23a2c);
  }
  // 島式ホームと上屋（2両編成の長さの概形）
  const pf = MIZUMA_PLATFORM, sc = (pf.from + pf.to) / 2, len = pf.to - pf.from;
  seg([pf.from, pf.lat], [pf.to, pf.lat], 0, 1.1, pf.width, 0xbdb8ad);
  for (const sd of [-1, 1]) seg([pf.from, pf.lat + sd * (pf.width / 2 - .3)], [pf.to, pf.lat + sd * (pf.width / 2 - .3)], 1.1, .01, .25, 0xe4c43a); // 点字ブロック
  seg([sc - len * .35, pf.lat], [sc + len * .35, pf.lat], 4.2, .15, pf.width - .6, 0x6b7680);
  for (let s = sc - len * .3; s <= sc + len * .3 + .1; s += len * .2) { const p = track.at(s, pf.lat, 0); b.add('m', P.boxB, M(p.x, g(s) + 1.1, p.z, -track.trackAt(s).phi, .2, 3.1, .2), 0x8a9096); }
  // 駅舎（車止めの先）
  const bd = MIZUMA_BUILDING;
  seg([bd.s - bd.len / 2, bd.lat], [bd.s + bd.len / 2, bd.lat], 0, 3.6, bd.wid, 0xe7e2d6);
  seg([bd.s - bd.len / 2 - .3, bd.lat], [bd.s + bd.len / 2 + .3, bd.lat], 3.6, .3, bd.wid + .6, 0x5d6670);
  seg([bd.s + bd.len / 2 - .05, bd.lat - 3], [bd.s + bd.len / 2 - .05, bd.lat + 3], .1, 2.2, .1, 0x2b343d); // ホーム側の出入口
  // 架線柱（約 40m ごと、線路の外側）
  for (const line of [MIZUMA_TRACKS[0], MIZUMA_MAIN]) {
    const pts = densify(line, 40);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [p] = off(pts[i], pts[i + 1], -2.6), q = track.at(p[0], p[1], 0);
      b.add('m', P.boxB, M(q.x, g(p[0]), q.z, 0, .3, 7.2, .3), 0x9aa0a6);
    }
  }
  const root = new THREE.Group(); root.name = 'mizuma';
  b.build({ m: new THREE.MeshLambertMaterial({ vertexColors: true }) }, root);
  scene.add(root);
}
