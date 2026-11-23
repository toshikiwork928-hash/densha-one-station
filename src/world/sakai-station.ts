import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { FONT } from '../core/config';
import type { Route, Station } from '../route/types';
import { GeoBatch, M, P } from './batch';
import { canvasTex } from './canvas-tex';
import { cullByDistance } from './cull';

/** ホーム中心から湊側へ進むときの、駅モデル内の z の符号。 */
export function sakaiSouthSign(route: Route): 1 | -1 {
  const sakai = route.stations.findIndex(st => st.name === '堺');
  const south = route.stations.findIndex(st => st.name === '湊');
  if (south >= 0) return south < sakai ? 1 : -1;
  return route.stations.findIndex(st => st.name === '七道') > sakai ? 1 : -1;
}

export function sakaiAccessOpenings(route: Route, length: number) {
  const south = sakaiSouthSign(route);
  return [
    { kind: 'stairs', z: 0, x: 0, width: 2.6, depth: 11 },
    { kind: 'stairs', z: south * length * .32, x: 0, width: 2.6, depth: 11 },
    { kind: 'elevator', z: south * 12, x: 0, width: 1.8, depth: 2.1 },
  ] as const;
}

export const sakaiConcourseLevel = (ground: number) => (ground - 1.1) / 2;

/** 線路の上は山形の鉄骨だけを渡す。屋根板は2本の島の上で途切れる。 */
function buildSakaiShelter(b: GeoBatch, halfSpan: number, length: number, south: number,
  openings: ReturnType<typeof sakaiAccessOpenings>): void {
  const roofLength = length * .85, steel = 0xa6aba9, white = 0xe3e2da;
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) =>
    b.add('body', P.box, M(x, y, z, 0, w, h, d), color);
  function beam(x1: number, y1: number, x2: number, y2: number, z: number, h: number, d: number, color: number) {
    const dx = x2 - x1, dy = y2 - y1;
    b.add('body', P.box, M((x1+x2)/2, (y1+y2)/2, z, 0, Math.hypot(dx,dy), h, d, 0, Math.atan2(dy,dx)), color);
  }
  for (const side of [-1, 1]) {
    const island = side * halfSpan;
    for (const edge of [-1, 1]) {
      beam(island, 4.7, island + edge * 3.35, 5.55, 0, .16, roofLength, 0x606361);
      box(island + edge * 3.35, 5.52, 0, .12, .24, roofLength, 0x787b76);
    }
    box(island, 4.54, 0, .28, .3, roofLength, steel);
    for (let z = -roofLength / 2 + 4; z < roofLength / 2; z += 10) {
      // 階段をまたぐ部分は前後の柱から長手の桁で支える。
      if (!openings.some(o => Math.abs(z - o.z) < o.depth / 2 + .45))
        box(island, 2.87, z, .42, 3.54, .44, steel);
      for (const edge of [-1, 1])
        beam(island, 4.48, island + edge * 3.32, 5.34, z, .22, .26, steel);
      beam(island - side * 3.32, 5.55, side * .9, 6.67, z, .36, .26, white);
    }
    // 外側線の背後には下部の横桟と淡色のパネルが連なり、上端から空が見える。
    const wall = side * (halfSpan + 7.8), wallLength = roofLength - 4;
    box(wall, 1.75, 0, .18, 1.55, wallLength, 0xd5d4ce);
    for (const y of [1.12, 1.45, 1.8, 2.51])
      box(wall - side * .11, y, 0, .08, .065, wallLength, 0x969d9a);
    for (let z = -wallLength/2 + 1; z < wallLength/2; z += 4)
      box(wall - side * .12, 1.76, z, .1, 1.65, .09, 0xa8aeab);
    // 中央部の上段には細い方立と上枠だけを通し、街や夜空が区画ごとに見えるようにする。
    const framed = 80;
    box(wall, 4.48, 0, .16, .15, framed, 0xb4bab6);
    for (let z = -framed / 2; z <= framed / 2; z += 8)
      box(wall, 3.5, z, .14, 2, .14, 0xb4bab6);
  }
  for (let z = -roofLength/2 + 4; z < roofLength/2; z += 10)
    box(0, 6.67, z, 1.82, .36, .26, white);

  // 東側の中央部は駅ビルの外壁がホームより高く、白い壁面から連続窓に切り替わる。
  const facade = south * (halfSpan + 8.55);
  box(facade + south * .4, 5.65, 0, .8, 11.3, 77, 0xd9d7ce);
  box(facade - south * .06, 6.4, -south * 12, .14, 8.7, 49, 0x93aab0);
  for (let z = -36; z <= 12; z += 3)
    box(facade - south * .17, 6.4, south * z, .18, 8.85, .17, 0xd0d2cb);
  for (let y = 3; y < 11; y += 1.45)
    box(facade - south * .17, y, -south * 12, .16, .085, 49, 0xb8c2bf);
}

