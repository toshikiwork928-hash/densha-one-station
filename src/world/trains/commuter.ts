import { windowSill } from './cab-glazing';
// 通勤形 20m 級4扉（架空塗装の青帯＋橙線）
//  new: ステンレス車体・黒い前面・中央貫通扉・角ばったスカート・シングルアーム
//  old: 7100系。銀灰色の鋼製車体、屋根上の2灯前照灯、分散冷房、下枠交差形パンタグラフ
//  6300系（ss = true）はステンレスの外板と菱形パンタグラフを使う。
import * as THREE from 'three';
import { BLUE_7100, FRONT_BLUE_7100, FRONT_ORANGE_7100, ORANGE_7100, paint7100Side } from './c7100-side';
import { add7100Skirt, addWrapSkirt } from './c7100-skirt';
import { SECTION_7100, paint7100Cab, add7100Gangway, add7100HeadlightShell, curve7100Shell, curve7100Z } from './c7100-cab';
import { GeoBatch, M, P } from '../batch';
import {
  Y0, adder, addCrossArm, addEndWall, addSingleArm, addUnderfloor, capGeo, curvedCab, faceSheet, roundRings, shellGeo, sideSheet, sweepBand,
  type CarKind, type CarParts, type Ring, type SheetMaps, type V2,
} from './common';

export type CommuterVariant = 'new' | 'old';

export const HW = 1.45;
export const YTOP = 3.84;
const ROOF: V2[] = [[HW, 3.42], [HW - .05, 3.58], [HW - .3, 3.71], [HW - .75, 3.8], [0, YTOP]];
/** 断面: new = すそ絞り、old = 直線車体（鋼製） */
const HALFS: Record<CommuterVariant, V2[]> = { new: [[HW - .06, Y0], [HW, 1.5], ...ROOF], old: [[HW, Y0], ...ROOF] };
const DOORS = [-7.2, -2.4, 2.4, 7.2], DOOR_W = 1.3;
/** 先頭車: 前端から乗務員扉の中心まで・扉幅・客用扉1の後ろへのずらし量 */
const CREW_OFF = .55, CREW_W = .64, HEAD_SHIFT = .4;
const BLUE = '#2f3fa8', ORANGE = '#f0961c';

interface Look {
  r: number; base: [string, string]; roof: string; rough: number; metal: number;
  topBand: V2; topLine: V2; lowBand: V2; lowLine: V2; frontBand: V2; frontLine: V2;
  win: V2; door: string; roofY: number;
}
const LOOK: Record<CommuterVariant, Look> = {
  new: {
    r: .24, base: ['#d3d7dc', '#b4bac1'], roof: '#a7acb2', rough: .38, metal: .75,
    topBand: [3.34, 3.48], topLine: [3.24, 3.33], lowBand: [1.66, 1.77], lowLine: [1.54, 1.64],
    frontBand: [1.58, 2.0], frontLine: [1.48, 1.55], win: [2.04, 2.93], door: '#c4c9cf', roofY: 3.55, // 側窓は実車の横長二枚窓。客用扉だけ縦長窓にする
  },
  old: {
    r: .3, base: ['#c6cbd6', '#b3b9c6'], roof: '#9fa4aa', rough: .42, metal: .12,
    topBand: [3.4, 3.65], topLine: [3.26, 3.37], lowBand: [1.44, 1.53], lowLine: [1.34, 1.43],
    frontBand: [1.6, 2.02], frontLine: [1.49, 1.56], win: [2.0, 2.93], door: '#c9ccd1', roofY: 3.7, // ドアは車体と同系色の塗装。上の帯は太い青＋細い橙。窓の上下端は客用扉の窓と揃える
  },
};

/** 6300系（old の形・ステンレス無塗装）の外板。帯・窓は old のまま */
const stainless = (L: Look): Look => ({ ...L, base: ['#d8dce0', '#b5bbc2'], roof: '#a3a8ae', rough: .36, metal: .78, door: '#c8cdd3',
  frontBand: FRONT_BLUE_7100, frontLine: FRONT_ORANGE_7100,
  // 6300系の側面写真に合わせ、青帯を太く、橙帯を細くして幕板を少し下げる。
  topBand: [3.29, 3.50], topLine: [3.16, 3.23], lowBand: [1.55, 1.615], lowLine: [1.455, 1.525],
});
const lookOf = (v: CommuterVariant, ss: boolean): Look => ss ? stainless(LOOK[v]) : LOOK[v];

