// 線路（バラスト・レール・枕木）、地面、架線柱・架線
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Track } from '../route/track';
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
    for (let s0 = TS0; s0 < TS1; s0 += CH) {
      const s1 = Math.min(TS1, s0 + CH), cnt = Math.ceil((s1 - s0) / sp) * route.tracks.length;
      const inst = new THREE.InstancedMesh(geo, matSleeper, cnt);
      let i = 0;
      for (let k = Math.ceil((s0 - TS0) / sp); TS0 + k * sp < s1 && i < cnt; k++) for (const c of route.tracks) {
        const s = TS0 + k * sp, t = trackAt(s); q.setFromEuler(e.set(0, -t.phi, 0));
        inst.setMatrixAt(i++, m4.compose(at(s, c, .27), q, one));
      }
      inst.count = i; inst.computeBoundingSphere(); scene.add(inst);
      cullByDistance(ctx, inst, 700);
    }
  }
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
  }
}
