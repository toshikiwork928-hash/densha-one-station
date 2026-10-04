// 自列車の外観（運転台視点以外で表示）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { onLight } from './batch';
import { createEmuKit, placeCar, type CarKind } from './emu';

export interface PlayerTrain {
  readonly group: THREE.Group;
  /** 編成両数 */
  readonly cars: number;
}

const CAR_LEN = 20;

/** n 両編成の車種並び（両端 = 先頭車、所々にパンタ付き） */
export function formation(n: number): CarKind[] {
  return Array.from({ length: n }, (_, i): CarKind => i === 0 || i === n - 1 ? 'head' : i % 3 === 2 ? 'pan' : 'mid');
}

export function createPlayerTrain(ctx: GameContext): PlayerTrain {
  const { scene, track, route } = ctx;
  const n = Math.max(2, Math.round(route.trainLength / CAR_LEN));
  const last = route.stations[route.stations.length - 1]?.name ?? '';
  const kit = createEmuKit({ carLen: CAR_LEN, dest: last, renderer: ctx.renderer });
  const group = new THREE.Group(); group.name = 'playerTrain'; scene.add(group);
  const cars = formation(n).map((k, i) => {
    const c = kit.makeCar(k, i === 0 ? 'front' : i === n - 1 ? 'rear' : 'mid');
    group.add(c); return c;
  });

  const bogie = CAR_LEN / 2 - .25 - 2.6;
  // 線路を照らす前照灯の光源は環境担当（env/night-lights.ts）。ここは灯具の発光・窓明かりのみ
  onLight(ctx, (n, t) => kit.setNight(Math.max(n, t)));

  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
  ctx.events.on('frame', () => {
    const s = ctx.state.train.s;
    group.visible = ctx.cameraMode !== 'cab';
    if (group.visible) {
      cars.forEach((c, i) => {
        const sc = s - CAR_LEN / 2 - i * CAR_LEN;
        p1.copy(track.at(sc + bogie, 0, .38)); p2.copy(track.at(sc - bogie, 0, .38));
        placeCar(c, p1, p2);
      });
    }
  });
  return { group, cars: n };
}
