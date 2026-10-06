import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Station } from '../route/types';
import { GeoBatch, M, P, onLight } from './batch';
import { canvasTex } from './canvas-tex';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';

/** 高架島式駅の地上改札・駅床・ホーム支持。寸法は実測ではなく構内形式の近似。 */
export function buildElevatedConcourse(ctx: GameContext, sta: Station, centers: number[], outside: number): void {
  const sc = (sta.platform.from + sta.platform.to) / 2, len = sta.platform.to - sta.platform.from;
  const dy = getTerrain(ctx).groundY(sc) - ctx.track.trackAt(sc).y;
  const group = new THREE.Group(); group.position.copy(ctx.track.at(sc, 0, 0)); group.rotation.y = -ctx.track.trackAt(sc).phi;
  const batch = new GeoBatch();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => batch.add('body', P.box, M(x, y, z, 0, w, h, d), color);
  const left = outside - 3.3, right = 4 - outside + 3.3, width = right - left;
  box((left + right) / 2, -.55, 0, width, .8, len, 0xb9b9b3);
  for (let z = -len / 2 + 8; z < len / 2; z += 18) for (const x of centers) {
    box(x, dy / 2 - .3, z, 1.1, -dy - .6, 1.1, 0xb0b3ae);
  }
  // 高架下コンコース。線路上を横切る跨線橋ではなく地上でホーム階段をつなぐ。
  box(2, dy + 3, 0, width, 6, 35, 0xe2e2dc);
  for (const x of [left - .02, right + .02]) {
    box(x, dy + 2.5, 0, .04, 3.5, 16, 0x405764);
    box(x, dy + 4.6, 0, 3, .18, 20, 0x64727a);
  }
  for (const x of centers) box(x, dy / 2, len * .18, 2.6, -dy + 1, 10, 0xd5d8d2);
  // ホーム背面の高架駅スクリーン。屋根を覆い尽くさず列車の顔が見える高さ。
  for (const x of [left + .2, right - .2]) {
    box(x, 2.4, 0, .12, 2.4, len * .85, 0xd2d6d5);
    for (let z = -len * .4; z < len * .4; z += 12) box(x, 3, z, .14, 1, 8, 0x9caeb5);
  }
  batch.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, group);
  const texture = canvasTex(768, 128, (g, w, h) => {
    g.fillStyle = '#164f67'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 76px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sta.name + '駅', w / 2, h / 2);
  });
  const material = new THREE.MeshLambertMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .05 });
  for (const [x, rotation] of [[left - .12, -Math.PI / 2], [right + .12, Math.PI / 2]]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), material); sign.position.set(x, dy + 5.2, 0); sign.rotation.y = rotation; group.add(sign);
  }
  onLight(ctx, f => material.emissiveIntensity = .05 + f * .75);
  ctx.scene.add(group); cullByDistance(ctx, group, 1200);
}

/** 浜寺モチーフ: 地上の旧駅舎を保存した木造洋風の意匠。画像素材は使わない。 */
export function buildHeritageFacade(ctx: GameContext, sta: Station): void {
  const sc = (sta.platform.from + sta.platform.to) / 2;
  const reverse = ctx.route.id.endsWith('-up');
  const group = new THREE.Group(); group.position.copy(ctx.track.at(sc, reverse ? 30 : -26, 0)); group.rotation.y = -ctx.track.trackAt(sc).phi + (reverse ? Math.PI : 0);
  const b = new GeoBatch();
  b.add('body', P.boxB, M(0, 0, 0, 0, 8, 4.5, 26), 0xefe5cc);
  b.add('body', P.gable, M(0, 4.5, 0, 0, 10, 2.6, 29), 0x655548);
  b.add('body', P.gable, M(-4.5, 3.2, 0, Math.PI / 2, 9, 2.8, 8), 0x655548);
  for (let z = -10; z <= 10; z += 4) {
    b.add('body', P.box, M(-4.02, 2.1, z, 0, .06, 2.2, 2.2), 0x53747a);
    b.add('body', P.box, M(-4.06, 2.1, z, 0, .08, 2.3, .12), 0xefe8da);
    b.add('body', P.box, M(-4.1, 2.1, z, 0, .1, .12, 2.3), 0xefe8da);
  }
  for (const z of [-4, 4]) b.add('body', P.box, M(-7.2, 1.6, z, 0, .2, 3.2, .2), 0xeee3cd);
  b.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, group);
  ctx.scene.add(group); cullByDistance(ctx, group, 1000);
}

