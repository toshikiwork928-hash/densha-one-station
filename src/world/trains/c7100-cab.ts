import * as THREE from 'three';
import { basePart, GeoBatch, M, P } from '../batch';
import { faceSheet, Y0, type V2 } from './common';
import { BLUE_7100, FRONT_BLUE_7100, FRONT_ORANGE_7100, ORANGE_7100, RESTORED_LOWER, RESTORED_UPPER, RESTORED_SPLIT } from './c7100-side';

/** 側板から肩へ小さな曲率で立ち上がり、屋根の中央でなだらかにつなぐ。 */
export const SECTION_7100: V2[] = [
  [1.43, Y0], [1.45, 1.13], [1.45, 3.26], [1.44, 3.39], [1.40, 3.51],
  [1.32, 3.62], [1.18, 3.70], [.94, 3.76], [.53, 3.82], [0, 3.84],
];

/** 中央の貫通扉を平らに保ち、窓・腰板を左右の肩へ向かって後退させる。 */
export function curve7100Z(x: number, _y: number, zf: number): number {
  const edge = Math.max(0, Math.abs(x) - .46);
  return zf + .15 * edge * edge;
}

/** シェル最前リングにも同じ曲率を与え、前面外周との白い隙間を防ぐ。 */
export function curve7100Shell(g: THREE.BufferGeometry, zf: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), fade = Math.max(0, Math.min(1, 1 - (z - zf) / .24));
    if (fade > 0) p.setZ(i, z + (curve7100Z(p.getX(i), p.getY(i), zf) - zf) * fade);
  }
  p.needsUpdate = true; g.computeVertexNormals();
  return g;
}

export function paint7100Cab(hw: number, top: number, restored = false, number = '7157', stainless = false) {
  const s = faceSheet(hw, top);
  const enamel = s.c.createLinearGradient(0, 0, 0, s.H);
  enamel.addColorStop(0, '#d1d4d8');
  enamel.addColorStop(1, '#b7bcc2');
  if (restored) {
    s.base(RESTORED_UPPER, .45, .12);
    s.rect(-hw, hw, Y0, RESTORED_SPLIT, RESTORED_LOWER, .45, .12);
  } else {
    s.base(enamel, stainless ? .32 : .43, stainless ? .65 : .14);
    if (stainless) {
      for (let y = 1.39; y < 2.1; y += .055) {
        for (const [l, r] of [[-hw, -.47], [.47, hw]]) s.rect(l, r, y, y + .016, '#90969a', .33, .65);
      }
    }
    s.rect(-hw, hw, ...FRONT_BLUE_7100, BLUE_7100, .38, .12);
    s.rect(-hw, hw, ...FRONT_ORANGE_7100, ORANGE_7100, .38, .12);
    if (stainless) {
      for (let y = FRONT_BLUE_7100[0]; y < FRONT_BLUE_7100[1] - .03; y += .067) {
        for (const [l, r] of [[-hw, -.47], [.47, hw]]) s.rect(l, r, y, y + .022, 'rgba(20,22,40,.25)');
      }
    }
  }

  function windshield(x: number, half: number) {
    const lo = 2.15, hi = 2.94;
    const l = x - half, r = x + half;
    s.rect(l - .042, r + .042, lo - .042, hi + .042, '#929699', .32, .52, .065);
    s.rect(l - .02, r + .02, lo - .02, hi + .02, '#2b3135', .62, .06, .05);
    if (stainless) {
      s.cabGlass(l, r, lo, hi, '', .035);
      return;
    }
    s.glass(l, r, lo, hi, '', .035, ['#405359', '#202d31']);
    s.poly([[l + .025, hi - .08], [r - .025, hi - .08], [r - .025, hi - .24], [l + .025, hi - .37]], 'rgba(174,199,203,.13)');
    s.rect(l + .025, r - .025, lo + .025, lo + .095, '#262d30');
  }
  windshield(.855, .325);
  windshield(-.855, .325);
  windshield(0, .255);
  s.text(number, 0, 1.83, .17, '#f4f5f4', 600);
  s.rect(.50, 1.20, 3.025, 3.275, '#939899', .29, .46, .10);
  s.rect(.52, 1.18, 3.045, 3.255, '#24282c', .34, .1, .08);
  s.emit(-hw, hw, Y0, top, '#000');
  return s.textures();
}

/** 実物の幌受けは角が丸い。細い金属縁とその背後のゴムを別の奥行きで描く。 */
function roundedLoop(path: THREE.Path, w: number, h: number, r: number) {
  const x = w / 2, y = h / 2;
  path.moveTo(-x + r, -y);
  path.lineTo(x - r, -y); path.quadraticCurveTo(x, -y, x, -y + r);
  path.lineTo(x, y - r); path.quadraticCurveTo(x, y, x - r, y);
  path.lineTo(-x + r, y); path.quadraticCurveTo(-x, y, -x, y - r);
  path.lineTo(-x, -y + r); path.quadraticCurveTo(-x, -y, -x + r, -y);
}
function gangwayFrame(width: number, height: number, radius: number, rim: number, depth: number) {
  const frame = new THREE.Shape(), opening = new THREE.Path();
  roundedLoop(frame, width, height, radius);
  roundedLoop(opening, width - 2 * rim, height - 2 * rim, radius - rim);
  frame.holes.push(opening);
  return basePart(new THREE.ExtrudeGeometry(frame, {depth, bevelEnabled: false, curveSegments: 4}));
}
const rubber = gangwayFrame(.94, 2.14, .16, .048, .06);
const metal = gangwayFrame(.89, 2.09, .14, .034, .035);
const headlightShape = new THREE.Shape();
roundedLoop(headlightShape, .89, .30, .13);
const headlightShell = basePart(new THREE.ExtrudeGeometry(headlightShape, {
  depth: .32, bevelEnabled: true, bevelSegments: 2, bevelSize: .012, bevelThickness: .012, curveSegments: 6,
}));

export function add7100HeadlightShell(b: GeoBatch, z: number) {
  b.add('paint', headlightShell, M(0, 3.62, z - .075), 0xb8b9b6);
}

// 7170号の正面向かって右に並ぶ金具。薄い踏み板を下から三角のリブで支える。
const braceProfile = new THREE.Shape();
braceProfile.moveTo(0, -.115);
braceProfile.lineTo(.086, 0);
braceProfile.lineTo(0, 0);
braceProfile.closePath();
const stepBrace = basePart(new THREE.ExtrudeGeometry(braceProfile, { depth: .016, bevelEnabled: false })
  .translate(0, 0, -.008).rotateY(Math.PI / 2));

export function add7100CornerSteps(b: GeoBatch, zf: number, restored: boolean) {
  const yaw = .52, x = -1.33;
  const z = curve7100Z(x, 2, zf) + .010;
  for (const y of [1.32, 1.81, 2.30, 2.79, 3.28]) {
    const color = restored ? (y < RESTORED_SPLIT ? RESTORED_LOWER : RESTORED_UPPER) : '#a1a6a5';
    b.add('paint', P.box, M(x, y - .066, z, yaw, .066, .14, .030), color);
    b.add('paint', stepBrace, M(x, y - .010, z, yaw), color);
    b.add('paint', P.box, M(x - .047 * Math.sin(yaw), y, z - .047 * Math.cos(yaw),
      yaw, .115, .018, .11), color);
  }
}

export function add7100Gangway(b: GeoBatch, z: number, frameColor = 0xbabcb9) {
  b.add('paint', rubber, M(0, 2.27, z - .066), 0x333638);
  b.add('paint', metal, M(0, 2.27, z - .085), frameColor);
}
