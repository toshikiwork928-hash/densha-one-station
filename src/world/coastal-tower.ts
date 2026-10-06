// 羽衣駅直結のタワーマンション（描画専用）。形は 30階前後の細長い箱形＋低層の商業棟＋ホームへの連絡通路で、
// 外壁・窓割りは汎用。実在建物の名称・看板・ロゴ・寸法の写しは持たない。
// 位置は route.coastalLandmarks の { kind:'tower' }。s = 低層棟の中心、side = 線路のどちら側か、direction = ローカル +z が向く s 方向。
// reverseRoute が s・side・direction を反転するので、上り・下りで同じ物理位置になる。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Route } from '../route/types';
import { GeoBatch, P, M, onLight } from './batch';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';
import { twinTowerZones } from './izumiotsu-towers';

type Tower = NonNullable<Route['coastalLandmarks']>[number];

/** ローカル座標（z = 線路方向、u = 外側の最外線からの距離）の寸法 [m] */
const PODIUM = { z0: -46, z1: 46, u0: 10.5, u1: 40 };
const SHAFT = { z0: -40, z1: -8, u0: 16, u1: 38 };
const FLOORS = 28, ROOF_ABOVE_GROUND = 105;
const WALK = { z1: 112, u0: 7.6, u1: 11.6 };
/** 連絡通路: ホーム（z = 36 付近）から低層棟屋上のロビーへ */
const LINK = { z: 36, u0: 6.4, u1: 14 };

/** 低層棟・タワー周辺には住宅・道路・街路樹を置かない範囲（s）。向きに依らず中心対称。 */
export function towerZones(route: Route): { side: 1 | -1; from: number; to: number }[] {
  const single = (route.coastalLandmarks ?? []).filter(l => l.kind === 'tower').map(l => ({ side: l.side ?? 1, from: l.s - 62, to: l.s + 62 }));
  return [...single, ...twinTowerZones(route)];
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 外壁アトラス: 1セル = 1住戸の窓＋バルコニー（36px）。昼の色と夜の窓明かりを別キャンバスに描く。
const CELL = 36, ATLAS_W = 1280, ATLAS_H = 1024;
const BAYS = { long: 10, short: 7 };
const FACE_X = [0, 368, 736, 996];
const FACE_BAYS = [BAYS.long, BAYS.long, BAYS.short, BAYS.short];

function facadeTextures(): { map: THREE.CanvasTexture; emit: THREE.CanvasTexture } {
  const mk = () => { const c = document.createElement('canvas'); c.width = ATLAS_W; c.height = ATLAS_H; return c; };
  const day = mk(), lit = mk();
  const gd = day.getContext('2d')!, gl = lit.getContext('2d')!;
  gd.fillStyle = '#e4e0d5'; gd.fillRect(0, 0, ATLAS_W, ATLAS_H);
  gl.fillStyle = '#000'; gl.fillRect(0, 0, ATLAS_W, ATLAS_H);
  const rnd = seeded(20261006);
  const glass = ['#5b7f98', '#547891', '#648aa1', '#4f7089'];
  const warm = ['#ffd68a', '#ffe3a8', '#ffeec9', '#ffc977'], cool = ['#d6e8ff', '#bcd8f5'];
  FACE_X.forEach((x0, f) => {
    const bays = FACE_BAYS[f];
    for (let k = 0; k < FLOORS; k++) for (let b = 0; b < bays; b++) {
      const x = x0 + b * CELL, y = (FLOORS - 1 - k) * CELL;
      // 水平のスラブ線とガラス手すり。外壁の白い帯がバルコニーの水平線になる。
      gd.fillStyle = '#f3f0e8'; gd.fillRect(x, y + 31, CELL, 5);
      gd.fillStyle = '#b4b0a5'; gd.fillRect(x, y + 35, CELL, 1);
      gd.fillStyle = '#a9c0c8'; gd.fillRect(x, y + 22, CELL, 9);
      gd.fillStyle = '#768487'; gd.fillRect(x, y + 22, CELL, 1);
      // 窓（2枚引違い）
      gd.fillStyle = glass[Math.floor(rnd() * glass.length)]; gd.fillRect(x + 5, y + 4, CELL - 10, 17);
      gd.fillStyle = '#dcd8cc'; gd.fillRect(x + CELL / 2 - 1, y + 4, 2, 17);
      const curtain = rnd() < .28;
      if (curtain) { gd.fillStyle = '#d3cbb4'; gd.fillRect(x + 5, y + 4, (CELL - 10) / 2, 17); }
      if (rnd() < .5) {
        const colors = rnd() < .9 ? warm : cool;
        gl.fillStyle = colors[Math.floor(rnd() * colors.length)]; gl.fillRect(x + 5, y + 4, CELL - 10, 17);
        gl.fillStyle = '#000'; gl.fillRect(x + CELL / 2 - 1, y + 4, 2, 17);
      }
    }
    // アトラス内の隣接面へのにじみを防ぐ余白は壁色のまま（昼）・黒（夜）
  });
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  };
  return { map: tex(day), emit: tex(lit) };
}

