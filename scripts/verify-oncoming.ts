/** 対向列車の共通時刻表モデルを、描画なしで検証する。 */
import { START_CLOCK } from '../src/core/config';
import { createMeet, planMeet } from '../src/game/meet';
import { ROUTES } from '../src/route';
import { hashSeed, scheduledConsist } from '../src/route/oncoming-stops';
import { sakuragaoka } from '../src/route/routes/sakuragaoka';
import { applyService, islandOffset, playerPathLat, WAKAYAMA_DEST } from '../src/route/service';
import type { CounterTrain } from '../src/world/oncoming-timetable';

// oncoming-timetable は描画アダプタも同居しており、モジュール初期化時だけ発光用 canvas を作る。
// 純粋モデルの検証では描画 API を実行しないため、この最小 canvas で初期化を抑える。
(globalThis as any).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '',
  }) }),
};
const { createCounterTraffic, sameLaneAhead, COUNTER_BLOCK_GAP, counterTimetable, makeCounterPlans } = await import('../src/world/oncoming-timetable');
const { coastalThirdTracks } = await import('../src/world/coastal-stations');

type Tod = keyof typeof START_CLOCK;
const TODS: Tod[] = ['morning', 'noon', 'evening', 'night'];
const routeIds = Object.values(ROUTES).filter(r => !r.singleTrack && (r.lineId === 'shiokaze' || r.lineId === 'airport')).map(r => r.id);
const only = (((globalThis as any).process?.argv as string[] | undefined)?.find(x => x.startsWith("--only="))?.slice("--only=".length) ?? "").split(",").filter(Boolean);
let checks = 0;
let safetyCases = 0;
let minatoNoonExpressFollowFrames = 0;
const minatoNoonSamples: string[] = [];

function verify(condition: unknown, message: string): asserts condition {
  checks++;
  if (!condition) throw new Error(message);
}

function verifyLazy(condition: unknown, message: () => string): asserts condition {
  checks++;
  if (!condition) throw new Error(message());
}

/** world/oncoming.ts の realConsist と同じ種別・編成選択。車体長を含め本番と同じ条件で点検する。 */
function consist(code: string, ordinal: number, playerTowardNamba: boolean) {
  const { id, ...spec } = scheduledConsist(code, ordinal, playerTowardNamba);
  return { ...spec, cars: spec.cars!, kind: spec.kind!, dest: playerTowardNamba ? WAKAYAMA_DEST[id][0] : 'なんば' };
}

function snapshot(trains: CounterTrain[]) {
  return trains.map(t => [t.id, t.active, t.finished, +t.head.toFixed(3), +t.v.toFixed(3), t.station, +t.delay.toFixed(3)]);
}

function sameLaneAt(traffic: ReturnType<typeof createCounterTraffic>, a: CounterTrain, b: CounterTrain): boolean {
  const from = Math.max(a.head, b.head), to = Math.min(a.head + a.length, b.head + b.length);
  if (from > to) return false;
  for (let s = from; s <= to; s += 1) if (Math.abs(traffic.laneAt(a, s) - traffic.laneAt(b, s)) < 3.4) return true;
  return Math.abs(traffic.laneAt(a, to) - traffic.laneAt(b, to)) < 3.4;
}

/** 車体が離れていても、近接する前後端が同じ線路にいる場合は閉そく間隔を検査する。 */
function sharesLane(traffic: ReturnType<typeof createCounterTraffic>, rear: CounterTrain, front: CounterTrain): boolean {
  return traffic.sameTrack(rear, front) || sameLaneAt(traffic, rear, front)
    // 後続が先行の最後尾の位置で同じ線を通り、いまも同じ線にいる（world/oncoming-timetable.ts の conflict と同じ。2026-11-05）
    || sameLaneAhead(traffic.laneAt, rear, front);
}

