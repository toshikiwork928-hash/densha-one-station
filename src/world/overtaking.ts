import { front7169ForRoute } from '../route/vehicle-direction';
// 同方向の先行列車と後続列車を、それぞれの着発時刻と走行線に合わせて描く。
import * as THREE from 'three';
import type { GameContext } from '../core/context';
import { customPlatformSide, destOf, islandOffset, loopShape, loopZone, profileLat, sameClass, serviceOf, stationIslandOffset, stationStopS } from '../route/service';
import { overtakeZone } from '../game/overtake';
import { realTrainFor } from '../route/real-diagram';
import { encounterMotion, scheduledOvertakes, separatedBodies } from './scheduled-overtakes';
import type { ServiceSpec, TrainKind } from '../route/types';
import { placeCar } from './emu';
import { bogieOffset, createTrainSet, type TrainCar } from './train-models';

interface SetView { group: THREE.Group; cars: TrainCar[] }

/** 近さの判定距離 [m]（風切り音） */
const NEAR = 60;

export function createOvertaking(ctx: GameContext): void {
  const { scene, track, route, events } = ctx, st = ctx.state;
  const cache = new Map<string, SetView>();
  const destAll = route.stations[route.stations.length - 1]?.name ?? '';
  const view = (kind: TrainKind, units: number[], label: string, unitKinds?: TrainKind[], dest = destAll, tag = ''): SetView => {
    const base = `${unitKinds?.join('+') ?? kind}:${units.join('+')}:${label}:${dest}${tag}`;
    let key = base;
    for (let slot = 2; cache.get(key)?.group.visible; slot++) key = base + ':' + slot;
    let v = cache.get(key);
    if (!v) {
      const group = new THREE.Group(); group.name = 'overtake-' + key; group.visible = false; scene.add(group);
      const cars = createTrainSet(kind, units.reduce((a, n) => a + n, 0), ctx.renderer, { nambaFirst: front7169ForRoute(route.id), dest, label, units, unitKinds });
      for (const c of cars) group.add(c.object);
      v = { group, cars }; cache.set(key, v);
    }
    return v;
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  /** 先頭 head から後ろへ並べる。latAt = 横位置 */
  const place = (v: SetView, head: number, latAt: (s: number) => number) => {
    let sc = head;
    for (const c of v.cars) {
      sc -= c.length / 2;
      const bogie = bogieOffset(c.length);
      pa.copy(track.at(sc + bogie, latAt(sc + bogie), .38)); pb.copy(track.at(sc - bogie, latAt(sc - bogie), .38));
      placeCar(c.object, pa, pb);
      sc -= c.length / 2;
    }
  };
  const zones = route.stations.flatMap((_, index) => {
    const zone = overtakeZone(route, index);
    return zone ? [{ ...zone, index }] : [];
  });
  /** 本線のホーム側 / 待避線のホーム側（島式: 本線は進行方向左、待避線は右。自列車が待避線に入る駅は platform.side が 'R' に変わる） */
  const mainSide = (i: number): 'L' | 'R' => { const sta = route.stations[i]; return sta.enterLoop ? (sta.platform.side === 'R' ? 'L' : 'R') : sta.platform.side; };
  const flip = (x: 'L' | 'R'): 'L' | 'R' => x === 'L' ? 'R' : 'L';
  let hornDone = false, wasNear = false, lastH = 0, lastStation = -1;

  let plans: ReturnType<typeof scheduledOvertakes> | undefined;
  // 同じ列車が隣り合う2駅で待避することもある。画面内の同一列番と分岐器の占有を共有する。
  const occupied: { no?: string; head: number; length: number; lane: (s: number) => number }[] = [];
  function reset() {
    hornDone = false; lastStation = -1;
    const train = realTrainFor(route, st.sel.service, st.fromIndex, st.endIndex);
    const svc = route.services?.find(s => s.id === st.sel.service);
    plans = train?.encounters && svc ? scheduledOvertakes(route, train, svc, st.fromIndex, st.endIndex) : undefined;
  }
  reset();
  events.on('reset', reset);

  function showEncounter(plan: ReturnType<typeof scheduledOvertakes>[number], head: number, doors: boolean) {
    const { encounter, index, consist, lane } = plan;
    if (occupied.some(t => t.no === encounter.no || !separatedBodies(head, plan.length, lane, t.head, t.length, t.lane))) return;
    occupied.push({ no: encounter.no, head, length: plan.length, lane });
    const sta = route.stations[index];
    const lat = lane(plan.stop);
    const side = customPlatformSide(sta, lat) ?? (sta.loop?.outside
      ? (sta.loop.lat < 0 ? 'L' : 'R') : (lat < track.pathLat(plan.stop) ? 'R' : 'L'));
    const v = view(consist.kind, consist.units!, consist.label!, consist.unitKinds, encounter.dest);
    v.group.userData.trainNo = encounter.no;
    v.group.visible = true;
    for (const c of v.cars) c.setDoors(doors, side);
    place(v, head, lane);
  }

  // 優等列車で堺・泉大津を終着にするとき: 終着駅の普通の番線（待避線、堺は3番線・1番線）に普通が止まっている（時間帯によらず）
  const goal = route.stations.length - 1, goalSta = route.stations[goal];
  const goalTerminal = goalSta && (goalSta.name === '堺' || goalSta.name === '泉大津');
  function showTerminalLocal(local: ServiceSpec, ps: number): void {
    if (!goalTerminal || st.endIndex !== goal) return;
    showParkedLocal(local, ps, goal, ':goal');
  }
  /** 駅 index の待避線（終着駅は普通の番線）に止まっている普通を描く（自列車から 1600m 以内のとき） */
  function showParkedLocal(local: ServiceSpec, ps: number, index: number, tag: string): void {
    const goalSta = route.stations[index];
    const me = serviceOf(route, st.sel.service);
    if (!me || Math.abs(goalSta.stopS - ps) > 1600) return;
    // 普通の停止位置は、種別・編成長を含む共通計算を使う。
    const head = stationStopS(route, index, local);
    const z = loopZone(goalSta);
    const latAt = local.lane ? (s: number) => profileLat(local.lane!, s) + stationIslandOffset(route, route.tracks[0], s) + (z ? z.lat * loopShape(z, s) : 0)
      : z ? (s: number) => z.lat * loopShape(z, s) : null;
    if (!latAt || Math.abs(latAt(head) - track.pathLat(head)) < 3.4) return;
    const lat = latAt(head);
    const side = goalSta.layout === 'custom' ? customPlatformSide(goalSta, lat) ?? 'R' : goalSta.loop?.outside ? (goalSta.loop.lat < 0 ? 'L' : 'R') : 'R';
    const v = view(local.kind, local.units, local.name, local.unitKinds, destOf(route, local), tag);
    v.group.visible = true;
    for (const c of v.cars) c.setDoors(true, side);
    place(v, head, latAt);
  }
  events.on('frame', () => {
    for (const v of cache.values()) v.group.visible = false;
    const playing = st.state === 'run' || st.state === 'dwell' || st.state === 'result';
    if (!playing) { if (wasNear) { events.emit('overtakePass', { proximity: 0 }); wasNear = false; } return; }
    const ps = st.train.s, plen = route.trainLength;
    occupied.length = 0;
    occupied.push({ head: ps, length: plen, lane: track.pathLat });

    // 後続の通過列車（本線 = 横位置 0）
    const o = st.overtake;
    const actual = o && plans?.find(p => p.index === o.station && p.signalSequence === o.seq);
    if (o && o.phase === 'run' && (!plans || actual)) {
      if (lastStation !== o.station) { lastStation = o.station; hornDone = false; }
      const connecting = o.stage === 'stopped' && o.localStopped;
      if (actual) showEncounter(actual, o.head, connecting);
      else {
        const svc = serviceOf(route, o.passedBy)!;
        const v = view(svc.kind, svc.units, svc.name, svc.unitKinds, destOf(route, svc));
        v.group.visible = true;
        const side = svc.platformSides?.[o.station] ?? mainSide(o.station);
        for (const c of v.cars) c.setDoors(connecting, side);
        const lane = (s: number) => svc.lane ? profileLat(svc.lane, s) + stationIslandOffset(route, 0, s) : islandOffset(route, 0, s);
        place(v, o.head, lane);
        occupied.push({ head: o.head, length: o.len, lane });
      }
      const gap = o.head < ps - plen ? ps - plen - o.head : o.head - o.len > ps ? o.head - o.len - ps : 0;
      if (!hornDone && o.head > ps - plen - 250) { hornDone = true; events.emit('oncomingHorn', { distance: Math.max(0, ps - plen - o.head) }); }
      const prox = Math.max(0, 1 - gap / NEAR);
      if (prox > 0 || wasNear) events.emit('overtakePass', { proximity: prox });
      wasNear = prox > 0;
    } else if (wasNear) { events.emit('overtakePass', { proximity: 0 }); wasNear = false; }

    if (plans) {
      const clock = route.startClock + st.t;
      for (const plan of plans) {
        if (plan.signalSequence >= 0 || Math.abs(plan.stop - ps) > 2200) continue;
        const motion = encounterMotion(plan, clock);
        if (!motion || Math.abs(motion.head - plan.stop) > 1100 || Math.abs(motion.head - ps) > 1600) continue;
        if (motion.head < route.extent.from || motion.head - plan.length > route.extent.to) continue;
        showEncounter(plan, motion.head, motion.doors);
      }
      return;
    }

    // 待避線の先行普通（自列車が本線を通る駅のみ。自列車の近くにいるときだけ表示）
    const local = serviceOf(route, 'local');
    if (!local || st.sel.service === 'local') return;
    showTerminalLocal(local, ps);
    const h = st.precedingS, prevH = lastH;
    lastH = h;
    const last = route.stations.length - 1;
    const waitZones = zones.filter(q => q.index < last && !route.stations[q.index].enterLoop && local.waits?.some(w => w.station === q.index && sameClass(w.passedBy, st.sel.service)));
    // 先行の普通（1本）が先の待避駅で自列車に抜かれて後ろにいるとき、その先の待避駅で自列車を待つのは、もう1本前の普通（夕方の和歌山方面の
    // 浜寺公園と泉大津など）。その駅の待避線に止まっている普通を描く（自列車が出て見えなくなるまで止まったまま）
    for (const q of waitZones) if (h < ps - 50 && q.inFrom > h && ps < q.outTo + 300) showParkedLocal(local, ps, q.index, `:wait${q.index}`);
    // 途中駅開始では先行列車の時計が既に先の駅を指す場合もある。
    // 開始駅で実際に待避する普通を、その駅の分岐区間を離れるまで別番線に置く。
    const origin = st.fromIndex;
    const originWait = local.waits?.some(w => w.station === origin && sameClass(w.passedBy, st.sel.service));
    const originZone = zones.find(q => q.index === origin);
    const originEnd = originZone?.outTo ?? route.stations[origin].platform.to;
    if (originWait && ps < originEnd + 300 && !(originZone && h > originZone.inFrom && h < originZone.outTo + 400)) {
      showParkedLocal(local, ps, origin, `:wait${origin}`);
    }
    const z = waitZones.find(q => h > q.inFrom && h < q.outTo + 400);
    if (!z || Math.abs(h - ps) > 1500) return;
    const v = view(local.kind, local.units, local.name, local.unitKinds, destOf(route, local));
    v.group.visible = true;
    // 待避線に停車している間はドアを開ける（動き出したら閉める）
    const still = Math.abs(h - prevH) < 1e-3;
    const side = local.platformSides?.[z.index] ?? flip(mainSide(z.index));
    for (const c of v.cars) c.setDoors(still, side);
    place(v, h, s => (local.lane ? profileLat(local.lane, s) + stationIslandOffset(route, 0, s) : islandOffset(route, 0, s)) + z.lat * loopShape(z, s));
  });
}
