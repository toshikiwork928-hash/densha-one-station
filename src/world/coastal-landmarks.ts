// 汐風線の目印。道路・路面電車の跨線橋、鋼橋、描画専用支線。
// 走行経路・信号・分岐器制御は持たず、路線データに指定した位置だけに置く。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';

type Landmark = {
  kind: 'road-overpass' | 'tram-overpass' | 'steel-bridge' | 'branch';
  s: number;
  length?: number;
  label?: string;
  side?: 1 | -1;
  direction?: 1 | -1;
};
const UP = new THREE.Vector3(0, 1, 0);
const COLOR = { concrete: 0xb8b7ad, steel: 0x647773, road: 0x51565a, line: 0xe5e3cd, rail: 0x9caaa9, ballast: 0x7c786d };

/** 任意向きの角材を、独立メッシュを増やさずバッチへ積む。 */
function beam(b: GeoBatch, a: THREE.Vector3, z: THREE.Vector3, width: number, color: number, depth = width): void {
  const d = z.clone().sub(a), len = d.length();
  if (len < .001) return;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / len));
  b.add('coastal', P.box, new THREE.Matrix4().compose(a.clone().add(z).multiplyScalar(.5), q, new THREE.Vector3(width, len, depth)), color);
}

/** 水平な帯。横幅と厚みを固定し、線路の向きが変わっても床版が回転しない。 */
function strip(b: GeoBatch, a: THREE.Vector3, z: THREE.Vector3, width: number, height: number, color: number): void {
  const d = z.clone().sub(a), length = d.length();
  if (length < .001) return;
  const p = a.clone().add(z).multiplyScalar(.5), yaw = Math.atan2(d.x, d.z);
  b.add('coastal', P.box, M(p.x, p.y, p.z, yaw, width, height, length + .04), color);
}