/** 描画専用の支線ホーム・第3線。プレイヤーの進路や信号には含めない。 */
export function buildCoastalSpecialStations(ctx: GameContext, sta: Station): void {
  if (sta.layout !== 'hagoromo' && sta.layout !== 'hamadera') return;
  const sc = (sta.platform.from + sta.platform.to) / 2, len = sta.platform.to - sta.platform.from;
  const group = new THREE.Group(), b = new GeoBatch();
  group.name = `coastal-special-station-${sta.name}`;
  group.position.copy(ctx.track.at(sc, 0, 0)); group.rotation.y = -ctx.track.trackAt(sc).phi;
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => b.add('body', P.box, M(x, y, z, 0, w, h, d), color);
  if (sta.layout === 'hagoromo') {
    const landmark = ctx.route.coastalLandmarks?.find(l => l.kind === 'branch');
    const side = landmark?.side ?? -1, rail = side < 0 ? Math.min(...ctx.route.tracks) - 14 : Math.max(...ctx.route.tracks) + 14;
    // 車体半幅＋ホーム離隔1.6mを確保。復路も支線の横位置に合わせる。
    const center = rail - side * 3.85, floor = -2.9, deckLength = len - 28;
    box(center, floor - .55, 0, 4.5, 1.1, deckLength, 0xc9c5bc);
    box(rail - side * 1.9, floor + .015, 0, .3, .025, deckLength, 0xe5bf31);
    box(rail - side * 1.7, floor + .018, 0, .13, .03, deckLength, 0xf4efe3);
    box(center, floor + 3.3, 0, 4.4, .2, deckLength * .65, 0x69817e);
    for (let z = -deckLength * .3; z <= deckLength * .3; z += 11) {
      box(center - side * 1.1, floor + 1.6, z, .18, 3.2, .18, 0x939f99);
      box(center, floor + 3.15, z, 4.2, .14, .14, 0xa9b0a9);
    }
    const ground = getTerrain(ctx).groundY(sc) - ctx.track.trackAt(sc).y;
    const pierHeight = floor - 1.1 - ground;
    if (pierHeight > .2) for (let z = -deckLength / 2 + 9; z < deckLength / 2; z += 20) box(center, ground + pierHeight / 2, z, .8, pierHeight, 1, 0xb9bcb3);
    // 主線ホームから一段下の支線ホームへ、折返し階段と踊り場。
    const mainCenter = side < 0 ? -4.1 : 8.1, stairCenter = (mainCenter + center) / 2;
    const z = len * .2;
    box(stairCenter, floor + .08, z, Math.abs(mainCenter - center) + 2.4, .18, 3, 0xc7c9c2);
    for (let i = 0; i < 24; i++) {
      const u = (i + .5) / 24, stepY = floor + 4 * u;
      box(mainCenter, stepY - .1, z + 3 + i * .27, 2.2, .2, .28, 0xd1d0c9);
      for (const dx of [-1.08, 1.08]) box(mainCenter + dx, stepY + .65, z + 3 + i * .27, .045, 1.3, .045, 0x9aa3a0);
    }
    box(mainCenter, 1.1, z + 9.6, 2.6, .2, 1.4, 0xc7c9c2);
    const texture = canvasTex(768, 192, (g, w, h) => {
      g.fillStyle = '#1f5b57'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
      g.font = 'bold 66px sans-serif'; g.textAlign = 'center'; g.fillText('3番線　羽根浜支線', w / 2, 80);
      g.font = '44px sans-serif'; g.fillText('羽根浜ゆき', w / 2, 145);
    });
    const material = new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .05 });
    for (const sz of [-deckLength * .25, deckLength * .25]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), material); sign.position.set(center, floor + 2.6, sz); group.add(sign);
    }
    onLight(ctx, f => material.emissiveIntensity = .05 + f * .65);
  } else {
    const reverse = ctx.route.id === 'shiokaze-up', main = reverse ? 4 : 0, outer = reverse ? 13.2 : -9.2;
    const endMargin = 90;
    const point = (s: number, lat: number, y: number) => ctx.track.at(s, lat, y);
    const position = (s: number) => {
      const t = Math.min(1, Math.max(0, Math.min((s - (sta.platform.from - endMargin)) / endMargin, (sta.platform.to + endMargin - s) / endMargin)));
      return main + (outer - main) * t * t * (3 - 2 * t);
    };
    // 本線→外側線→本線。島式の外縁にレールを追加して2面3線を表す。
    const wb = new GeoBatch();
    const strip = (a: THREE.Vector3, z: THREE.Vector3, width: number, height: number, color: number) => {
      const d = z.clone().sub(a), p = a.clone().add(z).multiplyScalar(.5);
      wb.add('body', P.box, M(p.x, p.y, p.z, Math.atan2(d.x, d.z), width, height, d.length() + .025), color);
    };
    for (let s = sta.platform.from - endMargin; s < sta.platform.to + endMargin; s += 4) {
      const z = Math.min(sta.platform.to + endMargin, s + 4), la = position(s), lb = position(z);
      strip(point(s, la, .06), point(z, lb, .06), 2.7, .28, 0x827e72);
      for (const rail of [-.5335, .5335]) strip(point(s, la + rail, .35), point(z, lb + rail, .35), .065, .12, 0x99a5a3);
      for (let q = s; q < z; q += 1) strip(point(q, position(q) - 1, .19), point(q, position(q) + 1, .19), .14, .12, 0x5b554a);
    }
    const outerSide = outer < main ? -1 : 1;
    for (let s = sta.platform.from - 10; s <= sta.platform.to + 10; s += 25) {
      const t = ctx.track.trackAt(s), p = point(s, outer + outerSide * 2.5, 0);
      wb.add('body', P.boxB, M(p.x, p.y, p.z, -t.phi, .16, 6.9, .16), 0x8c9691);
      const arm = point(s, outer + outerSide * 1.15, 6.4);
      wb.add('body', P.box, M(arm.x, arm.y, arm.z, -t.phi, 2.8, .12, .12), 0x8c9691);
      strip(point(s, outer, 5.72), point(Math.min(sta.platform.to + 10, s + 25), outer, 5.72), .03, .03, 0x68716a);
    }
    const trackGroup = new THREE.Group(); trackGroup.name = 'coastal-third-track';
    wb.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, trackGroup);
    ctx.scene.add(trackGroup); cullByDistance(ctx, trackGroup, 1000);
    const center = (main + outer) / 2;
    box(center, .55, 0, Math.abs(outer - main) - 3.2, 1.1, len, 0xc9c5bc);
    box(outer - outerSide * 1.9, 1.115, 0, .3, .025, len, 0xe5bf31);
    box(center, 4.5, 0, 4.4, .14, len * .62, 0x63716d);
  }
  b.build({ body: new THREE.MeshLambertMaterial({ vertexColors: true }) }, group);
  ctx.scene.add(group); cullByDistance(ctx, group, 1000);
}
