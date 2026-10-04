// 線路脇の標識（route.signs から生成）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { Sign } from '../route/types';
import { limitTex, postMat, textBoard } from './canvas-tex';
import { cullByDistance } from './cull';

export function addSign(ctx: GameContext, tex: THREE.Texture, s: number, lat: number, w: number, h: number, y: number, yaw = 0): THREE.Group {
  const t = ctx.track.trackAt(s), grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
  board.position.y = y; grp.add(board);
  const ph = y - h / 2, post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, ph, 6), postMat);
  post.position.y = ph / 2; grp.add(post);
  grp.position.copy(ctx.track.at(s, lat, 0)); grp.rotation.y = -t.phi + yaw;
  ctx.scene.add(grp);
  cullByDistance(ctx, grp, 800);
  return grp;
}

function buildSign(ctx: GameContext, sg: Sign): void {
  switch (sg.kind) {
    case 'limit': {
      const k = sg.size ?? 1.0;
      addSign(ctx, limitTex(sg.kmh), sg.s, sg.lat ?? -2.2, k, k, sg.y ?? 3.0);
      break;
    }
    case 'limitEnd':
      addSign(ctx, textBoard([{ t: '制限' }, { t: '解除' }], '#fff', '#e8502a', 256, 256, 80), sg.s, sg.lat ?? -2.2, .9, .9, 3.0);
      break;
    case 'distance':
      addSign(ctx, textBoard([{ t: sg.meters, size: 120 }], '#fff', '#111'), sg.s, sg.lat ?? -2.0, .7, .7, sg.meters >= 200 ? 2.2 : 2.9);
      break;
    case 'stopMarker':
      addSign(ctx, textBoard([{ t: String(sg.cars), size: 150 }, { t: '停止位置', size: 34 }], '#1b4fd1', '#fff', 256, 300), sg.s, sg.lat ?? -2.0, .9, 1.05, 3.0);
      break;
  }
}

export function buildSigns(ctx: GameContext): void {
  for (const sg of ctx.route.signs) buildSign(ctx, sg);
}

