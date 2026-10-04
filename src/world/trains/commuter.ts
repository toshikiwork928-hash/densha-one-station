// 通勤形 20m 級4扉（架空塗装の青帯＋橙線）
//  new: ステンレス車体・黒い前面・中央貫通扉・角ばったスカート・シングルアーム
//  old: 鋼製（銀灰色塗装）・丸みのある前面・屋根上の2灯前照灯・分散冷房・菱形パンタ
import * as THREE from 'three';
import { GeoBatch, M, P } from '../batch';
import {
  Y0, adder, addEndWall, addLozenge, addSingleArm, addUnderfloor, capGeo, faceSheet, roundRings, shellGeo, sideSheet, sweepBand,
  type CarKind, type CarParts, type Ring, type SheetMaps, type V2,
} from './common';

export type CommuterVariant = 'new' | 'old';

export const HW = 1.45;
export const YTOP = 3.84;
const ROOF: V2[] = [[HW, 3.42], [HW - .05, 3.58], [HW - .3, 3.71], [HW - .75, 3.8], [0, YTOP]];
/** 断面: new = すそ絞り、old = 直線車体（鋼製） */
const HALFS: Record<CommuterVariant, V2[]> = { new: [[HW - .06, Y0], [HW, 1.5], ...ROOF], old: [[HW, Y0], ...ROOF] };
const DOORS = [-7.2, -2.4, 2.4, 7.2], DOOR_W = 1.3;
const BLUE = '#2f3fa8', ORANGE = '#f0961c';

interface Look {
  r: number; base: [string, string]; roof: string; rough: number; metal: number;
  topBand: V2; topLine: V2; lowBand: V2; lowLine: V2; frontBand: V2; frontLine: V2;
  win: V2; door: string;
}
const LOOK: Record<CommuterVariant, Look> = {
  new: {
    r: .16, base: ['#d3d7dc', '#b4bac1'], roof: '#a7acb2', rough: .38, metal: .75,
    topBand: [3.27, 3.4], topLine: [3.2, 3.24], lowBand: [1.87, 1.94], lowLine: [1.81, 1.85],
    frontBand: [1.58, 2.0], frontLine: [1.48, 1.55], win: [2.12, 3.02], door: '#c4c9cf',
  },
  old: {
    r: .3, base: ['#cfd2d7', '#bfc3c9'], roof: '#9fa4aa', rough: .42, metal: .12,
    topBand: [3.22, 3.42], topLine: [3.13, 3.18], lowBand: [1.6, 1.67], lowLine: [1.53, 1.57],
    frontBand: [1.6, 2.02], frontLine: [1.49, 1.56], win: [1.98, 3.0], door: '#c9ccd1', // ドアは車体と同系色の塗装
  },
};

/** 側面（head = 先頭車。前端 = -Z 側に乗務員扉と帯の立ち上がり） */
export function paintCommuterSide(v: CommuterVariant, Lb: number, head: boolean): SheetMaps {
  const L = LOOK[v], s = sideSheet(Lb, YTOP), hz = Lb / 2;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, L.base[0]); grd.addColorStop(1, L.base[1]);
  s.base(grd, L.rough, L.metal);
  s.rect(-hz - 1, hz + 1, 3.55, YTOP + .1, L.roof, .6, L.metal * .6);
  const band = (b: V2, col: string, z0 = -hz - 1) => s.rect(z0, hz + 1, b[0], b[1], col, .35, .1);
  const crewZ = -hz + .75;
  if (head) {
    const zs = crewZ + .55, k = .62;
    sweepBand(s, Lb, L.frontLine, L.topLine, zs + .12, k, ORANGE, .35, .1);
    sweepBand(s, Lb, L.frontBand, L.topBand, zs, k, BLUE, .35, .1, -.12);
    band(L.lowBand, BLUE, zs + 2.2); band(L.lowLine, ORANGE, zs + 2.2);
  } else {
    band(L.topBand, BLUE); band(L.topLine, ORANGE); band(L.lowBand, BLUE); band(L.lowLine, ORANGE);
  }
  const [w0, w1] = L.win;
  const door = (zc: number, w: number, dbl: boolean) => {
    s.rect(zc - w / 2 - .03, zc + w / 2 + .03, 1.13, 3.08, v === 'old' ? '#a9adb3' : '#8b9198', .5, .3);
    s.rect(zc - w / 2, zc + w / 2, 1.16, 3.05, L.door, v === 'old' ? L.rough : .4, v === 'old' ? L.metal : .7);
    if (dbl) {
      s.rect(zc - .012, zc + .012, 1.16, 3.05, '#5e646b');
      for (const sg of [-1, 1]) s.glass(zc + sg * w / 4 - .17, zc + sg * w / 4 + .17, 2.08, 2.92, '#5a6067', .03);
    } else s.glass(zc - .2, zc + .2, 2.12, 2.92, '#5a6067', .03);
  };
  for (const d of DOORS) door(d, DOOR_W, true);
  // 側窓
  for (let i = 0; i < DOORS.length - 1; i++) {
    const zc = (DOORS[i] + DOORS[i + 1]) / 2;
    if (v === 'new') s.glass(zc - 1.35, zc + 1.35, w0, w1, '#4a5056', .04);
    else { s.glass(zc - 1.4, zc - .2, w0, w1, '#565c63', .06); s.glass(zc + .2, zc + 1.4, w0, w1, '#565c63', .06); }
  }
  s.glass(DOORS[3] + DOOR_W / 2 + .35, hz - .4, w0, w1, '#565c63', .05);
  if (head) {
    door(crewZ, .6, false);
    s.glass(crewZ + .5, DOORS[0] - DOOR_W / 2 - .3, w0, w1, '#565c63', .05);
  } else s.glass(-hz + .4, DOORS[0] - DOOR_W / 2 - .35, w0, w1, '#565c63', .05);
  // 号車札・小表示（文字なし）
  s.rect(DOORS[1] + .9, DOORS[1] + 1.2, 3.46, 3.53, '#2b3138');
  if (v === 'old') for (let z = -hz + .2; z < hz; z += 2.1) s.rect(z, z + .02, Y0, 3.55, 'rgba(0,0,0,.06)'); // 外板継ぎ目
  return s.textures();
}