/** 3階の島式ホームと、その下の中央・南改札を結ぶ堺駅。座標の原点は線路面。 */
export function buildSakaiConcourse(ctx: GameContext, sta: Station, ground: number): void {
  const islands = (sta.customPlatforms ?? []).flatMap(p => p.kind === 'island' ? [p.lat] : []).sort((a, b) => a - b);
  if (islands.length !== 2) return;
  const { from, to } = sta.platform, center = (from + to) / 2;
  const south = sakaiSouthSign(ctx.route), mid = (islands[0] + islands[1]) / 2;
  const group = new THREE.Group(), b = new GeoBatch();
  group.name = '堺駅・改札階と番線案内';
  group.position.copy(ctx.track.at(center, mid, 0));
  group.rotation.y = -ctx.track.trackAt(center).phi;
  ctx.scene.add(group);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) =>
    b.add('body', P.box, M(x, y, z, 0, w, h, d), color);
  const width = islands[1] - islands[0] + 18;
  buildSakaiShelter(b, (islands[1] - islands[0]) / 2, to - from, south, sakaiAccessOpenings(ctx.route, to - from));
  const floor = sakaiConcourseLevel(ground);
  const southGate = south * (to - from) * .32;
  for (const [z, depth] of [[0, 48], [southGate, 23]]) {
    box(0, floor - .3, z, width, .6, depth, 0xc0bdb5);
    for (const side of [-1, 1]) {
      const outer = side * (width / 2 - .4);
      for (const dz of [-depth / 2 + 1, 0, depth / 2 - 1]) {
        box(outer, (ground - 1.1) / 2, z + dz, .75, Math.max(.2, -1.1 - ground), .8, 0xb9b5ae);
      }
      box(outer, floor + .55, z - depth * .32, .3, 1.1, depth * .32, 0xe0dbcf);
      box(outer, floor + .55, z + depth * .32, .3, 1.1, depth * .32, 0xe0dbcf);
    }
    // 中央改札階の東西通路と、湊側にある南改札の改札機。
    const gates = z === 0 ? [-1, 1] : [0];
    for (const side of gates) for (let lane = -1; lane <= 1; lane++) {
      box(side * (width / 2 - 4) + (side === 0 ? lane * 1.25 : 0),
        floor + .48, z + (side === 0 ? 0 : lane * 1.25), side === 0 ? .38 : 1.55, .96, side === 0 ? 1.55 : .38, 0x607777);
    }
  }
  for (let i = 0; i < islands.length; i++) {
    // なんば向きの横位置順は4・3番、2・1番。下りではホームも板の左右も反転する。
    const towardNamba = (i === 0) === (south === 1);
    const left = south === 1 ? 4 - 2 * i : 1 + 2 * i;
    const right = left - south;
    for (const face of [-1, 1]) {
      const tex = canvasTex(512, 128, (g, w, h) => {
        g.fillStyle = '#203952'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `bold 76px ${FONT}`;
        g.fillText(String(face === 1 ? left : right), 52, 64);
        g.fillText(String(face === 1 ? right : left), 460, 64);
        g.font = `bold 31px ${FONT}`;
        g.fillText(towardNamba ? 'なんば方面' : '和歌山市・関西空港方面', 256, 64, 295);
      });
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .18 });
      for (const z of [-.22, .22]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, .75), mat);
        sign.rotation.y = face === 1 ? 0 : Math.PI;
        sign.position.set(islands[i] - mid, 3.18, z * (to - from) + face * .08);
        group.add(sign);
      }
    }
    for (const z of [-.22, .22]) {
      const x = islands[i] - mid, zz = z * (to - from);
      box(x, 3.18, zz, 3.03, .78, .14, 0x36424b);
      for (const dx of [-1, 1]) box(x + dx, 4.2, zz, .05, 1.34, .05, 0x6b6e6b);
    }
  }
  b.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, group);
  cullByDistance(ctx, group, 1200);
}
