import { windowSill } from './cab-glazing';
import { southernCab, cabPanel } from './southern-cab';
import { addWrapSkirt } from './c7100-skirt';
// 12000系サザンプレミアム。銀色地に青いサウスウェイブ帯を描く。
import * as THREE from 'three';
import { basePart, GeoBatch, M, P } from '../batch';
import { Y0, adder, addEndWall, addSingleArm, addUnderfloor, faceSheet, shellGeo, sideSheet, sweepBand, type CarKind, type CarParts, type SheetMaps, type V2 } from './common';
import { add7100Gangway } from './c7100-cab';

const SILVER = '#d9dde0', SILVER_DARK = '#aeb5bb', BLUE = '#187aca', GOLD = '#e49a25';
// 12000系は8000系ベースの丸い肩を持つため、直線的な10000系より端部の丸みを大きく取る。
export const HW_S = 1.45, YTOP_S = 3.84, R_S = .22;
const HALF: V2[] = [[HW_S - .14, Y0], [HW_S, 1.88], [HW_S, 3.4], [HW_S - .04, 3.56], [HW_S - .24, 3.71], [HW_S - .7, 3.81], [0, YTOP_S]];
const WIN: [number, number] = [2.04, 2.98];

function frontZ(zf: number, x: number): number {
  const t = Math.max(0, Math.abs(x) - .39) / (HW_S - R_S - .39);
  return zf + .32 * t * t;
}

export function paint12000Side(Lb: number, head: boolean, open = false): SheetMaps {
  const s = sideSheet(Lb, YTOP_S), hz = Lb / 2;
  s.base('#aab0b5', .33, .68);
  // 先頭の客室下で立ち上がり、後方へ水平になる青帯と細い金色の上縁。
  const edge: V2[] = [];
  const start = head ? -hz + 2.1 : -hz - .1;
  for (let i = 0; i <= 24; i++) {
    const z = start + (hz + .1 - start) * i / 24;
    const t = Math.min(1, (z - start) / 6.3);
    edge.push([z, head ? 1.10 + .70 * (1 - (1 - t) ** 2) : 1.80]);
  }
  s.poly([[start, 1.06], [hz + .1, 1.06], ...edge.slice().reverse()], BLUE, .28, .35);
  s.poly([...edge, ...edge.slice().reverse().map(([z, y]): V2 => [z, y + .045])], GOLD, .28, .45);
  if (head) sweepBand(s, Lb, [1.45, 1.67], [3.37, 3.44], -hz + .72, .65, BLUE, .2, .35);
  else s.rect(-hz - 1, hz + 1, 3.37, 3.44, BLUE, .18, .38);
  if (head) {
    s.poly([[-hz, 1.50], [-hz + .49, 1.54], [-hz + .59, 1.69], [-hz, 1.67]], '#ebb531', .29, .26);
    s.rect(-hz, -hz + .39, Y0, 1.48, '#e2e5e3', .34, .30);
  }
  const window = (zc: number, w = .88) => s.glass(zc - w / 2, zc + w / 2, WIN[0], WIN[1], '#59626a', .05, ['#33424f', '#121a22']);
  const doors = [head ? Lb * .305 : hz - 2.2];
  if (head) {
    for (let i = 0; i < 6; i++) window(-hz + Lb * (.151 + i * .102), Lb * .084);
    window(-hz + Lb * .725, Lb * .037);
  } else {
    const start = -hz + .65, pitch = (doors[0] - .70 - start) / 8;
    for (let i = 0; i < 8; i++) window(start + pitch * (i + .5), pitch - .1);
  }
  for (const z of doors) {
    s.rect(z - .46, z + .46, 1.06, 3.10, SILVER_DARK, .3, .7, .02);
    if (open) s.glass(z - .40, z + .40, 1.12, 3.03, '', 0, ['#2d3943', '#11161b']);
    else {
      s.rect(z - .40, z + .40, 1.12, 3.03, SILVER, .3, .7, .02);
      s.rect(z - .40, z + .40, 1.12, 1.80, BLUE, .28, .35);
      s.rect(z - .40, z + .40, 1.80, 1.845, GOLD, .28, .45);
      s.glass(z - .24, z + .24, 2.10, 2.94, '#697279', .05, ['#34424e', '#151c23']);
    }
  }
  if (head) {
    const crew = -hz + 1.10;
    s.rect(crew - .34, crew + .34, 1.06, 3.10, SILVER_DARK, .3, .7, .02);
    s.rect(crew - .29, crew + .29, 1.12, 3.04, SILVER, .3, .7);
    s.glass(crew - .19, crew + .19, 2.10, 2.94, '#697279', .03, ['#34424e', '#151c23']);
  }
  return s.textures();
}

