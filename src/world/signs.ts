// 線路脇の標識（route.signs から生成）。速度制限・制限解除は種別（編成長・分岐器）ごとに route.limits から作り直す
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { stationLoopLat } from '../route/service';
import type { Sign } from '../route/types';
import { limitTex, postMat, textBoard } from './canvas-tex';
import { cullByDistance } from './cull';

export function addSign(ctx: GameContext, tex: THREE.Texture, s: number, lat: number, w: number, h: number, y: number, yaw = 0, parent: THREE.Object3D = ctx.scene): THREE.Group {
  const t = ctx.track.trackAt(s), grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
  board.position.y = y; grp.add(board);
  const ph = y - h / 2, post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, ph, 6), postMat);
  post.position.y = ph / 2; grp.add(post);
  grp.position.copy(ctx.track.at(s, lat, 0)); grp.rotation.y = -t.phi + yaw;
  parent.add(grp);
  cullByDistance(ctx, grp, 800);
  return grp;
}

/** lat0 = 標識を立てる線路の横位置（待避線では横にずれる） */
function buildSign(ctx: GameContext, sg: Sign, lat0: number, parent?: THREE.Object3D): void {
  switch (sg.kind) {
    case 'limit': {
      const k = sg.size ?? 1.0;
      addSign(ctx, limitTex(sg.kmh), sg.s, lat0 + (sg.lat ?? -2.2), k, k, sg.y ?? 3.0, 0, parent);
      break;
    }
    case 'limitEnd':
      addSign(ctx, textBoard([{ t: '制限' }, { t: '解除' }], '#fff', '#e8502a', 256, 256, 80), sg.s, lat0 + (sg.lat ?? -2.2), .9, .9, 3.0, 0, parent);
      break;
    case 'distance':
      addSign(ctx, textBoard([{ t: sg.meters, size: 120 }], '#fff', '#111'), sg.s, lat0 + (sg.lat ?? -2.0), .7, .7, sg.meters >= 200 ? 2.2 : 2.9, 0, parent);
      break;
    case 'stopMarker':
      addSign(ctx, textBoard([{ t: String(sg.cars), size: 150 }, { t: '停止位置', size: 34 }], '#1b4fd1', '#fff', 256, 300), sg.s, lat0 + (sg.lat ?? -2.0), .9, 1.05, 3.0, 0, parent);
      break;
  }
}

export function buildSigns(ctx: GameContext): void {
  const { route, track, events } = ctx;
  // 距離標・停止位置目標はホームに面する線路（2面4線駅は待避線）の左
  for (const sg of route.signs) buildSign(ctx, sg, sg.kind === 'distance' || sg.kind === 'stopMarker' ? stationLoopLat(route, sg.s) : 0);
  if (!route.services) return;
  // 速度制限・解除: 自列車の走行線の左。解除標は、より厳しい制限の中・終着駅より先なら立てない
  const group = new THREE.Group(); group.name = 'limitSigns'; ctx.scene.add(group);
  let built = '';
  const rebuild = () => {
    const key = route.lineLimit + ':' + route.limits.map(L => `${L.from}-${L.to}-${L.kmh}`).join();
    if (key === built) return;
    built = key;
    for (const c of [...group.children]) {
      group.remove(c);
      c.traverse(o => { if (o instanceof THREE.Mesh && o.material !== postMat) { (o.material as THREE.MeshBasicMaterial).map?.dispose(); (o.material as THREE.Material).dispose(); o.geometry.dispose(); } });
    }
    const last = route.stations[route.stations.length - 1].stopS;
    // 始発駅を出た所の線区最高速度（種別ごと）
    buildSign(ctx, { kind: 'limit', s: route.startS + 60, kmh: route.lineLimit, size: .9 }, 0, group);
    for (const L of route.limits) {
      buildSign(ctx, { kind: 'limit', s: L.from, kmh: L.kmh }, track.pathLat(L.from), group);
      const inner = route.limits.some(o => o !== L && o.kmh <= L.kmh && L.to > o.from && L.to < o.to);
      if (!inner && L.to < last) buildSign(ctx, { kind: 'limitEnd', s: L.to }, track.pathLat(L.to), group);
    }
  };
  rebuild();
  events.on('serviceChange', rebuild);
  events.on('reset', rebuild);
}

