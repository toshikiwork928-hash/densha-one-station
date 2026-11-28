import { windowSill } from './cab-glazing';
import { FRONT_2039_BLUE, FRONT_2039_ORANGE, paint2039Side } from './c2000-side';
import { add7100Skirt } from './c7100-skirt';
// 1000系（モブ。本線の対向列車・留置車両）・2000系（モブ。高野線の 8両と支線の 2両）と、前面の上半分が後ろへ傾いた車両の共通部品（30000系も使う）
//  1000系: 20m 級4扉・6両固定。8300系と同じ拡幅・すそ絞りの車体で、塗装は 7100系と同じ（銀灰色に青・橙の帯。先頭で斜めに立ち上がる）。
//          前面は大きな窓が少し後ろへ傾き、中央に銀色の貫通扉。前照灯と標識灯はガラスの下の青帯に一体化。
//          窓配置: 扉間2枚、中間車の車端は片側1枚ずつ
//  2000系: 17m 級（ゲームでは 18m）2扉（ズームカー）。1000系に近い顔と帯で、車体はステンレス無塗装の銀。
//          編成は支線用 2両・高野線用 4両 × 2 の 8両
import * as THREE from 'three';
import { GeoBatch, M, P } from '../batch';
import {
  Y0, paintDoor, adder, addCrossArm, addEndWall, addUnderfloor, curvedCab, faceSheet, roundRings, shellGeo, sideSheet, sweepBand,
  type CarKind, type CarParts, type Ring, type SheetMaps, type V2,
} from './common';

// ---------- 傾いた前面（共通） ----------

/** 前面の傾き: 高さ knee から上を屋根まで depth [m] 後ろへ、左右の端を bow [m] 後ろへ（上から見て丸い顔） */
export interface Slant { depth: number; bow: number; hw: number; ytop: number }
/** 前面の knee は前面の中心高さ（capGeo の扇の中心）。扇の三角形が折れ目と一致して平面になる */
const kneeOf = (sl: Slant) => (Y0 + sl.ytop) / 2;
/** 前端からの後退量 [m]（x, y = 前面上の位置） */
export function slantZ(sl: Slant, x: number, y: number): number {
  const k = kneeOf(sl), t = Math.min(1, Math.max(0, (y - k) / (sl.ytop - k)));
  return sl.depth * t + sl.bow * (x / sl.hw) ** 2;
}
/** 高さ y での前面の傾き（dz/dy） */
export const slantSlope = (sl: Slant, y: number): number => y > kneeOf(sl) ? sl.depth / (sl.ytop - kneeOf(sl)) : 0;

/** 先頭部の外板リング（丸み r の後ろに、傾きが収まるまでのリングを足す） */
export function slantRings(zf: number, r: number, sl: Slant): Ring[] {
  const d = sl.depth + sl.bow;
  return [...roundRings(zf, r, 1), { z: zf + d * .35, inset: 0 }, { z: zf + d * .7, inset: 0 }, { z: zf + d + .12, inset: 0 }];
}
/** 前面の後退量を外板の前端で一致させ、後方の直線部へ滑らかにつなぐ。 */
export function applySlant(g: THREE.BufferGeometry, zf: number, sl: Slant) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const weight = Math.max(0, 1 - (z - zf) / (sl.depth + sl.bow + .12));
    p.setZ(i, z + weight * slantZ(sl, p.getX(i), p.getY(i)));
  }
  p.needsUpdate = true; g.computeVertexNormals();
}
/** 傾いた前面に貼る行先 LED（[x, y, 幅]、高さ h）。面に沿って傾け、少し浮かせる */
export function slantLed(sl: Slant, zf: number, list: [number, number, number][], h: number, faceGap = .02): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [];
  for (const [x, y, w] of list) {
    const g = new THREE.PlaneGeometry(w, h, 8, 2).rotateY(Math.PI).translate(x, y, zf).toNonIndexed();
    const vertices = g.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      vertices.setZ(i, zf + slantZ(sl, vertices.getX(i), vertices.getY(i)) - faceGap);
    }
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nrm.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

export { paintDoor } from './common';

// ---------- 1000系・2000系 ----------

