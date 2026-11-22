// 特急形（ラピート 50000系に寄せた架空塗装）: 光沢の濃い青・楕円の側窓（1両 10 枚まで）・流線形の先頭部
// （鼻先の下半分は垂直、上は大きな弧で屋根へ。正面から見て丸い顔・中央の縦の稜線・窓の下の2つの膨らみ・外側の縁に縦3灯ずつ）
import * as THREE from 'three';
import { GeoBatch } from '../batch';
import { addRapitNose, RAPIT_BLUE, RAPIT_NOSE_LENGTH } from './rapit-nose';
import {
  Y0, adder, addEndWall, addCrossArm, addUnderfloor, shellGeo, sideSheet,
  type CarKind, type CarParts, type Ring, type SheetMaps, type V2,
} from './common';

export const HW_L = 1.42;
export const YTOP_L = 3.86;
const HALF: V2[] = [[1.30, Y0], [1.31, 1.10], [1.38, 1.48], [1.42, 1.97], [1.42, 2.76], [1.39, 3.13], [1.37, 3.28], [1.2, 3.6], [.8, 3.79], [0, YTOP_L]];
export const BLUE_L = RAPIT_BLUE;
const BLUE_CSS = '#1b295e';

/** open = 乗降口を開けた状態 */
export function paintLimitedSide(Lb: number, head: boolean, open = false): SheetMaps {
  const s = sideSheet(Lb, YTOP_L), hz = Lb / 2;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H);
  grd.addColorStop(0, '#202e62'); grd.addColorStop(.55, BLUE_CSS); grd.addColorStop(1, '#131c47');
  s.base(grd, .35, .24);
  s.rect(-hz - 1, hz + 1, Y0, 1.16, '#151a4a', .35, .4); // 裾
  const door = (zc: number, passenger = true) => {
    s.rect(zc - .42, zc + .42, 1.2, 3.1, '#151a46', .3, .5, .08);
    if (open && passenger) {
      s.glass(zc - .39, zc + .39, 1.23, 3.07, '', .02, ['#4a463e', '#23262b']);
      // 夜の発光: 上が明るく床へ向かって暗い車内。床と左右の縁は光らない
      s.emit(zc - .39, zc + .39, 1.23, 3.07, s.emitGrad(1.35, 3.07, '#ffffff', '#6a5e48'));
      s.emit(zc - .39, zc + .39, 1.23, 1.35, '#000');
      for (const sg of [-1, 1]) s.emit(zc + sg * .37 - .02, zc + sg * .37 + .02, 1.23, 3.07, '#000');
      return;
    }
    s.rect(zc - .39, zc + .39, 1.23, 3.07, BLUE_CSS, .35, .24, .07);
    s.oval(zc, 2.55, .09, .38, '#151a3e');
  };
  if (head) {
    // 50706号の先頭車。乗務員扉と車端の客用扉の間に楕円窓が11枚並ぶ。
    door(-hz + Lb * .259, false);
    door(-hz + Lb * .944);
    for (let i = 0; i < 11; i++) s.oval(-hz + Lb * (.326 + .0484 * i), 2.52, .36, .48, '#18203c');
  } else {
    const doorZ = -hz + 1.1;
    door(doorZ);
    const start = doorZ + 1.35, end = hz - .9;
    for (let i = 0; i < 10; i++) s.oval(start + (end - start) * i / 9, 2.52, .38, .49, '#18203c');
  }
  return s.textures();
}

export function buildLimitedCar(kind: CarKind, Lb: number, panZ: readonly number[]): CarParts {
  const hz = Lb / 2, head = kind === 'head';
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), tl = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  let rings: Ring[];
  if (head) {
    rings = [{ z: -hz + RAPIT_NOSE_LENGTH, inset: 0 }, { z: hz, inset: 0 }];
    addRapitNose(b, lit, tl, glows, hz);
  } else {
    rings = [{ z: -hz, inset: 0 }, { z: hz, inset: 0 }];
    addEndWall(b, -hz, YTOP_L, HW_L, BLUE_L);
  }
  const shell = shellGeo(HALF, rings, YTOP_L, Lb);
  addEndWall(b, hz, YTOP_L, HW_L, BLUE_L);
  addUnderfloor(b, Lb, kind, { frame: 0x1b1d26, equip: 0x24262e, bogie: 0x202228, equipmentDetail: true, frontCut: head ? RAPIT_NOSE_LENGTH - 1.2 : 0 });
  // 屋根上の低いカバー
  // 屋根上の FRP 製の冷却装置カバー（青で統一。2段の低い箱）
  const cz = head ? RAPIT_NOSE_LENGTH / 2 + 1 : 0, cl = head ? Lb - RAPIT_NOSE_LENGTH - 3 : panZ.length ? 10 : 12;
  add(0, YTOP_L + .04, cz, 1.5, .1, cl, 0x232970);
  add(0, YTOP_L + .16, cz, 1.38, .22, cl - .6, 0x202d66);
  for (const side of [-1, 1]) {
    for (let z = cz - cl / 2 + .85; z < cz + cl / 2 - .5; z += .73) {
      add(side * .695, YTOP_L + .17, z, .02, .13, .40, 0x12182c);
    }
  }
  for (const p of panZ) addCrossArm(b, p, YTOP_L - .02);
  return { shell, glass: b.geometry('glass') ?? undefined, paint: b.geometry('paint')!, head: lit.geometry('l') ?? undefined, tail: tl.geometry('l') ?? undefined, glows };
}
