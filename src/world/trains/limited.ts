// 特急形（架空）: 光沢の濃い青・楕円の側窓（1両 10 枚まで）・流線形の先頭部（回り込んだ前面窓・銀帯・下寄りの前照灯）
import * as THREE from 'three';
import { GeoBatch, P, basePart } from '../batch';
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

/** 流線形の先頭部の長さ [m]（車体端から） */
const NOSE_LEN = 4.3;
/** 先端の高さ（上下の稜線が集まる点）[m] */
const TIP_Y = 1.85;

/** 先頭部の断面形状（u = 0: 車体との境 → 1: 先端）。上 = 屋根の稜線、下 = 裾、w = 半幅 */
const noseTop = (u: number) => TIP_Y + (YTOP_L - TIP_Y) * Math.pow(Math.max(0, 1 - u ** 2.1), .62);
const noseBot = (u: number) => TIP_Y - (TIP_Y - Y0) * Math.pow(Math.max(0, 1 - u ** 3), .5);
const noseW = (u: number) => Math.pow(Math.max(0, 1 - u ** 2.6), .55);

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
  const zd = head ? -hz + NOSE_LEN + 1.2 : -hz + 1.1;
  door(zd);
  s.rect(zd + .55, zd + .69, 2.35, 2.95, '#e8ecf4', .3, .1); // 白い標記板（無地）
  // 楕円の側窓（1両 10 枚まで、等間隔）
  const z0 = zd + 1.35, z1 = hz - .9, n = Math.min(10, Math.floor((z1 - z0) / 1.45) + 1);
  for (let i = 0; i < n; i++) s.oval(z0 + (z1 - z0) * i / Math.max(1, n - 1), 2.52, .27, .46, '#151a3e');
  return s.textures();
}

export function buildLimitedCar(kind: CarKind, Lb: number): CarParts {
  const hz = Lb / 2, head = kind === 'head';
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), tl = new GeoBatch(), gl = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  let rings: Ring[];
  if (head) {
    rings = [{ z: -hz + NOSE_LEN, inset: 0 }, { z: hz, inset: 0 }];
    buildNose(b, lit, tl, glows, hz);
  } else {
    rings = [{ z: -hz, inset: 0 }, { z: hz, inset: 0 }];
    addEndWall(b, -hz, YTOP_L, HW_L, BLUE_L);
  }
  const shell = shellGeo(HALF, rings, YTOP_L, Lb);
  addEndWall(b, hz, YTOP_L, HW_L, BLUE_L);
  addUnderfloor(b, Lb, kind, { frame: 0x1b1d26, equip: 0x24262e, bogie: 0x202228, frontCut: head ? NOSE_LEN - 1.2 : 0 });
  // 屋根上の低いカバー
  add(0, YTOP_L + .06, head ? NOSE_LEN / 2 + 1 : 0, 1.3, .14, head ? Lb - NOSE_LEN - 3 : 12, 0x262c78);
  if (kind === 'pan') addSingleArm(b, -hz + 4.0, YTOP_L - .02);
  return { shell, paint: b.geometry('paint')!, glass: gl.geometry('g') ?? undefined, head: lit.geometry('l') ?? undefined, tail: tl.geometry('l') ?? undefined, glows };
}

/** 断面（片側）を弧長で等分し直す */
function resample(half: V2[], n: number): V2[] {
  // +X 下端 → 屋根 → -X 下端 → 床下を通って +X 下端へ（閉じた断面。先端で床下がせり上がるので底も要る）
  const full: V2[] = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y] as V2), half[0]];
  const len: number[] = [0];
  for (let i = 1; i < full.length; i++) len.push(len[i - 1] + Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]));
  const out: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const d = len[len.length - 1] * k / n;
    let i = 1; while (i < len.length - 1 && len[i] < d) i++;
    const f = (d - len[i - 1]) / (len[i] - len[i - 1] || 1);
    out.push([full[i - 1][0] + (full[i][0] - full[i - 1][0]) * f, full[i - 1][1] + (full[i][1] - full[i - 1][1]) * f]);
  }
  return out;
}

/** 先頭部の外形上の点（u = 前後、x/y = 車体断面上の点） */
function nosePoint(hz: number, u: number, x: number, y: number): THREE.Vector3 {
  const v = (y - Y0) / (YTOP_L - Y0);
  return new THREE.Vector3(x * noseW(u), noseBot(u) + v * (noseTop(u) - noseBot(u)), -hz + NOSE_LEN * (1 - u));
}