export function paint12000Face(): SheetMaps {
  const s = faceSheet(HW_S, YTOP_S);
  s.base('#eff1ed', .34, .28);
  // 前面窓は黒い一枚のマスクに見えるよう下端を中央へ落とす。
  s.poly([[-1.45, 3.78], [1.45, 3.78], [1.45, 2.22], [1.10, 2.10], [.65, 2.03], [0, 2.00], [-.65, 2.03], [-1.10, 2.10], [-1.45, 2.22]], '#151a20', .1, .25);
  s.cabGlass(-1.45, -.50, 2.24, 3.72, '', .02, ['#34434f', '#10161c']);
  s.cabGlass(.50, 1.45, 2.24, 3.72, '', .02, ['#34434f', '#10161c']);
  for (const sx of [-1, 1]) {
    windowSill(s, sx * .64, 2.13);
    s.poly([[sx * 1.45, 2.02], [sx * 1.15, 1.70], [sx * .96, 1.64], [sx * 1.45, 1.63]], BLUE, .28, .25);
    s.poly([[sx * 1.45, 1.69], [sx * .98, 1.66], [sx * .99, 1.51], [sx * 1.45, 1.51]], '#eeb831', .28, .25);
  }
  s.rect(-.46, .46, 1.18, 3.28, SILVER_DARK, .3, .72, .08);
  s.rect(-.40, .40, 1.23, 3.22, '#e7e9e9', .3, .6, .06);
  s.rect(-.40, .40, 1.95, 3.22, '#292c30', .32, .35, .06);
  s.cabGlass(-.29, .29, 2.02, 3.12, '#20272d', .06, ['#34414c', '#0c1116']);
  const badge = (color: string, scale: number) => {
    const g = s.c;
    g.save(); g.translate(s.X(0), s.Y(1.63));
    g.scale(Math.abs(s.X(.31) - s.X(0)) * scale, (s.Y(1.37) - s.Y(1.63)) * scale);
    g.fillStyle = color; g.beginPath();
    g.moveTo(-.97, -.53); g.quadraticCurveTo(-.94, -.95, -.51, -.99);
    g.quadraticCurveTo(.13, -1.05, .7, -.88); g.quadraticCurveTo(1, -.81, 1, -.39);
    g.lineTo(.95, .12); g.quadraticCurveTo(.78, .75, .03, 1);
    g.quadraticCurveTo(-.77, .76, -.96, .19); g.closePath(); g.fill(); g.restore();
  };
  badge('#a3acae', 1); badge('#dfae53', .93); badge('#dfd8c9', .81);
  s.text('SOUTHERN', 0, 1.67, .108, '#867665', 800);
  s.text('Premium', 0, 1.555, .085, '#9b8867', 700);
  // 12101の車号は、行先表示器を置かない右側窓の上部へ配置する。
  s.text('12101', -.86, 3.42, .14, '#e7eeee', 600);

  for (const side of [-1, 1]) s.poly([[side * .64, 1.50], [side * 1.06, 1.50], [side * 1.16, 1.67], [side * .64, 1.67]], '#202427', .28, .3);
  return s.textures();
}

export function build12000Car(kind: CarKind, Lb: number, panZ: readonly number[]): CarParts {
  const head = kind === 'head', hz = Lb / 2, zf = -hz;
  const zAt = (x: number) => frontZ(zf, x);
  const cab = head ? southernCab(HALF, YTOP_S, HW_S, R_S, Lb, zAt) : undefined;
  const shell = cab?.shell ?? shellGeo(HALF, [{ z: -hz, inset: 0 }, { z: hz, inset: 0 }], YTOP_S, Lb);
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch();
  const glows: THREE.Vector3[] = [], marksL = new GeoBatch(), marksR = new GeoBatch();
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined, led2: THREE.BufferGeometry | undefined;
  if (head) {
    // 中央貫通扉から左右窓の外端まで、前頭部の丸みに沿う曲面を張る。
    face = cab!.face;
    led = cabPanel([.61, 1.11], [.61, 1.11], 3.30, 3.49, zAt, .006);
    // 実車は右側窓上が車号表示のため、行先LEDは左側だけに置く。
    led2 = undefined;
    add(0, 3.46, frontZ(zf, 0) - .03, .65, .24, .04, 0x252a2e);
    add7100Gangway(b, zf);
    add(0, 1.225, zf - .12, .80, .045, .28, 0xb7b9b9);
    for (const sx of [-1, 1]) {
      const x = sx * .82;
      add(x, 2.30, zAt(x) - .051, .026, .50, .024, 0x242a2b, 0, 0, -sx * .50);
    }
    for (const sx of [-1, 1]) {
      const zLight = zAt(sx * .20);
      add(sx * .20, 3.46, zLight - .06, .20, .16, .03, 0x89949b);
      lit.add('l', P.box, M(sx * .20, 3.46, zLight - .08, 0, .14, .10, .02), 0xffffff);
      glows.push(new THREE.Vector3(sx * .20, 3.46, zLight - .22));
      const lens = cabPanel([sx * .67, sx * 1.045].sort((a, b) => a - b) as V2,
        [sx * .67, sx * 1.12].sort((a, b) => a - b) as V2, 1.535, 1.635, zAt, .008);
      (sx > 0 ? marksL : marksR).add('l', basePart(lens), M(0, 0, 0), 0xf2a52e);

    }
    addWrapSkirt(b, zf + .08, HW_S - .16, R_S, 0x2266ad);
    add(0, .82, zf - .12, .28, .24, .32, 0x636563);
    add(.053, .85, zf - .29, .10, .095, .026, 0x272d31);
    add(0, .57, zf + .025, .45, .13, .22, 0x53585b);
  }
  addEndWall(b, head ? hz : -hz, YTOP_S, HW_S, 0xc2c6cc);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b, equipmentDetail: true, frontCut: head ? .65 : 0 });
  for (const z of [-.20 * Lb, .12 * Lb]) {
    add(0, YTOP_S + .16, z, 1.72, .32, 2.58, 0xc5c6be);
    for (const side of [-1, 1]) for (const dz of [-.79, -.32, .15, .62]) {
      add(side * .866, YTOP_S + .13, z + dz, .016, .12, .40, 0x545a59);
    }
  }
  add(0, YTOP_S + .03, 0, .4, .06, Lb - 1.4, 0xa9aeb4);
  for (const p of panZ) addSingleArm(b, p, YTOP_S - .02);
  return { shell, face, paint: b.geometry('paint')!, glass: undefined, led, led2, head: lit.geometry('l') ?? undefined, marks: { l: marksL.geometry('l')!, r: marksR.geometry('l')! }, glows };
}