function trainTrace(traffic: ReturnType<typeof createCounterTraffic>, t: CounterTrain) {
  const path = t.paths.map(p => p.profile ? `profile(${p.profile[0][0]}-${p.profile.at(-1)![0]})` : p.zone ? `loop(${p.zone.inFrom}-${p.zone.outTo})` : 'main').join(',');
  const points = [t.head, t.head + t.length / 2, t.head + t.length].map(s => `${s.toFixed(1)}:${traffic.laneAt(t, s).toFixed(2)}`).join(' ');
  return `${t.id}/${t.code} head=${t.head.toFixed(2)} len=${t.length.toFixed(2)} v=${t.v.toFixed(2)} delay=${t.delay.toFixed(2)} station=${t.station} paths=${path || 'main'} lane[s:lat]=${points}`;
}

function activeSnapshot(trains: CounterTrain[]) {
  return trains.filter(t => t.active).map(t => ({ id: t.id, code: t.code, head: +t.head.toFixed(2), len: +t.length.toFixed(2), v: +t.v.toFixed(2), delay: +t.delay.toFixed(2), station: t.station }));
}

function assertSafety(routeId: string, tod: Tod): void {
  const route = ROUTES[routeId];
  const plans = makeCounterPlans(route, tod);
  const traffic = createCounterTraffic(route, tod, consist);
  // 対向普通の全車体・台車が通る横位置を、実描画と共有する浜寺公園の副線へ照合する。
  for (const train of traffic.trains.filter(t => t.code === 'L')) for (const point of train.plan.points) {
    if (!point.stop || point.station == null) continue;
    const station = route.stations[point.station];
    if (station.layout !== 'hamadera') continue;
    const main = train.lat + islandOffset(route, train.lat, point.s);
    const siding = coastalThirdTracks(route, station).find(x => Math.abs(x.main - main) < .001);
    verify(siding != null, `${routeId}/${tod}: 浜寺公園の対向副線がない`);
    for (let s = siding.from - train.length; s <= siding.to + train.length; s += 2) {
      verify(Math.abs(traffic.laneAt(train, s) - siding.lat(s)) < .001,
        `${routeId}/${tod}/${train.id}: 浜寺公園 s=${s} 車両横位置=${traffic.laneAt(train, s)} 線路=${siding.lat(s)}`);
    }
  }
  // 堺で停車する対向普通は、方向に応じた1/3番線の実プロファイルを使う。
  const sakai = route.stations.findIndex(s => s.name === '堺');
  if (sakai >= 0) for (const train of traffic.trains.filter(t => t.code === 'L' && t.plan.points.some(p => p.stop && p.station === sakai))) {
    const playerTowardNamba = route.lineId === 'airport' ? route.stations[0].name === '関西空港' : route.services?.find(s => s.id === 'local')?.destination === 'なんば';
    const expected = route.extraTracks?.find(x => x.id === (playerTowardNamba ? 'sakai-1' : 'sakai-3'))?.lat;
    verify(expected != null && train.paths.some(p => p.station === sakai && p.profile === expected),
      `${routeId}/${tod}/${train.id}: 堺普通が指定番線プロファイルを使わない`);
  }
  verify(new Set(plans.map(p => p.id)).size === plans.length, `${routeId}/${tod}: 列車 id が重複`);
  if (route.lineId === 'airport' || ['kishiwada-namba', 'namba-kishiwada-up', 'izumisano-sakai', 'sakai-izumisano-up'].includes(routeId)) {
    // 発車が遅れて離合地点が変わっても、車体が通る全区間で上下の線路が分かれていること。
    for (const { id: service } of route.services ?? []) {
      const player = structuredClone(route);
      applyService(player, service);
      const checked = new Set<string>();
      for (const train of traffic.trains) {
        const from = train.plan.points.at(-1)!.s, to = train.plan.points[0].s + train.length;
        const path = JSON.stringify([train.lat, train.paths, from, to]);
        if (checked.has(path)) continue;
        checked.add(path);
        for (let s = Math.max(from, route.extent.from); s <= Math.min(to, route.extent.to); s += 2) {
          verifyLazy(Math.abs(traffic.laneAt(train, s) - playerPathLat(player, s)) >= 3.4,
            () => `${routeId}/${tod}/${service}: 対向${train.id}の進路が自列車と重なる s=${s}`);
        }
      }
    }
  }
  for (const plan of plans) {
    verify(plan.points.length >= 2, `${routeId}/${tod}/${plan.id}: 点が不足`);
    for (let i = 1; i < plan.points.length; i++) {
      const a = plan.points[i - 1], b = plan.points[i];
      verify(a.s > b.s, `${routeId}/${tod}/${plan.id}: s が降順でない`);
      verify(a.depart <= b.depart, `${routeId}/${tod}/${plan.id}: 時刻が逆行`);
    }
    for (const p of plan.points) if (p.stop && p.station != null) {
      verify(route.stations[p.station] != null, `${routeId}/${tod}/${plan.id}: 停車駅 ${p.station} がない`);
    }
  }
  const first = Math.min(...plans.map(p => p.points[0].arrive));
  const last = Math.max(...plans.map(p => p.points.at(-1)!.depart));
  // 任意時刻からの冷間開始でも、初期配置した複数編成を同一線路へ重ねない。
  for (const coldClock of [first + 1, first + (last - first) * .35, first + (last - first) * .7]) {
    const cold = createCounterTraffic(route, tod, consist); cold.update(coldClock);
    for (const rear of cold.trains) for (const front of cold.trains) {
      if (rear === front || !rear.active || !front.active || rear.head <= front.head || !sharesLane(cold, rear, front)) continue;
      verify(rear.head + .02 >= front.head + front.length + COUNTER_BLOCK_GAP,
        `${routeId}/${tod}: cold start ${coldClock.toFixed(1)} で ${rear.id}/${front.id} の安全間隔がない`);
    }
  }
  let previous: ReturnType<typeof activeSnapshot> = [], lastClock = first - 1;
  const localOrder = new Map<string, number>();
  const stationarySince = new Map<string, number>();
  const admitted = new Set<string>();
  const observedStops = new Map<string, Set<number>>();
  // 遅延を戻しても全列車が系外へ抜けること。安全確認も同じ0.1秒刻みで続ける。
  for (let clock = first - 1; clock <= last + 3600; clock += .1) {
    lastClock = clock;
    traffic.update(clock);
    for (const t of traffic.trains) {
      if (t.active && !admitted.has(t.id)) {
        const planned = t.plan.at(clock - t.delay);
        verify(planned != null && Math.abs(t.head - planned.head) < .1, `${routeId}/${tod}: ${t.id} が所定の入場位置から外れて出現`);
        admitted.add(t.id);
      }
      const inSection = t.head > route.extent.from && t.head + t.length < route.extent.to;
      const atPlatform = route.stations.some(s => t.head + t.length >= s.platform.from && t.head <= s.platform.to);
      if (!t.active || t.v >= .05 || !inSection || atPlatform) { stationarySince.delete(t.id); continue; }
      // 同じ進路の先行・合流列車が閉そくを占める間は信号待ちがあり得る。
      // 進路が空いた後の静止と、泉大津の待避線にいる普通を本線の障害とする不具合を検出する。
      const izumiotsuRegression = routeId === 'nankai-through-up' && tod === 'noon' && t.id === '1716'
        && traffic.trains.some(q => q.stopped && q.id === '6818' && q.station != null && route.stations[q.station].name === '泉大津');
      if (!izumiotsuRegression && traffic.floorOf(t) >= t.head - 3) { stationarySince.delete(t.id); continue; }
      // 閉そくが開いてからの静止時間を測る。開通前の正当な信号待ちを加算しない。
      const since = stationarySince.get(t.id) ?? clock;
      stationarySince.set(t.id, since);
      verifyLazy(clock - since < 15, () => `${routeId}/${tod}: ${t.id} が駅間で15秒以上静止 clock=${clock.toFixed(1)} head=${t.head.toFixed(1)}`);
    }
    if (routeId === 'shiokaze') {
      const active = traffic.trains.filter(t => t.active).sort((a, b) => a.head - b.head);
      let previousLocal = -1;
      for (const train of active) {
        if (train.code === 'L') {
          if (!localOrder.has(train.id)) localOrder.set(train.id, localOrder.size);
          const order = localOrder.get(train.id)!;
          verifyLazy(order > previousLocal, () => `${routeId}/${tod}: 普通 ${train.id} の順序が逆転`);
          previousLocal = order;
        }
        if (train.stopped && train.station != null) {
          if (!observedStops.has(train.id)) observedStops.set(train.id, new Set());
          observedStops.get(train.id)!.add(train.station);
        }
      }
    }
    for (const rear of traffic.trains) for (const front of traffic.trains) {
      if (rear === front || !rear.active || !front.active || rear.head <= front.head || !sharesLane(traffic, rear, front)) continue;
      const floor = front.head + front.length + COUNTER_BLOCK_GAP;
      if (routeId === 'nankai-through-up' && tod === 'noon' && front.code === 'L' && front.stopped && front.station === 1 && rear.code === 'A') minatoNoonExpressFollowFrames++;
      verifyLazy(rear.head + .02 >= floor,
        () => `${routeId}/${tod}: clock=${clock.toFixed(1)} ${rear.id} が ${front.id} へ車体重なり又は ${COUNTER_BLOCK_GAP}m 未満\n現: rear ${trainTrace(traffic, rear)}\n現: front ${trainTrace(traffic, front)}\n直前(${(clock - .1).toFixed(1)}): ${JSON.stringify(previous)}`);
      if (front.stopped && front.station != null) {
        verifyLazy(rear.head + .02 >= route.stations[front.station].platform.to + 180,
          () => `${routeId}/${tod}: clock=${clock.toFixed(1)} ${rear.id}: ${front.id} がホーム占有中に構内へ進入\n現: rear ${trainTrace(traffic, rear)}\n現: front ${trainTrace(traffic, front)}\n直前(${(clock - .1).toFixed(1)}): ${JSON.stringify(previous)}`);
      }
    }
    previous = activeSnapshot(traffic.trains);
    if (clock >= last + 1 && traffic.trains.every(t => t.finished)) break;
  }
  verify(traffic.trains.every(t => t.finished), `${routeId}/${tod}: 遅延後も全列車が運行終了しない`);
  if (routeId === 'shiokaze') for (const train of traffic.trains) for (const point of train.plan.points) {
    if (point.stop && point.station != null) verify(observedStops.get(train.id)?.has(point.station),
      `${routeId}/${tod}: ${train.id} が ${route.stations[point.station].name} の停止位置に到着しない`);
  }
  if (routeId === 'nankai-through-up' && tod === 'noon') verify(minatoNoonExpressFollowFrames > 0,
    `昼 堺→岸和田: 湊停車普通の直後に急行が現れない。観測=${minatoNoonSamples.join(' | ') || 'なし'}`);
  const fixed = snapshot(traffic.trains);
  traffic.update(lastClock);
  verify(JSON.stringify(fixed) === JSON.stringify(snapshot(traffic.trains)), `${routeId}/${tod}: 時計非進行で状態が変化`);

  // 遅延・途中時計開始・時計を戻しての再開は、同じ時刻に新規生成した状態と一致する。
  const middle = first + (last - first) * .55;
  const fresh = createCounterTraffic(route, tod, consist); fresh.update(middle);
  traffic.update(middle);
  verify(JSON.stringify(snapshot(fresh.trains)) === JSON.stringify(snapshot(traffic.trains)), `${routeId}/${tod}: 途中時計開始または再作成で状態不一致`);

}

