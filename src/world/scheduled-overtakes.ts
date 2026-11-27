import { overtakeZone, waitsAt } from '../game/overtake';
import { hashSeed, scheduledConsist } from '../route/oncoming-stops';
import type { RealTrain } from '../route/real-diagram';
import { carLenOf, playerPathLat, stationPassingPaths, stationStopS } from '../route/service';
import type { Route, ServiceSpec } from '../route/types';

/** 実際に待避・追い越しで出会う相手と、その列車が駅で使う走行線。 */
export function scheduledOvertakes(route: Route, train: RealTrain, service: ServiceSpec, from: number, to: number) {
  const plans = (train.encounters ?? []).flatMap(encounter => {
    const index = route.stations.findIndex(s => s.name === encounter.station);
    if (index < from || index > to) return [];
    const paths = stationPassingPaths(route, index);
    if (!paths) return [];
    const station = route.stations[index];
    const consist = scheduledConsist(encounter.code, hashSeed(encounter.no), train.to !== 'なんば');
    const stop = stationStopS(route, index, consist);
    let lane = encounter.role === 'passing' ? paths.waiting : paths.passing;
    if (station.name === '泉佐野') {
      // 空港線に直通する列車は外側を使う。本線の普通は、自車が使わない側で優等と接続する。
      if (encounter.svc === 'airport' || encounter.svc === 'limited' || encounter.dest === '関西空港') {
        lane = paths.waiting;
      } else if (encounter.svc === 'local') {
        lane = Math.abs(paths.waiting(stop) - playerPathLat(route, stop)) >= 3.4 ? paths.waiting : paths.passing;
      } else lane = paths.passing;
    }
    if (Math.abs(lane(stop) - playerPathLat(route, stop)) < 3.4) return [];
    return [{ encounter, index, consist, stop, lane, length: consist.cars * carLenOf(consist.kind), signalSequence: -1 }];
  }).sort((a, b) => a.encounter.arrival - b.encounter.arrival);

  // 普通車の待避シミュレーションは到着の遅れも扱い、その列車の動きに発車信号を連動させる。
  // この相手だけは、時刻表からもう1本発生させずにシミュレーション側の位置を描く。
  for (const index of new Set(plans.map(p => p.index))) {
    if (!overtakeZone(route, index)) continue;
    const waiting = plans.filter(p => p.index === index && p.encounter.role === 'waiting');
    waitsAt(route, service, index).forEach((passer, seq) => {
      const next = waiting.find(p => p.signalSequence < 0 && p.encounter.svc === passer.id);
      if (next) next.signalSequence = seq;
    });
  }
  return plans;
}

type Plan = ReturnType<typeof scheduledOvertakes>[number];

/** 駅の着発秒から停止位置までの距離を逆算する。減速・加速中は等加速度、それより外側は等速。 */
function distanceFromStop(seconds: number, acceleration: number, speed: number) {
  const accelerating = Math.min(seconds, speed / acceleration);
  return .5 * acceleration * accelerating ** 2 + speed * (seconds - accelerating);
}

export function encounterMotion(plan: Plan, clock: number) {
  const { arrival, departure, role, dest, station } = plan.encounter;
  const seconds = clock - arrival;
  const speed = (role === 'passing' ? 45 : 80) / 3.6;
  if (arrival === departure) return { head: plan.stop + speed * seconds, doors: false };
  if (seconds < 0) return { head: plan.stop - distanceFromStop(-seconds, .85, speed), doors: false };
  if (clock <= departure) return { head: plan.stop, doors: clock < departure - 3 };
  if (dest === station) return null;
  return { head: plan.stop + distanceFromStop(clock - departure, .75, speed), doors: false };
}

/** 遅延で同じ分岐器に重なった場合は線路を共用する区間の車体を重ねない。 */
export function separatedBodies(head: number, length: number, lane: (s: number) => number,
                                otherHead: number, otherLength: number, otherLane: (s: number) => number) {
  const start = Math.max(head - length, otherHead - otherLength), end = Math.min(head, otherHead);
  if (start > end) return true;
  for (let s = start; s < end; s += 2) if (Math.abs(lane(s) - otherLane(s)) < 3.4) return false;
  return Math.abs(lane(end) - otherLane(end)) >= 3.4;
}
