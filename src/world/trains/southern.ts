import { windowSill } from './cab-glazing';
import { southernCab, cabPanel } from './southern-cab';
import { add7100Skirt } from './c7100-skirt';
// 特急サザンの座席指定車「10000系」（架空塗装）: 鋼製 20m 級・メタリックシルバー。帯の形は 7100系と同じ
//  （窓上の太い青＋細い橙、窓下の細い青＋橙。先頭車は運転台寄りで窓上の帯が斜めに下がって前面の帯へつながる）
//  先頭車: 乗務員扉 → 客用の折戸1か所 → 独立した客室窓8枚
//  中間車: 連続した1枚の横長窓・車端側に小窓2枚・片方の車端寄りに折戸1か所
//  前面: 貫通型。上半分は黒（前面窓は貫通扉の横から前面の両端まで延び、角の丸みへ回り込む + 窓付き貫通扉）、
//  下半分は濃い青 → 太い橙帯 → 白線 → 銀の裾。行先表示器は中央上部の1面、灯具は下部左右の銀枠（1枠に2灯）
import * as THREE from 'three';
import { basePart, GeoBatch, M } from '../batch';
import {
  Y0, adder, addCrossArm, addEndWall, addUnderfloor, cv, faceSheet, shellGeo, sideSheet, sweepBand,
  type CarKind, type CarParts, type Sheet, type SheetMaps, type V2,
} from './common';
import { add7100Gangway } from './c7100-cab';
import { FONT } from '../../core/config';

export const HW_S = 1.45;
export const YTOP_S = 3.84;
const ROOF: V2[] = [[HW_S, 3.43], [1.44, 3.55], [1.41, 3.63], [1.35, 3.69],
  [1.23, 3.74], [.98, 3.79], [.62, 3.825], [.30, 3.838], [0, YTOP_S]];
const HALF: V2[] = [[HW_S - .03, Y0], [HW_S, 1.4], ...ROOF];
/** 先頭部の丸み（前面は側面へ丸く回り込む）。前面シートの有効幅は HW_S - R_S */
const R_S = .38, FACE_WIDTH = 2.08;
const BLUE = '#32469a', ORANGE = '#f0961c';
const WIN: V2 = [2.0, 2.95];
const WAIST_BLUE: V2 = [1.65, 1.87], WAIST_ORANGE: V2 = [1.50, 1.60];
/** 側面の帯（7100系 commuter.ts の old と同じ並び）: 窓上 = 太い青（TOP_BAND）とその下の細い橙（TOP_LINE）、窓下 = 細い青（LOW_BAND）とその下の橙（LOW_LINE） */
const TOP_BAND: V2 = [3.4, 3.65], TOP_LINE: V2 = [3.26, 3.37];
/** 前面の帯（側面の帯は運転台寄りでここまで下がる）: 青 = 前面の下半分、橙 = その下 */
const FRONT_BAND: V2 = [1.52, 2.05], FRONT_LINE: V2 = [1.34, 1.47];
/** 前面窓の上下端（前面と、角の丸みに回り込む部分で共通） */
const FWIN: V2 = [2.065, 3.56];
/** 先頭車: 前端から乗務員扉・客用折戸の中心。中間車: 折戸の中心（前端から） */
const CREW_Z = 1.03, CREW_W = .6, HEAD_DOOR = 2.5, MID_DOOR = 1.35, DOOR_W = 1.0;

function frontZ(zf: number, x: number): number {
  const t = Math.max(0, Math.abs(x) - .38) / (HW_S - R_S - .38);
  return zf + .075 * t * t;
}

// 横断面は裾が広く、上肩が丸い。両端面も少し傾けて一続きのカバーにする。
function coolerHousing() {
  const section = new THREE.Shape();
  section.moveTo(-.92, 0); section.lineTo(.92, 0); section.lineTo(.80, .32);
  section.quadraticCurveTo(.78, .37, .69, .38);
  section.quadraticCurveTo(0, .41, -.69, .38);
  section.quadraticCurveTo(-.78, .37, -.80, .32); section.closePath();
  const geometry = new THREE.ExtrudeGeometry(section, { depth: 1, bevelEnabled: false, curveSegments: 6 });
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, (pos.getZ(i) - .5) * (1 - .055 * pos.getY(i) / .40));
  }
  geometry.computeVertexNormals();
  const part = basePart(geometry); geometry.dispose();
  return part;
}
const cooler = coolerHousing();

