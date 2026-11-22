import { windowSill } from './cab-glazing';
import { add7100Skirt } from './c7100-skirt';
import { add7100Gangway } from './c7100-cab';
// 9000系更新車。既存の通勤形ジオメトリを使い、更新標準塗装を描く。
import * as THREE from 'three';
import { basePart, GeoBatch, M, P } from '../batch';
import { Y0, adder, addCrossArm, addEndWall, addUnderfloor, capGeo, faceSheet, roundRings, shellGeo, sideSheet, sweepBand, type CarKind, type CarParts, type Ring, type SheetMaps, type V2 } from './common';
import { mergeLed } from './commuter';
import { paintDoor } from './c1000';

const BLUE = '#263d89', ORANGE = '#f0961c';
const lampDisc = basePart(new THREE.CylinderGeometry(.5, .5, 1, 40));
export const YTOP = 3.84;
// 実車9510・9511の正面は側壁をほぼ垂直に立て、上端だけを浅いアーチで結ぶ。
// 旧形状の大きな肩絞りを避け、食パン形の断面を再現する。
const HW = 1.45, R = .12;
const CROWN: V2[] = [[HW, 3.50], [1.44, 3.58], [1.40, 3.65], [1.33, 3.70],
  [1.20, 3.745], [.98, 3.785], [.68, 3.815], [.35, 3.835], [0, YTOP]];
const HALF: V2[] = [[HW, Y0], [HW, 1.5], ...CROWN];

export function paint9000Side(Lb: number, head: boolean, open = false): SheetMaps {
  const s = sideSheet(Lb, YTOP), hz = Lb / 2;
  s.base('#d6dbe0', .34, .78);
  for (let y = Y0 + .08; y < 1.94; y += .055) {
    s.rect(-hz, hz, y, y + .018, 'rgba(255,255,255,.22)');
    s.rect(-hz, hz, y + .018, y + .03, 'rgba(0,0,0,.1)');
  }
  s.rect(-hz - 1, hz + 1, 3.48, YTOP + .1, '#aeb4ba', .55, .45);
  const doors = head ? [.187, .416, .646, .882].map(f => Lb * (f - .5)) : [-7.2, -2.4, 2.4, 7.2];
  if (head) {
    const zs = -hz + 1.04;
    sweepBand(s, Lb, [1.40, 1.52], [3.21, 3.30], zs + .12, .62, ORANGE, .35, .15);
    sweepBand(s, Lb, [1.52, 2.03], [3.32, 3.47], zs, .62, BLUE, .35, .2, -.12);
  } else {
    s.rect(-hz - 1, hz + 1, 3.32, 3.47, BLUE, .35, .2);
    s.rect(-hz - 1, hz + 1, 3.21, 3.30, ORANGE, .35, .15);
  }
  const lowStart = -.245 * Lb + .53;
  if (!head) {
    s.rect(-hz, doors[0], 1.60, 1.73, BLUE, .35, .2);
    s.rect(-hz, doors[0], 1.49, 1.59, ORANGE, .35, .15);
  }
  s.rect(lowStart, hz + 1, 1.60, 1.73, BLUE, .35, .2);
  s.rect(lowStart, hz + 1, 1.49, 1.59, ORANGE, .35, .15);
  const win: [number, number] = [2.02, 2.96];
  for (const z of doors) {
    s.rect(z - .68, z + .68, 1.12, 3.08, '#aeb4ba', .45, .55);
    if (open) s.glass(z - .62, z + .62, 1.16, 3.04, '', 0, ['#4a463e', '#23262b']);
    else {
      s.rect(z - .58, z + .58, 1.16, 3.04, '#c4c9ce', .4, .7);
      s.rect(z - .015, z + .015, 1.16, 3.04, '#727980', .4, .5);
      s.glass(z - .47, z - .10, win[0], win[1], '#565e68', .04);
      s.glass(z + .10, z + .47, win[0], win[1], '#565e68', .04);
    }
  }
  for (let i = 0; i < doors.length - 1; i++) {
    const z = (doors[i] + doors[i + 1]) / 2;
    const half = (win[1] - win[0]) / 2;
    for (const dz of [-.53, .53]) s.glass(z + dz - half, z + dz + half, win[0], win[1], '#565c63', .07);
  }
  s.glass(hz - 1.6, hz - .65, win[0], win[1], '#25313c', .06);
  if (head) {
    paintDoor(s, -hz + .85, .61, 3.08, win, '#c4c9ce', false, false);
    s.rect(-hz + .545, -hz + 1.155, 1.565, 2.03, BLUE, .35, .2);
    s.rect(-hz + .545, -hz + 1.155, 1.40, 1.52, ORANGE, .35, .15);
    s.glass(-hz + 1.44, -hz + 2.31, win[0], win[1], '#25313c', .06);
  }
  s.rect(1.2, 1.52, 3.43, 3.55, '#2b3138');
  return s.textures();
}