for (const routeId of routeIds) for (const tod of TODS) {
  if (only.length && !only.includes(`${routeId}/${tod}`) && !only.includes(routeId)) continue;
  const timetable = counterTimetable(routeId, tod);
  verify(timetable != null && timetable.length > 0, `${routeId}/${tod}: 時刻表がない`);
  safetyCases++;
  assertSafety(routeId, tod);
}

// 朝の堺〜岸和田: 堺での普通6602と区急3808は同時停車しても3/4番線に分かれる。
const throughMorning = ROUTES['nankai-through-up'];
const throughTraffic = createCounterTraffic(throughMorning, 'morning', consist);
throughTraffic.update(START_CLOCK.morning + 40);
const train6602 = throughTraffic.trains.find(t => t.id === '6602');
const train3808 = throughTraffic.trains.find(t => t.id === '3808');
verify(train6602?.active && train6602.stopped && train6602.station === 0 && Math.abs(train6602.head - 388) < .1,
  '朝 堺→岸和田: 6602 が堺3番線の停止位置にいない');
verify(train3808?.active && train3808.stopped && train3808.station === 0 && Math.abs(train3808.head - 388) < .1,
  '朝 堺→岸和田: 3808 が堺4番線の停止位置にいない');
verify(Math.abs(throughTraffic.laneAt(train6602!, train6602!.head) - throughTraffic.laneAt(train3808!, train3808!.head)) >= 3.4,
  '朝 堺→岸和田: 6602 と3808が同一線路に重なる');