/** 跨線橋は線路に斜交。軌道の真上には橋脚を置かない。 */
function crossing(ctx: GameContext, b: GeoBatch, st: Landmark, tram: boolean): void {
  const { track } = ctx, t = track.trackAt(st.s), terrain = getTerrain(ctx);
  const side = st.side ?? -1, span = st.length ?? (tram ? 125 : 155), width = tram ? 7.8 : 19;
  // 主線の吊架線・門形ビームも通せる余裕を取る。
  const deckY = t.y + 9.35, roadAngle = -t.phi + side * .26;
  const p = (x: number, y: number, z = 0): THREE.Vector3 => {
    const c = Math.cos(roadAngle), s = Math.sin(roadAngle);
    return new THREE.Vector3(t.x + c * x + s * z, y, t.z - s * x + c * z);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, col: number) => {
    const v = p(x, y, z); b.add('coastal', P.box, M(v.x, v.y, v.z, roadAngle, w, h, d), col);
  };
  box(0, deckY, 0, span, 1.2, width, COLOR.concrete);
  box(0, deckY + .62, 0, span, .07, width - .65, tram ? COLOR.ballast : COLOR.road);
  for (const z of [-width / 2, width / 2]) {
    box(0, deckY + 1.2, z, span, 1.2, .3, COLOR.concrete);
    box(0, deckY + 1.9, z, span, .09, .09, COLOR.steel);
    for (let x = -span / 2 + 2; x < span / 2; x += 3) box(x, deckY + 1.65, z, .065, .65, .065, COLOR.steel);
  }
  for (let x = -span / 2 + 12; x < span / 2; x += 27) {
    // 本線・待避線の建築限界を含む中央の大きな無柱スパン。
    if (Math.abs(x) < 18) continue;
    const ground = terrain.groundY(st.s + side * x * .25), height = deckY - .6 - ground;
    if (height <= 0) continue;
    for (const z of [-width * .3, width * .3]) box(x, ground + height / 2, z, 1.2, height, 1.5, COLOR.concrete);
    box(x, deckY - 1, 0, 2.5, .8, width + .4, COLOR.concrete);
  }
  if (tram) {
    // 複線の路面電車高架。車体と架線を添えて道路橋と区別する。
    for (const c of [-1.55, 1.55]) {
      for (const rail of [c - .7175, c + .7175]) box(0, deckY + .77, rail, span, .12, .065, COLOR.rail);
      for (let x = -span / 2 + 1; x < span / 2; x += .9) box(x, deckY + .7, c, .14, .09, 2.25, 0x5b5147);
      beam(b, p(-span / 2, deckY + 6, c), p(span / 2, deckY + 6, c), .028, 0x6d726d);
    }
    for (let x = -span / 2 + 10; x < span / 2; x += 28) {
      beam(b, p(x, deckY + .8, -3.4), p(x, deckY + 6.5, -3.4), .14, COLOR.steel);
      beam(b, p(x, deckY + 6.2, -3.4), p(x, deckY + 6.2, 2.9), .11, COLOR.steel);
    }
    const carX = span * .26;
    box(carX, deckY + 2.4, -1.55, 11.5, 2.7, 2.4, 0x67997c);
    box(carX, deckY + 3.85, -1.55, 11.7, .2, 2.45, 0xd4cec0);
    box(carX, deckY + 1.42, -1.55, 11.4, .4, 2.45, 0xc9c9b8);
    for (let x = carX - 4.2; x < carX + 5; x += 1.7) for (const z of [-2.77, -.33]) box(x, deckY + 2.9, z, 1.15, 1.05, .03, 0x364d50);
    for (const x of [carX - 3.7, carX + 3.7]) for (const z of [-2.3, -.8]) box(x, deckY + 1.03, z, .7, .65, .28, 0x393d3c);
    for (const dx of [-.8, .8]) {
      beam(b, p(carX, deckY + 4, -1.55), p(carX + dx, deckY + 5, -1.55), .065, 0x414c48);
      beam(b, p(carX + dx, deckY + 5, -1.55), p(carX, deckY + 6, -1.55), .065, 0x414c48);
    }
    box(carX, deckY + 6, -1.55, .16, .07, 1.2, 0x414c48);
  } else {
    // 4車線バイパス。線路から見える床版・側壁が主役。
    box(0, deckY + .8, 0, span, .3, .6, COLOR.concrete);
    for (const z of [-width * .25, width * .25]) for (let x = -span / 2 + 2; x < span / 2; x += 11) box(x, deckY + .68, z, 5, .02, .12, COLOR.line);
    for (const [x, z, color] of [[-42, -6.8, 0xe8e4db], [39, 6.8, 0x537186], [62, -2.3, 0x98755a]] as const) {
      box(x, deckY + 1.25, z, 4.1, 1.05, 1.7, color);
      box(x, deckY + 2, z, 2.2, .55, 1.5, color);
      box(x, deckY + 2.03, z, 2.25, .4, 1.52, 0x40565e);
    }
  }
}

/** 既存 buildStructures の川面・橋脚・床版に、上部鋼トラスだけを追加。 */
function truss(ctx: GameContext, b: GeoBatch, st: Landmark): void {
  const length = st.length ?? 170, from = st.s - length / 2, to = st.s + length / 2;
  const left = Math.min(...ctx.route.tracks) - 3.4, right = Math.max(...ctx.route.tracks) + 3.4;
  const point = (s: number, lat: number, y: number) => ctx.track.at(s, lat, y);
  const count = Math.max(2, Math.ceil(length / 18));
  for (let i = 0; i < count; i++) {
    const a = from + length * i / count, z = from + length * (i + 1) / count;
    for (const side of [left, right]) {
      beam(b, point(a, side, .8), point(z, side, .8), .32, COLOR.steel, .46);
      beam(b, point(a, side, 9.2), point(z, side, 9.2), .29, COLOR.steel, .38);
      beam(b, point(a, side, .8), point(a, side, 9.2), .28, COLOR.steel);
      beam(b, point(a, side, i % 2 ? 9.2 : .8), point(z, side, i % 2 ? .8 : 9.2), .25, COLOR.steel);
    }
    beam(b, point(a, left, 9.2), point(a, right, 9.2), .28, COLOR.steel);
    beam(b, point(a, left, 9.2), point(z, right, 9.2), .14, COLOR.steel);
  }
  for (const side of [left, right]) beam(b, point(to, side, .8), point(to, side, 9.2), .28, COLOR.steel);
  beam(b, point(to, left, 9.2), point(to, right, 9.2), .28, COLOR.steel);
}

