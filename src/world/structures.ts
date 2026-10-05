// 構造物（route.structures）: トンネル（坑口・覆工・照明）、高架橋、橋梁＋川。トンネル出入りを tunnel イベントで通知
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';
import { extrudeAlong } from './track-mesh';
import { TUNNEL_CENTER, TUNNEL_HALF, TUNNEL_WALL_H, getTerrain, gridAlong } from './terrain';
import { BAND_CULL, isMountain } from './mountain-terrain';
import { cullByDistance } from './cull';
import { buildMountainSpan, buildRockSheds } from './mountain-structures';

const concrete = new THREE.MeshLambertMaterial({ color: 0xc4c0b6, side: THREE.DoubleSide });

/** トンネル断面（線路基準の横位置・高さ） */
function archProfile(segs = 14): [number, number][] {
  const c = TUNNEL_CENTER, r = TUNNEL_HALF, out: [number, number][] = [[c - r, -.2], [c - r, TUNNEL_WALL_H]];
  for (let i = 1; i < segs; i++) { const a = Math.PI - Math.PI * i / segs; out.push([c + Math.cos(a) * r, TUNNEL_WALL_H + Math.sin(a) * r]); }
  out.push([c + r, TUNNEL_WALL_H], [c + r, -.2]);
  return out;
}

/** 線路のカメラ位置に最も近い s（運転台以外のカメラ用） */
export function nearestS(ctx: GameContext, p: THREE.Vector3, guess: number): { s: number; lat: number } {
  let best = guess, bd = Infinity;
  for (let ds = -400; ds <= 400; ds += 10) {
    const q = ctx.track.trackAt(guess + ds), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
    if (d < bd) { bd = d; best = guess + ds; }
  }
  for (let ds = -10; ds <= 10; ds += 1) {
    const q = ctx.track.trackAt(best + ds), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
    if (d < bd) { bd = d; best = best + ds; }
  }
  const q = ctx.track.trackAt(best);
  return { s: best, lat: (p.x - q.x) * q.rx + (p.z - q.z) * q.rz };
}

