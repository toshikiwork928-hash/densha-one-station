import * as THREE from 'three';
import { basePart, GeoBatch, M, P } from '../batch';

// クハ50701の側面写真を基にした断面。レール面からの高さ、半幅、中央の鼻先と側面の接線までの後退量（m）。
const profiles = [
  [.26, 1.14, .00, 2.32], [1.04, 1.30, .10, 2.16], [1.10, 1.31, .11, 2.11],
  [1.48, 1.38, .20, 2.10], [1.97, 1.42, .38, 2.12], [2.41, 1.42, .59, 2.20],
  [2.76, 1.42, .82, 2.28], [3.13, 1.39, 1.13, 2.44], [3.28, 1.37, 1.32, 2.56],
  [3.60, 1.20, 1.98, 2.96], [3.79, .80, 2.68, 3.37], [3.86, 0, 3.52, 3.65],
];
export const RAPIT_NOSE_LENGTH = 4.55;
export const RAPIT_BLUE = 0x1b295e;
const point = (u: number, y: number) => {
  const i = profiles.findIndex(row => row[0] >= y);
  const b = profiles[i < 0 ? profiles.length - 1 : i], a = profiles[Math.max(0, (i < 0 ? profiles.length - 1 : i) - 1)];
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0] || 1), 0, 1);
  const [, width, front, side] = a.map((v, k) => THREE.MathUtils.lerp(v, b[k], t));
  const angle = Math.min(1, Math.abs(u)) * Math.PI / 2;
  const x = Math.sign(u) * width * Math.sin(angle);
  const shoulder = Math.max(0, 1 - Math.abs(u));
  const keelWidth = .13 + .28 * THREE.MathUtils.smoothstep(2.48 - y, 0, 2.2);
  const prow = .185 * Math.max(0, 1 - Math.abs(x) / keelWidth) * (1 - THREE.MathUtils.smoothstep(y, 2.42, 3.65));
  const cheek = .44 * Math.exp(-(((Math.abs(x) - .77) / .45) ** 2) - (((y - 1.88) / .43) ** 2));
  const depth = Math.abs(u) > 1 ? THREE.MathUtils.lerp(side, RAPIT_NOSE_LENGTH, Math.abs(u) - 1)
    : front + (side - front) * (1 - Math.cos(angle)) + cheek * shoulder - prow;
  return new THREE.Vector3(x, y, Math.abs(u) > 1 ? THREE.MathUtils.lerp(side * 1.13, RAPIT_NOSE_LENGTH, Math.abs(u) - 1) : depth * 1.13);
};

/** 曲面の座標と外向き法線から、ガラス・ゴム縁・灯具を同じ外板に沿わせる。 */
function surface(u: number, y: number, lift = 0) {
  const du = point(u + .001, y).sub(point(u - .001, y));
  const dy = point(u, y + .001).sub(point(u, y - .001));
  const n = dy.cross(du).normalize();
  return { p: point(u, y).addScaledVector(n, lift), n };
}

