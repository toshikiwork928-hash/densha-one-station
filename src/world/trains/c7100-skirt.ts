import * as THREE from 'three';
import { basePart, GeoBatch, M, P } from '../batch';
import { adder } from './common';

// 7965号車の正面写真に合わせ、中央を開けたまま側板と下辺を一枚につなぐ。
const plate = new THREE.Shape();
plate.moveTo(-1.36, 1.08);
plate.lineTo(-1.13, .29); plate.quadraticCurveTo(-1.12, .24, -1.06, .24);
plate.lineTo(1.06, .24); plate.quadraticCurveTo(1.12, .24, 1.13, .29);
plate.lineTo(1.36, 1.08); plate.lineTo(1.10, 1.08);
plate.lineTo(.98, .41); plate.quadraticCurveTo(.97, .38, .93, .38);
plate.lineTo(-.93, .38); plate.quadraticCurveTo(-.97, .38, -.98, .41);
plate.lineTo(-1.10, 1.08); plate.closePath();
const geo = new THREE.ExtrudeGeometry(plate, {depth: .09, bevelEnabled: false, curveSegments: 3});
const pos = geo.getAttribute('position');
for (let i = 0; i < pos.count; i++) {
  const x = Math.abs(pos.getX(i));
  pos.setZ(i, pos.getZ(i) + .21 * Math.max(0, x - .85) / .51 + .05 * (1.08 - pos.getY(i)));
}
geo.computeVertexNormals();
const guard = basePart(geo);
const hose = basePart(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-.06, .89, .06), new THREE.Vector3(-.07, .70, -.035),
  new THREE.Vector3(-.035, .54, .013), new THREE.Vector3(.055, .57, .10),
  new THREE.Vector3(.085, .72, .15),
]), 8, .025, 6, false));

export function add7100Skirt(b: GeoBatch, z: number, color: THREE.ColorRepresentation = 0x777d80) {
  const add = adder(b);
  b.add('paint', guard, M(0, 0, z - .03), color);
  add(0, .81, z + .25, 1.95, .27, .21, 0x303539);
  add(0, .82, z + .02, .21, .21, .43, 0x4a4c4c);
  add(0, .82, z - .17, .32, .25, .17, 0x404345);
  add(-.095, .84, z - .261, .085, .11, .02, 0x272b2d);
  for (const x of [.56, .80]) {
    add(x, .95, z + .025, .12, .11, .12, 0x96938b);
    b.add('paint', hose, M(x, 0, z), 0x303333);
  }
  add(-.66, .69, z + .17, .57, .18, .19, 0x373c40);
  for (const x of [-.85, -.66, -.47]) {
    b.add('paint', P.cyl, M(x, .69, z + .055, 0, .14, .08, .14, Math.PI / 2), 0x525759);
  }
}

/** 8300系と12000系の裾。上端は外板の平面と丸い角をたどり、側面へ回り込む。 */
export function addWrapSkirt(b: GeoBatch, z: number, halfWidth: number, radius: number, color: number) {
  const faceEdge = halfWidth - radius;
  for (const side of [-1, 1]) {
    const outline = [[.60, .46, .01], [faceEdge, faceEdge * .85, .02]];
    for (let i = 1; i <= 10; i++) {
      const angle = Math.PI * i / 20;
      const x = faceEdge + radius * Math.sin(angle);
      outline.push([x, x * .85, radius * (1 - Math.cos(angle)) + .02]);
    }
    outline.push([halfWidth, halfWidth * .85, .94]);
    const points: number[] = [];
    for (let i = 1; i < outline.length; i++) {
      const upper = ([x, , dz]: number[]) => [side * x, 1.055, z + dz];
      const lower = ([, x, dz]: number[]) => [side * x, .39, z + dz + .14];
      const a = outline[i - 1], c = outline[i];
      const tris = [upper(a), upper(c), lower(a), lower(a), upper(c), lower(c)];
      if (side < 0) tris.reverse();
      points.push(...tris.flat());
    }
    const panel = new THREE.BufferGeometry();
    panel.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    panel.computeVertexNormals();
    b.add('paint', basePart(panel), M(0, 0, 0), color); panel.dispose();
  }
  const add = adder(b);
  add(0, .40, z + .20, .94, .09, .11, color);
  add(0, .80, z + .30, 1.25, .24, .17, 0x33393a);
  add(0, .82, z + .05, .28, .22, .45, 0x3a4144);
}
