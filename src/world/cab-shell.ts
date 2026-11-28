import * as THREE from 'three';
import type { TrainKind } from '../route/types';
import type { GameContext } from '../core/context';
import { GeoBatch, M, P } from './batch';

interface CabShell {
  wall: number;
  desk: number;
  sill: number;
  lintel: number;
  divider: number;
  radius: number;
  rake: number;
  blind?: number;
}

const oldCab: CabShell = { wall: 0xc3beb1, desk: 0x999994, sill: 2.51, lintel: 3.66, divider: .25, radius: .062, rake: .015 };
const wideCab: CabShell = { wall: 0xa8a69e, desk: 0x394148, sill: 2.46, lintel: 3.69, divider: .37, radius: .09, rake: .105 };
const shells: Record<TrainKind, CabShell> = {
  'commuter-old': oldCab,
  'commuter-7100-restored': oldCab,
  'commuter-6300': { ...oldCab, wall: 0xb8b6af, desk: 0x54585b },
  'commuter-new': { ...wideCab, wall: 0x979792, desk: 0x57595a, divider: .43 },
  'commuter-1000': { ...wideCab, wall: 0xb8b3a7, desk: 0x35393e, divider: .5 },
  'commuter-9000': { ...wideCab, wall: 0xc4c3b4, desk: 0x303648, divider: .31 },
  'commuter-2000': { ...wideCab, wall: 0xc3bcaa, desk: 0x635d51, divider: .27 },
  'commuter-2300': { ...wideCab, wall: 0xb1aba0, desk: 0x525452, divider: .22, radius: .065 },
  'southern-10000': { ...oldCab, wall: 0xc6bfac, desk: 0x394056, divider: .4, rake: .095 },
  'southern-12000': { ...wideCab, wall: 0xb6b9b6, desk: 0x42464c, divider: .41, rake: .15 },
  'limited-30000': { ...wideCab, wall: 0xaaa59a, desk: 0x454044, divider: .67, rake: .23, radius: .16 },
  limited: { wall: 0x716e68, desk: 0x3b4048, sill: 2.43, lintel: 3.62, divider: .34, radius: .15, rake: .21, blind: 0x263951 },
};

export const cabEyeLift = (kind: TrainKind): number => kind === 'limited' ? .55 : kind === 'limited-30000' ? .24 : 0;
export const leadingCabKind = (ctx: GameContext): TrainKind => ctx.service?.unitKinds?.[0] ?? ctx.service?.kind ?? 'commuter-new';
export const cabSeatOffset = (kind: TrainKind) => kind === 'limited' ? 0 : kind === 'limited-30000' ? -.1 : -.31;