export function paint9000Face(carNumber = '9501'): SheetMaps {
  const s = faceSheet(1.45, YTOP);
  s.base('#cfd4d9', .34, .78);
  // 前面の見切りは屋根と同じ弧を描き、両端で縦の窓柱へ下がる。
  for (const sign of [-1, 1]) {
    const rim: V2[] = CROWN.map(([x, y]) => [sign * Math.max(0, x - R), y - R * (y - YTOP + 1)]);
    s.poly([...rim, ...rim.slice().reverse().map(([x, y]): V2 => [x * .992, y - .035])], '#697171', .48, .45);
  }
  s.rect(-1.45, 1.45, 1.52, 2.03, BLUE, .35, .2);
  s.rect(-1.45, 1.45, 1.40, 1.52, ORANGE, .35, .15);

  for (const side of [-1, 1]) {
    const [left, right] = side < 0 ? [-1.26, -.52] : [.52, 1.26];
    s.rect(left - .046, right + .046, 2.055, 3.565, '#979d9c', .31, .72, .11);
    s.cabGlass(left, right, 2.10, 3.52, '', .085, ['#374650', '#151c23']);
    windowSill(s, side * .76, 2.015);
    // ガラスの反射を透かし、左右の窓の上部だけに日よけの色を重ねる。
    const g = s.c, x = s.X(right), width = s.X(left) - x;
    g.save();
    g.beginPath();
    g.roundRect(x, s.Y(3.52), width, s.Y(2.10) - s.Y(3.52), .085 * s.H / 3);
    g.clip();
    const shade = g.createLinearGradient(0, s.Y(3.52), 0, s.Y(3.06));
    shade.addColorStop(0, 'rgba(9, 33, 29, .83)');
    shade.addColorStop(1, 'rgba(19, 49, 41, .69)');
    g.fillStyle = shade;
    g.fillRect(x, s.Y(3.52), width, s.Y(3.06) - s.Y(3.52));
    g.restore();
  }
  s.text(carNumber, -.91, 3.30, .145, '#d5dad4', 500);
  s.rect(-.45, .45, 1.18, 3.30, '#9ea5ab', .4, .75);
  s.rect(-.35, .35, 1.24, 3.19, '#555e65', .12, .3);
  s.cabGlass(-.29, .29, 2.10, 3.17, '#26323c', .04);
  s.rect(-.48, .48, 1.52, 2.03, BLUE, .35, .2);
  s.rect(-.48, .48, 1.40, 1.52, ORANGE, .35, .15);
  s.rect(-.36, .36, 3.31, 3.53, '#41494b', .22, .35, .035);
  s.rect(-1.45, 1.45, 1.53, 1.565, '#a3acaf', .34, .7);
  s.emit(-HW, HW, Y0, YTOP, '#000');
  return s.textures();
}

export function build9000Car(kind: CarKind, Lb: number, panZ: readonly number[]): CarParts {
  // 9000系更新車は専用の貫通面・窓下前照灯を持つ20m級4扉車。
  const head = kind === 'head', hz = Lb / 2, zf = -hz;
  const rings: Ring[] = [...(head ? roundRings(zf, R, 1) : [{ z: -hz, inset: 0 }]), { z: hz, inset: 0 }];
  const shell = shellGeo(HALF, rings, YTOP, Lb), b = new GeoBatch(), add = adder(b), lit = new GeoBatch();
  const glows: THREE.Vector3[] = [], marksL = new GeoBatch(), marksR = new GeoBatch();
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined;
  if (head) {
    face = capGeo(HALF, { z: zf, inset: R }, YTOP, HW, -1);
    const z = zf - .01;
    // 表示器を大型前面窓の上部へ収め、窓越しに見える位置に置く。
    led = mergeLed([[0, 3.42, .60]], zf - .003, .16);
    add7100Gangway(b, zf);
    add(0, 1.22, zf - .13, .78, .044, .30, 0xa6a8a7);
    for (const sx of [-1, 1]) {
      const x = sx * 1.01;
      b.add('paint', lampDisc, M(x, 1.78, z - .032, 0, .27, .05, .27, Math.PI / 2), 0x45494e);
      b.add('paint', lampDisc, M(x, 1.78, z - .059, 0, .236, .016, .236, Math.PI / 2), 0xc7c9c6);
      lit.add('l', lampDisc, M(x, 1.78, z - .072, 0, .19, .018, .19, Math.PI / 2), 0xffffff);
      glows.push(new THREE.Vector3(x, 1.78, z - .22));
      add(sx * 1.14, 1.43, z - .045, .204, .15, .065, 0x505357);
      (sx > 0 ? marksL : marksR).add('l', P.box, M(sx * 1.14, 1.43, z - .083, 0, .15, .087, .025), 0xffffff);
      add(sx * .90, 1.135, z - .035, .74, .031, .055, 0x565c60);
    }
    // 9000系の大型前面窓は下端に独立したワイパーを持つ。窓下灯具と分離して立体化する。
    for (const sx of [-1, 1]) {
      add(sx * .73, 2.21, z - .045, .018, .45, .018, 0x31363a, 0, 0, -sx * .52);
      add(sx * .65, 2.38, z - .064, .025, .48, .024, 0x1c2024, 0, 0, -sx * .47);
    }
    add7100Skirt(b, zf + .10, 0x90979d);
  }
  addEndWall(b, head ? hz : -hz, YTOP - .12, HW, 0xb9bec4);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b, equipmentDetail: true, frontCut: head ? .65 : 0 });
  // パンタ: 中間電動車（モハ9001形）に下枠交差形を2基（Wikipedia「南海9000系電車」。位置は記載が無いので車体の両端寄り）。冷房装置はその間
  for (const z of [-.37, -.17, .06, .29].map(f => f * Lb)) if (!panZ.some(p => Math.abs(z - p) < 1.6)) {
    add(0, YTOP + .15, z, 1.5, .31, 2.15, 0xbac0c0);
    for (const side of [-1, 1]) for (const offset of [-.48, .10, .66]) {
      add(side * .756, YTOP + .15, z + offset, .016, .16, .37, 0x4c5356);
    }
  }
  add(0, YTOP + .03, 0, .45, .06, Lb - 1.2, 0x868b91);
  for (const p of panZ) addCrossArm(b, p, YTOP - .02);
  return { shell, face, paint: b.geometry('paint')!, glass: undefined, led, head: lit.geometry('l') ?? undefined, marks: { l: marksL.geometry('l')!, r: marksR.geometry('l')! }, glows };
}