/** 側面（head = 先頭車。前端 = -Z 側に乗務員扉と帯の立ち上がり） */
/** open = 客用ドアを開けた状態（開口部は暗い車内、夜は点灯）。ss = ステンレス無塗装（6300系） */
export function paintCommuterSide(v: CommuterVariant, Lb: number, head: boolean, open = false, ss = false): SheetMaps {
  if (v === 'old' && !ss) return paint7100Side(Lb, YTOP, head, open);
  const L = lookOf(v, ss), s = sideSheet(Lb, YTOP), hz = Lb / 2;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, L.base[0]); grd.addColorStop(1, L.base[1]);
  s.base(grd, L.rough, L.metal);
  s.rect(-hz - 1, hz + 1, L.roofY, YTOP + .1, L.roof, .6, L.metal * .6);
  if (ss) {
    // 6300系: 腰板（窓の下）と幕板（窓の上）のコルゲート（横方向の細い波板）。帯・扉・窓はこの上に描く
    const rib = (y0: number, y1: number) => {
      for (let y = y0; y < y1; y += .055) {
        s.rect(-hz, hz, y, y + .018, 'rgba(255,255,255,.22)');
        s.rect(-hz, hz, y + .018, y + .03, 'rgba(0,0,0,.1)');
      }
    };
    rib(Y0 + .08, L.win[0] - .08); rib(L.win[1] + .1, L.roofY - .04);
  }
  const band = (b: V2, col: string, z0 = -hz - 1) => s.rect(z0, hz + 1, b[0], b[1], col, .35, .1);
  const blue = ss ? BLUE_7100 : BLUE, orange = ss ? ORANGE_7100 : ORANGE;
  // 先頭車: 乗務員扉（幅0.64m）→ 窓（約1.1m）→ 客用扉。1つ目の客用扉は中間車より後ろ（+0.35m）へずらして窓の幅を取る
  const crewZ = -hz + CREW_OFF;
  const doors = head ? [DOORS[0] + HEAD_SHIFT, ...DOORS.slice(1)] : DOORS;
  if (head) {
    const zs = crewZ + CREW_W / 2 + .06, k = .62;
    sweepBand(s, Lb, L.frontLine, L.topLine, zs + .12, k, orange, ss ? .38 : .35, ss ? .12 : .1);
    sweepBand(s, Lb, L.frontBand, L.topBand, zs, k, blue, ss ? .38 : .35, ss ? .12 : .1, -.12);
  } else { band(L.topBand, blue); band(L.topLine, orange); }
  // 先頭車は社名の後ろから、中間車は車端から腰帯を引く。
  const lowStart = head ? (ss ? -.245 : -.278) * Lb + .53 : -hz;
  for (const [stripe, color] of [[L.lowBand, blue], [L.lowLine, orange]] as const) {
    band(stripe, color, lowStart);
  }
  // 8310号の真横写真では、客用扉の細い窓と戸間の二枚窓は上下端がほぼ揃う。
  const [w0, w1] = L.win;
  const sq = (w1 - w0) / 2; // sq = old の正方形窓の半幅
  const door = (zc: number, w: number, dbl: boolean) => {
    s.rect(zc - w / 2 - .03, zc + w / 2 + .03, 1.13, 3.08, v === 'old' ? '#a9adb3' : '#8b9198', .5, .3);
    if (open && dbl) {
      // 開口: 戸袋へ引き込まれた扉の縁だけを残し、車内（床・つり革・天井の灯り）を暗く描く
      s.glass(zc - w / 2, zc + w / 2, 1.16, 3.05, '', .0, ['#4a463e', '#23262b']);
      s.rect(zc - w / 2, zc + w / 2, 1.16, 1.3, '#5b5f66', .6, .1);
      s.rect(zc - w / 2, zc + w / 2, 2.98, 3.05, '#d9d6c8', .5, 0);
      for (const sg of [-1, 1]) s.rect(zc + sg * (w / 2 - .06) - .06, zc + sg * (w / 2 - .06) + .06, 1.16, 3.05, L.door, v === 'old' ? L.rough : .4, v === 'old' ? L.metal : .7);
      // 夜の発光: 天井の灯りが明るく、床へ向かって暗くなる車内。床・引き込まれた扉の縁は光らない
      s.emit(zc - w / 2, zc + w / 2, 1.16, 3.05, s.emitGrad(1.3, 3.05, '#ffffff', '#6a5e48'));
      s.emit(zc - w / 2, zc + w / 2, 1.16, 1.3, '#000');
      for (const sg of [-1, 1]) s.emit(zc + sg * (w / 2 - .06) - .06, zc + sg * (w / 2 - .06) + .06, 1.16, 3.05, '#000');
      return;
    }
    s.rect(zc - w / 2, zc + w / 2, 1.16, 3.05, L.door, v === 'old' ? L.rough : .4, v === 'old' ? L.metal : .7);
    if (dbl) {
      s.rect(zc - .012, zc + .012, 1.16, 3.05, '#5e646b');
      for (const sg of [-1, 1]) {
        const x = zc + sg * w / 4;
        if (v === 'new') s.cabGlass(x - .175, x + .175, w0, w1, '#858b8b', .085, ['#758b87','#4a605e']);
        else s.glass(x - .22, x + .22, w0, w1, '#5a6067', .06);
      }
    } else if (v === 'new') s.cabGlass(zc - .14, zc + .14, w0 + .12, w1, '#858b8b', .045, ['#758b87','#4a605e']);
    else s.glass(zc - .2, zc + .2, w0, w1, '#5a6067', .03);
  };
  for (const d of doors) door(d, DOOR_W, true);
  // 側窓
  for (let i = 0; i < doors.length - 1; i++) {
    const zc = (doors[i] + doors[i + 1]) / 2;
    if (v === 'new') {
      s.cabGlass(zc - .90, zc + .90, w0, w1, '#848c8b', .12, ['#758b87','#4a605e']);
      s.rect(zc - .023, zc + .023, w0, w1, '#b8beb9', .4, .5);
    } else if (ss) {
      // 6301号の戸間には、銀のサッシを持つ独立した窓が2枚並ぶ。
      for (const offset of [-.51, .51]) s.glass(zc + offset - .45, zc + offset + .45, w0, w1, '#848b8d', .055);
    } else for (const dz of [-.53, .53]) s.glass(zc + dz - sq, zc + dz + sq, w0, w1, '#565c63', .07); // 正方形の1段下降窓を2枚ずつ（間に約13cmの窓柱）
  }
  if (v === 'new') {
    const zc = (DOORS[3] + DOOR_W / 2 + .35 + hz - .4) / 2;
    s.cabGlass(zc - sq, zc + sq, w0, w1, '#848c8b', .12, ['#758b87','#4a605e']);
  }
  else if (head) s.glass((DOORS[3] + DOOR_W / 2 + hz) / 2 - sq, (DOORS[3] + DOOR_W / 2 + hz) / 2 + sq, w0, w1, '#565c63', .03);
  else {
    // 7100系の中間車: 後ろ（+Z）の車端は窓が2枚（先頭車の乗務員扉の位置も窓になったような並び）。幅を少し細くして収める
    const z0 = DOORS[3] + DOOR_W / 2, ww = .8, gap = .1, zc = (z0 + hz) / 2;
    for (const sg of [-1, 1]) { const c = zc + sg * (ww + gap) / 2; s.glass(c - ww / 2, c + ww / 2, w0, w1, '#565c63', .03); }
  }
  if (head) {
    door(crewZ, CREW_W, false);
    if (ss) {
      s.rect(crewZ - CREW_W / 2, crewZ + CREW_W / 2, ...L.frontBand, blue, .38, .12);
      s.rect(crewZ - CREW_W / 2, crewZ + CREW_W / 2, ...L.frontLine, orange, .38, .12);
      for (let y = L.frontBand[0]; y < L.frontBand[1] - .03; y += .067) {
        s.rect(-hz, crewZ - CREW_W / 2 - .03, y, y + .022, 'rgba(20,22,40,.25)');
      }
    }
    // 乗務員扉と客用扉の間の窓: 7100系にはあり、8300系は窓の無い壁（帯の立ち上がりだけ）
    // 7100系の窓は他の側窓と同じ正方形（乗務員扉と客用扉の間の中央）
    if (v === 'old') {
      const zc = (crewZ + CREW_W / 2 + doors[0] - DOOR_W / 2) / 2;
      s.glass(zc - sq, zc + sq, w0, w1, '#565c63', .07);
    }
  } else if (v === 'new') {
    const zc = (-hz + .4 + DOORS[0] - DOOR_W / 2 - .35) / 2;
    s.cabGlass(zc - sq, zc + sq, w0, w1, '#848c8b', .12, ['#758b87','#4a605e']);
  }
  else s.glass((DOORS[0] - DOOR_W / 2 - hz) / 2 - sq, (DOORS[0] - DOOR_W / 2 - hz) / 2 + sq, w0, w1, '#565c63', .03);
  // 号車札・小表示（文字なし）
  s.rect(DOORS[1] + .9, DOORS[1] + 1.2, 3.46, 3.53, '#2b3138');
  if (ss) {
    // 外板継ぎ目（コルゲートは地塗りの直後に描いた）
    for (let z = -hz + 1.6; z < hz; z += 2.9) s.rect(z, z + .015, Y0, L.roofY, 'rgba(0,0,0,.05)');
  } else if (v === 'old') for (let z = -hz + .2; z < hz; z += 2.1) s.rect(z, z + .02, Y0, 3.55, 'rgba(0,0,0,.06)'); // 外板継ぎ目
  return s.textures();
}