function rounded(path: THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export function buildCabShell(root: THREE.Group, kind: TrainKind) {
  const p = shells[kind];
  const front = new THREE.Group();
  front.position.set(0, p.sill, -1.34);
  front.rotation.x = p.rake;
  root.add(front);
  const gangway = kind !== 'limited' && kind !== 'limited-30000';
  const lintel = p.lintel + (kind === 'limited' ? 0 : .24);
  const h = lintel - p.sill;
  // 運転台窓、貫通戸の落とし窓、助士側窓を別々に抜く。
  const doorLeft = -.25, doorWidth = .69;
  const driverRight = gangway ? doorLeft - p.divider * .22 : p.divider;
  const rightStart = gangway ? doorLeft + doorWidth + .078 : p.divider + .095;
  const leftEdge = gangway ? -1.445 : -1.36;
  const windows = kind === 'limited-30000' ? [{ x: -1.36, w: 2.74 }] : [
    { x: leftEdge, w: driverRight - leftEdge }, { x: rightStart, w: 1.38 - rightStart },
  ];
  const material = (color: number, roughness: number) => new THREE.MeshStandardMaterial({ color, roughness });
  const trim = material(0x292b29, .84), metal = material(0x777971, .48);
  const face = new THREE.Shape();
  rounded(face, -1.57, -1.27, 3.14, h + 1.56, .03);
  function plate(shape: THREE.Shape, mat: THREE.Material, depth: number, z: number) {
    const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: .003, bevelThickness: .003, curveSegments: 8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = z;
    front.add(mesh);
  }
  function glaze(sheet: THREE.Shape, x: number, y: number, w: number, height: number, radius: number, depth: number) {
    sheet.holes.push(rounded(new THREE.Path(), x, y, w, height, radius));
    for (const [inset, thickness, mat, z] of [[0, .024, trim, -.007], [.021, .004, metal, -.02]] as const) {
      const rim = new THREE.Shape();
      rounded(rim, x + inset - .005, y + inset - .005, w - inset * 2 + .01, height - inset * 2 + .01, radius);
      rim.holes.push(rounded(new THREE.Path(), x + inset + thickness, y + inset + thickness, w - 2 * (inset + thickness), height - 2 * (inset + thickness), radius - .013));
      plate(rim, mat, .025, depth + z);
    }
  }
  for (const {x, w} of windows) glaze(face, x, 0, w, h, p.radius, 0);
  if (gangway) {
    const bottom = -1.17, height = h - bottom + .085;
    face.holes.push(rounded(new THREE.Path(), doorLeft, bottom, doorWidth, height, .035));
    const jamb = new THREE.Shape();
    rounded(jamb, doorLeft - .012, bottom - .012, doorWidth + .024, height + .024, .043);
    jamb.holes.push(rounded(new THREE.Path(), doorLeft + .021, bottom + .021, doorWidth - .042, height - .042, .026));
    plate(jamb, trim, .083, -.02);
    const leaf = new THREE.Shape();
    rounded(leaf, doorLeft + .014, bottom + .014, doorWidth - .028, height - .028, .025);
    const lo = kind === 'commuter-1000' ? -.24 : kind === 'commuter-2300' ? .15 : .03;
    const border = kind === 'commuter-2300' ? .14 : .09;
    glaze(leaf, doorLeft + border, lo, doorWidth - 2 * border, h - lo - .105, .048, -.045);
    plate(leaf, material(new THREE.Color(p.wall).multiplyScalar(.85).getHex(), .55), .044, -.058);
    const fittings = new GeoBatch();
    const hardware = (x: number, y: number, z: number, w: number, ht: number, d: number, color: number) =>
      fittings.add('metal', P.box, M(x, y, z, 0, w, ht, d), color);
    const handleX = doorLeft + .061;
    for (const y of [.11, .35]) hardware(handleX, y, .022, .034, .038, .077, 0x898b85);
    fittings.add('metal', P.cyl, M(handleX, .23, .062, 0, .023, .266, .023), 0xb5b7af);
    for (const y of [-.38, h - .24]) {
      hardware(doorLeft + doorWidth - .027, y, .015, .065, .097, .025, 0x989994);
      fittings.add('metal', P.cyl, M(doorLeft + doorWidth - .01, y, .035, 0, .025, .105, .025), 0xb1b4aa);
    }
    fittings.build({ metal: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .45}) }, front);
  }
  const paint = material(p.wall, .74);
  // 塗装表面の細かな凹凸だけを繰り返す。光源の向きに応じて窓枠の陰影が変わる。
  const grain = new Uint8Array(64 * 64);
  let seed = 91;
  for (let i = 0; i < grain.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    grain[i] = seed >>> 24;
  }
  const finish = new THREE.DataTexture(grain, 64, 64, THREE.RedFormat);
  finish.wrapS = finish.wrapT = THREE.RepeatWrapping;
  finish.repeat.set(6, 6);
  finish.magFilter = THREE.LinearFilter;
  finish.minFilter = THREE.LinearMipmapLinearFilter;
  finish.generateMipmaps = true;
  finish.needsUpdate = true;
  paint.bumpMap = finish;
  paint.bumpScale = .00065;
  plate(face, paint, .06, 0);

  const batch = new GeoBatch();
  const box = (x: number, y: number, z: number, w: number, ht: number, d: number, col: number, rx = 0) =>
    batch.add('paint', P.box, M(x, y, z, 0, w, ht, d, rx), col);
  const rod = (a: THREE.Vector3, b: THREE.Vector3, diameter: number, color: number, target = batch) => {
    const axis = b.clone().sub(a);
    const length = axis.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    target.add('paint', P.cyl, new THREE.Matrix4().compose(a.clone().lerp(b, .5), rotation, new THREE.Vector3(diameter, length, diameter)), color);
  };
  // 手前の縁を丸めた机と、窓下の奥行きのある水切り。
  const deskWidth = gangway ? 1.57 : 2.96, deskX = gangway ? -.70 : 0;
  box(deskX, 2.37, -.87, deskWidth, .22, .9, p.desk);
  batch.add('paint', P.cyl, M(deskX, 2.46, -.425, 0, .07, deskWidth, .07, 0, Math.PI / 2), p.desk);
  for (const w of windows) box(w.x + w.w / 2, p.sill - .025, -1.27, w.w + .035, .055, .19, p.wall);
  box(0, kind === 'limited' ? 3.81 : lintel + .145, -.58, 3.06, .14, 1.64, p.wall);
  // 側窓の上枠・腰板と縦桟の間からホームが見える。
  for (const side of [-1, 1]) {
    box(side * 1.48, 2.24, -.43, .1, .66, 1.74, p.wall);
    box(side * 1.48, kind === 'limited' ? 3.69 : lintel + .03, -.43, .1, .21, 1.74, p.wall);
    box(side * 1.48, 3.05, -1.12, .09, 1.24, .09, p.wall);
    box(side * 1.435, 2.56, -.43, .06, .025, 1.74, 0x383a38);
  }
  // 巻き取り軸の端受け、日よけと下端の桟。
  const shadeWidth = windows[0].w - .13;
  const cx = windows[0].x + windows[0].w / 2;
  batch.add('paint', P.cyl, M(cx, lintel - .018, -1.19, 0, .065, shadeWidth, .065, 0, Math.PI / 2), 0x555750);
  for (const end of [-1, 1]) box(cx + end * shadeWidth / 2, lintel - .012, -1.2, .04, .092, .1, 0x85847e);
  if (p.blind) {
    box(cx, p.lintel - .11, -1.19, shadeWidth, .18, .015, p.blind);
    box(cx, p.lintel - .2, -1.18, shadeWidth, .014, .023, 0x30343b);
  }
  const classic = kind === 'commuter-old' || kind === 'commuter-7100-restored' || kind === 'commuter-6300';
  if (classic) {
    // 窓台の上に露出した空気式ワイパーの駆動箱と二本のリンク。
    const y = p.sill + .125;
    box(-.83, y - .088, -1.20, .64, .064, .16, 0x737571);
    box(-.77, y, -1.20, .40, .145, .13, 0x898779);
    box(-.77, y + .077, -1.20, .42, .014, .15, 0xb2b1a2);
    rod(new THREE.Vector3(-1.17, y + .082, -1.19), new THREE.Vector3(-.60, y + .082, -1.19), .021, 0xb9b7ad);
    batch.add('paint', P.cyl, M(-1.03, y + .096, -1.19, 0, .042, .14, .042), 0xa19986);
    batch.add('paint', P.cyl, M(-1.03, y + .166, -1.19, 0, .065, .018, .065), 0xcacac4);
  }
  let parkedWiper: THREE.Group | undefined;
  if (classic || kind === 'commuter-1000') {
    parkedWiper = new THREE.Group();
    front.add(parkedWiper);
    const arms = new GeoBatch();
    const alloy = classic ? 0x92816a : 0x393b3c;
    const link = (ax: number, ay: number, bx: number, by: number, d: number, color: number) =>
      rod(new THREE.Vector3(ax, ay, .008), new THREE.Vector3(bx, by, .008), d, color, arms);
    link(-.89, .084, -.525, .78, .019, alloy);
    link(-.81, .085, -.475, .78, .015, alloy);
    link(-.535, .78, -.465, .78, .028, alloy);
    link(-.536, .12, -.445, h - .06, .024, 0x252625);
    link(-.545, .13, -.455, h - .06, .009, alloy);
    arms.build({paint: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .49})}, parkedWiper);
  }
  // 左側の受話器と、窓柱に沿って垂れるカールコード。
  const phoneX = kind === 'limited' ? -1.29 : -1.38;
  if (!classic) {
    if (kind === 'commuter-1000') {
      box(-1.422, 3.07, -1.25, .125, .36, .06, 0xaaa49a);
      box(phoneX, 3.075, -1.19, .047, .065, .105, 0x777771);
      batch.add('paint', P.cyl, M(phoneX, 3.08, -1.12, 0, .036, .285, .036, -.12), 0xa5a59f);
      batch.add('paint', P.cyl, M(phoneX, 3.09, -1.122, 0, .04, .14, .04, -.12), 0x292c2c);
      batch.add('paint', P.cyl, M(phoneX, 3.203, -1.134, 0, .047, .07, .047, -.12), 0xc2c2bc);
      for (let i = -2; i <= 2; i++) box(phoneX + i * .006, 3.203, -1.112, .0023, .044, .002, 0x40413f, -.12);
    } else {
      box(-1.365, 2.94, -1.26, .25, .24, .065, p.wall);
      box(phoneX, 2.94, -1.22, .10, .31, .065, 0x65655f);
      box(phoneX, 2.95, -1.16, .046, .19, .052, 0x302f2e, -.1);
      for (const y of [2.84, 3.055]) {
        batch.add('paint', P.sphere, M(phoneX, y, -1.14, 0, .076, .075, .076), 0x363635);
      }
    }
    const cableY = kind === 'commuter-1000' ? 2.94 : 2.82;
    const cableZ = kind === 'commuter-1000' ? -1.105 : -1.16;
    let prev = new THREE.Vector3(phoneX, cableY, cableZ);
    for (let i = 1; i <= 64; i++) {
      const angle = i * Math.PI / 4;
      const next = new THREE.Vector3(phoneX + .012 * Math.sin(angle), cableY - i * .0034, cableZ - .01 + .009 * Math.cos(angle));
      rod(prev, next, .006, 0x323231);
      prev = next;
    }
  }
  if (classic || kind === 'commuter-1000') {
    // 旧型車は左窓柱に表示灯、1000系は貫通戸の脇に通話装置を収める。
    const x = classic ? -1.38 : doorLeft - .051;
    const y = classic ? 3.08 : 3.32;
    box(x, y, -1.185, classic ? .105 : .102, classic ? .56 : .4, .073, classic ? 0x383b37 : 0xaba89f);
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 512;
    const g = canvas.getContext('2d')!;
    const color = g.createLinearGradient(0, 0, 160, 0);
    color.addColorStop(0, classic ? '#302f2c' : '#aca9a0'); color.addColorStop(.4, classic ? '#151617' : '#cfccc2'); color.addColorStop(1, classic ? '#262726' : '#99978e');
    g.fillStyle = color; g.fillRect(0, 0, 160, 512); g.textAlign = 'center';
    if (classic) {
      ['力 行', 'ブレーキ', '電 源', '直 通', '予 備'].forEach((label, i) => {
        const row = 32 + i * 92;
        g.beginPath(); g.roundRect(22, row, 116, 47, 17); g.fillStyle = '#151813'; g.fill();
        g.strokeStyle = '#4d5047'; g.lineWidth = 2; g.stroke();
        g.fillStyle = i === 1 || i === 2 ? '#9fb274' : '#54584f'; g.font = 'bold 19px sans-serif'; g.fillText(label, 80, row + 30);
      });
    } else {
      g.fillStyle = '#575951'; g.fillRect(16, 42, 128, 76);
      g.fillStyle = '#a6b594'; g.font = '19px monospace'; g.fillText('GPS', 80, 74);
      g.fillStyle = '#dfa877'; g.fillText('1 2 3 4', 80, 103);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#4b4d47'; g.fillRect(22, 165 + 28 * i, 31, 23);
        g.fillStyle = '#d4bc72'; g.font = '14px monospace'; g.fillText(String(i + 1), 37, 181 + i * 28);
      }
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
        if (i * i + j * j > 10) continue;
        g.fillStyle = '#575650'; g.beginPath(); g.arc(87 + i * 9, 370 + j * 9, 2.5, 0, Math.PI * 2); g.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const fascia = new THREE.Mesh(new THREE.PlaneGeometry(classic ? .1 : .098, classic ? .54 : .392),
      new THREE.MeshStandardMaterial({map: texture, roughness: .53}));
    fascia.position.set(x, y, -1.146); root.add(fascia);
    for (const dy of [-.18, .18]) for (const dx of [-.039, .039])
      batch.add('paint', P.cyl, M(x + dx, y + dy, -1.145, 0, .009, .006, .009, Math.PI / 2), 0xb9bbb5);
  }
  batch.build({ paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 }) }, root);
  return parkedWiper;
}
