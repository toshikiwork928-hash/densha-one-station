// 特急形（架空）: 光沢の濃い青・丸窓・ふくらんだ前頭部（庇状のドーム＋奥まった前面窓＋縦の銀帯＋側ひれの丸灯）
import * as THREE from 'three';
import { GeoBatch, M, P, basePart } from '../batch';
import {
  Y0, adder, addEndWall, addSingleArm, addUnderfloor, shellGeo, sideSheet,
  type CarKind, type CarParts, type Ring, type SheetMaps, type V2,
} from './common';

export const HW_L = 1.42;
export const YTOP_L = 3.86;
const HALF: V2[] = [[1.16, Y0], [1.34, 1.3], [1.42, 1.8], [1.42, 2.8], [1.37, 3.28], [1.2, 3.6], [.8, 3.79], [0, YTOP_L]];
export const BLUE_L = 0x252c80;
const BLUE_CSS = '#2a318c';
const SILVER = 0xe2e6ec;

/** 先頭部の寸法（hz = 車体半長） */
function nose(hz: number) {
  const zCap = -hz + .75, zN = zCap + 1.6;
  return { zCap, zN, yC: 2.98, rx: HW_L + .01, ry: YTOP_L - 2.98 + .01, rz: 2.25 };
}

export function paintLimitedSide(Lb: number, head: boolean): SheetMaps {
  const s = sideSheet(Lb, YTOP_L), hz = Lb / 2;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H);
  grd.addColorStop(0, '#2c3494'); grd.addColorStop(.55, BLUE_CSS); grd.addColorStop(1, '#1d2368');
  s.base(grd, .2, .55);
  s.rect(-hz - 1, hz + 1, Y0, 1.16, '#151a4a', .35, .4); // 裾
  const door = (zc: number) => {
    s.rect(zc - .42, zc + .42, 1.2, 3.1, '#151a46', .3, .5, .08);
    s.rect(zc - .39, zc + .39, 1.23, 3.07, BLUE_CSS, .2, .55, .07);
    s.oval(zc, 2.55, .09, .38, '#151a3e');
  };
  const zd = head ? -hz + 3.1 : -hz + 1.1;
  door(zd);
  s.rect(zd + .55, zd + .69, 2.35, 2.95, '#e8ecf4', .3, .1); // 白い標記板（無地）
  if (head) s.oval(-hz + 1.6, 2.6, .2, .3, '#151a3e'); // 乗務員室の窓
  for (let z = zd + 1.15; z < hz - .7; z += .98) s.oval(z, 2.52, .2, .43, '#151a3e');
  return s.textures();
}

export function buildLimitedCar(kind: CarKind, Lb: number): CarParts {
  const hz = Lb / 2, head = kind === 'head';
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), tl = new GeoBatch(), gl = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  let rings: Ring[];
  if (head) {
    const N = nose(hz);
    const clipAt = (z: number) => (x: number, y: number) => {
      const d = Math.max(0, N.zN - z), q = 1 - (x / N.rx) ** 2 - (d / N.rz) ** 2;
      return q <= 0 ? Math.min(y, N.yC - .02) : N.yC + N.ry * Math.sqrt(q) - .05;
    };
    rings = [];
    for (let i = 0; i <= 10; i++) { const z = N.zCap + (N.zN - N.zCap) * i / 10; rings.push({ z, inset: 0, clip: clipAt(z) }); }
    rings.push({ z: hz, inset: 0 });
    buildNose(b, lit, tl, gl, glows, hz);
  } else {
    rings = [{ z: -hz, inset: 0 }, { z: hz, inset: 0 }];
    addEndWall(b, -hz, YTOP_L, HW_L, BLUE_L);
  }
  const shell = shellGeo(HALF, rings, YTOP_L, Lb);
  addEndWall(b, hz, YTOP_L, HW_L, BLUE_L);
  addUnderfloor(b, Lb, kind, { frame: 0x1b1d26, equip: 0x24262e, bogie: 0x202228, frontCut: head ? 1.5 : 0 });
  // 屋根上の低いカバー
  add(0, YTOP_L + .06, head ? 1.5 : 0, 1.3, .14, head ? 9 : 12, 0x262c78);
  if (kind === 'pan') addSingleArm(b, -hz + 4.0, YTOP_L - .02);
  return { shell, paint: b.geometry('paint')!, glass: gl.geometry('g') ?? undefined, head: lit.geometry('l') ?? undefined, tail: tl.geometry('l') ?? undefined, glows };
}

