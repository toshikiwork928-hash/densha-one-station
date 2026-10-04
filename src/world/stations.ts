// 駅（ホーム・上屋・駅名標・ベンチ・柵・駅舎・駅前広場・人）。route.stations から生成
// ホーム照明の光源・発光体は環境担当（env/night-lights.ts）
import * as THREE from 'three';
import { FONT } from '../core/config';
import type { GameContext } from '../core/context';
import type { Station } from '../route/types';
import { GeoBatch, M, P, onLight } from './batch';
import { canvasTex } from './canvas-tex';

const platMat = new THREE.MeshLambertMaterial({ color: 0xc9c5bc });
const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const SHIRTS = [0x2d3a5a, 0xf0f0f0, 0x6a2a2a, 0x3a5a3a, 0xc8b89a, 0x222222, 0x8a9ab0, 0xd06a3a, 0x5a4a7a, 0xe8d0d8];
const PANTS = [0x22262e, 0x3a3f4a, 0x4a3a2e, 0x6a6a70, 0x1a2a4a];

/** 人（立ち姿、ローカル座標 y=0 が床） */
function person(b: GeoBatch, rnd: () => number, x: number, z: number, ry: number): void {
  const h = 1.5 + rnd() * .32, shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)], pants = PANTS[Math.floor(rnd() * PANTS.length)];
  const legH = h * .46, torso = h * .34;
  for (const dx of [-.09, .09]) b.add('body', P.box, M(x + dx * Math.cos(ry), legH / 2, z - dx * Math.sin(ry), ry, .13, legH, .16), pants);
  b.add('body', P.box, M(x, legH + torso / 2, z, ry, .4, torso, .24), shirt);
  for (const dx of [-.24, .24]) b.add('body', P.box, M(x + dx * Math.cos(ry), legH + torso * .55, z - dx * Math.sin(ry), ry, .1, torso * .9, .12), shirt);
  b.add('body', P.sphere, M(x, legH + torso + .13, z, 0, .21, .25, .22), 0xe0b896);
  b.add('body', P.sphere, M(x, legH + torso + .19, z + .02, 0, .23, .16, .23), rnd() < .8 ? 0x1a1612 : 0x6a5a4a); // 髪
  if (rnd() < .4) b.add('body', P.box, M(x + .28 * Math.cos(ry), legH + .05, z - .28 * Math.sin(ry), ry, .1, .3, .35), [0x222222, 0x6a4a2a, 0xb0a090][Math.floor(rnd() * 3)]); // かばん
}

function nameTex(sta: Station, prevName: string, nextName: string): THREE.CanvasTexture {
  return canvasTex(1024, 300, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e0588c'; g.fillRect(0, 196, w, 22);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = `800 112px ${FONT}`; g.fillText(sta.name, w / 2, 130);
    if (sta.kana) { g.font = `600 34px ${FONT}`; g.fillText(sta.kana, w / 2, 178); }
    g.font = `600 40px ${FONT}`; g.textAlign = 'left'; g.fillText('← ' + prevName, 30, 268);
    g.textAlign = 'right'; g.fillText(nextName + ' →', w - 30, 268);
  });
}

/** lat = ホームに面する線路の横位置（2面4線駅は待避線）、side = ホームの側、minimal = 駅舎・駅前広場を作らない（対向側ホーム） */
export interface StationBuildOpts { lat?: number; side?: 'L' | 'R'; minimal?: boolean }

