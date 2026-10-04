// 待避: 普通が2面4線駅の待避線に停車中、後続の通過列車（特急など）が本線を通過していく。
// 通過列車が出口分岐器を抜けるまで出発信号は停止現示（game/signals.ts が st.overtake を見る）
import type { GameContext } from '../core/context';
import { CAR_LEN, loopZone, serviceOf } from '../route/service';
import { departureTime } from './state';

/** 通過列車の速度 [km/h] */
const PASS_KMH = 80;
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
      const v = PASS_KMH / 3.6;
      const tPass = departureTime(route, index) - PASS_BEFORE_DEP;
      st.overtake = {
        station: index, passedBy: w.passedBy,
        depSignal: sigs.findIndex(g => g.s > sta.stopS),
        phase: 'wait', spawnT: Math.max(st.t + MIN_WAIT, tPass - SPAWN_BACK / v),
        head: sta.stopS - SPAWN_BACK, v, len: passer.cars * CAR_LEN, cleared: false,
      };
      banner(`${sta.name}で後続の${passer.name}を待避します。出発信号が進行になるまで待て`, 4);
    },
    update(dt) {
      const o = st.overtake;
      if (!o || o.phase === 'done') return;
      if (o.phase === 'wait') {
        if (st.t < o.spawnT) return;
        o.phase = 'run';
      }
      o.head += o.v * dt;
      const z = loopZone(route.stations[o.station])!;
      if (!o.cleared && o.head - o.len > z.outTo) {
        o.cleared = true;
        banner(`${serviceOf(route, o.passedBy)!.name} 通過。出発信号を確認`, 3);
      }
      if (o.head - o.len > z.outTo + 700) o.phase = 'done';
    },
  };
}