function addSouthernCooler(batch: GeoBatch, length: number, panZ: readonly number[]) {
  const add = adder(batch), base = YTOP_S - .035;
  // 集電装置がある車両では、台枠の内側に収まる長さにする。
  const span = Math.min(length * .69, ...panZ.map(z => 2 * (Math.abs(z) - 1.62)));
  batch.add('paint', cooler, M(0, base, 0, 0, 1, 1, span), 0xd8d9d4);
  const angle = Math.atan(.12 / .32);
  for (const side of [-1, 1]) {
    for (const fraction of [-.405, -.30, -.11, .11, .30, .405]) {
      const z = span * fraction;
      const width = span * .059;
      add(side * .851, base + .195, z, .012, .163, width, 0x525858, 0, 0, side * angle);
      for (const dy of [-.043, 0, .043]) {
        add(side * (.861 - dy * .375), base + .195 + dy, z, .013, .012, width, 0x969994, 0, 0, side * angle);
      }
    }
  }
}

/** 側面（head = 先頭車。前端 -Z 側に乗務員扉）。open = 折戸を開けた状態 */
export function paintSouthernSide(Lb: number, head: boolean, open = false): SheetMaps {
  const s = sideSheet(Lb, YTOP_S), hz = Lb / 2;
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, '#dfe2e7'); grd.addColorStop(1, '#bcc1c8');
  s.base(grd, .3, .7);
  s.rect(-hz - 1, hz + 1, 3.7, YTOP_S + .1, '#c4c8ce', .4, .6); // 屋根
  const hband = (b: V2, col: string, z0 = -hz - 1, z1 = hz + 1) => s.rect(z0, z1, b[0], b[1], col, .3, .2);
  if (head) {
    // 7100系と同じ: 乗務員扉の後ろで、前面の帯（青・橙）から窓上の帯へ斜めに立ち上がる。窓下の帯は客用扉から後ろ
    const zs = -hz + CREW_Z + CREW_W / 2 + .06, k = .62;
    sweepBand(s, Lb, FRONT_LINE, TOP_LINE, zs + .12, k, ORANGE, .3, .2);
    sweepBand(s, Lb, FRONT_BAND, TOP_BAND, zs, k, BLUE, .3, .2, -.12);
    // 10909号は社名部分だけ青が下に張り出す。後端の斜辺から銀の隙間と橙線が始まる。
    s.poly([[-hz + 3.88, 1.27], [-hz + 4.53, WAIST_BLUE[1]], [hz, WAIST_BLUE[1]],
      [hz, WAIST_BLUE[0]], [-hz + 6.92, WAIST_BLUE[0]], [-hz + 6.51, 1.27]], BLUE, .32, .16);
    s.poly([[-hz + 6.76, WAIST_ORANGE[0]], [-hz + 6.87, WAIST_ORANGE[1]],
      [hz, WAIST_ORANGE[1]], [hz, WAIST_ORANGE[0]]], ORANGE, .32, .16);
  } else {
    hband(TOP_BAND, BLUE); hband(TOP_LINE, ORANGE); hband(WAIST_BLUE, BLUE); hband(WAIST_ORANGE, ORANGE);
  }

  /** 折戸（片引きの2枚折り）: 閉 = 銀の扉に細い窓2枚、開 = 暗い車内 + 戸袋の縁 */
  const fold = (zc: number) => {
    const w = DOOR_W;
    s.rect(zc - w / 2 - .035, zc + w / 2 + .035, 1.13, 3.08, '#8f959c', .5, .3);
    if (open) {
      s.glass(zc - w / 2, zc + w / 2, 1.16, 3.05, '', 0, ['#4a463e', '#23262b']);
      s.rect(zc - w / 2, zc + w / 2, 1.16, 1.3, '#5b5f66', .6, .1);
      s.rect(zc - w / 2, zc + w / 2, 2.98, 3.05, '#d9d6c8', .5, 0);
      s.rect(zc + w / 2 - .12, zc + w / 2, 1.16, 3.05, '#c8ccd2', .35, .6);
      s.emit(zc - w / 2, zc + w / 2, 1.16, 3.05, s.emitGrad(1.3, 3.05, '#ffffff', '#6a5e48'));
      s.emit(zc - w / 2, zc + w / 2, 1.16, 1.3, '#000');
      s.emit(zc + w / 2 - .12, zc + w / 2, 1.16, 3.05, '#000');
      return;
    }
    s.rect(zc - w / 2, zc + w / 2, 1.16, 3.05, '#cfd3d9', .3, .65); // 扉は車体と同じ銀（7100系と同じく窓下の帯は扉で切れる）
    s.rect(zc - .012, zc + .012, 1.16, 3.05, '#6a7078');
    for (const sg of [-1, 1]) s.glass(zc + sg * .24 - .15, zc + sg * .24 + .15, WIN[0], WIN[1], '#5a6067', .05);
  };
  const smallWin = (zc: number, w: number) => s.glass(zc - w / 2, zc + w / 2, WIN[0], WIN[1], '#3f454b', .05);
  if (head) {
    // 乗務員扉（銀。帯は扉の上にも描く）
    const cz = -hz + CREW_Z;
    s.rect(cz - CREW_W / 2 - .03, cz + CREW_W / 2 + .03, 1.13, 3.08, '#8f959c', .5, .3);
    s.rect(cz - CREW_W / 2, cz + CREW_W / 2, 1.16, 3.05, '#cfd3d9', .3, .65);
    s.rect(cz - CREW_W / 2, cz + CREW_W / 2, FRONT_BAND[0], FRONT_BAND[1], BLUE, .3, .2);
    s.rect(cz - CREW_W / 2, cz + CREW_W / 2, FRONT_LINE[0], FRONT_LINE[1], ORANGE, .3, .2);
    s.glass(cz - .2, cz + .2, WIN[0] + .15, WIN[1], '#5a6067', .03);
    fold(-hz + HEAD_DOOR);
    // 客室窓 8枚（独立した窓）
    const n = 8, gap = .42, z0 = -hz + HEAD_DOOR + DOOR_W / 2 + .5, z1 = hz - .55, pitch = (z1 - z0 + gap) / n, w = pitch - gap;
    for (let i = 0; i < n; i++) s.glass(z0 + i * pitch, z0 + i * pitch + w, WIN[0], WIN[1], '#3a4046', .07, ['#34414f', '#141b23']);
  } else {
    fold(-hz + MID_DOOR);
    // 連続した1枚の大きな横長窓（黒い帯状）+ 車端側に小窓2枚
    s.glass(-hz + MID_DOOR + DOOR_W / 2 + .45, hz - 2.4, WIN[0], WIN[1], '#14181c', .06, ['#2a343f', '#0d1217']);
    smallWin(hz - 1.8, .6); smallWin(hz - .9, .6);
  }
  // 号車札（文字なし）
  s.rect(hz - 4.5, hz - 4.2, 3.28, 3.38, '#2b3138');
  return s.textures();
}

