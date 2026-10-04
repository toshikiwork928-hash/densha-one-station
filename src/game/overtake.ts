// 待避: 普通が2面4線駅の待避線に停車中、後続の優等列車が本線を通過していく（その駅に停車する種別は本線ホームに停車してから先に発車）。
// 優等列車が出口分岐器を抜けるまで出発信号は停止現示（game/signals.ts が st.overtake を見る）
import type { GameContext } from '../core/context';
import { CAR_LEN, loopZone, serviceOf, stopOffset } from '../route/service';
import { departureTime } from './state';

/** 通過列車の速度 [km/h] */
const PASS_KMH = 80;
/** 停車する優等列車の減速度・加速度 [m/s²]・停車時間 [s] */
const DECEL = .8, ACCEL = .75, PASSER_DWELL = 15;
/** 出現位置（停止位置の何 m 後方か） */
const SPAWN_BACK = 1000;
/** 定刻発車の何秒前に停止位置を通過させるか */
const PASS_BEFORE_DEP = 24;
/** 着いてから出現までの最短 [s] */
const MIN_WAIT = 4;

export interface Overtake {
  /** 停車駅で停止確定したとき */
  onArrive(index: number): void;
  update(dt: number): void;
}

export function createOvertake(ctx: GameContext): Overtake {
  const { route, events } = ctx, st = ctx.state;
  const sigs = route.signals ?? [];
  const banner = (text: string, sec = 3) => events.emit('banner', { text, sec });

  return {
    onArrive(index) {
      const svc = serviceOf(route, st.sel.service);
      const w = svc?.waits?.find(x => x.station === index);
      const sta = route.stations[index], z = loopZone(sta);
      if (!svc || !w || !z || !route.services) return;
      const passer = serviceOf(route, w.passedBy)!;
      const v = PASS_KMH / 3.6, len = passer.cars * CAR_LEN;
      const stops = passer.stops.includes(index);
      // 停車する場合: 本線ホームの停止位置（6両基準）に止まり、停車後に加速して出口分岐器を抜ける
      const stopAt = stops ? sta.stopS + stopOffset(route.services?.find(x => x.id === st.sel.service)?.cars ?? 6) - stopOffset(passer.cars) : null;
      let lead: number;
      if (stopAt != null) {
        const back = Math.max(SPAWN_BACK * .6, v * v / (2 * DECEL) + 50), dBrake = v * v / (2 * DECEL);
        const tIn = (back - dBrake) / v + v / DECEL, dOut = z.outTo - stopAt + len;
        lead = tIn + PASSER_DWELL + Math.sqrt(2 * dOut / ACCEL) + 6; // 出現 → 出口分岐器を抜けるまで
        st.overtake = {
          station: index, passedBy: w.passedBy, depSignal: sigs.findIndex(g => g.s > sta.stopS),
          phase: 'wait', spawnT: Math.max(st.t + MIN_WAIT, departureTime(route, index) - lead),
          stopAt, dwellLeft: PASSER_DWELL, stage: 'cruise',
          head: stopAt - back, v, len, cleared: false,
        };
      } else {
        const tPass = departureTime(route, index) - PASS_BEFORE_DEP;
        st.overtake = {
          station: index, passedBy: w.passedBy, depSignal: sigs.findIndex(g => g.s > sta.stopS),
          phase: 'wait', spawnT: Math.max(st.t + MIN_WAIT, tPass - SPAWN_BACK / v),
          stopAt: null, dwellLeft: 0, stage: 'cruise',
          head: sta.stopS - SPAWN_BACK, v, len, cleared: false,
        };
      }
      banner(`${sta.name}で後続の${passer.name}${stops ? 'の到着・発車' : 'の通過'}を待ちます。出発信号が進行になるまで待て`, 4);
    },
    update(dt) {
      const o = st.overtake;
      if (!o || o.phase === 'done') return;
      if (o.phase === 'wait') {
        if (st.t < o.spawnT) return;
        o.phase = 'run';
      }
      if (o.stopAt != null) {
        // 停車する優等列車: 停止位置に合わせて減速 → 停車 → 加速
        const vc = PASS_KMH / 3.6;
        if (o.stage === 'cruise' && o.stopAt - o.head <= o.v * o.v / (2 * DECEL)) o.stage = 'brake';
        if (o.stage === 'brake') {
          const rem = Math.max(0, o.stopAt - o.head);
          o.v = Math.sqrt(2 * DECEL * rem);
          if (rem < .05) { o.head = o.stopAt; o.v = 0; o.stage = 'stopped'; }
        } else if (o.stage === 'stopped') {
          if ((o.dwellLeft -= dt) <= 0) o.stage = 'accel';
        } else if (o.stage === 'accel') o.v = Math.min(vc, o.v + ACCEL * dt);
      }
      o.head += o.v * dt;
      const z = loopZone(route.stations[o.station])!;
      if (!o.cleared && o.head - o.len > z.outTo) {
        o.cleared = true;
        banner(`${serviceOf(route, o.passedBy)!.name} ${o.stopAt != null ? '発車' : '通過'}。出発信号を確認`, 3);
      }
      if (o.head - o.len > z.outTo + 700) o.phase = 'done';
    },
  };
}