export type NewLiveryModel = '1000' | '2000';
/** 帯（7100系と同じ。world/trains/commuter.ts の LOOK.old）。2000系は屋根が低いので幕板の帯を下げる（Spec.top） */
const L7100 = {
  base: ['#c6cbd6', '#b3b9c6'] as [string, string], blue: '#2f3fa8', orange: '#f0961c',
  topBand: [3.4, 3.65] as V2, topLine: [3.26, 3.37] as V2, lowBand: [1.44, 1.53] as V2, lowLine: [1.34, 1.43] as V2,
  frontBand: [1.47, 1.88] as V2, frontLine: [1.34, 1.43] as V2,
};

interface Spec {
  hw: number; ytop: number; half: V2[]; slant: Slant; r: number;
  doors: number[]; doorW: number; win: V2; roofY: number;
  /** 車体の地（グラデーションの上・下）と粗さ・金属度 */
  base: [string, string]; rough: number; metal: number;
  /** 幕板の帯 [青, 橙]（車種で高さが違う） */
  top: [V2, V2];
  crewOff: number; crewW: number;
  /** 前面: 窓の上下、前面の地色、車番 */
  fwin: V2; face: string; num: string;
}
const ROOF = (hw: number, ytop: number): V2[] => [[hw, ytop - .42], [hw - .05, ytop - .26], [hw - .3, ytop - .13], [hw - .75, ytop - .04], [0, ytop]];
const SPEC: Record<NewLiveryModel, Spec> = {
  '1000': {
    // 連結部を真横から見た輪郭に合わせ、腰部を垂直に保ち、上半分を緩く傾ける。
    // 左右端の後退は小さくして、中央の貫通扉より側窓がわずかに湾曲する形を保つ。
    hw: 1.45, ytop: 3.84, half: [[1.39, Y0], [1.45, 1.5], [1.45, (Y0 + 3.84) / 2], ...ROOF(1.45, 3.84)], slant: { depth: .22, bow: .10, hw: 1.45, ytop: 3.84 }, r: .2,
    doors: [-7.2, -2.4, 2.4, 7.2], doorW: 1.3, win: [2.08, 2.90], roofY: 3.7,
    base: ['#eef0ef', '#d3d5d6'], rough: .39, metal: .16, top: [L7100.topBand, L7100.topLine],
    crewOff: .86, crewW: .60, fwin: [1.94, 3.58], face: '#e9ebec', num: '1510',
  },
  '2000': {
    hw: 1.4, ytop: 3.8, half: [[1.34, Y0], [1.4, 1.48], [1.4, (Y0 + 3.8) / 2], ...ROOF(1.4, 3.8)], slant: { depth: .055, bow: .14, hw: 1.4, ytop: 3.8 }, r: .18,
    doors: [-4.3, 4.3], doorW: 1.3, win: [2.0, 2.92], roofY: 3.4,
    base: ['#d8dce0', '#b5bbc2'], rough: .36, metal: .78, top: [[3.18, 3.34], [3.05, 3.14]],
    // 写真で確認した代表編成は2039編成（モハ2039）。
    crewOff: .58, crewW: .6, fwin: [1.97, 3.54], face: '#cdd1d6', num: '2039',
  },
};

