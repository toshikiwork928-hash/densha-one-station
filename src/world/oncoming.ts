// 対向列車（route.oncoming ごとに1編成。種別・両数が混在）。tick で移動し、警笛・すれ違いをイベントで通知
// spec.kind 未指定なら 普通(新型4両) → 急行(旧型6両) → 特急(6両) の順に割り当てる
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { OncomingSpec, TrainKind } from '../route/types';
import { onLight } from './batch';
import { placeCar } from './emu';
import { createTrainSet, setTrainNight, TRAIN_KINDS, type TrainCar } from './train-models';

interface OncomingTrain {
  spec: OncomingSpec;
  kind: TrainKind;
  group: THREE.Group;
  cars: TrainCar[];
  /** 編成長 [m] */
  length: number;
  active: boolean;
  done: boolean;
  head: number;
  horn: boolean;
}

export interface OncomingSystem {
  /** 走行中の対向列車の範囲（先頭 s < 最後尾 s）。踏切制御用 */
  activeSpans(): { head: number; tail: number }[];
}

/** 既定の種別ローテーション */
const MIX: { kind: TrainKind; cars: number; kmhScale: number }[] = [
  { kind: 'commuter-new', cars: 4, kmhScale: .95 },
  { kind: 'commuter-old', cars: 6, kmhScale: 1 },
  { kind: 'limited', cars: 6, kmhScale: 1.12 },
];

export function createOncoming(ctx: GameContext): OncomingSystem {
  const { scene, track, events, route } = ctx;
  const dest = route.stations[0]?.name ?? route.prevName ?? '';
  const trains: OncomingTrain[] = route.oncoming.map((spec0, i) => {
    const mix = MIX[i % MIX.length];
    const spec: OncomingSpec = spec0.kind ? spec0 : { ...spec0, kind: mix.kind, cars: mix.cars, kmh: Math.round(spec0.kmh * mix.kmhScale) };
    const kind = spec.kind!;
    const group = new THREE.Group(); group.visible = false; group.name = `oncoming-${kind}`; scene.add(group);
    const cars = createTrainSet(kind, spec.cars, ctx.renderer, { dest: spec.dest ?? dest, label: spec.label ?? TRAIN_KINDS[kind].service });
    for (const c of cars) group.add(c.object);
    const length = cars.reduce((a, c) => a + c.length, 0);
    return { spec, kind, group, cars, length, active: false, done: false, head: 0, horn: false };
  });
  // 窓明かり・前照灯グロー（全編成共通。トンネル内でも点灯）
  onLight(ctx, (n, t) => setTrainNight(Math.max(n, t)));

  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function place(o: OncomingTrain) {
    let s0 = o.head;
    for (const c of o.cars) {
      const s = s0 + c.length / 2, bog = c.length / 2 - .25 - 2.6;
      // s が減る向きへ走るので前側台車は s - bog
      pa.copy(track.at(s - bog, o.spec.lat, .38)); pb.copy(track.at(s + bog, o.spec.lat, .38));
      placeCar(c.object, pa, pb);
      s0 += c.length;
    }
  }

  /** 戻り値 = すれ違いの近さ 0..1（非走行なら -1） */
  function update(o: OncomingTrain, dt: number, playerS: number): number {
    const O = o.spec, speed = O.kmh / 3.6;
    if (!o.active && !o.done && playerS >= O.spawnAt) { o.active = true; o.head = O.startS; o.group.visible = true; }
    if (!o.active) return -1;
    o.head -= speed * dt;
    place(o);
    const tail = o.head + o.length;
    const d = o.head - playerS;
    if (!o.horn && d > 0 && d < 260) { o.horn = true; events.emit('oncomingHorn', { distance: d }); }
    // すれ違い中（先頭〜最後尾が自車横）は風切り音
    const dist = d > 0 ? d : tail > playerS ? 0 : playerS - tail;
    if (tail < playerS - 150 - route.trainLength) { o.active = false; o.done = true; o.group.visible = false; return 0; }
    return Math.max(0, 1 - dist / 60);
  }

  // 複数編成が同時に走っても近さは最大値で1回だけ通知
  events.on('tick', ({ dt, train }) => {
    let p = -1;
    for (const o of trains) p = Math.max(p, update(o, dt, train.s));
    if (p >= 0) events.emit('oncomingPass', { proximity: p });
  });
  events.on('reset', () => {
    for (const o of trains) { Object.assign(o, { active: false, done: false, horn: false }); o.group.visible = false; }
  });

  return {
    activeSpans: () => trains.filter(o => o.active).map(o => ({ head: o.head, tail: o.head + o.length })),
  };
}