/** 前面シート */
export function paintCommuterFace(v: CommuterVariant): SheetMaps {
  const L = LOOK[v], s = faceSheet(HW, YTOP);
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, L.base[0]); grd.addColorStop(1, L.base[1]);
  s.base(grd, L.rough, L.metal);
  if (v === 'new') {
    // 黒い前面（窓まわり）
    s.rect(-HW, HW, 2.0, 3.7, '#121417', .18, .3);
    s.glass(.56, 1.3, 2.3, 3.28, '', .03, ['#2e3a46', '#10151b']);
    s.glass(-1.3, -.56, 2.3, 3.28, '', .03, ['#2e3a46', '#10151b']);
    s.rect(-HW, HW, L.frontBand[0], 2.0, BLUE, .3, .15);
    s.rect(-HW, HW, L.frontLine[0], L.frontLine[1], ORANGE, .3, .1);
    s.rect(-HW, HW, Y0, 1.25, '#c1c6cc', .4, .7);
    // 貫通扉（銀）
    s.rect(-.5, .5, 1.18, 3.42, '#9aa0a7', .4, .7, .03);
    s.rect(-.44, .44, 1.22, 3.36, '#cdd2d7', .35, .8, .02);
    s.glass(-.3, .3, 2.38, 3.12, '#3d434a', .03);
    s.rect(-.2, .2, 1.24, 1.3, '#8a9097');
    // 上部の前照灯箱まわり
    s.rect(-.42, .42, 3.47, 3.72, '#0d0f11', .2, .2);
  } else {
    s.rect(-HW, HW, L.frontBand[0], L.frontBand[1], BLUE, .35, .1);
    s.rect(-HW, HW, L.frontLine[0], L.frontLine[1], ORANGE, .35, .1);
    // 前面窓（黒ゴム枠）
    s.glass(.6, 1.26, 2.24, 3.08, '#22262b', .06);
    s.glass(-1.26, -.6, 2.24, 3.08, '#22262b', .06);
    // 貫通扉（黒い幌枠の内側）
    s.rect(-.5, .5, 1.2, 3.2, '#1d2024', .5, 0, .12);
    s.rect(-.4, .4, 1.25, 3.1, L.door, L.rough, L.metal, .05);
    s.rect(-.4, .4, L.frontBand[0], L.frontBand[1], BLUE, .35, .1);
    s.rect(-.4, .4, L.frontLine[0], L.frontLine[1], ORANGE, .35, .1);
    s.glass(-.28, .28, 2.3, 2.98, '#22262b', .05);
    // 架空の車番
    s.text('5203', -.95, 1.81, .26, '#f4f6fa', 600);
    // 行先表示器の枠
    s.rect(.56, 1.3, 3.14, 3.44, '#15171a', .3, 0, .02);
  }
  return s.textures();
}