export function addRapitNose(b: GeoBatch, lamps: GeoBatch, tails: GeoBatch, glows: THREE.Vector3[], hz: number) {
  const forward = new THREE.Vector3(0, 0, -hz);
  function patch(cols: number, rows: number, sample: (u: number, v: number) => THREE.Vector3, color: number, material = 'paint') {
    const pos: number[] = [], ind: number[] = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const p = sample(i / cols, j / rows); pos.push(p.x, p.y, p.z - hz);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, c = a + cols + 1;
      ind.push(a, c, a + 1, a + 1, c, c + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ind); g.computeVertexNormals(); b.add(material, basePart(g), M(0, 0, 0), color);
  }
  // 下端は台車の前で切り上げ、車体側板の下に車輪を露出させる。
  const body = (u: number, v: number) => {
    const s = 4 * u - 2, cut = THREE.MathUtils.smoothstep(Math.abs(s), 1.22, 1.64);
    return point(s, THREE.MathUtils.lerp(.26 + .79 * cut, 3.86, v));
  };
  patch(80, 38, body, RAPIT_BLUE);

  // 前面の窓は上辺が庇の下にあり、下辺は中央の稜線の脇で少し持ち上がる。
  function pane(left: number, right: number, bottom: number, top: number, sideWindow = false) {
    for (const [inset, lift, color] of [[0, .025, 0x152642], [.014, .046, 0x193747]]) {
      patch(24, 12, (p, q) => {
        const round = .045 * (1 - Math.sqrt(Math.max(0, 1 - Math.max(0, 1 - Math.min(q, 1 - q) * 7) ** 2)));
        const u = THREE.MathUtils.lerp(left + inset + round, right - inset - round, p);
        const rake = sideWindow ? .10 * (1 - q) * Math.sign(u) : 0;
        const y = THREE.MathUtils.lerp(bottom + inset + .05 * Math.abs(u), top - inset - .025 * Math.abs(u), q);
        return surface(u + rake, y, lift).p;
      }, color, inset ? 'glass' : 'paint');
    }
  }
  pane(-.78, -.012, 2.39, 3.24); pane(.012, .78, 2.39, 3.24);
  // 運転台窓を分ける細い稜線が、屋根から鼻先へ向かって細く消える。
  patch(4, 36, (u, v) => {
    const y = 1.80 + v * 1.97;
    return surface((2 * u - 1) * (.005 + .016 * Math.sin(Math.PI * v)), y, .055).p;
  }, 0x9ba5b2);
  for (const sign of [-1, 1]) {
    const l = sign > 0 ? 1.01 : -1.19, r = sign > 0 ? 1.19 : -1.01;
    pane(l, r, 2.42, 3.13, true);
    // 客室側の板が灯具列の縁にかぶさる。下端で縁を後ろへ引き、頬のふくらみを出す。
    patch(8, 24, (i, j) => {
      const across = sign > 0 ? i : 1 - i;
      const y = 1.30 + 2.02 * j;
      const edge = .77 + .21 * (1 - Math.sin(Math.PI * j));
      const u = sign * (edge + across * (.17 + .04 * j));
      return surface(u, y, .013 + .075 * (1 - across) * Math.sin(Math.PI * j)).p;
    }, 0x2b3c89);
    // 三段の灯具の後ろに、側面へ向かって薄く消える流線形の覆いを付ける。
    for (const [index, y] of [2.00, 2.46, 2.93].entries()) {
      const u0 = .93, u1 = 1.52, rise = .075;
      patch(18, 6, (i, j) => {
        const along = sign < 0 ? 1 - i : i;
        const u = sign * THREE.MathUtils.lerp(u0, u1, along);
        const h = .115 * (1 - along) + .006;
        return surface(u, y + along * rise + (j * 2 - 1) * h,
          .022 + .075 * (1 - along) * Math.sin(Math.PI * j)).p;
      }, 0x233377);
      const lens = surface(sign * u0, y, .094).p.add(forward);
      const axis = new THREE.Vector3(sign * .38, .08, -1).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
      const mount = (offset: number, diameter: number, depth: number) => new THREE.Matrix4().compose(
        lens.clone().addScaledVector(axis, offset), q, new THREE.Vector3(diameter, depth, diameter));
      b.add('paint', P.cyl, mount(0, .19, .075), 0x485374);
      b.add('paint', P.cyl, mount(.042, .154, .021), 0x272f40);
      if (index === 0) { lamps.add('l', P.cyl, mount(.056, .127, .016), 0xffffff); glows.push(lens.clone().addScaledVector(axis, .18)); }
      if (index === 1) tails.add('l', P.cyl, mount(.056, .127, .016), 0xffffff);
    }
    const w0 = surface(sign * .13, 2.51, .040).p.add(forward), w1 = surface(sign * .43, 2.68, .040).p.add(forward);
    const delta = w1.clone().sub(w0), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    b.add('paint', P.box, new THREE.Matrix4().compose(w0.lerp(w1, .5), q, new THREE.Vector3(.022, delta.length(), .025)), 0x242d32);
    // 小窓の後ろ、屋根肩の通風スリット。
    for (let i = 0; i < 10; i++) {
      const u = 1.30 + i * .047;
      patch(1, 3, (p, h) => surface(sign * (u + .012 * (sign > 0 ? p : 1 - p) + .06 * h), 3.28 + .19 * h, .012).p, 0x192c60);
    }
  }
  // 下部カバーの分割線と締結具を、中央の尖った鼻先から側面まで回す。
  patch(64, 1, (u, v) => surface((2 * u - 1) * 1.60, 1.055 + .019 * v, .009).p, 0x172452);
  for (const u of [-1.37, -1.14, -.96, -.77, -.56, -.31, 0, .31, .56, .77, .96, 1.14, 1.37]) {
    const { p, n } = surface(u, 1.035, .014); p.add(forward);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    b.add('paint', P.cyl, new THREE.Matrix4().compose(p, q, new THREE.Vector3(.058, .032, .058)), 0x354577);
  }
}
