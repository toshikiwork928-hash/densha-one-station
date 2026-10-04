// 待避の描画: 普通の待避中に本線を通過していく後続列車（st.overtake）と、
// 急行・特急で通過する2面4線駅の待避線に止まっている先行の普通（st.precedingS が待避線にいる間）
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { loopShape, loopZones, serviceOf } from '../route/service';
import type { TrainKind } from '../route/types';
import { placeCar } from './emu';
import { CAR_LEN, createTrainSet, type TrainCar } from './train-models';

interface SetView { group: THREE.Group; cars: TrainCar[] }

/** 近さの判定距離 [m]（風切り音） */
const NEAR = 60;

export function createOvertaking(ctx: GameContext): void {
  const { scene, track, route, events } = ctx, st = ctx.state;
  const cache = new Map<string, SetView>();
  const dest = route.stations[route.stations.length - 1]?.name ?? '';
  const view = (kind: TrainKind, units: number[], label: string): SetView => {
    const key = `${kind}:${units.join('+')}:${label}`;
    let v = cache.get(key);
    if (!v) {
      const group = new THREE.Group(); group.name = 'overtake-' + key; group.visible = false; scene.add(group);
      const cars = createTrainSet(kind, units.reduce((a, n) => a + n, 0), ctx.renderer, { dest, label, units });
      for (const c of cars) group.add(c.object);
      v = { group, cars }; cache.set(key, v);
    }
    return v;
  };
  const bogie = CAR_LEN / 2 - .25 - 2.6;
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  /** 先頭 head から後ろへ並べる。latAt = 横位置 */
  const place = (v: SetView, head: number, latAt: (s: number) => number) => {
    let sc = head;
    for (const c of v.cars) {
      sc -= c.length / 2;
      pa.copy(track.at(sc + bogie, latAt(sc + bogie), .38)); pb.copy(track.at(sc - bogie, latAt(sc - bogie), .38));
      placeCar(c.object, pa, pb);
      sc -= c.length / 2;
    }
  };
  const zones = loopZones(route);
  let hornDone = false, wasNear = false, lastH = 0;

  events.on('reset', () => { hornDone = false; });
  events.on('frame', () => {
    for (const v of cache.values()) v.group.visible = false;
    const playing = st.state === 'run' || st.state === 'dwell' || st.state === 'result';
    if (!playing) { if (wasNear) { events.emit('overtakePass', { proximity: 0 }); wasNear = false; } return; }
    const ps = st.train.s, plen = route.trainLength;

    // 後続の通過列車（本線 = 横位置 0）
    const o = st.overtake;
    if (o && o.phase === 'run') {
      const svc = serviceOf(route, o.passedBy)!;
      const v = view(svc.kind, svc.units, svc.name);
      v.group.visible = true;
      for (const c of v.cars) c.setDoors(o.stage === 'stopped' && o.localStopped); // 停車して接続中はドアを開ける
      place(v, o.head, () => 0);
      const gap = o.head < ps - plen ? ps - plen - o.head : o.head - o.len > ps ? o.head - o.len - ps : 0;
      if (!hornDone && o.head > ps - plen - 250) { hornDone = true; events.emit('oncomingHorn', { distance: Math.max(0, ps - plen - o.head) }); }
      const prox = Math.max(0, 1 - gap / NEAR);
      if (prox > 0 || wasNear) events.emit('overtakePass', { proximity: prox });
      wasNear = prox > 0;
    } else if (wasNear) { events.emit('overtakePass', { proximity: 0 }); wasNear = false; }

    // 待避線の先行普通（自列車が本線を通る駅のみ。自列車の近くにいるときだけ表示）
    const local = serviceOf(route, 'local');
    if (!local || st.sel.service === 'local') return;
    const h = st.precedingS, prevH = lastH;
    lastH = h;
    const z = zones.find(q => !route.stations[q.index].enterLoop && local.stops.includes(q.index) && h > q.inFrom && h < q.outTo + 400);
    if (!z || Math.abs(h - ps) > 1500) return;
    const v = view(local.kind, local.units, local.name);
    v.group.visible = true;
    // 待避線に停車している間はドアを開ける（動き出したら閉める）
    const still = Math.abs(h - prevH) < 1e-3;
    for (const c of v.cars) c.setDoors(still);
    place(v, h, s => z.lat * loopShape(z, s));
  });
}
