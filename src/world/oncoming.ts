// 対向列車（route.oncoming ごとに1編成。種別・両数が混在）。frame で移動し、警笛・すれ違いをイベントで通知
// 走り抜けるものと、駅（spec.stop）に停車してドアを開け、自列車が同じ駅で停車して少し経つと発車するものがある
// 2面4線駅（汐見町・海浜公園）の対向側には待避線（対向線の +lat 側へ鏡像）があり、対向の普通（spec.stop.loop）はそこへ分岐器（制限 45km/h）で入って停車し、
// 島式ホーム側のドアだけ開ける。同じ駅の対向の優等列車（spec.follow）は本線に停車 / 通過し、普通はその優等列車が分岐器を抜けてから発車する
// 同時に走る対向列車は、走路が重ならないものだけ（出現位置が他の編成の走路と重なるうちは出さない）。同じ線の前後の編成は間隔を保つ。車両セットは種別・両数ごとに使い回す
// spec.kind 未指定なら 普通(新型4両) → 急行(旧型6両) → 特急(6両) の順に割り当てる
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import type { OncomingSpec, Station, TrainKind } from '../route/types';
import { islandOffset, loopShape, loopZone, type LoopZone } from '../route/service';
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
  /** route.oncoming の添字（follow の相手 = 前の要素） */
  idx: number;
  /** 待避線に停車する編成の待避線区間 */
  zone: LoopZone | null;
  view: SetView | null;
  active: boolean;
  done: boolean;
  /** 出現済み（reset まで） */
  started: boolean;
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

/** 停車中の対向列車のドアを開ける側（対向列車の進行方向に対して）。相対式・2面4線の本線: ホームは対向線の外側（+lat）= 左、島式1面2線: ホームは線間 = 右、
 *  2面4線の対向側の待避線: 島式ホームは待避線の内側（-lat）= 右 */
const doorSide = (sta: Station, loop?: boolean): 'L' | 'R' => sta.island ? 'R' : sta.loop ? (loop ? 'R' : 'L') : sta.platform.side;

