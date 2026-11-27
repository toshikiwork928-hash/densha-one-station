// 待避: 普通が2面4線駅の待避線に停車中、後続の優等列車が本線を通過していく（その駅に停車する種別は本線ホームに停車して接続してから先に発車）。
// 優等列車は普通が停車してから15秒以上空けてホームに入り、出口分岐器を抜けて見えなくなるまで出発信号は停止現示（game/signals.ts が st.overtake を見る）。
// 優等列車は普通が駅に近づく間に後方から追い付く形で現れる（普通が停まる前に本線ホームを通り過ぎないよう間隔を保つ）
import type { GameContext } from '../core/context';
import { carLenOf, loopZone, serviceOf, stationStopS } from '../route/service';
import { sakaiLayout } from '../route/sakai-layout';
import type { Route, ServiceSpec } from '../route/types';

/** 通過列車の速度 [km/h] */
const PASS_KMH = 80;
/** 停車する優等列車の減速度・加速度 [m/s²]・停車時間 [s] */
const DECEL = .8, ACCEL = .75, PASSER_DWELL = 20;
/** 出現位置（停止位置の何 m 後方か） */
const SPAWN_BACK = 1000;
/** 普通が止まってから優等列車の先頭がホームに入るまでの最短時間 [s] */
export const ARRIVE_GAP = 15;
/** 出口分岐器を後部が抜けてから、列車が見えなくなる（描画を止める）までの距離 [m] */
const CLEAR_DIST = 800;
/** 見えなくなってから出発信号が進行になるまで [s] */
const READY_MARGIN = 3;
/** 先行する普通の後部との最小間隔 [m]（普通が本線を出るまで） */
const FOLLOW_GAP = 100;
const FOLLOW_DECEL = .9;
/** 普通の停止見込み時間の誤差を見て、この秒数だけ早めに出現させる（間隔を保つので早めても追突しない） */
const SPAWN_EARLY = 2;
/** 待っていた優等列車が動き出すときの加速度 [m/s²]（巡航速度へ戻るまで） */
const RESUME_ACCEL = 1.2;
/** 同じ駅で続けて待つとき、前の列車が見えなくなってから次の列車が着くまで [s] */
export const NEXT_ARRIVE = 20;

/** 駅 index で普通が待つ後続列車（並べた順）。コースの始発駅・終着駅では待たない（終着駅は到着前の放送で案内するだけ） */
export function waitsAt(route: Route, svc: ServiceSpec | undefined, index: number): ServiceSpec[] {
  if (!svc?.waits || index <= 0 || index >= route.stations.length - 1) return [];
  return svc.waits.filter(w => w.station === index).map(w => serviceOf(route, w.passedBy)).filter((x): x is ServiceSpec => !!x);
}

export interface Passer {
  v: number; len: number; stopAt: number | null; back: number;
  /** 出現 → 本線ホームに着く（停車は停止、通過は停止位置を通過）[s] */
  tArrive: number;
  /** 出現 → 後部が出口分岐器 + CLEAR_DIST を抜けて見えなくなる [s] */
  tClear: number;
}

const sakaiTurnouts = sakaiLayout(0).up3.map(([s]) => s);
/** 堺の専用配線でも普通と優等が別々の番線に入る。進行方向に見た入口・出口は上下ともホーム端に対して対称。 */
export function overtakeZone(route: Route, index: number) {
  const sta = route.stations[index];
  if (sta.name !== '堺' || sta.layout !== 'custom' || index === 0 || index === route.stations.length - 1) return loopZone(sta);
  const pf = sta.platform.from;
  // 専用配線の横位置は各種別の lane に含まれるので、待避線として加算する横変位は 0。
  return { inFrom: pf + sakaiTurnouts[0], inTo: pf + sakaiTurnouts[1], outFrom: pf + sakaiTurnouts[2], outTo: pf + sakaiTurnouts[3], lat: 0, limit: 45 };
}