/** 側面（head = 前端 -Z に乗務員扉）。open = 客用扉を開けた状態 */
export function paintNewLiverySide(m: NewLiveryModel, Lb: number, head: boolean, open = false): SheetMaps {
  if (m === '2000') return paint2039Side(Lb, head, open);
  const S = SPEC[m], s = sideSheet(Lb, S.ytop), hz = Lb / 2, [w0, w1] = S.win;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, S.base[0]); grd.addColorStop(1, S.base[1]);
  s.base(grd, S.rough, S.metal);
  s.rect(-hz - 1, hz + 1, S.roofY, S.ytop + .1, '#a3a8ae', .6, .45);
  const D = S.doors;
  const doorColor = '#e3e5e4', crew = -hz + S.crewOff;
  const band = (b: V2, color: string, start = -hz - 1) => s.rect(start, hz + 1, ...b, color, .35, .1);
  if (head) {
    paintDoor(s, crew, S.crewW, 3.05, S.win, doorColor, false, false, S.metal);
    // 1002号の真横写真では、帯が乗務員扉の下半分を通って幕板へ上がる。
    const turn = -hz + .70;
    const [orangeBottom, orangeTop] = L7100.frontLine;
    s.poly([[-hz - .1, orangeBottom], [turn + .18, orangeBottom], [turn + 1.34, S.top[1][0]],
      [hz, S.top[1][0]], [hz, S.top[1][1]], [turn + 1.29, S.top[1][1]],
      [turn + .11, orangeTop], [-hz - .1, orangeTop]], L7100.orange, .35, .1);
    sweepBand(s, Lb, L7100.frontBand, S.top[0], turn, .64, L7100.blue, .35, .1, -.08);
    s.cabGlass(crew - .15, crew + .15, 2.10, 2.87, '#929797', .025, ['#74868a','#4a5e63']);
  } else {
    band(S.top[0], L7100.blue); band(S.top[1], L7100.orange);
  }
  const start = head ? -hz + Lb * .240 : -hz;
  const waistBlue: V2 = [1.51, 1.57], waistOrange: V2 = [1.44, 1.505];
  band(waistBlue, L7100.blue, start); band(waistOrange, L7100.orange, start);
  for (const d of D) {
    paintDoor(s, d, S.doorW, 3.05, S.win, doorColor, open, true, S.metal);
    if (!open && d > start) {
      for (const edge of [-1, 1]) {
        const a = d + edge * .012, b = d + edge * (S.doorW / 2 - .012);
        s.rect(a, b, ...waistBlue, L7100.blue, .35, .1);
        s.rect(a, b, ...waistOrange, L7100.orange, .35, .1);
      }
    }
  }
  const window = (center: number, width: number, divided: boolean) => {
    const a = center - width / 2, b = center + width / 2;
    s.rect(a - .04, b + .04, w0 - .04, w1 + .04, '#949b9b', .34, .5, .065);
    s.glass(a, b, w0, w1, '', .045, ['#829294', '#405353']);
    if (divided) s.rect(center - .028, center + .028, w0, w1, '#a6aba8', .34, .6);
  };
  const dw = S.doorW / 2;
  for (let i = 1; i < D.length; i++) window((D[i - 1] + D[i]) / 2, 1.82, true);
  window((D[3] + dw + hz) / 2, .86, false);
  if (!head) window((-hz + D[0] - dw) / 2, .86, false);
  s.rect(D[1] - .9, D[1] - .55, 3.28, 3.38, '#22272d'); // 号車札（文字なし）
  return s.textures();
}

/** 前面シート（正面から見て左 = +X）。1000系・2000系共通: 銀色の地に左右の大きな窓（黒い枠）、中央に銀色の貫通扉。
 *  窓の下の青帯に灯具（外側 = 標識灯、内側 = 前照灯）、その下に橙の細帯 */