// 窓枠を展開面に描く。上辺は肩に向かって下がり、後端は裾に向かって後退する。
function southernWindow(s: Sheet, side: number) {
  const outline = (margin: number): V2[] => {
    const inner = .435 + margin, outer = 1.77 - margin;
    const bottom = FWIN[0] + margin, top = FWIN[1] - margin, radius = .105 - margin / 2;
    const points: V2[] = [];
    for (const [cx, cy, start] of [[outer-radius, top-radius, 0], [inner+radius, top-radius, 90],
      [inner+radius, bottom+radius, 180], [outer-radius, bottom+radius, 270]]) {
      for (let i = 0; i <= 8; i++) {
        const a = (start + i * 90 / 8) * Math.PI / 180;
        const u = cx + radius * Math.cos(a), y = cy + radius * Math.sin(a);
        const t = (y - bottom) / (top - bottom), across = (u-inner)/(outer-inner);
        points.push([side * (u - .24 * across * t), y - .065 * across * across * t]);
      }
    }
    return points;
  };
  s.poly(outline(0), '#282c30', .53, .15);
  const glass = outline(.032);
  s.poly(glass, '#415359', .62, .04);
  // 日よけの下端を水平に保ち、左右端を窓ガラスの輪郭で切る。
  const ctx = s.c;
  ctx.save(); ctx.beginPath();
  glass.forEach(([u,y],i) => i ? ctx.lineTo(s.X(u),s.Y(y)) : ctx.moveTo(s.X(u),s.Y(y)));
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#38534d'; ctx.fillRect(0,0,s.W,s.Y(3.19));
  ctx.restore();
}