/** 前面シート（ss = ステンレス無塗装の 6300系） */
export function paintCommuterFace(v: CommuterVariant, ss = false): SheetMaps {
  if (v === 'old') return paint7100Cab(HW, YTOP, false, ss ? '6301' : '7157', ss);
  const L = lookOf(v, ss), s = faceSheet(HW, YTOP);
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, L.base[0]); grd.addColorStop(1, L.base[1]);
  s.base(grd, L.rough, L.metal);
  if (v === 'new') {
    s.base('#e2e5e5', .34, .40);
    for (const sx of [-1, 1]) {
      const l = sx < 0 ? -1.25 : .51, r = sx < 0 ? -.51 : 1.25;
      s.rect(l - .012, r + .012, 1.58, 3.63, '#22282d', .30, .18, .035);
      s.cabGlass(l + .019, r - .019, 2.21, 3.18, '', .025, ['#536568', '#273739']);
      s.rect(l, r, 3.22, 3.59, '#1e262d', .12, .18, .035);
      s.rect(l, r, ...L.frontBand, BLUE, .35, .15);
      s.poly([[l, L.frontBand[0]], [r, L.frontBand[0]], [r, L.frontLine[0]], [l, L.frontLine[0]]], ORANGE, .35, .1);
      windowSill(s, .78 * sx, 2.05);
    }
    s.rect(-.47, .47, 1.18, 3.37, '#e7e8e6', .39, .22, .06);
    s.cabGlass(-.28, .28, 2.12, 3.01, '#b4b9b9', .025);
    s.text('8360', -.92, 1.92, .12, '#edf0ec', 700);
    // 上部の前照灯箱まわり
    s.rect(-.42, .42, 3.47, 3.72, '#0d0f11', .2, .2);
    s.rect(-.30, .30, 3.51, 3.64, '#252b31', .1, .2);
  }
  return s.textures();
}