export function paintNewLiveryFace(m: NewLiveryModel, carNumber = SPEC[m].num): SheetMaps {
  const S = SPEC[m], s = faceSheet(S.hw, S.ytop), hw = S.hw, L = L7100, [f0, f1] = S.fwin, xo = hw - S.r - .01;
  s.base(S.face, S.rough, S.metal);
  // 実効幅は端部の丸み（r）を除いた ±xo。窓は貫通扉の両側を大きく取る
  const frontBand = m === '2000' ? FRONT_2039_BLUE : L.frontBand;
  const frontLine = m === '2000' ? FRONT_2039_ORANGE : L.frontLine;
  for (const sx of [-1, 1]) {
    // 1000系は後退した前頭部に二重の黒ゴム／銀サッシを持つ。
    s.rect(sx * .48, sx * xo, f0 - .13, f1 + .08, '#555e65', .12, .25, .04);
    s.rect(sx * .54, sx * (xo - .05), f0 - .05, f1 + .01, '#15191d', .14, .3, .05);
    s.cabGlass(sx * .55, sx * (xo - .05), f0, f1 - .02, '', .04, ['#2e3a46', '#10151b']);
    s.rect(sx * .55, sx * (xo - .05), f1 - .30, f1 - .026, '#222c33', .16, .19, .025);
  }
  s.rect(-hw, hw, ...frontBand, L.blue, .35, .1);
  s.rect(-hw, hw, ...frontLine, L.orange, .35, .1);
  // 貫通扉（銀色の枠・扉。窓は縦長、帯は扉にも通す）
  const doorTop = m === '1000' ? 3.34 : f1 + .08;
  s.rect(-.45, .45, 1.22, doorTop, '#a9aeb4', .45, .3, .04);
  s.rect(-.38, .38, 1.27, doorTop - .065, '#d0d4d9', .4, .2, .03);
  s.rect(-.31, .31, 1.31, doorTop - .11, m === '1000' ? '#c3c6c7' : '#afb6ba', .12, .25, .04);
  s.rect(-.38, .38, ...frontBand, L.blue, .35, .1);
  s.rect(-.38, .38, ...frontLine, L.orange, .35, .1);
  s.cabGlass(-.25, .25, m === '1000' ? 1.78 : 1.93, m === '1000' ? 3.15 : f1 - .16,
    '#3d434a', .03, ['#24303a', '#0f1418']);
  // 灯具の黒いケース（青帯の中、左右）
  const lc = (hw - .2 + .5) / 2; // 灯具の中心（貫通扉と車体の角の間）
  if (m === '1000') for (const sx of [-1, 1]) s.rect(sx * lc - .3, sx * lc + .3, 1.48, 1.70, '#0e1012', .2, .3, .04);
  for (const side of [-1, 1]) windowSill(s, side * (m === '1000' ? .63 : .69), m === '1000' ? 1.835 : f0 - .10);
  if (m === '2000') {
    // 2039号の前照灯は青帯の下縁をまたぎ、幅広い銀色の灯箱に収まる。
    for (const side of [-1, 1]) {
      const x = side * lc;
      s.rect(x - .325, x + .325, 1.30, 1.57, '#e4e5e1', .32, .5, .025);
      s.rect(x - .285, x + .285, 1.332, 1.537, '#686f72', .35, .55, .018);
    }
  }
  s.text(carNumber, m === '1000' ? -.98 : -lc, m === '2000' ? 1.76 : 1.81, .11, '#f4f6fa', 700);
  s.emit(-hw, hw, Y0, S.ytop + .1, '#000'); // 夜は運転台の窓を光らせない
  return s.textures();
}