export function paintSouthernFace(number = '10909'): SheetMaps {
  const H = FACE_WIDTH, s = faceSheet(H, YTOP_S, 1024, 768);
  const grd = s.c.createLinearGradient(0, 0, 0, s.H); grd.addColorStop(0, '#d9dce1'); grd.addColorStop(1, '#bcc1c8');
  s.base(grd, .3, .7);
  s.rect(-.50, .50, 2.04, 3.58, '#33383e', .55, .15, .055);
  s.rect(-H, H, ...FRONT_BAND, BLUE, .3, .2);
  s.rect(-H, H, ...FRONT_LINE, ORANGE, .3, .2);
  for (const side of [-1, 1]) southernWindow(s, side);
  for (const side of [-1, 1]) {
    windowSill(s, side * .72, 2.04);
  }
  // 貫通扉（黒い枠・窓付き・下は青）
  s.rect(-.47, .47, 1.22, 3.27, '#060708', .25, .2, .03);
  s.rect(-.4, .4, 1.26, 3.21, '#17191d', .3, .3, .02);
  s.rect(-.4, .4, 1.26, 2.05, '#c6cbd0', .38, .45);
  s.rect(-.4, .4, 1.52, 2.05, BLUE, .3, .25);
  s.rect(-.4, .4, 1.34, 1.47, ORANGE, .3, .15);
  s.cabGlass(-.26, .26, 2.15, 3.10, '#292e31', .035, ['#627273', '#485b60']);
  // 行先表示器の凹み（中央上部）
  s.rect(-.34, .34, 3.34, 3.56, '#414246', .45, .2, .04);
  // 右側の日よけに、編成の向きに応じた車番を載せる。
  s.text(number, -.80, 3.37, .155, '#e2e8e3', 600);
  s.emit(-H, H, Y0, YTOP_S + .1, '#000'); // 夜は運転台の窓を光らせない（客室窓は側面シートで発光）
  return s.textures();
}