function buildNose(b: GeoBatch, lit: GeoBatch, tl: GeoBatch, gl: GeoBatch, glows: THREE.Vector3[], hz: number) {
  const N = nose(hz), add = adder(b);
  // ドーム（庇）: 楕円体の前上 1/4
  const dome = new THREE.SphereGeometry(1, 28, 14, Math.PI, Math.PI, 0, Math.PI / 2).scale(N.rx, N.ry, N.rz).translate(0, N.yC, N.zN);
  b.add('paint', basePart(dome), M(0, 0, 0), BLUE_L);
  const under = new THREE.CircleGeometry(1, 28, Math.PI, Math.PI).rotateX(Math.PI / 2).scale(N.rx, 1, N.rz).translate(0, N.yC - .005, N.zN);
  b.add('paint', basePart(under), M(0, 0, 0), 0x1a1f5a);
  // 前面窓（黒い角形の枠に奥まったガラス）
  add(0, 2.55, N.zCap - .03, 2.5, .9, .06, 0x0c0e1c);
  gl.add('g', P.box, M(0, 2.56, N.zCap - .07, 0, 2.3, .74, .02), 0xffffff);
  // あご（窓下のふくらみ）
  const chin = new THREE.SphereGeometry(1, 24, 12).scale(1.3, .42, .72).translate(0, 1.95, N.zCap);
  b.add('paint', basePart(chin), M(0, 0, 0), BLUE_L);
  // 下部の盾（平面形は浅いV字）
  const sh = new THREE.Shape([
    new THREE.Vector2(1.38, -(N.zCap + .5)), new THREE.Vector2(1.36, -(-hz + .5)), new THREE.Vector2(1.2, -(-hz + .2)), new THREE.Vector2(.8, -(-hz + .02)),
    new THREE.Vector2(0, -(-hz - .06)), new THREE.Vector2(-.8, -(-hz + .02)), new THREE.Vector2(-1.2, -(-hz + .2)), new THREE.Vector2(-1.36, -(-hz + .5)), new THREE.Vector2(-1.38, -(N.zCap + .5)),
  ]);
  const shield = new THREE.ExtrudeGeometry(sh, { depth: 1.25, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, .48, 0);
  // 下ほど幅を絞る
  const sp = shield.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setX(i, sp.getX(i) * (.84 + .16 * Math.min(1, (sp.getY(i) - .48) / 1.25)));
  shield.computeVertexNormals();
  b.add('paint', basePart(shield), M(0, 0, 0), BLUE_L);
  // 盾のリベット列と継ぎ目
  const shieldZ = (x: number) => { const a = Math.abs(x); return a < .8 ? -hz - .06 + .08 * a / .8 : a < 1.2 ? -hz + .02 + .18 * (a - .8) / .4 : -hz + .2 + .3 * (a - 1.2) / .16; };
  for (let x = -1.3; x <= 1.31; x += .13) b.add('paint', P.sphere, M(x, 1.66, shieldZ(x) - .005, 0, .035, .035, .035), 0x8a90a8);
  for (const sx of [-1, 1]) for (let y = .62; y < 1.65; y += .16) b.add('paint', P.sphere, M(sx * .55, y, shieldZ(sx * .55) - .005, 0, .03, .03, .03), 0x8a90a8);
  // 側ひれ（丸灯付き）
  for (const sx of [-1, 1]) {
    const pt = (t: number) => new THREE.Vector3(sx * (1.36 - .04 * Math.sin(Math.PI * t)), 3.1 - 1.55 * t, N.zCap - .15 - .32 * Math.sin(Math.PI * t));
    for (let i = 0; i < 8; i++) {
      const a = pt(i / 8), c = pt((i + 1) / 8), m = a.clone().add(c).multiplyScalar(.5);
      b.add('paint', P.box, M(m.x, m.y, m.z, 0, .17, a.distanceTo(c) + .02, .34, Math.atan2(c.z - a.z, c.y - a.y)), BLUE_L);
    }
    ([[.14, 'h'], [.4, 'h'], [.66, 't']] as const).forEach(([t, k]) => {
      const p = pt(t), z = p.z - .17;
      b.add('paint', P.cyl, M(p.x, p.y, z, 0, .24, .05, .24, Math.PI / 2), 0x8f96a8);
      (k === 'h' ? lit : tl).add('l', P.cyl, M(p.x, p.y, z - .03, 0, .17, .02, .17, Math.PI / 2), 0xffffff);
      if (k === 'h') glows.push(new THREE.Vector3(p.x, p.y, z - .25));
    });
  }
  // 縦の銀帯: 屋根上 → ドーム → 前面窓の仕切り
  const x0 = .32, f = Math.sqrt(1 - (x0 / N.rx) ** 2), w = .07, tris: number[] = [];
  const P3 = (x: number, th: number) => {
    const ff = Math.sqrt(Math.max(0, 1 - (x / N.rx) ** 2)) * 1.012;
    return [x, N.yC + N.ry * ff * Math.cos(th), N.zN - N.rz * ff * Math.sin(th)];
  };
  for (let i = 0; i < 14; i++) {
    const t0 = Math.PI / 2 * i / 14, t1 = Math.PI / 2 * (i + 1) / 14;
    const a = P3(x0 - w, t0), c = P3(x0 + w, t0), d = P3(x0 - w, t1), e = P3(x0 + w, t1);
    tris.push(...a, ...c, ...e, ...a, ...e, ...d);
  }
  b.addTris('paint', tris, SILVER);
  void f;
  add(x0, YTOP_L - .005, N.zN + 1.5, .1, .03, 3, SILVER);
  add(x0, 2.55, N.zCap - .09, .1, .9, .05, SILVER);
  add(x0, 1.98 + .2, N.zCap - .5, .1, .05, .3, SILVER, .5);
}