/** 1両分のジオメトリ */
export function buildCommuterCar(v: CommuterVariant, kind: CarKind, Lb: number, ss: boolean, panZ: readonly number[]): CarParts {
  const cross7100 = v === 'old' && !ss;
  // 6300系も7100系と同じく、前面の肩を中央扉から後退させた曲面形状を持つ。
  // 外板の材質・屋上機器・スカートは ss 側の実車差分をそのまま残す。
  const curvedOld = v === 'old';
  const radius = curvedOld ? .20 : .13;
  const HALF = curvedOld ? SECTION_7100 : HALFS[v], hz = Lb / 2, head = kind === 'head', zf = -hz;
  const rings: Ring[] = [...(head ? roundRings(zf, radius, 1) : [{ z: -hz, inset: 0 }]), { z: hz, inset: 0 }];
  const shell0 = shellGeo(HALF, rings, YTOP, Lb);
  const shell = curvedOld && head ? curve7100Shell(shell0, zf) : shell0;
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), tl = new GeoBatch(), gl = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  const roofTop = YTOP;
  // 雨樋
  // 8300系は雨樋を屋根に内蔵したビードレス車体。7100系だけ従来の外付け雨樋を残す。
  if (v !== 'new') for (const sx of [-1, 1]) add(sx * (HW - .03), cross7100 ? 3.45 : 3.56, 0, .04, .04, Lb - (head ? .6 : 0), 0x8d939a, 0, 0, 0);
  addEndWall(b, hz, YTOP, HW, v === 'new' ? 0xb9bec4 : 0xbfc3c9);
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined, led2: THREE.BufferGeometry | undefined;
  let marks: CarParts['marks'];
  const mkL = new GeoBatch(), mkR = new GeoBatch();
  if (head) {
    face = curvedOld ? curvedCab(HALF, radius, YTOP, HW, (x, y) => curve7100Z(x, y, zf))
      : capGeo(HALF, { z: zf, inset: radius }, YTOP, HW, -1);
    const z = zf - .005;
    if (v === 'new') {
      // 貫通扉の枠（銀の張り出し）
      add7100Gangway(b, zf);
      add(0, 1.21, z - .1, .9, .05, .22, 0x9da3aa); // 渡り板
      // 前照灯（上部中央の LED）と標識灯（帯の中）
      for (const sx of [-1, 1]) {
        lit.add('l', P.box, M(sx * .2, 3.6, z - .012, 0, .26, .1, .02), 0xffffff);
        glows.push(new THREE.Vector3(sx * .2, 3.6, z - .2));
        add(sx * 1.02, 1.79, z - .006, .42, .16, .02, 0x0e1012);
        lit.add('l', P.box, M(sx * 1.02, 1.79, z - .018, 0, .32, .09, .02), 0xffb040);
        tl.add('l', P.box, M(sx * 1.02, 1.79, z - .026, 0, .32, .09, .02), 0xffffff);
      }
      // 行先 LED（左右の黒い部分の上）
      // 左（正面から見て +X 側）= 種別、右 = 行先
      led = mergeLed([[.90, 3.42, .52]], zf - .003, .17);
      led2 = mergeLed([[-.90, 3.42, .52]], zf - .003, .17);
      // スカート（角ばった銀灰色）と連結器
      addWrapSkirt(b, zf, HW - .06, radius, 0xc7cbce);

      // ワイパー
      for (const sx of [-1, 1]) add(sx * .83, 2.33, z - .04, .025, .53, .025, 0x202529, 0, 0, -sx * .50);
    } else {
      add7100Gangway(b, curve7100Z(0, 2.27, zf));
      add(0, 1.2, z - .12, .9, .05, .24, 0x8f959b);
      // 前照灯: 前面最上部の中央。屋根の縁の上に、丸い2灯が横に並ぶ灯具
      // 6300系も7100系と同じ中央2灯の丸い前照灯箱を使う。
      add7100HeadlightShell(b, curve7100Z(0, 3.62, zf));
      for (const sx of [-1, 1]) {
        const lz = curvedOld ? curve7100Z(sx * .2, 3.62, zf) : zf - .025;
        b.add('paint', P.cyl, M(sx * .2, 3.62, lz - .08, 0, .22, .03, .22, Math.PI / 2), 0xdadde1);
        lit.add('l', P.cyl, M(sx * .2, 3.62, lz - .1, 0, .17, .02, .17, Math.PI / 2), 0xffffff);
        glows.push(new THREE.Vector3(sx * .2, 3.62, lz - .25));
      }
      // 標識灯（列車識別灯）: 下部の左右端に小さな四角い灯具。点灯は makeCar（普通 = 左のみ / 優等 = 両方 / 後尾 = 赤）
      const mk: [GeoBatch, number][] = [[mkL, 1], [mkR, -1]];
      for (const [bt, sx] of mk) {
        const scale = .70;
        const mz = curve7100Z(sx * .98, 1.28, zf);
        add(sx * .98, 1.28, mz - .04, .3 * scale, .24 * scale, .06, 0x15171a);
        add(sx * .98, 1.28, mz - .075, .33 * scale, .02 * scale, .02, 0x8f959b);
        bt.add('l', P.box, M(sx * .98, 1.28, mz - .075, 0, .2 * scale, .16 * scale, .02), 0xffffff);
      }
      marks = { l: mkL.geometry('l')!, r: mkR.geometry('l')! };
      // 行先表示器（左窓の上）: 枠・庇・奥行きを付けて1面に種別 + 行先
      led = mergeLed([[0, 0, .59]], 0, .155).rotateY(-Math.atan(.30 * (.85 - .46)))
        .translate(.85, 3.15, curve7100Z(.85, 3.15, zf) - .015);
      add7100Skirt(b, ss ? zf + .09 : zf);
      for (const sx of [-1, 1]) {
        if (ss) add(sx * .93, 2.5, z - .03, .5, .025, .025, 0x111111, 0, 0, sx * .5);
        else {
          add(sx * .81, 2.27, curve7100Z(sx * .81, 2.27, zf) - .035, .35, .022, .025, 0x72787b, 0, 0, sx * 1.03);
          add(sx * .90, 2.42, curve7100Z(sx * .90, 2.42, zf) - .05, .46, .019, .025, 0x262d31, 0, 0, sx * 1.20);
        }
      }
    }
  } else addEndWall(b, -hz, YTOP, HW, v === 'new' ? 0xb9bec4 : 0xbfc3c9);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b, equipmentDetail: !cross7100, frontCut: head && !cross7100 ? .65 : 0 });
  // 屋根上: 冷房装置
  if (v === 'new') {
    // セミ集中式の冷房装置（2基）と独立した車外スピーカー
    for (const z of [-4.2, 4.2]) {
      if (panZ.some(p => Math.abs(p - z) < 2.25)) continue;
      add(0, roofTop + .12, z, 1.8, .24, 2.7, 0xb5bac0);
      add(0, roofTop + .25, z, 1.4, .03, 2.2, 0x9fa5ab);
      for (const dz of [-.7, 0, .7]) add(0, roofTop + .27, z + dz, 1.0, .02, .4, 0x6a7076);
    }
    add(0, roofTop + .08, 0, .5, .16, .9, 0x9da2a8);
    add(0, roofTop + .03, 0, .5, .06, Lb - 2, 0x868b91);
  } else {
    // モハ7189ではパンタグラフの前後に間隔を取って冷房装置を並べる。
    const coolers = cross7100 && head ? [-8.2, -4.65, -2.99, -.75, 1.5, 3.76, 6.02, 8.28] : [-8.4, -6, -3.6, -1.2, 1.2, 3.6, 6, 8.4];
    for (const z of coolers) {
      if (panZ.some(p => Math.abs(z - p) < 1.6)) continue;
      if (head && !cross7100 && z < -8) continue;
      add(0, roofTop + .15, z, 1.3, .32, 1.3, cross7100 ? 0xa2a5a7 : 0xc0c4c9);
      if (cross7100) {
        add(0, roofTop + .305, z, 1.34, .055, 1.34, 0xb3b5b4);
        add(0, roofTop + .335, z, .82, .014, .79, 0x909597);
      }
      for (const sx of [-1, 1]) for (const dz of [-.33, .33]) {
        add(sx * .66, roofTop + .16, z + dz, .02, .18, .44, 0x3a3f45);
        if (cross7100) for (const y of [.13, .19]) add(sx * .676, roofTop + y, z + dz, .014, .022, .44, 0x84898a);
      }
    }
    for (const sx of [-.85, .85]) add(sx, roofTop - .05, 0, .06, .06, Lb - 1, 0x8a8f95); // 配管
    for (const z of [-8.2, -4, 0, 4, 8.2]) add(0, roofTop + .06, z, .3, .1, .3, 0x8a8f95); // 通風器
    if (kind === 'head') add(0, roofTop + .05, zf + .9, .5, .06, .5, 0x8a8f95);
    if (cross7100) {
      for (const p of panZ) for (const x of [-.80, .80]) add(x, roofTop + .025, p, .22, .07, 1.93, 0x85898b);
    }
  }
  // 6300系も7100系と同じ下枠交差形を使う。8300系だけシングルアームを残す。
  for (const p of panZ) (v === 'new' ? addSingleArm : addCrossArm)(b, p, roofTop - .02);
  return { shell, face, paint: b.geometry('paint')!, glass: gl.geometry('l') ?? undefined, led, led2, head: lit.geometry('l') ?? undefined, tail: tl.geometry('l') ?? undefined, marks, glows };
}

/** 行先 LED 面（[x, y, 幅]）を -Z 向きで */
export function mergeLed(list: [number, number, number][], z: number, h: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [];
  for (const [x, y, w] of list) {
    const g = new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(x, y, z).toNonIndexed();
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nrm.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}