/** 1両分のジオメトリ */
export function buildNewLiveryCar(m: NewLiveryModel, kind: CarKind, Lb: number, panZ: readonly number[]): CarParts {
  const S = SPEC[m], hz = Lb / 2, head = kind === 'head', zf = -hz, sl = S.slant, roofTop = S.ytop;
  const nose = [...roundRings(zf, S.r, 1), { z: zf + sl.depth + sl.bow + .12, inset: 0 }];
  const rings: Ring[] = [...(head ? nose : [{ z: -hz, inset: 0 }]), { z: hz, inset: 0 }];
  const shell = shellGeo(S.half, rings, S.ytop, Lb);
  if (head) applySlant(shell, zf, sl);
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), mkL = new GeoBatch(), mkR = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) add(sx * (S.hw - .03), S.roofY + .02, head ? 1 : 0, .04, .04, Lb - (head ? 2 : 0), 0x8d939a); // 雨樋
  addEndWall(b, hz, S.ytop - .19, S.hw, 0xb9bec4);
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined, led2: THREE.BufferGeometry | undefined, marks: CarParts['marks'];
  if (head) {
    face = curvedCab(S.half, S.r, S.ytop, S.hw, (x, y) => zf + slantZ(sl, x, y));
    const zAt = (x: number, y: number) => zf + slantZ(sl, x, y) - .006;
    // 貫通扉の枠・渡り板・手すり
    for (const sx of [-1, 1]) add(sx * .45, 1.9, zAt(sx * .45, 1.9) - .02, .05, 1.5, .05, 0xa6acb2);
    add(0, 1.2, zAt(0, 1.2) - .1, .84, .05, .22, 0x9da3aa);
    // 前照灯（内側）と標識灯（外側）: 窓の下の青帯の中に一体の灯具
    // 実車の青帯下寄りに合わせ、前照灯・標識灯・光源を少し下げる。
    const lc = (S.hw - .2 + .5) / 2, ly = m === '2000' ? 1.43 : 1.59, lx = lc - .12, mx = lc + .13;
    for (const sx of [-1, 1]) {
      const zl = zAt(sx * lc, ly);
      add(sx * lx, ly, zl - .012, .213, .15, .018, 0xb9bfc0);
      b.add('paint', P.cyl, M(sx * lx, ly, zl - .030, 0, .144, .018, .144, Math.PI / 2), 0x646c6e);
      lit.add('l', P.cyl, M(sx * lx, ly, zl - .043, 0, .108, .014, .108, Math.PI / 2), 0xffffff);
      glows.push(new THREE.Vector3(sx * lx, ly, zl - .2));
      add(sx * mx, ly, zl - .012, .204, .15, .018, 0x797c79);
      (sx > 0 ? mkL : mkR).add('l', P.box, M(sx * mx, ly, zl - .02, 0, .17, .12, .02), 0xffffff);
    }
    marks = { l: mkL.geometry('l')!, r: mkR.geometry('l')! };
    // 行先 LED: 左右の窓の内側上部（左 = 種別、右 = 行先）
    const lw = S.hw - S.r - .55, lxc = .55 + lw / 2 + .02, lyc = S.fwin[1] - .16;
    led = slantLed(sl, zf, [[lxc, lyc, lw - .08]], .15, .006); led2 = slantLed(sl, zf, [[-lxc, lyc, lw - .08]], .15, .006);
    // スカート・連結器・ホース
    add7100Skirt(b, zf + .18, 0x8d949a);
    // ワイパー（傾いた窓の下端）
    for (const sx of [-1, 1]) add(sx * .84, S.fwin[0] + .17, zAt(sx * .84, S.fwin[0] + .17) - .035, .024, .54, .023, 0x292c2c,
      Math.atan(slantSlope(sl, S.fwin[0] + .17)), 0, sx * .40);
    // 屋根上の無線アンテナ
    add(0, roofTop + .04, zf + 1.3, .7, .05, .3, 0x6f747a);
  } else addEndWall(b, -hz, S.ytop - .19, S.hw, 0xb9bec4);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b, equipmentDetail: true, frontCut: head ? .65 : 0 });
  if (m === '1000') {
    // 低く長い冷房カバーを屋根中央に3基。前後端は斜めに下がる。
    for (const z of [-3.8, 0, 3.8]) {
      if (panZ.some(p => Math.abs(z - p) < 2.0)) continue;
      add(0, roofTop + .035, z, 1.7, .05, 3.7, 0xb5bac0);
      add(0, roofTop + .125, z, 1.7, .18, 3.1, 0xb5bac0);
      add(0, roofTop + .225, z, 1.7, .02, 3.1, 0xc4c8cc);
      for (const end of [-1, 1]) add(0, roofTop + .145, z + end * 1.69, 1.7, .035, .36, 0xc4c8cc, end * .5);
      for (const side of [-1, 1]) for (const dz of [-.8, .8]) {
        add(side * .855, roofTop + .13, z + dz, .018, .1, .72, 0x565d64);
        for (const dy of [-.025, 0, .025]) add(side * .866, roofTop + .13 + dy, z + dz, .01, .008, .72, 0x9fa5ab);
      }
    }
  } else {
    // 2039号の冷房カバーは車体長の約半分を占め、両端の斜面が屋根へ下がる。
    const span = Lb * .50, center = Lb * .002, height = .43;
    add(0, roofTop + height / 2, center, 1.62, height, span - .42, 0xc8c7bf);
    for (const end of [-1, 1]) {
      add(0, roofTop + height / 2, center + end * (span / 2 - .13), 1.62, .065, .51, 0xc8c7bf, end * .99);
    }
    for (const side of [-1, 1]) for (const f of [-.43, -.27, -.214, -.135, .024, .082, .209, .264, .431]) {
      const z = center + f * span;
      add(side * .815, roofTop + .19, z, .018, .16, .36, 0x43474b);
      for (const dy of [-.043, .015]) add(side * .828, roofTop + .19 + dy, z, .009, .012, .34, 0x727677);
    }
  }
  add(0, roofTop + .03, 0, .45, .06, Lb - 3, 0x868b91);
  // パンタ位置は編成データから受け取り、車種ごとの配置を呼び出し側で管理する。
  for (const p of panZ) addCrossArm(b, p, roofTop - .02);
  return { shell, face, paint: b.geometry('paint')!, led, led2, head: lit.geometry('l') ?? undefined, marks, glows };
}