// 単線交換は共通ダイヤを使わず、出発信号保持と閉そく占有を従来経路で維持する。
for (const mountainId of ['mountain', 'mountain-up']) {
  const mountain = ROUTES[mountainId];
  verify(mountain.singleTrack && mountain.meets?.length, `${mountainId}: 単線交換設定がない`);
  verify(counterTimetable(mountain.id, 'noon') == null, `${mountainId}: 共通時刻表を誤適用`);
  const station = mountain.meets![0].station;
  const state: any = { state: 'run', target: station, train: { s: mountain.stations[station].stopS - 500, v: 40 / 3.6 } };
  const events: any = { emit() {} };
  const meet = createMeet({ route: mountain, state, events, track: { limitAt: () => mountain.lineLimit } } as any);
  meet.update(.1);
  verify(state.meet != null && meet.occupying() != null, `${mountainId}: 接近中の対向列車の単線閉そく占有がない`);
  // 到着後の待機は別の実運行入口として確認する（onArrive は18秒到着を予約する）。
  state.meet = undefined;
  state.train.s = mountain.stations[station].stopS; state.train.v = 0;
  meet.onArrive(station, true);
  verify(meet.heldSignal() >= 0, `${mountainId}: 交換待ちの出発信号を保持しない`);
  const p = planMeet(mountain, mountain.meets![0]);
  for (let i = 0; i < 300 && !state.meet.arrived; i++) meet.update(.1);
  verify(state.meet.arrived && state.meet.head === p.headS, `${mountainId}: 対向列車が交換駅で停止しない`);
  verify(meet.heldSignal() === -1, `${mountainId}: 到着後も出発信号を保持する`);
}

