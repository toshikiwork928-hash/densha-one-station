// 線路（バラスト・レール・枕木）、地面、架線柱・架線
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Track } from '../route/track';
import { loopShape, loopZones, type LoopZone } from '../route/service';
import { cullByDistance } from './cull';
import { getTerrain } from './terrain';

const GAUGE = 0.535; // 軌間の半分 [m]

/** 線路に沿った押し出しメッシュ。profile = [横位置, 高さ][] */
export function extrudeAlong(track: Track, profile: [number, number][], s0: number, s1: number, step: number, mat: THREE.Material): THREE.Mesh {
  const n = Math.ceil((s1 - s0) / step) + 1, m = profile.length;
  const pos = new Float32Array(n * m * 3), idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = track.trackAt(Math.min(s0 + i * step, s1));
    for (let j = 0; j < m; j++) {
      const [l, y] = profile[j], k = (i * m + j) * 3;
      pos[k] = t.x + t.rx * l; pos[k + 1] = y + t.y; pos[k + 2] = t.z + t.rz * l;
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** 断面が s で変わる押し出しメッシュ（待避線・分岐器用）。fn(s) = [横位置, 高さ][]（点数一定） */
export function extrudeFn(track: Track, fn: (s: number) => [number, number][], s0: number, s1: number, step: number, mat: THREE.Material): THREE.Mesh {
  const n = Math.ceil((s1 - s0) / step) + 1, m = fn(s0).length;
  const pos = new Float32Array(n * m * 3), idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = Math.min(s0 + i * step, s1), t = track.trackAt(s), prof = fn(s);
    for (let j = 0; j < m; j++) {
      const [l, y] = prof[j], k = (i * m + j) * 3;
      pos[k] = t.x + t.rx * l; pos[k + 1] = y + t.y; pos[k + 2] = t.z + t.rz * l;
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** 2面4線駅の待避線1本（base = 本線の横位置、off = 本線からの振れ） */
export interface LoopTrack { z: LoopZone & { index: number }; base: number; off: number; lat(s: number): number }

/** 待避線の一覧（自線側は左、対向線側は右へ鏡像） */
export function loopTracks(ctx: GameContext): LoopTrack[] {
  const L0 = Math.min(...ctx.route.tracks), L1 = Math.max(...ctx.route.tracks);
  return loopZones(ctx.route).flatMap(z => [
    { z, base: L0, off: z.lat },
    ...(L1 !== L0 ? [{ z, base: L1, off: -z.lat }] : []),
  ].map(o => ({ ...o, lat: (s: number) => o.base + o.off * loopShape(z, s) })));
}

export function buildTrackMesh(ctx: GameContext): void {
  const { scene, track, route } = ctx, { trackAt, at } = track;
  const TS0 = route.extent.from, TS1 = route.extent.to;
  const matBallast = new THREE.MeshLambertMaterial({ color: 0x8a8378, side: THREE.DoubleSide });
  const matRail = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: .8, roughness: .35, side: THREE.DoubleSide });
  const matSleeper = new THREE.MeshLambertMaterial({ color: 0x6b6259 });
  for (const c of route.tracks) {
    scene.add(extrudeAlong(track, [[c - 2.3, 0.0], [c - 1.4, 0.22], [c + 1.4, 0.22], [c + 2.3, 0.0]], TS0, TS1, 4, matBallast));
    for (const r of [c - GAUGE, c + GAUGE])
      scene.add(extrudeAlong(track, [[r - .035, .24], [r - .035, .38], [r + .035, .38], [r + .035, .24]], TS0, TS1, 3, matRail));
  }
  // 枕木（200m ごとの InstancedMesh。遠方は距離カリング）
  {
    const geo = new THREE.BoxGeometry(2.0, 0.14, 0.22), sp = 0.65, CH = 200;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    const loops = loopTracks(ctx), wide = new THREE.Vector3();
    for (let s0 = TS0; s0 < TS1; s0 += CH) {
      const s1 = Math.min(TS1, s0 + CH), cnt = Math.ceil((s1 - s0) / sp) * route.tracks.length * 2;
      const inst = new THREE.InstancedMesh(geo, matSleeper, cnt);
      let i = 0;
      for (let k = Math.ceil((s0 - TS0) / sp); TS0 + k * sp < s1 && i < cnt - 1; k++) for (const c of route.tracks) {
        const s = TS0 + k * sp, t = trackAt(s); q.setFromEuler(e.set(0, -t.phi, 0));
        const lp = loops.find(o => o.base === c && s > o.z.inFrom && s < o.z.outTo);
        const d = lp ? lp.lat(s) - c : 0;
        if (lp && Math.abs(d) < Math.abs(lp.off) - .01) {
          // 分岐器: 本線と分岐線にまたがる長い枕木
          inst.setMatrixAt(i++, m4.compose(at(s, c + d / 2, .27), q, wide.set((Math.abs(d) + 2) / 2, 1, 1)));
          continue;
        }
        inst.setMatrixAt(i++, m4.compose(at(s, c, .27), q, one));
        if (lp) inst.setMatrixAt(i++, m4.compose(at(s, c + d, .27), q, one));
      }
      inst.count = i; inst.computeBoundingSphere(); scene.add(inst);
      cullByDistance(ctx, inst, 700);
    }
  }
  buildLoopTracks(ctx, matBallast, matRail);
  // 地面は terrain.ts
  // 架線柱・架線
  {
    const poleGeo = new THREE.CylinderGeometry(.13, .16, 7.2, 8); poleGeo.translate(0, 3.6, 0);
    const armGeo = new THREE.BoxGeometry(7.6, .14, .14);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    const T = getTerrain(ctx);
    const list: number[] = []; for (let s = TS0; s < TS1; s += 50) if (T.structureAt(s, 3)?.kind !== 'tunnel') list.push(s);
    const poles = new THREE.InstancedMesh(poleGeo, mat, list.length), arms = new THREE.InstancedMesh(armGeo, mat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    list.forEach((s, i) => {
      const t = trackAt(s); q.setFromEuler(e.set(0, -t.phi, 0));
      poles.setMatrixAt(i, m4.compose(at(s, 6.7, 0), q, one));
      arms.setMatrixAt(i, m4.compose(at(s, 3.0, 6.6), q, one));
    });
    scene.add(poles, arms);
    const wm = new THREE.LineBasicMaterial({ color: 0x2b2b2b });
    for (const c of route.tracks) {
      const pts: THREE.Vector3[] = []; for (let s = TS0; s <= TS1; s += 10) pts.push(at(s, c, 5.7));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm));
    }
    // 待避線の架線と門型の架線柱（駅舎の前は片持ち）
    for (const o of loopTracks(ctx)) {
      const pts: THREE.Vector3[] = []; for (let s = o.z.inFrom; s <= o.z.outTo; s += 5) pts.push(at(s, o.lat(s), 5.7));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm));
    }
    const beamGeo = new THREE.BoxGeometry(1, .2, .2);
    for (const z of loopZones(route)) {
      const sta = route.stations[z.index], sc = (sta.platform.from + sta.platform.to) / 2;
      const left = Math.min(...route.tracks) + z.lat - 7.4, right = Math.max(...route.tracks) - z.lat + 7.4;
      for (let s = Math.ceil(z.inFrom / 50) * 50; s <= z.outTo; s += 50) {
        const t = trackAt(s); q.setFromEuler(e.set(0, -t.phi, 0));
        const g = new THREE.Group();
        const pr = new THREE.Mesh(poleGeo, mat); pr.position.copy(at(s, right, 0)); pr.quaternion.copy(q); g.add(pr);
        const nearBldg = Math.abs(s - sc) < 16; // 駅舎の前は柱を立てない
        const lft = nearBldg ? z.lat - 1.2 : left;
        if (!nearBldg) { const pl = new THREE.Mesh(poleGeo, mat); pl.position.copy(at(s, left, 0)); pl.quaternion.copy(q); g.add(pl); }
        const bm = new THREE.Mesh(beamGeo, mat); bm.position.copy(at(s, (lft + right) / 2, 7.05)); bm.quaternion.copy(q); bm.scale.x = right - lft; g.add(bm);
        scene.add(g); cullByDistance(ctx, g, 1200);
      }
    }
  }
}