export function buildStation(ctx: GameContext, sta: Station, prevName: string, nextName: string, opt: StationBuildOpts = {}): THREE.Group {
  const { rng: rnd, track } = ctx;
  const s0 = sta.platform.from, s1 = sta.platform.to;
  const len = s1 - s0, sc = (s0 + s1) / 2, t = track.trackAt(sc);
  // 右側ホームは左右反転（x と向きを反転）
  const sx = (opt.side ?? sta.platform.side) === 'L' ? 1 : -1;
  const X = (x: number) => sx * x; // ホーム側を負とする横位置
  const grp = new THREE.Group(); grp.position.copy(track.at(sc, opt.lat ?? 0, 0)); grp.rotation.y = -t.phi; ctx.scene.add(grp);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, len), platMat); plat.position.set(X(-(1.6 + 2.5)), .55, 0); grp.add(plat);
  const b = new GeoBatch();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, col: number) => b.add('body', P.box, M(X(x), y, z, 0, w, h, d), col);
  // 点字ブロック・白線・ホーム端
  box(-2.3, 1.11, 0, .3, .02, len, 0xf2c200);
  box(-1.72, 1.115, 0, .25, .03, len, 0xf4f4f4);
  box(-1.62, .9, 0, .06, .3, len, 0x9a968c);
  // 上屋（屋根・梁・柱）
  const rl = len * .62;
  box(-4.3, 4.35, 0, 4.6, .14, rl, 0x6b7680);
  box(-4.3, 4.22, 0, 4.4, .12, rl, 0xdcdcd8); // 天井
  box(-2.0, 4.15, 0, .1, .35, rl, 0x6b7680); // 鼻隠し
  for (let z = -rl / 2 + 4; z <= rl / 2 - 4; z += 10) {
    box(-5.0, 2.65, z, .2, 3.1, .2, 0x8a9096);
    box(-4.3, 4.1, z, 4.2, .16, .14, 0x8a9096);
  }
  // 柵（ホーム裏側）
  for (let z = -len / 2; z <= len / 2; z += 2.5) box(-6.55, 1.75, z, .06, 1.3, .06, 0x8a9096);
  box(-6.55, 2.35, 0, .05, .06, len, 0x8a9096); box(-6.55, 1.8, 0, .02, .9, len, 0x9fb0a8);
  // ベンチ・自販機・ごみ箱・時計
  for (let z = -rl / 2 + 8; z <= rl / 2 - 8; z += 16) {
    box(-5.4, 1.55, z, .45, .06, 2.2, 0x2a6aa8); box(-5.62, 1.85, z, .06, .45, 2.2, 0x2a6aa8);
    for (const dz of [-.9, .9]) box(-5.4, 1.32, z + dz, .4, .42, .06, 0x777777);
  }
  for (const z of [-rl / 2 + 3, rl / 2 - 14]) {
    b.add('body', P.boxB, M(X(-6.0), 1.1, z, 0, .7, 1.83, .95), [0xc8282a, 0x2a5fb0][z < 0 ? 0 : 1]);
    box(-5.64, 2.25, z, .02, .9, .8, 0xe8f0f4);
    for (let k = 0; k < 3; k++) box(-5.63, 2.05 + k * .25, z, .02, .08, .7, [0xd03030, 0x3070d0, 0x30a050][k]);
  }
  box(-4.3, 3.7, 0, .1, .5, .5, 0x222222);
  // 駅名標の柱
  const signs: number[] = [-len * .3, 0, len * .3];
  for (const z of signs) for (const dz of [-1.5, 1.5]) box(-4.0, 1.9, z + dz, .08, 1.6, .08, 0x777d84);
  // 人（ホーム上、停車駅のみ多め）
  const n = opt.minimal ? 10 : sta.pass && !sta.loop ? 6 : 22;
  for (let k = 0; k < n; k++) {
    const z = (rnd() - .5) * len * .8, x = -(3.0 + rnd() * 2.8);
    b.parent = new THREE.Matrix4().makeTranslation(0, 1.1, 0);
    person(b, rnd, X(x), z, rnd() < .7 ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : rnd() * 6);
    b.parent = null;
  }

  // 駅舎・駅前広場（ホーム裏、中央付近）
  const bw = 26, bd = 10, bx = -(7.2 + bd / 2);
  if (!opt.minimal) {
  b.add('body', P.plane, M(X(-21), .04, 0, 0, 28, len * .9, 1, -Math.PI / 2), 0x6a6c70); // 広場の舗装
  for (let z = -len * .3; z < len * .3; z += 3) box(-28, .06, z, 4.5, .02, .1, 0xeeeeee); // 駐車枠
  b.add('body', P.boxB, M(X(bx), 0, 0, 0, bd, 7.5, bw), 0xe8e4da);
  box(bx, 7.75, 0, bd + .6, .5, bw + .6, 0x6b7680);
  box(bx - bd / 2 - .02, 2.0, 0, .04, 3.2, 8, 0x2b343d); // 出入口ガラス
  box(bx - bd / 2 - 1.2, 3.8, 0, 2.4, .15, 10, 0x8a9096); // 庇
  for (let z = -bw / 2 + 2; z < bw / 2 - 1; z += 3.2) if (Math.abs(z) > 5) box(bx - bd / 2 - .02, 5.4, z, .04, 1.3, 2, 0x2b343d);
  // 広場の人・タクシー・バス停
  for (let k = 0; k < 10; k++) person(b, rnd, X(-(14 + rnd() * 12)), (rnd() - .5) * 40, rnd() * 6);
  for (const z of [-14, -9]) {
    b.add('body', P.boxB, M(X(-25), .25, z, 0, 1.7, .7, 4.4), 0xd8c020);
    b.add('body', P.boxB, M(X(-25), .95, z + .2, 0, 1.5, .55, 2.2), 0xd8c020);
    box(-25, 1.25, z + .2, 1.52, .4, 2.0, 0x2a333c);
    box(-25, 1.6, z + .3, .3, .15, .5, 0xf4f4f4);
  }
  box(-20, 1.3, 14, .1, 2.6, .1, 0x777777); box(-20, 2.5, 14, .05, .5, .5, 0x2a7ab8);
  // 駐輪場
  box(-12, 2.1, -len * .3, 3, .06, 14, 0x9aa4ae);
  for (let z = -len * .3 - 6; z < -len * .3 + 6; z += .6) box(-12, .5, z, 1.6, .9, .05, [0x333333, 0x9a2a2a, 0x2a4a8a, 0xcccccc][Math.floor(rnd() * 4)]);
  } else {
    // 対向側ホーム: 跨線橋の階段口（簡易）
    box(-4.6, 2.3, len * .18, 2.2, 2.4, 9, 0xd8d4ca);
    box(-4.6, 3.6, len * .18, 2.6, .2, 9.6, 0x6b7680);
  }
  b.build({ body: bodyMat }, grp);

  // 駅名標（ホーム）・駅舎の看板
  const tex = nameTex(sta, prevName, nextName);
  const signMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .05 });
  for (const z of signs) {
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), signMat);
    bb.position.set(X(-4.0), 3.0, z); bb.rotation.y = sx * (Math.PI / 2 - 0.55); grp.add(bb);
  }
  const bTex = canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#1d2a5a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = `800 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sta.name + '駅', w / 2, h / 2 + 6);
  });
  const bsMat = new THREE.MeshLambertMaterial({ map: bTex, emissive: 0xffffff, emissiveMap: bTex, emissiveIntensity: .05 });
  // 駅舎の正面看板（広場側）と線路側
  if (!opt.minimal) {
  const front = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), bsMat);
  front.position.set(X(bx - bd / 2 - .05), 6.4, 0); front.rotation.y = -sx * Math.PI / 2; grp.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), bsMat);
  back.position.set(X(bx + bd / 2 + .05), 6.4, 0); back.rotation.y = sx * Math.PI / 2; grp.add(back);
  }

  onLight(ctx, f => { signMat.emissiveIntensity = bsMat.emissiveIntensity = .05 + f * .75; });
  return grp;
}

export function buildStations(ctx: GameContext): void {
  const st = ctx.route.stations;
  st.forEach((sta, i) => {
    const prev = st[i - 1]?.name ?? ctx.route.prevName ?? '';
    const next = st[i + 1]?.name ?? ctx.route.nextName ?? '';
    const lat = sta.loop?.lat ?? 0;
    buildStation(ctx, sta, prev, next, { lat });
    // 2面4線: 対向線の外側（待避線）にもホーム。駅名標の前後は逆向き
    if (sta.loop) {
      const L1 = Math.max(...ctx.route.tracks);
      buildStation(ctx, sta, next, prev, { lat: L1 - lat, side: sta.platform.side === 'L' ? 'R' : 'L', minimal: true });
    }
  });
}
