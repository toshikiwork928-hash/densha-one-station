// 閉そく信号と ATS。先行列車（仮想）の在線から現示を決め、通過時に速度照査する
import type { GameContext } from '../core/context';
import type { SignalAspect } from '../core/events';
import { ASPECT_LABEL, ASPECT_LIMIT, PRECEDING_LENGTH, aspectOf, buildPrecedingKeys, precedingHead } from './preceding';

const ATS_ACK_TIME = 5; // 警報から確認までの猶予 [s]
const ATS_ACK_NOTCH = -4; // 確認に必要なブレーキ段（B4 以上）
const RED_APPROACH = 400; // 停止現示の信号へこの距離まで近づくと警報 [m]
const OVER_MARGIN = 0.5;

export interface SignalSystem {
  /** 現示更新（run / dwell 中）。moving = 走行判定（通過・ATS）も行う */
  update(dt: number, moving: boolean): void;
  /** ATS 確認扱い。戻り値 = 受け付けたか */
  ack(): boolean;
  reset(): void;
}

export function createSignalSystem(ctx: GameContext, forceEB: () => void): SignalSystem {
  const { route, events } = ctx, st = ctx.state;
  const sigs = route.signals ?? [];
  const sigS = sigs.map(g => g.s);
  const keys = buildPrecedingKeys(route);
  let lastEmit = '';
  let passed = -1; // 直前に通過した信号
  const redWarned = new Set<number>();

  const banner = (text: string, sec = 3) => events.emit('banner', { text, sec });
  const precOnly = (i: number): SignalAspect => aspectOf(sigS, i, [[st.precedingS, PRECEDING_LENGTH]]);

  function refreshAspects() {
    st.precedingS = precedingHead(keys, st.t);
    const trains: [number, number][] = [[st.precedingS, PRECEDING_LENGTH], [st.train.s, route.trainLength]];
    for (let i = 0; i < sigS.length; i++) st.signals[i] = aspectOf(sigS, i, trains);
    // R（冒進後）は ATS が扱うので速度超過判定には使わない
    const pa = passed >= 0 ? precOnly(passed) : 'G';
    st.sigLimit = pa === 'R' ? Infinity : ASPECT_LIMIT[pa];
    const n = st.nextSignal;
    const key = n >= 0 ? `${sigs[n].id}:${st.signals[n]}` : 'none';
    if (n >= 0 && key !== lastEmit) {
      lastEmit = key;
      events.emit('signalAspect', { id: sigs[n].id, s: sigS[n], aspect: st.signals[n] });
    }
  }

  function warn(reason: string) {
    if (st.ats.state !== 'normal') return;
    st.ats = { state: 'warn', timer: ATS_ACK_TIME, reason };
    st.penalties.atsWarn++;
    events.emit('ats', { kind: 'warn', reason });
    banner(`ATS警報！ ${reason} — B4以上＋確認(A)`, 3);
  }

  function brake(reason: string) {
    if (st.ats.state === 'brake') return;
    st.ats = { state: 'brake', timer: 0, reason };
    st.penalties.atsBrake++;
    events.emit('ats', { kind: 'brake', reason });
    forceEB();
    banner(`ATS 非常制動（${reason}）`, 3.5);
  }

  function release() {
    const reason = st.ats.reason;
    st.ats = { state: 'normal', timer: 0, reason: '' };
    events.emit('ats', { kind: 'release', reason });
  }

  function onPass(i: number) {
    passed = i;
    const asp = precOnly(i), lim = ASPECT_LIMIT[asp], vk = st.train.v * 3.6;
    if (asp === 'R') {
      st.penalties.redPass++;
      brake('停止信号冒進');
      return;
    }
    if (vk > lim + OVER_MARGIN) warn(`${ASPECT_LABEL[asp]}現示 ${lim}km/h 超過`);
  }

  return {
    update(dt, moving) {
      const s = st.train.s;
      if (moving) {
        while (st.nextSignal >= 0 && s >= sigS[st.nextSignal]) {
          const i = st.nextSignal;
          st.nextSignal = i + 1 < sigS.length ? i + 1 : -1;
          onPass(i);
        }
      }
      refreshAspects();
      if (!moving) return;
      // 停止現示への接近
      const n = st.nextSignal;
      if (n >= 0 && st.signals[n] === 'R' && sigS[n] - s < RED_APPROACH && st.train.v > 0 && !redWarned.has(n)) {
        redWarned.add(n);
        warn('停止信号接近');
      }
      if (st.ats.state === 'warn' && (st.ats.timer -= dt) <= 0) brake('確認扱いなし');
    },
    ack() {
      if (st.ats.state === 'warn') {
        if (st.train.notch > ATS_ACK_NOTCH) { banner('B4以上のブレーキを掛けて確認', 2); return false; }
        release(); banner('ATS 確認', 1.5); return true;
      }
      if (st.ats.state === 'brake') {
        if (st.train.v > 0) { banner('停止後に ATS 復帰', 2); return false; }
        release(); banner('ATS 復帰', 1.5); return true;
      }
      return false;
    },
    reset() {
      lastEmit = ''; redWarned.clear();
      passed = -1;
      for (let i = sigS.length - 1; i >= 0; i--) if (sigS[i] <= st.train.s) { passed = i; break; }
      st.nextSignal = sigS.findIndex(x => x > st.train.s);
      refreshAspects();
    },
  };
}

export { ASPECT_LIMIT, ASPECT_LABEL };