export function buildTower(ctx: GameContext, st: Tower): void {
  const { track, route } = ctx, T = getTerrain(ctx);
  const lo = Math.min(...route.tracks), hi = Math.max(...route.tracks);
  const side = st.side ?? 1, dir = st.direction ?? 1;
  const latOf = (u: number) => side > 0 ? hi + u : lo - u;
  const sAt = (z: number) => st.s + dir * z;
  const g = T.groundY(st.s), yaw = -track.trackAt(st.s).phi;
  const platformY = T.trackY(sAt(LINK.z)) + 1.1 - g;    // ホーム面（地面からの高さ）
  const hp = platformY - .12;                              // 低層棟の屋上面
  const roofY = ROOF_ABOVE_GROUND;
  const world = (z: number, u: number, y: number) => { const p = track.at(sAt(z), latOf(u), 0); p.y = g + y; return p; };

  /** ローカル範囲の直方体（y は地面からの高さ） */
  const bx = (b: GeoBatch, key: string, z0: number, z1: number, u0: number, u1: number, y0: number, y1: number, color: number) => {
    const p = world((z0 + z1) / 2, (u0 + u1) / 2, (y0 + y1) / 2);
    b.add(key, P.box, M(p.x, p.y, p.z, yaw, Math.abs(u1 - u0), Math.abs(y1 - y0), Math.abs(z1 - z0)), color);
  };
  const BODY = { wall: 0xdcd7ca, dark: 0x5e666b, white: 0xf1eee6, slab: 0xc9c6bc, green: 0x6b9456, steel: 0x8b9399 };
  const WARM = 0xffd9a0, COOL = 0xcfe6f4, RED = 0xff3a30;

  // ---- 遠景（距離 3km まで）: 外壁アトラスの塔身・低層棟の素ブロック・屋上 ----
  const far = new GeoBatch(), farGroup = new THREE.Group(); farGroup.name = 'coastal-tower-far';
  bx(far, 'body', PODIUM.z0, PODIUM.z1, PODIUM.u0, PODIUM.u1, 0, hp, BODY.wall);
  bx(far, 'body', PODIUM.z0 - .3, PODIUM.z1 + .3, PODIUM.u0 - .3, PODIUM.u1 + .3, hp - .5, hp + .12, BODY.slab);
  // 塔身の上端・屋上（パラペット・機械室・避雷針）
  bx(far, 'body', SHAFT.z0 - .4, SHAFT.z1 + .4, SHAFT.u0 - .4, SHAFT.u1 + .4, roofY - .1, roofY + 1.2, BODY.white);
  bx(far, 'body', SHAFT.z0 + 6, SHAFT.z1 - 8, SHAFT.u0 + 5, SHAFT.u1 - 5, roofY + 1.2, roofY + 4.8, BODY.slab);
  bx(far, 'body', SHAFT.z0 + 9, SHAFT.z0 + 15, SHAFT.u0 + 7, SHAFT.u0 + 12, roofY + 4.8, roofY + 6.4, BODY.steel);
  const mast = world((SHAFT.z0 + SHAFT.z1) / 2, (SHAFT.u0 + SHAFT.u1) / 2, roofY + 4.8);
  far.add('body', P.boxB, M(mast.x, mast.y, mast.z, yaw, .35, 9, .35), BODY.steel);
  // 4隅の縦の柱型（外壁の立体感）
  for (const z of [SHAFT.z0, SHAFT.z1]) for (const u of [SHAFT.u0, SHAFT.u1]) {
    bx(far, 'body', z - .55, z + .55, u - .55, u + .55, hp, roofY, BODY.white);
  }
  // 塔身: 4面をアトラス1枚に貼る（描画1回）。面ごとにアトラスの別の領域を使う。
  const pos: number[] = [], nrm: number[] = [], uvs: number[] = [];
  const quad = (za: number, ua: number, zb: number, ub: number, outZ: number, outU: number, face: number) => {
    const bays = FACE_BAYS[face], x0 = FACE_X[face], x1 = x0 + bays * CELL;
    const u0 = (x0 + .5) / ATLAS_W, u1 = (x1 - .5) / ATLAS_W, v0 = 1 - FLOORS * CELL / ATLAS_H, v1 = 1;
    const A = world(za, ua, hp), B = world(zb, ub, hp), C = world(zb, ub, roofY), D = world(za, ua, roofY);
    const ca = world(0, 0, 0), co = world(outZ, outU, 0).sub(ca).setY(0).normalize();
    const n = B.clone().sub(A).cross(D.clone().sub(A)).normalize();
    const flip = n.dot(co) < 0, N = [co.x, 0, co.z];
    const tri = (p: THREE.Vector3[], t: number[][]) => p.forEach((v, i) => { pos.push(v.x, v.y, v.z); nrm.push(...N); uvs.push(...t[i]); });
    const tA = [u0, v0], tB = [u1, v0], tC = [u1, v1], tD = [u0, v1];
    if (!flip) { tri([A, B, C], [tA, tB, tC]); tri([A, C, D], [tA, tC, tD]); } else { tri([A, C, B], [tA, tC, tB]); tri([A, D, C], [tA, tD, tC]); }
  };
  quad(SHAFT.z0, SHAFT.u0, SHAFT.z1, SHAFT.u0, 0, -1, 0);
  quad(SHAFT.z0, SHAFT.u1, SHAFT.z1, SHAFT.u1, 0, 1, 1);
  quad(SHAFT.z1, SHAFT.u0, SHAFT.z1, SHAFT.u1, 1, 0, 2);
  quad(SHAFT.z0, SHAFT.u0, SHAFT.z0, SHAFT.u1, -1, 0, 3);
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shaftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  shaftGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shaftGeo.computeBoundingSphere();
  const { map, emit } = facadeTextures();
  const facade = new THREE.MeshLambertMaterial({ map, emissiveMap: emit, emissive: 0xffffff, emissiveIntensity: 0 });
  const shaft = new THREE.Mesh(shaftGeo, facade); shaft.name = 'coastal-tower-shaft'; farGroup.add(shaft);
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  far.build({ body: bodyMat }, farGroup);
  // 航空障害灯（夜だけ光る小さな赤い点）は下の lit に積む

  // ---- 近景（距離 650m まで）: 商業棟の店構え・庇・屋上庭園・連絡通路・高架下の歩廊 ----
  const near = new GeoBatch(), nearGroup = new THREE.Group(); nearGroup.name = 'coastal-tower-near';
  const lit = new GeoBatch(), E = .07;
  const { z0, z1, u0, u1 } = PODIUM;
  // 線路側（u0）の正面: 1階は店舗の連続ガラス、2階は事務所・クリニック風の窓列。
  for (let z = z0 + 1; z < z1 - 3; z += 4.5) {
    bx(lit, 'lit', z, z + 4.1, u0 - E, u0 - E + .02, .5, 4.9, z % 9 < 4.5 ? WARM : COOL);
    bx(near, 'body', z - .15, z + .15, u0 - E - .06, u0 - E + .06, .4, 5.1, BODY.dark);
  }
  for (let z = z0 + 2; z < z1 - 2; z += 3.2) bx(lit, 'lit', z, z + 2.4, u0 - E, u0 - E + .02, 6.6, Math.min(hp - .5, 9.2), COOL);
  bx(near, 'body', z0, z1, u0 - .5, u0 + .02, 5.2, 6.4, BODY.white);          // 1階と2階の間の帯
  bx(near, 'body', z0, z1, u0 - 2.5, u0 - .1, 5.5, 5.8, BODY.steel);          // 庇
  bx(near, 'body', z0, z1, u0 - E - .5, u0, hp - .9, hp, BODY.white);          // 軒の水平線
  // 端面（z0, z1）と背面（u1）は窓だけの簡素な面。背面は駐車場のルーバー風の水平帯。
  for (const z of [z0, z1]) for (let u = u0 + 2; u < u1 - 4; u += 4.5) {
    const o = z < 0 ? -E : E;
    bx(lit, 'lit', z + o, z + o + .02 * Math.sign(o), u, u + 2.8, 1.2, 4.2, COOL);
    bx(lit, 'lit', z + o, z + o + .02 * Math.sign(o), u, u + 2.8, 6.2, Math.min(hp - .6, 8.8), COOL);
  }
  for (let y = 1; y < hp - 1; y += 1.9) bx(near, 'body', z0 + 1, z1 - 1, u1, u1 + E, y, y + .75, BODY.dark);
  for (const y of [3.2, 7.4]) bx(lit, 'lit', z0 + 3, z1 - 3, u1 + E, u1 + E + .02, y, y + .3, WARM);
  // 屋上庭園（塔身の足元以外）と植栽・パラペット
  bx(near, 'body', SHAFT.z1 + 1, z1 - 1, u0 + 1, u1 - 1, hp, hp + .14, BODY.green);
  bx(near, 'body', z0 + 1, SHAFT.z0 - 1, u0 + 1, u1 - 1, hp, hp + .14, BODY.green);
  bx(near, 'body', SHAFT.z1 + 4, z1 - 4, 18, 20, hp + .14, hp + .17, BODY.slab);   // 園路
  for (const [z, u] of [[-44, 14], [-44, 34], [12, 36], [20, 36], [28, 36], [40, 36], [12, 14], [-3, 14]] as const) {
    const p = world(z, u, hp + 2.6), r = 1.6 + ((z * 7 + u) % 3) * .35;
    near.add('body', P.boxB, M(p.x, g + hp + .14, p.z, 0, .22, 1.6, .22), 0x6d5640);
    near.add('body', P.sphere, M(p.x, p.y, p.z, 0, r * 2, r * 1.8, r * 2), 0x5a8a4c);
  }
  for (const [a0, a1, b0, b1] of [[z0, z1, u0, u0 + .4], [z0, z1, u1 - .4, u1], [z0, z0 + .4, u0, u1], [z1 - .4, z1, u0, u1]] as const) bx(near, 'body', a0, a1, b0, b1, hp, hp + 1.05, BODY.white);
  // 塔身足元の2層分は壁面を少し張り出して低層と一体に見せる。
  bx(near, 'body', SHAFT.z0 - .8, SHAFT.z1 + .8, SHAFT.u0 - .8, SHAFT.u1 + .8, hp, hp + 6.2, BODY.wall);
  for (let z = SHAFT.z0 + 1; z < SHAFT.z1 - 1; z += 4) bx(lit, 'lit', z, z + 2.8, SHAFT.u0 - .8 - E, SHAFT.u0 - .8 - E + .02, hp + 1, hp + 4.8, WARM);
  // 屋上設備（室外機・給水タンク風の円筒・手すり）
  for (let z = SHAFT.z0 + 18; z < SHAFT.z1 - 1; z += 3.4) bx(near, 'body', z, z + 2.4, SHAFT.u1 - 9, SHAFT.u1 - 7, roofY + 1.2, roofY + 2.6, BODY.steel);
  // 航空障害灯
  for (const [z, u] of [[SHAFT.z0 + .5, SHAFT.u0 + .5], [SHAFT.z1 - .5, SHAFT.u1 - .5]] as const) bx(lit, 'lit', z - .3, z + .3, u - .3, u + .3, roofY + 1.2, roofY + 1.9, RED);
  const mt = world((SHAFT.z0 + SHAFT.z1) / 2, (SHAFT.u0 + SHAFT.u1) / 2, roofY + 13.5);
  lit.add('lit', P.box, M(mt.x, mt.y, mt.z, yaw, .55, .55, .55), RED);

  // 連絡通路: ホーム端（z = LINK.z）から低層棟の屋上ロビーへ。ホーム面と同じ高さのガラス張りの通路。
  const wz0 = LINK.z - 2.4, wz1 = LINK.z + 2.4, ch = 3.1;
  bx(near, 'body', wz0, wz1, LINK.u0, LINK.u1, platformY - .45, platformY, BODY.slab);
  bx(near, 'body', wz0 - .2, wz1 + .2, LINK.u0, LINK.u1 + .4, platformY + ch, platformY + ch + .35, BODY.white);
  for (const z of [wz0, wz1]) {
    const o = z < LINK.z ? -.04 : .04;
    bx(lit, 'lit', z + o, z + o + .02 * Math.sign(o), LINK.u0 + .1, LINK.u1, platformY + .5, platformY + ch - .1, COOL);
    bx(near, 'body', z - .1, z + .1, LINK.u0, LINK.u1, platformY, platformY + .5, BODY.white);
    for (let u = LINK.u0 + .4; u <= LINK.u1; u += 2.3) bx(near, 'body', z - .12, z + .12, u - .1, u + .1, platformY, platformY + ch, BODY.white);
  }
  bx(lit, 'lit', wz0 + .3, wz1 - .3, LINK.u0 + .2, LINK.u1 - .4, platformY + ch - .05, platformY + ch - .02, WARM);

  // 高架下の歩廊: 低層棟の端からコンコース（z = 130 付近）まで。屋根と柱、床。
  const wz = (a: number, b: number, y0: number, y1: number, ua: number, ub: number, color: number, batch = near, key = 'body') => bx(batch, key, a, b, ua, ub, y0, y1, color);
  wz(z1, WALK.z1, 0, .05, WALK.u0, WALK.u1, 0xb9b6ac);
  wz(z1, WALK.z1, 3.9, 4.15, WALK.u0 - .2, WALK.u1 + .4, 0x6f7a80);
  for (let z = z1 + 3; z <= WALK.z1; z += 7) for (const u of [WALK.u0 + .1, WALK.u1]) wz(z - .1, z + .1, 0, 3.9, u - .1, u + .1, BODY.steel);
  for (let z = z1 + 6; z < WALK.z1; z += 7) wz(z - .6, z + .6, 3.72, 3.88, WALK.u0 + 1, WALK.u1 - 1, WARM, lit, 'lit');

  near.build({ body: bodyMat }, nearGroup);
  const litMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x4b5760 });
  lit.build({ lit: litMat }, nearGroup);

  const dayGlass = new THREE.Color(0x4b5760), night = new THREE.Color(0xffffff);
  onLight(ctx, f => {
    litMat.color.copy(dayGlass).lerp(night, f);
    facade.emissiveIntensity = f * .9;
  });
  ctx.scene.add(farGroup, nearGroup);
  cullByDistance(ctx, farGroup, 3200);
  cullByDistance(ctx, nearGroup, 650);
}