/** 1両分のジオメトリ */
export function buildCommuterCar(v: CommuterVariant, kind: CarKind, Lb: number): CarParts {
  const L = LOOK[v], HALF = HALFS[v], hz = Lb / 2, head = kind === 'head', zf = -hz;
  const rings: Ring[] = [...(head ? roundRings(zf, L.r, 1) : [{ z: -hz, inset: 0 }]), { z: hz, inset: 0 }];
  const shell = shellGeo(HALF, rings, YTOP, Lb);
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), tl = new GeoBatch(), gl = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  const roofTop = YTOP;
  // 雨樋
  for (const sx of [-1, 1]) add(sx * (HW - .03), 3.56, 0, .04, .04, Lb - (head ? .6 : 0), 0x8d939a, 0, 0, 0);
  addEndWall(b, hz, YTOP, HW, v === 'new' ? 0xb9bec4 : 0xbfc3c9);
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined;
  if (head) {
    face = capGeo(HALF, { z: zf, inset: L.r }, YTOP, HW, -1);
    const z = zf - .005;
    if (v === 'new') {
      // 貫通扉の枠（銀の張り出し）
      add(0, 3.42, z - .03, 1.04, .06, .08, 0xb8bdc3);
      for (const sx of [-1, 1]) add(sx * .5, 2.3, z - .03, .06, 2.24, .08, 0xb8bdc3);
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
      led = mergeLed([[.93, 3.42, .62], [-.93, 3.42, .62]], z - .01, .17);
      // スカート（角ばった銀灰色）と連結器
      for (const sx of [-1, 1]) {
        b.add('paint', P.box, M(sx * .98, .7, zf - .1, sx * .15, .8, .6, .08, -.22), 0x9ca2a9);
        add(sx * 1.36, .78, zf + .2, .06, .46, .6, 0x9ca2a9);
      }
      add(0, .45, zf - .1, 1.3, .12, .12, 0x9aa0a6, -.2);
      add(0, .88, zf - .15, .3, .24, .5, 0x22252a);
      // ワイパー
      for (const sx of [-1, 1]) add(sx * .95, 2.38, z - .03, .55, .025, .025, 0x111111, 0, 0, sx * .35);
    } else {
      // 貫通扉まわりの黒い幌枠
      add(0, 3.24, z - .05, 1.06, .1, .1, 0x1a1c20);
      for (const sx of [-1, 1]) add(sx * .5, 2.2, z - .05, .1, 2.06, .1, 0x1a1c20);
      add(0, 1.2, z - .12, .9, .05, .24, 0x8f959b);
      // 屋根上の前照灯（2灯）
      add(0, roofTop - .08, zf + .25, 1.25, .3, .46, 0xc6cad0);
      for (const sx of [-1, 1]) {
        b.add('paint', P.cyl, M(sx * .36, roofTop - .08, zf + .02, 0, .3, .08, .3, Math.PI / 2), 0xdadde1);
        lit.add('l', P.cyl, M(sx * .36, roofTop - .08, zf - .025, 0, .22, .02, .22, Math.PI / 2), 0xffffff);
        glows.push(new THREE.Vector3(sx * .36, roofTop - .08, zf - .25));
        // 標識灯（橙線の両端）
        add(sx * 1.2, 1.4, z - .01, .17, .13, .03, 0x8a6a2a);
        tl.add('l', P.box, M(sx * 1.2, 1.4, z - .03, 0, .13, .09, .02), 0xffffff);
      }
      led = mergeLed([[.93, 3.29, .66]], z - .01, .22);
      // 簡易スカート・連結器・ホース
      add(0, .78, zf + .05, 2.4, .42, .1, 0x8e9399, -.1);
      add(0, .9, zf - .15, .3, .24, .5, 0x22252a);
      for (const sx of [-.75, -.55, -.35]) b.add('paint', P.cyl, M(sx, 1.0, zf - .1, 0, .07, .35, .07), 0x1c1e21);
      for (const sx of [-1, 1]) add(sx * .93, 2.5, z - .03, .5, .025, .025, 0x111111, 0, 0, sx * .5);
    }
  } else addEndWall(b, -hz, YTOP, HW, v === 'new' ? 0xb9bec4 : 0xbfc3c9);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b });
  // 屋根上: 冷房装置
  if (v === 'new') {
    add(0, roofTop + .14, 0, 2.0, .3, 6.2, 0xb5bac0);
    for (let i = -2; i <= 2; i++) add(0, roofTop + .3, i * 1.15, 1.5, .02, .8, 0x6a7076);
    add(0, roofTop + .03, 0, .5, .06, Lb - 2, 0x868b91);
  } else {
    // 分散冷房（箱形・両側にルーバー）
    for (const z of [-6, -2, 2, 6]) {
      add(0, roofTop + .16, z, 1.5, .36, 1.7, 0xc0c4c9);
      for (const dz of [-.42, .42]) for (const sx of [-1, 1]) add(sx * .76, roofTop + .17, z + dz, .02, .2, .5, 0x3a3f45);
    }
    for (const sx of [-.85, .85]) add(sx, roofTop - .05, 0, .06, .06, Lb - 1, 0x8a8f95); // 配管
  }
  if (kind === 'pan') (v === 'new' ? addSingleArm : addLozenge)(b, -hz + 4.0, roofTop - .02);
  return { shell, face, paint: b.geometry('paint')!, glass: gl.geometry('l') ?? undefined, led, head: lit.geometry('l') ?? undefined, tail: tl.geometry('l') ?? undefined, glows };
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