/** 待避線を使う編成の速度制限 [m/s] = 分岐器制限。入口の手前から制動で合わせ、区間内は一定、後部が抜けるまで（出発時）制限する */
function zoneCap(z: LoopZone, head: number, len: number): number {
  const vl = z.limit / 3.6;
  if (head > z.outTo) return Math.sqrt(vl * vl + 2 * DECEL * (head - z.outTo));
  return head + len > z.inFrom ? vl : Infinity;
}
/** 同じ線で前を行く編成との最小間隔（停止時）[m] */
const FOLLOW_GAP = 60;
/** 同じ線とみなす横位置の差 [m] */
const SAME_LANE = 3.4;
/** 優等列車の出現: 普通が出現位置からこれだけ進んでから（出現位置の重なりを避ける）[m] */
const FOLLOW_AFTER = 100;
/** 優等列車が出口分岐器側を抜けたとみなす余裕 [m]（通過列車の後部が待避線区間の入口よりこれだけ先へ出たら、待避線の普通が発車してよい） */
const CLEAR_MARGIN = 30;

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
    const zone = spec.stop?.loop ? loopZone(route.stations[spec.stop.station]) : null;
    return { spec, kind: spec.kind!, idx: i, zone, view: null, active: false, done: false, started: false, head: 0, v: 0, phase: 'cruise', left: false, tStop: 0, tClose: 0, tPlayer: 0, horn: false } as OncomingTrain;
  });
  const lenOf = (o: OncomingTrain) => o.view ? o.view.length : o.spec.cars * (o.spec.carLen + o.spec.gap);
  /** 待避線に停車する編成について、同じ駅の優等列車（後ろに続く follow の要素）。無ければ null */
  const followerOf = (o: OncomingTrain): OncomingTrain | null => { const f = trains[o.idx + 1]; return o.zone && f?.spec.follow ? f : null; };
  const leaderOf = (o: OncomingTrain): OncomingTrain | null => o.spec.follow ? trains[o.idx - 1] ?? null : null;
  /** 編成の走る線の横位置（待避線に入る編成は分岐器で +lat 側の待避線へ） */
  const laneLat = (o: OncomingTrain, s: number): number => {
    const lat = o.spec.lat;
    return lat + islandOffset(route, lat, s) + (o.zone ? -o.zone.lat * loopShape(o.zone, s) : 0);
  };
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
    for (const c of o.view!.cars) {
      const s = s0 + c.length / 2, bog = c.length / 2 - .25 - 2.6;
      // s が減る向きへ走るので前側台車は s - bog
      // 島式ホーム駅では対向線もホームの反対側へ開く
      pa.copy(track.at(s - bog, laneLat(o, s - bog), .38)); pb.copy(track.at(s + bog, laneLat(o, s + bog), .38));
      placeCar(c.object, pa, pb);
      s0 += c.length;
    }
  }

  const finish = (o: OncomingTrain) => { o.active = false; o.done = true; release(o); };

  /** 前を行く編成（self より先頭が s の小さい側）の車体と、同じ線で重なる位置の手前で止まれる速度の上限 [m/s]。
   *  待避線の普通が分岐器へ入る前の本線で後ろの優等列車が間隔を保つ。待避線から本線へ戻る普通が、本線を走る編成の横へ合流しない */
  function followLimit(o: OncomingTrain): number {
    let lim = Infinity;
    for (const q of trains) {
      if (q === o || !q.active || !q.view || q.head >= o.head) continue;
      const qt = q.head + q.view.length;
      // o の先頭が進む先（s が減る向き）で、q の車体のうち最初に同じ線で重なる位置
      for (let s = Math.min(o.head, qt); s >= q.head; s -= 6) {
        if (Math.abs(laneLat(o, s) - laneLat(q, s)) >= SAME_LANE) continue;
        lim = Math.min(lim, Math.sqrt(2 * DECEL * Math.max(0, o.head - s - FOLLOW_GAP)));
        break;
      }
    }
    return lim;
  }

  /** 待避線の普通が発車してよいか: 同じ駅の優等列車が（停車するなら発車済み、通過するなら後部が待避線区間を抜けて）本線から退いている */
  function followerClear(o: OncomingTrain): boolean {
    const f = followerOf(o);
    if (!f || !o.zone) return true;
    if (f.done) return true;
    if (!f.active || !f.view) return false; // まだ出現していない
    return f.spec.stop ? f.left : f.head + f.view.length < o.zone.inFrom - CLEAR_MARGIN;
  }

  /** 戻り値 = すれ違いの近さ 0..1（非走行なら -1） */
  function update(o: OncomingTrain, dt: number, ps: number, pv: number): number {
    const O = o.spec, vmax = O.kmh / 3.6, stop = O.stop, view = o.view!;
    const len = view.length;
    const hold = followLimit(o), cap = Math.min(hold, o.zone ? zoneCap(o.zone, o.head, len) : Infinity);
    switch (o.phase) {
      case 'cruise':
        o.v = Math.min(vmax, cap);
        if (stop && !o.left && o.head - stop.headS <= o.v * o.v / (2 * DECEL)) o.phase = 'brake';
        break;
      case 'brake': {
        const d = Math.max(o.head - stop!.headS, .5);
        const vb = Math.max(0, o.v - Math.max(DECEL, o.v * o.v / (2 * d)) * dt);
        // 前の編成・分岐器制限に合わせて遅い間は、停止位置に着いたとは扱わない
        if (cap < vb) { o.v = cap; break; }
        o.v = vb;
        // 停止位置の手前 1.5m 以内で止まったら位置を合わせる
        if (o.v < .15 || o.head - stop!.headS < .3) {
          if (o.head - stop!.headS < 1.5) o.head = stop!.headS;
          o.v = 0; o.phase = 'stopped'; o.tStop = 0; o.tPlayer = 0;
        }
        break;
      }
      case 'stopped': {
        o.tStop += dt;
        const sta = route.stations[stop!.station];
        // 自列車が同じ駅に停車している間だけ数える。自列車が通過する駅では、通過し終えたら条件を満たす
        if (st.state === 'dwell' && st.target === stop!.station) o.tPlayer += dt;
        const playerStops = !sta.pass, playerGone = !playerStops && ps > sta.platform.to + 30;
        if (o.tStop >= MIN_DWELL && ((playerStops && o.tPlayer >= AFTER_PLAYER) || playerGone || o.tStop >= MAX_DWELL) && (followerClear(o) || o.tStop >= MAX_DWELL)) { o.phase = 'closing'; o.tClose = 0; }
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
        o.v = Math.min(vmax, o.v + ACCEL * dt, cap);
        if (o.v >= vmax) o.phase = 'cruise';
        break;
    }
    o.head -= o.v * dt;
    // 停車中は戸を開ける（ホーム側のみ）、動き出したら閉める
    if (stop) {
      const open = o.phase === 'stopped', side = doorSide(route.stations[stop.station], !!o.zone);
      for (const c of view.cars) c.setDoors(open, side);
    }
    place(o);
    const tail = o.head + len, d = o.head - ps;
    if (!o.horn && !stop && d > 0 && d < 260) { o.horn = true; events.emit('oncomingHorn', { distance: d }); }
    if (tail < ps - VANISH - route.trainLength) { finish(o); return 0; }
    // すれ違い中（先頭〜最後尾が自車横）は風切り音。相対速度が小さいとき（停車中どうし）は鳴らさない。待避線の編成は線が遠い分だけ弱める
    const dist = d > 0 ? d : tail > ps ? 0 : ps - tail;
    return Math.max(0, 1 - dist / 60) * Math.min(1, (pv + o.v) / 8) * (o.zone ? .7 : 1);
  }

  /** 出現できるか。優等列車（follow）は待避線の普通が動き出してから。走路（停止位置 〜 出現位置）が他の出現中の編成と重なるうちは出さない */
  function canSpawn(o: OncomingTrain, ps: number): boolean | 'skip' {
    const leader = leaderOf(o);
    if (leader) {
      if (!leader.started) return leader.done ? 'skip' : false; // 普通が出なかった（近すぎた）なら出さない
      if (!leader.active) return 'skip';
      if (leader.head > leader.spec.startS - FOLLOW_AFTER) return false;
    }
    if (o.spec.startS - ps < MIN_SPAWN_DIST) return 'skip';
    const lo = o.spec.stop ? o.spec.stop.headS - 100 : -Infinity, hi = o.spec.startS + lenOf(o) + 20;
    for (const q of trains) {
      if (!q.active || q === leader) continue;
      if (q.head <= hi && q.head + lenOf(q) >= lo) return false;
    }
    return true;
  }

  events.on('frame', ({ dt }) => {
    if (st.state !== 'run' && st.state !== 'dwell') return;
    const ps = st.train.s, pv = st.train.v;
    let p = -1;
    for (const o of trains) {
      if (!o.active && !o.done && ps >= o.spec.spawnAt) {
        const ok = canSpawn(o, ps);
        if (ok === 'skip') { o.done = true; continue; }
        if (ok) {
          Object.assign(o, { active: true, started: true, head: o.spec.startS, v: o.spec.kmh / 3.6, phase: 'cruise', left: false, tStop: 0, tClose: 0, tPlayer: 0, horn: false });
          o.view = acquire(o);
        }
      }
      if (o.active) p = Math.max(p, update(o, Math.min(dt, .1), ps, pv));
    }
    if (p >= 0) events.emit('oncomingPass', { proximity: p });
  });
  events.on('reset', () => {
    for (const o of trains) { Object.assign(o, { active: false, done: false, started: false, horn: false }); release(o); }
  });

  // 開発時の確認用: 各編成の状態
  if (import.meta.env.DEV) (window as any).__oncomingDebug = () => trains.map(o => ({ kind: o.kind, stop: o.spec.stop?.station, loop: !!o.zone, active: o.active, done: o.done, phase: o.phase, head: Math.round(o.head), len: Math.round(lenOf(o)), lat: +laneLat(o, o.head).toFixed(1), kmh: Math.round(o.v * 3.6), tStop: Math.round(o.tStop), tPlayer: Math.round(o.tPlayer) }));

  return {
    activeSpans: () => trains.filter(o => o.active && o.view && o.phase !== 'stopped' && o.phase !== 'closing').map(o => ({ head: o.head, tail: o.head + o.view!.length })),
  };
}
