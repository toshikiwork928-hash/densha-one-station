import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { curvedCab, roundRings, shellGeo, type V2 } from './common';

// 前面、丸い角、側面を同じ後退量で変形する。側面の直線部で後退量をゼロに戻す。
export function southernCab(half: V2[], top: number, hw: number, radius: number, length: number,
  zAt: (x: number, y: number) => number, roofDrop = 1, wrapWidth?: number) {
  const zf = -length / 2;
  const nose = roundRings(zf, radius, 1, 16);
  const body = [{ z: zf + 1.4, inset: 0 }, { z: -zf, inset: 0 }];
  const face = curvedCab(half, radius, top, hw, zAt, roofDrop);
  const deform = (g: THREE.BufferGeometry) => {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), weight = 1 - THREE.MathUtils.smoothstep(z - zf, radius, 1.4);
      p.setZ(i, z + (zAt(p.getX(i), p.getY(i)) - zf) * weight);
    }
    g.computeVertexNormals();
    return g;
  };
  if (!wrapWidth) return { shell: deform(shellGeo(half, [...nose, ...body], top, length, roofDrop)), face };

  // 側面の乗務員扉の手前までを展開し、窓・枠・帯を正面と同じシートに載せる。
  const seam = { z: zf + .70, inset: 0 };
  const collar = shellGeo(half, [...nose, seam], top, length, roofDrop);
  for (const g of [face, collar]) {
    const p = g.getAttribute('position'), uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), depth = g === face ? 0 : p.getZ(i) - zf;
      const angle = Math.acos(THREE.MathUtils.clamp(1 - depth / radius, 0, 1));
      const arc = radius * (angle - Math.sin(angle)) + Math.max(0, depth - radius);
      uv.setX(i, .5 - (x + Math.sign(x) * arc) / (2 * wrapWidth));
    }
  }
  deform(collar);
  const wrapped = mergeGeometries([face, collar])!;
  face.dispose(); collar.dispose();
  return { shell: deform(shellGeo(half, [seam, ...body], top, length, roofDrop)), face: wrapped };
}

// 下辺と上辺を別々に指定し、灯具のレンズと表示器を前面曲線に沿わせる。
export function cabPanel(bottom: V2, top: V2, y0: number, y1: number,
  zAt: (x: number, y: number) => number, lift: number) {
  const g = new THREE.PlaneGeometry(1, 1, 12, 3).rotateY(Math.PI);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + .5, y = THREE.MathUtils.lerp(y0, y1, t);
    const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(bottom[0], top[0], t),
      THREE.MathUtils.lerp(bottom[1], top[1], t), p.getX(i) + .5);
    p.setXYZ(i, x, y, zAt(x, y) - lift);
  }
  g.computeVertexNormals();
  return g;
}