/** 支線は単線の湾曲高架。駅の支線ホームは stations.ts が担当。 */
function branch(ctx: GameContext, b: GeoBatch, st: Landmark): void {
  const side = st.side ?? -1, direction = st.direction ?? -1, length = st.length ?? 430;
  const originY = ctx.track.trackAt(st.s).y - 4, originLat = side < 0 ? Math.min(...ctx.route.tracks) - 14 : Math.max(...ctx.route.tracks) + 14;
  const point = (d: number, lat = 0, height = 0): THREE.Vector3 => {
    // ホームの横は直線で通す。駅端を離れてから緩く外側へ分かれる。
    const f = Math.max(0, Math.min(1, (d - 220) / Math.max(1, length - 220)));
    const offset = originLat + side * 115 * f * f;
    const p = ctx.track.at(st.s + direction * d, offset + lat, 0);
    p.y = originY + height; return p;
  };
  // 8mごとの床版、4mごとの枕木をまとめ、遠景まで軽く描く。
  for (let d = -60; d < length; d += 8) {
    const z = Math.min(length, d + 8);
    strip(b, point(d, 0, -.8), point(z, 0, -.8), 4.2, 1.1, COLOR.concrete);
    strip(b, point(d, 0, -.04), point(z, 0, -.04), 2.7, .35, COLOR.ballast);
    for (const lat of [-.5335, .5335]) strip(b, point(d, lat, .35), point(z, lat, .35), .065, .12, COLOR.rail);
    for (const lat of [-1.9, 1.9]) strip(b, point(d, lat, .6), point(z, lat, .6), .15, .7, COLOR.concrete);
    for (let sleeper = d; sleeper < z; sleeper += 1.1) strip(b, point(sleeper, -1, .18), point(sleeper, 1, .18), .15, .13, 0x605951);
  }
  for (let d = -34; d < length; d += 25) {
    const p = point(d), terrain = getTerrain(ctx), g = terrain.groundY(st.s + direction * d), h = p.y - 1.4 - g;
    if (h > .2) b.add('coastal', P.boxB, M(p.x, g, p.z, 0, 1.2, h, 1.2), COLOR.concrete);
    beam(b, point(d, side * 2.5, 0), point(d, side * 2.5, 6.5), .14, COLOR.steel);
    beam(b, point(d, side * 2.5, 6.2), point(d, 0, 6.2), .1, COLOR.steel);
    beam(b, point(d, 0, 5.72), point(Math.min(length, d + 25), 0, 5.72), .03, 0x68706b);
  }
}

export function buildCoastalLandmarks(ctx: GameContext): void {
  // Optional metadata keeps mountain routes entirely unchanged.
  const list: Landmark[] = ctx.route.coastalLandmarks ?? [];
  if (!list.length) return;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const st of list) {
    const batch = new GeoBatch(), group = new THREE.Group();
    group.name = `coastal-${st.kind}-${Math.round(st.s)}`;
    if (st.kind === 'road-overpass' || st.kind === 'tram-overpass') crossing(ctx, batch, st, st.kind === 'tram-overpass');
    else if (st.kind === 'steel-bridge') truss(ctx, batch, st);
    else branch(ctx, batch, st);
    batch.build({ coastal: material }, group);
    ctx.scene.add(group);
    cullByDistance(ctx, group, st.kind === 'branch' ? 1100 : 1400);
  }
}