// コースをまたぐ同じ列車は1本として、朝に登場する一般車の系列と編成長を確認する。
const counted = new Set<string>();
const fleet = new Map<string, number>();
for (const id of routeIds) for (const train of counterTimetable(id, 'morning') ?? []) {
  if (counted.has(train.id) || !['L', 'A', 'E'].includes(train.code[0])) continue;
  counted.add(train.id);
  const consist = scheduledConsist(train.code, hashSeed(train.id), true);
  fleet.set(consist.kind!, (fleet.get(consist.kind!) ?? 0) + 1);
  verify(consist.units!.reduce((sum, n) => sum + n, 0) === consist.cars, `${train.id}: 編成と両数が一致しない`);
  if (consist.cars === 4) verify(consist.kind === 'commuter-new', `${train.id}: 4両の系列`);
}
const fleetCounts = ['commuter-new', 'commuter-1000', 'commuter-old', 'commuter-9000'].map(k => fleet.get(k) ?? 0);
verify(fleetCounts.every((n, i) => n > (fleetCounts[i + 1] ?? 0)), `朝の一般車の本数順: ${fleetCounts.join(', ')}`);
console.log(`朝の一般車（列車番号単位）8300系・1000系・7100系・9000系: ${fleetCounts.join('・')}本`);

// 旧架空コースは従来の 1 編成だけで、共通ダイヤを使わない。
verify(sakuragaoka.oncoming.length === 1, '桜ヶ丘: 旧対向列車が1編成でない');
verify(counterTimetable(sakuragaoka.id, 'noon') == null, '桜ヶ丘: 共通時刻表を誤適用');
console.log(`対向列車検証: ${checks} 件成功（実行 ${safetyCases} コース・時間帯、候補 ${routeIds.length}方向×4時間帯、0.1秒刻み、昼の湊停車普通直後の急行 ${minatoNoonExpressFollowFrames} フレーム）`);