/** 行先表示（種別 = 赤地に白、行先 = 黒地に白の1面）。label '特急サザン' は「サザン」と表示 */
export function ledSouthernTexture(label: string, dest: string): THREE.CanvasTexture {
  const [k, g] = cv(512, 128), shown = label === '特急サザン' ? 'サザン' : label;
  g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#d4202a'; g.fillRect(8, 8, 200, 112);
  g.fillStyle = '#0b0b0b'; g.fillRect(212, 8, 292, 112);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff'; g.font = `800 62px ${FONT}`; g.fillText(shown, 108, 66, 176);
  g.fillStyle = '#ffffff'; g.font = `700 66px ${FONT}`; g.fillText(dest, 358, 68, 268);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 1両分のジオメトリ */
export function buildSouthernCar(kind: CarKind, Lb: number, panZ: readonly number[]): CarParts {
  const hz = Lb / 2, head = kind === 'head', zf = -hz;
  const zAt = (x: number) => frontZ(zf, x);
  const cab = head ? southernCab(HALF, YTOP_S, HW_S, R_S, Lb, zAt, .15, FACE_WIDTH) : undefined;
  const shell = cab?.shell ?? shellGeo(HALF, [{ z: -hz, inset: 0 }, { z: hz, inset: 0 }], YTOP_S, Lb);
  const b = new GeoBatch(), add = adder(b), lit = new GeoBatch(), mkL = new GeoBatch(), mkR = new GeoBatch();
  const glows: THREE.Vector3[] = [];
  const roofTop = YTOP_S;
  for (const sx of [-1, 1]) add(sx * (HW_S - .03), 3.56, head ? .45 : 0, .024, .024, Lb - (head ? .90 : 0), 0x9aa0a7);
  addEndWall(b, hz, YTOP_S - .15, HW_S, 0xc2c6cc);
  let face: THREE.BufferGeometry | undefined, led: THREE.BufferGeometry | undefined, marks: CarParts['marks'];
  if (head) {
    // 10000系の大型前面ガラスは、貫通扉の左右から側面へ滑らかに回り込む。
    // 下端は側面寄りほど後退するため、前面下側の台形状にも連続する。
    face = cab!.face;
    const z = zf - .005;
    // 行先表示器は中央上部の黒い枠に収める。
    led = cabPanel([-.32, .32], [-.32, .32], 3.35, 3.55, zAt, .006);
    add7100Gangway(b, zf, 0x43474a);
    add(0, 1.22, zf - .10, .77, .035, .25, 0xb2b2ae);
    // 前照灯・標識灯・尾灯: 下部左右の銀の枠（1枠に2灯。内側 = 前照灯、外側 = 標識灯・尾灯）
    for (const sx of [-1, 1]) {
      const panel = (batch: GeoBatch, key: string, x: number, w: number, h: number, lift: number, color: number) => {
        const edges: V2 = [x-w/2, x+w/2];
        const surface = cabPanel(edges, edges, 1.685-h/2, 1.685+h/2, zAt, lift);
        batch.add(key, basePart(surface), M(0,0,0), color);
        surface.dispose();
      };
      panel(b, 'paint', sx * .89, .58, .26, .015, 0xd7dbdc);
      panel(b, 'paint', sx * .89, .51, .205, .021, 0x676e73);
      panel(lit, 'l', sx * .775, .196, .137, .029, 0xffffff);
      panel(sx > 0 ? mkL : mkR, 'l', sx * 1.005, .196, .137, .029, 0xffffff);
      glows.push(new THREE.Vector3(sx * .775, 1.685, zAt(sx * .775) - .2));
    }
    // ワイパー（前面窓の下）
    for (const sx of [-1, 1]) add(sx * .75, 2.20, z - .045, .024, .45, .023, 0x363c3d, 0, 0, sx * .57);
    // 裾（銀）・連結器・ホース
    // 10000系は灰色の左右分割スカートと中央の露出連結器。
    add7100Skirt(b, zf + .10, 0x757c84);
    // 開口の奥に機器箱と取付梁を置き、連結器の左右から台車を覆う。
    add(0, .80, zf + .70, 2.02, .48, .18, 0x35383a);
    for (const side of [-1, 1]) {
      add(side * 1.18, .70, zf + .60, .08, .68, .65, 0x636b72, 0, 0, -side * .23);
    }
    marks = { l: mkL.geometry('l')!, r: mkR.geometry('l')! };
  } else addEndWall(b, -hz, YTOP_S, HW_S, 0xc2c6cc);
  addUnderfloor(b, Lb, kind, { frame: 0x3a3d42, equip: 0x2b2e33, bogie: 0x24272b, equipmentDetail: true, frontCut: head ? .65 : 0 });
  add(0, roofTop + .03, 0, .4, .06, Lb - 1.4, 0xa9aeb4);
  addSouthernCooler(b, Lb, panZ);
  for (const p of panZ) addCrossArm(b, p, roofTop - .02);
  return { shell, face, paint: b.geometry('paint')!, led, head: lit.geometry('l') ?? undefined, marks, glows };
}
