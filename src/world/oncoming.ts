// 対向列車（route.oncoming ごとに1編成）。tick で移動し、警笛・すれ違いをイベントで通知
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { OncomingSpec } from '../route/types';
import { onLight } from './batch';
import { createEmuKit, placeCar, type EmuKit } from './emu';
import { formation } from './player-train';

interface OncomingTrain {
  spec: OncomingSpec;
  group: THREE.Group;
  cars: THREE.Object3D[];
  active: boolean;
  done: boolean;
  head: number;
  horn: boolean;
}

export interface OncomingSystem {
  /** 走行中の対向列車の範囲（先頭 s < 最後尾 s）。踏切制御用 */
  activeSpans(): { head: number; tail: number }[];
}

export function createOncoming(ctx: GameContext): OncomingSystem {
  const { scene, track, events, route } = ctx;
  const kits = new Map<number, EmuKit>();
  const kitFor = (L: number) => {
    let k = kits.get(L);
    if (!k) { k = createEmuKit({ carLen: L, dest: route.stations[0]?.name ?? route.prevName ?? '', renderer: ctx.renderer }); kits.set(L, k); }
    return k;
  };
  const trains: OncomingTrain[] = route.oncoming.map(spec => {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const kit = kitFor(spec.carLen), n = spec.cars;
    const cars = formation(n).map((k, i) => { const c = kit.makeCar(k, i === 0 ? 'front' : i === n - 1 ? 'rear' : 'mid'); group.add(c); return c; });
    return { spec, group, cars, active: false, done: false, head: 0, horn: false };
  });
  onLight(ctx, n => { for (const k of kits.values()) k.setNight(n); });

  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function place(o: OncomingTrain) {
    const O = o.spec, bog = O.carLen / 2 - .25 - 2.6;
    o.cars.forEach((c, i) => {
      const s = o.head + O.carLen / 2 + i * (O.carLen + O.gap);
      // s が減る向きへ走るので前側台車は s - bog
      pa.copy(track.at(s - bog, O.lat, .38)); pb.copy(track.at(s + bog, O.lat, .38));
      placeCar(c, pa, pb);
    });
  }

  function update(o: OncomingTrain, dt: number, playerS: number) {
    const O = o.spec, speed = O.kmh / 3.6;
    if (!o.active && !o.done && playerS >= O.spawnAt) { o.active = true; o.head = O.startS; o.group.visible = true; }
    if (!o.active) return;
    o.head -= speed * dt;
    place(o);
    const tail = o.head + O.cars * (O.carLen + O.gap);
    const d = o.head - playerS;
    if (!o.horn && d > 0 && d < 260) { o.horn = true; events.emit('oncomingHorn', { distance: d }); }
    // すれ違い中（先頭〜最後尾が自車横）は風切り音
    const dist = d > 0 ? d : tail > playerS ? 0 : playerS - tail;
    events.emit('oncomingPass', { proximity: Math.max(0, 1 - dist / 60) });
    if (tail < playerS - 150 - route.trainLength) { o.active = false; o.done = true; o.group.visible = false; events.emit('oncomingPass', { proximity: 0 }); }
  }

  events.on('tick', ({ dt, train }) => { for (const o of trains) update(o, dt, train.s); });
  events.on('reset', () => {
    for (const o of trains) { Object.assign(o, { active: false, done: false, horn: false }); o.group.visible = false; }
  });

  return {
    activeSpans: () => trains.filter(o => o.active).map(o => ({ head: o.head, tail: o.head + o.spec.cars * (o.spec.carLen + o.spec.gap) })),
  };
}