function buildNose(b: GeoBatch, lit: GeoBatch, tl: GeoBatch, glows: THREE.Vector3[], hz: number) {
  const add = adder(b);
  // 外板: 車体断面を前方へ絞りながら押し出したロフト（滑らかな法線）
  const sec = resample(HALF, 180), NU = 96;
  const pos: number[] = [], idx: number[] = [], par: [number, number, number][] = [];
  for (let j = 0; j <= NU; j++) {
    const u = 1 - (1 - j / NU) ** 1.6; // 先端ほど細かく
    for (const [x, y] of sec) {
      const p = nosePoint(hz, Math.min(u, .999), x, y);
      pos.push(p.x, p.y, p.z); par.push([u, x / HW_L, (y - Y0) / (YTOP_L - Y0)]);
    }
  }
  const n = sec.length;
  for (let j = 0; j < NU; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, c = a + n;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // 頂点ごとに色を決める（境界は約 3cm でぼかす）: 塗装 / 前面窓（黒）/ 銀帯 / 裾
  const sm = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const band = (x: number, lo: number, hi: number, w = .03) => sm(lo - w, lo + w, x) * (1 - sm(hi - w, hi + w, x));
  const cBody = new THREE.Color(BLUE_L), cGlass = new THREE.Color(0x07080f), cSilver = new THREE.Color(SILVER), cSkirt = new THREE.Color(0x151a46);
  const P3 = g.attributes.position, tmp = new THREE.Color();
  const col = new Float32Array(P3.count * 3);
  for (let k = 0; k < P3.count; k++) {
    const [u, , v] = par[k], x = P3.getX(k), y = P3.getY(k);
    tmp.copy(cBody);
    // 前面窓: 高さ一定の帯が先頭部の曲面を回り込む。中央に細い仕切り
    const w = band(y, 2.3, 2.98 - .12 * u) * band(u, .3, .93, .02) * (1 - band(x, -.035, .035, .015) * .85);
    tmp.lerp(cGlass, w);
    tmp.lerp(cSilver, band(x, -.045, .045, .012) * sm(2.95, 3.0, y) * (1 - sm(.83, .87, u)));
    tmp.lerp(cSkirt, 1 - sm(.08, .12, v));
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const ng = g.toNonIndexed();
  b.addColored('paint', ng.attributes.position.array, ng.attributes.normal.array, ng.attributes.color.array);
  // 銀帯の屋根上の続き
  add(0, YTOP_L + .005, -hz + NOSE_LEN + 1.5, .09, .03, 3, SILVER);
  // 前照灯・尾灯（窓の下、左右に並べる）。外板の法線に沿って少し浮かせる
  // 断面の外周上で高さ y（車体基準）の点（sx = 左右）を先頭部へ写す
  const edge = (sx: number, y: number): V2 => {
    let best = sec[0], bd = Infinity;
    for (const q of sec) if (q[0] * sx > 0 && Math.abs(q[1] - y) < bd && q[1] > Y0 + .05) { bd = Math.abs(q[1] - y); best = q; }
    return best;
  };
  const surf = (u: number, sx: number, y: number) => { const [ex, ey] = edge(sx, y); return nosePoint(hz, u, ex, ey); };
  const lamp = (u: number, sx: number, y: number, kind: 'h' | 't') => {
    const p = surf(u, sx, y), du = surf(u + .01, sx, y).sub(p), dv = surf(u, sx, y + .08).sub(p);
    let nrm = du.clone().cross(dv).normalize();
    if (nrm.z > 0) nrm.negate();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
    const m = (k: number, w: number, h: number) => new THREE.Matrix4().compose(p.clone().addScaledVector(nrm, k), q, new THREE.Vector3(w, h, w * .75));
    b.add('paint', P.cyl, m(.005, .42, .04), 0x0a0c14); // 黒い縁
    b.add('paint', P.cyl, m(.015, .3, .05), 0x8f96a8);
    (kind === 'h' ? lit : tl).add('l', P.cyl, m(.035, .22, .02), 0xffffff);
    if (kind === 'h') glows.push(p.clone().addScaledVector(nrm, .3));
  };
  for (const sx of [-1, 1]) { lamp(.84, sx, 1.95, 'h'); lamp(.76, sx, 1.95, 't'); }
  // 排障器（スカート）: 先頭部の平面形に沿った板（上から見た輪郭を押し出し）
  const outline: THREE.Vector2[] = [];
  for (let k = 0; k <= 16; k++) { const u = .86 * k / 16; outline.push(new THREE.Vector2(HW_L * noseW(u) * .82, hz - NOSE_LEN * (1 - u))); }
  for (let k = 16; k >= 0; k--) { const u = .86 * k / 16; outline.push(new THREE.Vector2(-HW_L * noseW(u) * .82, hz - NOSE_LEN * (1 - u))); }
  const skirt = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: .6, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, .45, 0);
  b.add('paint', basePart(skirt), new THREE.Matrix4(), 0x1f2330);
  // ワイパー
  for (const sx of [-1, 1]) {
    const p = surf(.62, sx, 2.6);
    add(p.x * .9, 2.32, p.z - .02, .5, .02, .02, 0x111111, 0, 0, sx * .5);
  }
}
