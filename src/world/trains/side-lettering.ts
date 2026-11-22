import * as THREE from 'three';
import { type TrainKind } from '../../route/types';
import { canvasTexture, cv } from './common';

const plane = new THREE.PlaneGeometry(1, 1);
const inks = new Map<string, THREE.MeshBasicMaterial>();

function ink(text: string, color: string, italic: boolean) {
  const key = [text, color, italic].join('/');
  let mat = inks.get(key);
  if (mat) return mat;
  const [canvas, g] = cv(512, 96);
  g.font = `${italic ? 'italic ' : ''}${text === 'NANKAI' ? 400 : 600} 76px Arial, sans-serif`;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (text === 'NANKAI') {
    g.translate(256, 49);
    g.scale(475 / g.measureText(text).width, 1.12);
    g.fillText(text, 0, 0);
  } else g.fillText(text, 256, 49, 492);
  mat = new THREE.MeshBasicMaterial({ map: canvasTexture(canvas, true), transparent: true, depthWrite: false });
  inks.set(key, mat);
  return mat;
}

// 左右で別々に文字面を外へ向け、車体側面の文字を正しい向きに保つ。
export function addSideLettering(body: THREE.Group, kind: TrainKind, length: number, hasPan: boolean) {
  const mark = (text: string, color: string, z: number, y: number, width: number, height: number,
    halfWidth: number, italic = false) => {
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(plane, ink(text, color, italic));
      mesh.name = text;
      mesh.position.set(side * (halfWidth + .006), y, z * length);
      mesh.rotation.y = side * Math.PI / 2; mesh.scale.set(width, height, 1);
      body.add(mesh);
    }
  };
  if (kind === 'southern-12000') {
    mark('SOUTHERN', '#f4b92e', -.035, 1.45, 2.75, .39, 1.45);
    mark('Premium', '#fafbfa', .062, 1.40, 1.05, .23, 1.45, true);
    mark('NANKAI', '#305996', .39, 2.45, 1.33, .29, 1.45, true);
  } else if (kind === 'southern-10000') {
    mark('NANKAI', '#e2e4de', -.221, 1.57, 1.08, .29, 1.45, true);
  } else if (kind === 'commuter-1000') {
    mark('NANKAI', '#283f73', -.287, 1.51, .94, .21, 1.45, true);
  } else if (kind === 'commuter-2000') {
    mark('NANKAI', '#253b77', -.167, 1.595, .94, .205, 1.4, true);
    mark(hasPan ? '2039' : '2189', '#293d75', 0, 1.422, .60, .14, 1.4);
  } else if (kind === 'commuter-new' || kind === 'commuter-old' || kind === 'commuter-6300' || kind === 'commuter-9000') {
    const z = kind === 'commuter-new' ? -.278 : -.245;
    const y = kind === 'commuter-new' ? 1.65 : kind === 'commuter-9000' ? 1.61 : 1.54;
    mark('NANKAI', '#263d89', z, y, .96, .23, 1.45, true);
  } else if (kind === 'commuter-2300') {
    mark('NANKAI', '#533d46', -.13, 1.40, .91, .21, 1.37, true);
  } else if (kind === 'limited-30000') {
    mark('NANKAI', '#eee7dc', -.22, 1.50, .91, .21, 1.40, true);
  } else if (kind === 'limited') {
    mark('rapi:t', '#ced4d8', .38, 2.58, .75, .22, 1.42);
  }
}
