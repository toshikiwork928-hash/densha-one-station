// 対向列車（route.oncoming ごとに1編成。種別・両数が混在）。frame で移動し、警笛・すれ違いをイベントで通知
// 走り抜けるものと、駅（spec.stop）に停車してドアを開け、自列車が同じ駅で停車して少し経つと発車するものがある
// 同時に走る対向列車は1編成だけ（対向線の上で追いつき・重なりを起こさない）。車両セットは種別・両数ごとに使い回す
// spec.kind 未指定なら 普通(新型4両) → 急行(旧型6両) → 特急(6両) の順に割り当てる
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { OncomingSpec, Station, TrainKind } from '../route/types';
import { islandOffset } from '../route/service';
import { onLight } from './batch';
import { placeCar } from './emu';
import { createTrainSet, setTrainNight, TRAIN_KINDS, type TrainCar } from './train-models';

/** 車両セット（種別・両数・表示ごとに1つ。使用中は他の編成へ貸さない） */
interface SetView { key: string; group: THREE.Group; cars: TrainCar[]; length: number; inUse: boolean }

/** cruise = 巡航、brake = 停車駅へ制動、stopped = 停車（ドア開）、closing = 戸閉め、accel = 発車（以後は cruise） */
type Phase = 'cruise' | 'brake' | 'stopped' | 'closing' | 'accel';

interface OncomingTrain {
  spec: OncomingSpec;
  kind: TrainKind;
  view: SetView | null;
  active: boolean;
  done: boolean;
  head: number;
  /** 速度 [m/s] */
  v: number;
  phase: Phase;
  /** 停車駅を発車済み */
  left: boolean;
  /** 停車してからの経過 / 戸閉めからの経過 / 自列車が同じ駅で停車してからの経過 [s] */
  tStop: number;
  tClose: number;
  tPlayer: number;
  horn: boolean;
}

export interface OncomingSystem {
  /** 走行中の対向列車の範囲（先頭 s < 最後尾 s）。踏切制御用。停車中の列車は含めない */
  activeSpans(): { head: number; tail: number }[];
}

/** 既定の種別ローテーション */
const MIX: { kind: TrainKind; cars: number; kmhScale: number }[] = [
  { kind: 'commuter-new', cars: 4, kmhScale: .95 },
  { kind: 'commuter-old', cars: 6, kmhScale: 1 },
  { kind: 'limited', cars: 6, kmhScale: 1.12 },
];

/** 制動・加速度 [m/s²] */
const DECEL = .9, ACCEL = .8;
/** 停車してから発車できるまでの最短時間（自列車が来る前でも）・自列車の停車後に待つ時間・待ち続ける上限・戸閉めの時間 [s] */
const MIN_DWELL = 12, AFTER_PLAYER = 8, MAX_DWELL = 300, CLOSE_T = 5;
/** 出現させる最小距離 [m]（自列車の前方これ以上遠くでないと、出現が見えるので出さない） */
const MIN_SPAWN_DIST = 800;
/** 自列車の後方にこれ以上離れたら消す [m]（編成長に加える） */
const VANISH = 250;

/** 停車中の対向列車のドアを開ける側（対向列車の進行方向に対して）。相対式・2面4線の本線: ホームは対向線の外側（+lat）= 左、島式1面2線: ホームは線間 = 右 */
const doorSide = (sta: Station): 'L' | 'R' => sta.island ? 'R' : sta.loop ? 'L' : sta.platform.side;

