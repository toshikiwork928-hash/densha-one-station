import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { placeCar } from './emu';
import { buildCabShell, cabEyeLift, cabSeatOffset, leadingCabKind } from './cab-shell';
import { createCabInstruments } from './cab-instruments';

function releaseCab(group: THREE.Group) {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const geometry = new Set<THREE.BufferGeometry>();
  group.traverse(part => {
    if (!(part instanceof THREE.Mesh)) return;
    geometry.add(part.geometry);
    for (const mat of Array.isArray(part.material) ? part.material : [part.material]) materials.add(mat);
  });
  for (const mat of materials) {
    for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    mat.dispose();
  }
  for (const tex of textures) tex.dispose();
  for (const geom of geometry) geom.dispose();
  group.removeFromParent();
}

export function createCab(ctx: GameContext): void {
  const root = new THREE.Group();
  root.name = 'cab3d';
  ctx.scene.add(root);
  let body: THREE.Group | undefined;
  let parkedWiper: THREE.Object3D | undefined;
  let instruments: ReturnType<typeof createCabInstruments>;
  function rebuild() {
    const kind = leadingCabKind(ctx);
    if (body?.name === kind) {
      instruments.redrawCard();
      return;
    }
    if (body) releaseCab(body);
    body = new THREE.Group();
    body.name = kind;
    body.position.y = cabEyeLift(kind);
    parkedWiper = buildCabShell(body, kind);
    const controls = new THREE.Group();
    controls.position.x = cabSeatOffset(kind);
    body.add(controls);
    instruments = createCabInstruments(ctx, controls, kind);
    body.traverse(part => { part.userData.noShadow = true; });
    root.add(body);
  }
  rebuild();
  ctx.events.on('serviceChange', rebuild);
  ctx.events.on('reset', rebuild);
  const frame = document.getElementById('cabframe');
  if (frame) frame.style.display = 'none';
  const front = new THREE.Vector3(), rear = new THREE.Vector3();
  ctx.events.on('frame', ({ dt, time }) => {
    root.visible = ctx.cameraMode === 'cab';
    if (!root.visible) return;
    const s = ctx.state.train.s;
    front.copy(ctx.track.pathAt(s - 3, 0, 0));
    rear.copy(ctx.track.pathAt(s - 17, 0, 0));
    placeCar(root, front, rear);
    root.position.copy(ctx.track.pathAt(s, 0, 0));
    if (parkedWiper) parkedWiper.visible = !ctx.env?.overlayWiperVisible;
    instruments.update(dt, time);
  });
}