/** 優等列車の運動計画（普通が待避線に停車するとき）。時刻表の生成（scripts/timetable.ts）とゲームで共通 */
export function planPasser(route: Route, index: number, passer: ServiceSpec): Passer | null {
  const sta = route.stations[index], z = overtakeZone(route, index);
  if (!z) return null;
  const v = PASS_KMH / 3.6, len = passer.cars * carLenOf(passer.kind);
  if (!passer.stops.includes(index)) {
    const back = SPAWN_BACK, dist = z.outTo + CLEAR_DIST + len - (sta.stopS - back);
    return { v, len, stopAt: null, back, tArrive: back / v, tClear: dist / v };
  }
  // 停車: 本線ホームの停止位置（6両基準）に止まり、停車後に加速して出口分岐器を抜ける
  const stopAt = stationStopS(route, index, passer);
  const dBrake = v * v / (2 * DECEL), back = Math.max(SPAWN_BACK * .6, dBrake + 50);
  const tArrive = (back - dBrake) / v + v / DECEL;
  const dOut = z.outTo + CLEAR_DIST + len - stopAt, dAcc = v * v / (2 * ACCEL);
  const tOut = dOut <= dAcc ? Math.sqrt(2 * dOut / ACCEL) : v / ACCEL + (dOut - dAcc) / v;
  return { v, len, stopAt, back, tArrive, tClear: tArrive + PASSER_DWELL + tOut };
}

/** 待避駅での普通の停車時間 [s]（停車 → 優等列車の到着 → 発車・通過 → 見えなくなる →（次の列車 …）→ 発車） */
export function waitDwell(route: Route, index: number, passers: ServiceSpec | ServiceSpec[]): number {
  const list = Array.isArray(passers) ? passers : [passers];
  let t = ARRIVE_GAP;
  list.forEach((ps, k) => {
    const p = planPasser(route, index, ps);
    // 2本目以降は前の列車が見えなくなってから出現し、本線ホームへの進入・停車に余計にかかる分を見込む
    t += (k ? NEXT_ARRIVE + 25 : 0) + (p ? p.tClear - p.tArrive : 40);
  });
  return Math.ceil(t + READY_MARGIN);
}

export interface Overtake {
  /** 停車駅で停止確定したとき */
  /** 待避駅に着いた。待ち合わせの案内文を返す（quiet なら案内を出さない） */
  onArrive(index: number, quiet?: boolean): string | null;
  update(dt: number): void;
}