export function buildStructures(ctx: GameContext): void {
  const { scene, track, route } = ctx, T = getTerrain(ctx);
  const list = route.structures ?? [];
  const batch = new GeoBatch();
  const lining = new THREE.MeshLambertMaterial({ color: 0x5d5a55, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  const lamps: THREE.Matrix4[] = [];
  const MT = isMountain(T) ? T : null;

  for (const st of list) {
    if (st.kind === 'tunnel') {
      // 山岳線は地面の帯を距離カリングするので、覆工・床・トラフはトンネル区間の帯と同じ包含球・距離で一体に消す
      //（帯だけ消えて覆工が谷に浮いて見えないように）
      const tg = new THREE.Group(); scene.add(tg);
      if (MT) {
        const own = MT.bands.filter(b => b.inside && b.a < st.to && b.b > st.from).map(b => b.mesh);
        if (own.length) cullByDistance(ctx, tg, BAND_CULL, own);
      }
      // 覆工（内壁）と床
      tg.add(extrudeAlong(track, archProfile(), st.from, st.to, 5, lining));
      tg.add(extrudeAlong(track, [[TUNNEL_CENTER - TUNNEL_HALF, .005], [TUNNEL_CENTER + TUNNEL_HALF, .005]], st.from, st.to, 10, lining));
      // 照明（左右の壁、交互）
      for (let s = st.from + 10; s < st.to; s += 18) {
        const t = track.trackAt(s), side = Math.round((s - st.from) / 18) % 2 ? -1 : 1;
        const p = track.at(s, TUNNEL_CENTER + side * (TUNNEL_HALF - .12), 4.2);
        lamps.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -t.phi, 0)), new THREE.Vector3(.12, .14, 1.2)));
      }
      // 坑口（両端）
      for (const [s, back] of [[st.from, true], [st.to, false]] as const) {
        // 山岳線: 尾根が広いので断面を広く取り、下端は坑口の外の地表に合わせる（谷側の段差もふさぐ）
        if (MT) buildPortal(ctx, s, back, (q, l) => MT.sample(q, l), 400, (q, l) => MT.sample(q, l, undefined, false), 0x3d5a36);
        else buildPortal(ctx, s, back, T.terrainY.bind(T));
      }
      // ケーブルトラフ
      for (const side of [-1, 1]) tg.add(extrudeAlong(track, [[TUNNEL_CENTER + side * (TUNNEL_HALF - .5), .0], [TUNNEL_CENTER + side * (TUNNEL_HALF - .5), .45], [TUNNEL_CENTER + side * (TUNNEL_HALF - .05), .45]], st.from, st.to, 10, concrete));
    } else if (MT) {
      buildMountainSpan(ctx, MT, st, batch);
    } else {
      const bridge = st.kind === 'bridge';
      // 床版・地覆・高欄
      const L0 = Math.min(...route.tracks) - 3.3, L1 = Math.max(...route.tracks) + 3.3;
      const deck: [number, number][] = [[L0, .02], [L0, -1.1], [L1, -1.1], [L1, .02]];
      scene.add(extrudeAlong(track, deck, st.from, st.to, 5, concrete));
      scene.add(extrudeAlong(track, [[L0 + .25, .02], [L1 - .25, .02]], st.from, st.to, 5, concrete));
      const wallH = bridge ? .55 : 1.15;
      for (const [a, b] of [[L0, L0 + .25], [L1 - .25, L1]]) {
        scene.add(extrudeAlong(track, [[a, .02], [a, wallH], [b, wallH], [b, .02]], st.from, st.to, 5, concrete));
      }
      // 橋台（盛土との境）
      for (const s of [st.from, st.to]) {
        const t = track.trackAt(s), g = T.groundY(s), y = T.trackY(s), p = track.at(s, (L0 + L1) / 2, 0);
        if (y - g > .5) batch.add('concrete', P.boxB, M(p.x, g - .5, p.z, -t.phi, L1 - L0 + 1, y - g + .3, 3), 0xffffff);
      }
      if (bridge) {
        // 鋼桁（主桁）と手すり
        const steel = new THREE.MeshLambertMaterial({ color: 0x5f7488, side: THREE.DoubleSide });
        for (const c of route.tracks) scene.add(extrudeAlong(track, [[c - 1.1, -1.1], [c - 1.1, -2.9], [c + 1.1, -2.9], [c + 1.1, -1.1]], st.from + 2, st.to - 2, 5, steel));
        for (const l of [L0 + .1, L1 - .1]) scene.add(extrudeAlong(track, [[l - .05, 1.05], [l - .05, 1.15], [l + .05, 1.15], [l + .05, 1.05]], st.from, st.to, 5, steel));
        for (let s = st.from; s <= st.to; s += 2.5) for (const l of [L0 + .1, L1 - .1]) {
          const t = track.trackAt(s), p = track.at(s, l, .55);
          batch.add('steel', P.box, M(p.x, p.y + .3, p.z, -t.phi, .06, .6, .06), 0xffffff);
        }
        // 橋脚（川の中は小判形）
        for (let s = st.from + 40; s < st.to - 20; s += 45) pier(batch, ctx, s, 2.9, true);
        // 川面
        const c = (st.from + st.to) / 2, w = (st.to - st.from) * .7;
        const water = new THREE.MeshPhongMaterial({ color: 0x3c6577, shininess: 90, specular: 0x8899aa });
        const rv = T.riverAt(c) ?? -3.6;
        const wm = gridAlong(track, c - w / 2, c + w / 2, 10, () => [[-1400, rv], [1404, rv]], water);
        wm.name = 'river'; scene.add(wm);
      } else {
        for (let s = st.from + 12; s < st.to - 4; s += 20) pier(batch, ctx, s, 1.1, false);
      }
    }
  }
  batch.build({ concrete, steel: new THREE.MeshLambertMaterial({ color: 0x5f7488 }), mbody: new THREE.MeshLambertMaterial({ vertexColors: true }) }, scene);
  if (lamps.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lampMat, lamps.length);
    lamps.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); im.userData.noShadow = true; scene.add(im);
  }

  if (MT) buildRockSheds(ctx, MT);
  // トンネル出入り判定（カメラ位置基準）
  const tunnels = list.filter(s => s.kind === 'tunnel');
  if (!tunnels.length) return;
  let inside = false, guess = ctx.state.train.s;
  ctx.events.on('reset', () => { if (inside) { inside = false; ctx.events.emit('tunnel', { inside }); } });
  ctx.events.on('frame', () => {
    const tr = ctx.state.train.s;
    let s = tr, lat = -.45, y = ctx.camera.position.y - T.trackY(tr);
    if (ctx.cameraMode !== 'cab') {
      const r = nearestS(ctx, ctx.camera.position, guess); s = r.s; lat = r.lat; y = ctx.camera.position.y - T.trackY(s);
    }
    guess = s;
    const now = tunnels.some(t => s > t.from + .5 && s < t.to - .5) && Math.abs(lat - TUNNEL_CENTER) < TUNNEL_HALF && y < TUNNEL_WALL_H + TUNNEL_HALF;
    if (now !== inside) { inside = now; ctx.events.emit('tunnel', { inside }); }
  });
}