export function createOncoming(ctx: GameContext): OncomingSystem {
  const { scene, track, events, route } = ctx, st = ctx.state;
  const dest = route.stations[0]?.name ?? route.prevName ?? '';
  const sets = new Map<string, SetView[]>();
  const labelOf = (o: { spec: OncomingSpec; kind: TrainKind }) => o.spec.label ?? TRAIN_KINDS[o.kind].service;
  const keyOf = (o: { spec: OncomingSpec; kind: TrainKind }) => `${o.kind}:${o.spec.cars}:${labelOf(o)}:${o.spec.dest ?? dest}`;
  const build = (o: { spec: OncomingSpec; kind: TrainKind }): SetView => {
    const key = keyOf(o);
    const group = new THREE.Group(); group.visible = false; group.name = `oncoming-${o.kind}`; scene.add(group);
    const list = createTrainSet(o.kind, o.spec.cars, ctx.renderer, { dest: o.spec.dest ?? dest, label: labelOf(o) });
    for (const c of list) group.add(c.object);
    const v: SetView = { key, group, cars: list, length: list.reduce((a, c) => a + c.length, 0), inUse: false };
    const arr = sets.get(key) ?? []; arr.push(v); sets.set(key, arr);
    return v;
  };
  const trains: OncomingTrain[] = route.oncoming.map((spec0, i) => {
    const mix = MIX[i % MIX.length];
    const spec: OncomingSpec = spec0.kind ? spec0 : { ...spec0, kind: mix.kind, cars: mix.cars, kmh: Math.round(spec0.kmh * mix.kmhScale) };
    return { spec, kind: spec.kind!, view: null, active: false, done: false, head: 0, v: 0, phase: 'cruise', left: false, tStop: 0, tClose: 0, tPlayer: 0, horn: false };
  });
  // 種別・両数ごとに1セットを先に作る（出現時の負荷を避ける）
  for (const o of trains) if (!sets.has(keyOf(o))) build(o);
  const acquire = (o: OncomingTrain): SetView => {
    const v = sets.get(keyOf(o))?.find(x => !x.inUse) ?? build(o);
    v.inUse = true; v.group.visible = true;
    for (const c of v.cars) c.setDoors(false);
    return v;
  };
  const release = (o: OncomingTrain) => { if (o.view) { o.view.inUse = false; o.view.group.visible = false; o.view = null; } };
  // 窓明かり・前照灯グロー（全編成共通。トンネル内でも点灯）
  onLight(ctx, (n, t) => setTrainNight(Math.max(n, t)));

  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function place(o: OncomingTrain) {
    let s0 = o.head;
    const lat = o.spec.lat;
    for (const c of o.view!.cars) {
      const s = s0 + c.length / 2, bog = c.length / 2 - .25 - 2.6;
      // s が減る向きへ走るので前側台車は s - bog
      // 島式ホーム駅では対向線もホームの反対側へ開く
      pa.copy(track.at(s - bog, lat + islandOffset(route, lat, s - bog), .38)); pb.copy(track.at(s + bog, lat + islandOffset(route, lat, s + bog), .38));
      placeCar(c.object, pa, pb);
      s0 += c.length;
    }
  }

  const finish = (o: OncomingTrain) => { o.active = false; o.done = true; release(o); };

  /** 戻り値 = すれ違いの近さ 0..1（非走行なら -1） */
  function update(o: OncomingTrain, dt: number, ps: number, pv: number): number {
    const O = o.spec, vmax = O.kmh / 3.6, stop = O.stop, view = o.view!;
    const len = view.length;
    switch (o.phase) {
      case 'cruise':
        o.v = vmax;
        if (stop && !o.left && o.head - stop.headS <= o.v * o.v / (2 * DECEL)) o.phase = 'brake';
        break;
      case 'brake': {
        const d = Math.max(o.head - stop!.headS, .5);
        o.v = Math.max(0, o.v - Math.max(DECEL, o.v * o.v / (2 * d)) * dt);
        // 停止位置の手前 1.5m 以内で止まったら位置を合わせる
        if (o.v < .15 || o.head - stop!.headS < .3) {
          if (o.head - stop!.headS < 1.5) o.head = stop!.headS;
          o.v = 0; o.phase = 'stopped'; o.tStop = 0; o.tPlayer = 0;
        }
        break;
      }
      case 'stopped': {
        o.tStop += dt;
        // 自列車が同じ駅に停車している間だけ数える
        if (st.state === 'dwell' && st.target === stop!.station) o.tPlayer += dt;
        const playerStops = !route.stations[stop!.station].pass;
        if (o.tStop >= MIN_DWELL && ((playerStops && o.tPlayer >= AFTER_PLAYER) || o.tStop >= MAX_DWELL)) { o.phase = 'closing'; o.tClose = 0; }
        break;
      }
      case 'closing':
        o.tClose += dt;
        if (o.tClose >= CLOSE_T) {
          o.phase = 'accel'; o.left = true;
          const d = o.head - ps;
          if (Math.abs(d) < 500) { o.horn = true; events.emit('oncomingHorn', { distance: Math.max(0, d) }); }
        }
        break;
      case 'accel':
        o.v = Math.min(vmax, o.v + ACCEL * dt);
        if (o.v >= vmax) o.phase = 'cruise';
        break;
    }
    o.head -= o.v * dt;
    // 停車中は戸を開ける（ホーム側のみ）、動き出したら閉める
    if (stop) {
      const open = o.phase === 'stopped', side = doorSide(route.stations[stop.station]);
      for (const c of view.cars) c.setDoors(open, side);
    }
    place(o);
    const tail = o.head + len, d = o.head - ps;
    if (!o.horn && !stop && d > 0 && d < 260) { o.horn = true; events.emit('oncomingHorn', { distance: d }); }
    if (tail < ps - VANISH - route.trainLength) { finish(o); return 0; }
    // すれ違い中（先頭〜最後尾が自車横）は風切り音。相対速度が小さいとき（停車中どうし）は鳴らさない
    const dist = d > 0 ? d : tail > ps ? 0 : ps - tail;
    return Math.max(0, 1 - dist / 60) * Math.min(1, (pv + o.v) / 8);
  }

  events.on('frame', ({ dt }) => {
    if (st.state !== 'run' && st.state !== 'dwell') return;
    const ps = st.train.s, pv = st.train.v;
    let p = -1, busy = trains.some(o => o.active);
    for (const o of trains) {
      if (!o.active && !o.done && !busy && ps >= o.spec.spawnAt) {
        // 遠くで出現できないほど自列車が近づいていたら、この編成は出さない
        if (o.spec.startS - ps < MIN_SPAWN_DIST) { o.done = true; continue; }
        Object.assign(o, { active: true, head: o.spec.startS, v: o.spec.kmh / 3.6, phase: 'cruise', left: false, tStop: 0, tClose: 0, tPlayer: 0, horn: false });
        o.view = acquire(o); busy = true;
      }
      if (o.active) p = Math.max(p, update(o, Math.min(dt, .1), ps, pv));
    }
    if (p >= 0) events.emit('oncomingPass', { proximity: p });
  });
  events.on('reset', () => {
    for (const o of trains) { Object.assign(o, { active: false, done: false, horn: false }); release(o); }
  });

  // 開発時の確認用: 各編成の状態
  if (import.meta.env.DEV) (window as any).__oncomingDebug = () => trains.map(o => ({ kind: o.kind, stop: o.spec.stop?.station, active: o.active, done: o.done, phase: o.phase, head: Math.round(o.head), kmh: Math.round(o.v * 3.6), tStop: Math.round(o.tStop), tPlayer: Math.round(o.tPlayer) }));

  return {
    activeSpans: () => trains.filter(o => o.active && o.view && o.phase !== 'stopped' && o.phase !== 'closing').map(o => ({ head: o.head, tail: o.head + o.view!.length })),
  };
}