/** 待避線のバラスト・レールと分岐器（転てつ機・クロッシング・ガードレール） */
function buildLoopTracks(ctx: GameContext, matBallast: THREE.Material, matRail: THREE.Material): void {
  const { scene, track } = ctx;
  const steel = new THREE.MeshLambertMaterial({ color: 0x4a4d52 });
  const machine = new THREE.MeshLambertMaterial({ color: 0x8a8f72 });
  for (const o of loopTracks(ctx)) {
    const { z, base } = o, dir = Math.sign(o.off);
    const s0 = z.inFrom, s1 = z.outTo;
    // バラスト: 待避線の外側の法面から本線の道床まで埋める
    scene.add(extrudeFn(track, s => {
      const l = o.lat(s);
      return dir < 0 ? [[l - 2.3, 0], [l - 1.4, .215], [base - 1.0, .215]] : [[base + 1.0, .215], [l + 1.4, .215], [l + 2.3, 0]];
    }, s0, s1, 2, matBallast));
    // レール（本線と重なる分岐部で z-fight しないよう僅かに上げる）
    for (const g of [-GAUGE, GAUGE]) {
      scene.add(extrudeFn(track, s => {
        const r = o.lat(s) + g;
        return [[r - .035, .243], [r - .035, .383], [r + .035, .383], [r + .035, .243]];
      }, s0, s1, 1, matRail));
    }
    // 分岐器の部品（入口・出口）
    const grp = new THREE.Group();
    const put = (geo: THREE.BufferGeometry, m: THREE.Material, s: number, lat: number, y: number) => {
      const t = track.trackAt(s), mesh = new THREE.Mesh(geo, m);
      mesh.position.copy(track.at(s, lat, y)); mesh.rotation.y = -t.phi; grp.add(mesh);
    };
    const ends: [number, number, number][] = [[z.inFrom, z.inTo, 1], [z.outTo, z.outFrom, -1]];
    for (const [from, to, sgn] of ends) {
      // 転てつ機（分岐の起点、本線の外側）と動作かん
      put(new THREE.BoxGeometry(.5, .35, 1.0), machine, from + sgn * 1.5, base - dir * 1.6, .35);
      put(new THREE.BoxGeometry(1.0, .06, .08), steel, from + sgn * 1.5, base - dir * .9, .33);
      // トングレール付近の床板
      put(new THREE.BoxGeometry(1.4, .04, 6), steel, from + sgn * 3.5, base + dir * .1, .262);
      // クロッシング: 分岐線の内側レールが本線のレールと交わる位置
      let fs = to;
      for (let k = 0; k <= 200; k++) {
        const s = from + (to - from) * k / 200;
        if (Math.abs(o.lat(s) - base) >= GAUGE * 2) { fs = s; break; }
      }
      put(new THREE.BoxGeometry(.5, .08, 3.2), steel, fs, base + dir * GAUGE, .3);
      // ガードレール（反対側レールの内側）
      put(new THREE.BoxGeometry(.06, .1, 4.5), steel, fs, base - dir * (GAUGE - .12), .33);
      put(new THREE.BoxGeometry(.06, .1, 4.5), steel, fs, o.lat(fs) - dir * (GAUGE - .12), .33);
    }
    scene.add(grp); cullByDistance(ctx, grp, 700);
  }
}