/** 橋脚（高架はラーメン、橋梁は小判形） */
function pier(b: GeoBatch, ctx: GameContext, s: number, beamDepth: number, river: boolean): void {
  const T = getTerrain(ctx), t = ctx.track.trackAt(s), g = T.groundY(s) - .5, top = T.trackY(s) - beamDepth;
  const h = top - g;
  if (h <= .2) return;
  const tr = ctx.route.tracks, c = (Math.min(...tr) + Math.max(...tr)) / 2;
  if (river) {
    const p = ctx.track.at(s, c, 0);
    b.add('concrete', P.cyl, M(p.x, g + h / 2, p.z, -t.phi, 9, h, 2.4), 0xffffff);
    return;
  }
  for (const l of [Math.min(...tr) - 1.6, Math.max(...tr) + 1.6]) {
    const p = ctx.track.at(s, l, 0);
    b.add('concrete', P.boxB, M(p.x, g, p.z, -t.phi, 1.0, h, 1.0), 0xffffff);
  }
  const p = ctx.track.at(s, c, 0);
  b.add('concrete', P.boxB, M(p.x, top - 1.0, p.z, -t.phi, (Math.max(...tr) - Math.min(...tr)) + 6.6, 1.0, 1.2), 0xffffff);
}

/** 坑口: 山の断面（アーチ穴あき）＋コンクリート面壁 */
function buildPortal(ctx: GameContext, s: number, back: boolean, terrainY: (s: number, lat: number) => number,
  range = 150, bottomY?: (s: number, lat: number) => number, capColor = 0x55703f): void {
  const { track, scene } = ctx, t = track.trackAt(s), base = t.y;
  const sx = back ? 1 : -1; // 前向き坑口は x を反転して作る
  const arch = archProfile().map(([l, y]) => new THREE.Vector2(sx * l, y));
  // 山の断面
  const outer: THREE.Vector2[] = [];
  for (let l = -range; l <= range + 4; l += 8) outer.push(new THREE.Vector2(sx * (l + TUNNEL_CENTER - 2), Math.max(.5, terrainY(s, l + TUNNEL_CENTER - 2) - base)));
  if (bottomY) {
    // 下端: 坑口の外の地表（尾根を除く）に沿わせる
    for (let l = range + 4; l >= -range; l -= 8) outer.push(new THREE.Vector2(sx * (l + TUNNEL_CENTER - 2), Math.min(-.5, bottomY(s, l + TUNNEL_CENTER - 2) - base - .3)));
  } else outer.push(new THREE.Vector2(sx * 152, -.5), new THREE.Vector2(-sx * 150, -.5));
  const shape = new THREE.Shape(back ? outer : outer.reverse());
  const hole = new THREE.Path(back ? [...arch].reverse() : arch);
  shape.holes.push(hole);
  const capMat = new THREE.MeshLambertMaterial({ color: capColor, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), capMat);
  const grp = new THREE.Group(); grp.position.copy(track.at(s, 0, 0)); grp.rotation.y = -t.phi + (back ? 0 : Math.PI); scene.add(grp);
  grp.add(cap);
  // 面壁（アーチ穴あきの板を押し出し）
  const c = TUNNEL_CENTER * sx, W = 8.5, H = TUNNEL_WALL_H + TUNNEL_HALF + 2.2;
  const face = new THREE.Shape([new THREE.Vector2(c - W, -.3), new THREE.Vector2(c + W, -.3), new THREE.Vector2(c + W, H), new THREE.Vector2(c - W, H)]);
  face.holes.push(new THREE.Path(archProfile().map(([l, y]) => new THREE.Vector2(sx * l, y))));
  const fg = new THREE.ExtrudeGeometry(face, { depth: 1.0, bevelEnabled: false });
  const fm = new THREE.Mesh(fg, concrete); fm.position.z = -.2; grp.add(fm);
  // 笠石
  const coping = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + .6, .5, 1.6), concrete); coping.position.set(c, H + .2, .3); grp.add(coping);
  // 坑口銘板（架空）
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .6), new THREE.MeshLambertMaterial({ color: 0x3b3f44 }));
  plate.position.set(c, TUNNEL_WALL_H + TUNNEL_HALF + 1.0, 1.02); grp.add(plate);
}