export function createOvertake(ctx: GameContext): Overtake {
  const { route, events } = ctx, st = ctx.state;
  const sigs = route.signals ?? [];
  const banner = (text: string, sec = 3) => events.emit('banner', { text, sec });

  /** 優等列車を出現させる（普通がこの駅へ向かっている間 / 駅から始めるとき / 前の列車が抜けた後）。arriveIn = 到着までの秒数、seq = この駅で何本目か */
  function spawn(index: number, arriveIn: number, seq = 0): void {
    const svc = serviceOf(route, st.sel.service), passer = waitsAt(route, svc, index)[seq];
    if (!svc || !passer || !route.services) return;
    const sta = route.stations[index];
    const p = planPasser(route, index, passer);
    if (!p) return;
    const v = p.v;
    let head: number, stage: 'cruise' | 'brake' = 'cruise', pv = v;
    if (p.stopAt != null) {
      const tBrake = v / DECEL, dBrake = v * v / (2 * DECEL);
      if (arriveIn >= p.tArrive) head = p.stopAt - p.back;
      else if (arriveIn > tBrake) head = p.stopAt - dBrake - (arriveIn - tBrake) * v;
      else { stage = 'brake'; pv = DECEL * arriveIn; head = p.stopAt - pv * arriveIn / 2; }
    } else head = sta.stopS - v * Math.min(arriveIn, p.tArrive);
    // 遅着時や待避駅からの開始時も、最高速度で15秒走る距離を入口の手前に残す。
    const holdAt = sta.platform.from - v * ARRIVE_GAP;
    if (seq === 0 && head > holdAt) {
      head = holdAt;
      pv = p.stopAt == null ? v : Math.min(v, Math.sqrt(2 * DECEL * (p.stopAt - head)));
      stage = pv < v ? 'brake' : 'cruise';
    }
    st.overtake = {
      station: index, passedBy: passer.id, seq, depSignal: sigs.findIndex(g => g.s > sta.stopS),
      phase: 'run', stopAt: p.stopAt, dwellLeft: PASSER_DWELL, stage,
      head, v: pv, len: p.len, cleared: false, localStopped: seq > 0,
    };
  }

  /** 普通が次の停車駅（待避駅）へ向かう間: 普通が止まる約 ARRIVE_GAP 秒後に優等列車が着くよう、頃合いで出現させる */
  function approach(): void {
    if (st.state !== 'run' || st.target < 0 || st.overtake?.station === st.target) return;
    const svc = serviceOf(route, st.sel.service), passer = waitsAt(route, svc, st.target)[0];
    if (!svc || !passer || !route.services) return;
    const sta = route.stations[st.target];
    const p = planPasser(route, st.target, passer);
    if (!p) return;
    const rem = sta.stopS - st.train.s, v = Math.max(st.train.v, 1);
    if (rem > 2500) return;
    // 停止までの見込み時間（巡航 + 減速）
    const dB = v * v / (2 * .65), eta = 3 + (rem > dB ? (rem - dB) / v + 2 * dB / v : 2 * Math.max(rem, 0) / v);
    if (eta + ARRIVE_GAP - p.tArrive <= SPAWN_EARLY) spawn(st.target, p.tArrive);
  }

  return {
    onArrive(index, quiet) {
      const svc = serviceOf(route, st.sel.service), list = waitsAt(route, svc, index);
      if (!svc || !list.length || !route.services) return null;
      const sta = route.stations[index];
      if (!st.overtake || st.overtake.station !== index) spawn(index, ARRIVE_GAP);
      const o = st.overtake;
      if (!o) return null;
      o.localStopped = true;
      const parts = list.map(ps => ps.stops.includes(index) ? `${ps.name}を待ち合わせ` : `${ps.name}の通過を待ち`);
      const text = `${sta.name}で後続の${parts.join('、')}ます。出発信号が進行になるまで待て`;
      if (!quiet) banner(text, 4);
      return text;
    },
    update(dt) {
      approach();
      const o = st.overtake;
      if (!o || o.phase === 'done') return;
      const z = overtakeZone(route, o.station)!;
      // 普通が本線を出るまで（待避線へ入り切るまで）は後部との間隔を保つ
      let vHold = Infinity;
      const tail = st.train.s - route.trainLength;
      if (!o.localStopped && st.train.s < z.inTo + route.trainLength && o.head < tail) {
        vHold = Math.sqrt(2 * FOLLOW_DECEL * Math.max(0, tail - o.head - FOLLOW_GAP));
      }
      if (!o.localStopped) {
        const holdAt = route.stations[o.station].platform.from - PASS_KMH / 3.6 * ARRIVE_GAP;
        const remaining = Math.max(0, holdAt - o.head);
        vHold = Math.min(vHold, Math.sqrt(2 * FOLLOW_DECEL * remaining), remaining / dt);
      }
      // 普通の最後尾が入口分岐器を抜けて待避線に入り切るまでは（手前で止まった場合も）、分岐器の手前で待つ
      if (tail < z.inTo + 2) vHold = Math.min(vHold, Math.sqrt(2 * FOLLOW_DECEL * Math.max(0, z.inFrom - 30 - o.head)));
      const vUp = o.v + RESUME_ACCEL * dt; // 抑えた後の再加速
      if (o.stopAt != null) {
        // 停車する優等列車: 停止位置に合わせて減速 → 停車 → 加速
        const vc = PASS_KMH / 3.6;
        if (o.stage === 'cruise' && o.stopAt - o.head <= o.v * o.v / (2 * DECEL)) o.stage = 'brake';
        if (o.stage === 'brake') {
          const rem = Math.max(0, o.stopAt - o.head);
          o.v = Math.min(Math.sqrt(2 * DECEL * rem), vHold, vUp);
          if (rem < .05) { o.head = o.stopAt; o.v = 0; o.stage = 'stopped'; }
        } else if (o.stage === 'stopped') {
          if (o.localStopped && (o.dwellLeft -= dt) <= 0) o.stage = 'accel';
        } else if (o.stage === 'accel') o.v = Math.min(vc, o.v + ACCEL * dt);
        else o.v = Math.min(vc, vHold, vUp);
      } else o.v = Math.min(PASS_KMH / 3.6, vHold, vUp);
      o.head += o.v * dt;
      if (!o.cleared && o.head - o.len > z.outTo + CLEAR_DIST) {
        const next = waitsAt(route, serviceOf(route, st.sel.service), o.station)[o.seq + 1];
        if (next) {
          // 続けて次の列車を待つ（出発信号は停止のまま）
          banner(`${serviceOf(route, o.passedBy)!.name} ${o.stopAt != null ? '発車' : '通過'}。続いて${next.name}を待つ`, 3);
          spawn(o.station, NEXT_ARRIVE, o.seq + 1);
          return;
        }
        o.cleared = true;
        o.phase = 'done';
        banner(`${serviceOf(route, o.passedBy)!.name} ${o.stopAt != null ? '発車' : '通過'}。出発信号を確認`, 3);
      }
    },
  };
}
