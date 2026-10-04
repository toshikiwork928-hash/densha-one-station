// QA 用の自動運転（開発時のみ。main.ts が import.meta.env.DEV で読み込む）。
// コンソールから: __qa.run('local'|'express'|'limited') → 全線通しを描画せずに走らせ、停車・待避の経過を返す
import type { GameContext } from '../core/context';
import type { ServiceId } from '../route/types';

export function attachAutodrive(ctx: GameContext, advance: (sec: number, dt?: number, hook?: () => boolean | void) => void): void {
  const st = ctx.state, route = ctx.route, track = ctx.track;
  const log: string[] = [];
  for (const k of ['banner', 'arrive', 'depart', 'ats'] as const) {
    ctx.events.on(k, (e: any) => log.push(`${st.t.toFixed(1)} ${k} ${e.text ?? e.station?.name ?? e.kind ?? ''} @${Math.round(st.train.s)}`));
  }
  /** 制限・停止位置・信号に合わせてノッチを決める */
  const hook = (): boolean => {
    const tr = st.train; // リセットで差し替わる
    if (st.state === 'result') return true;
    if (st.state === 'title') return false;
    if (st.state === 'dwell') { ctx.actions.setNotch(st.doors === 'closed' ? 5 : -4); return false; }
    const pl = (ctx.trainEnv.perf?.bMax ?? 1) * .6;
    const target = st.target >= 0 ? route.stations[st.target].stopS : 1e9;
    let vAllow = Math.min(track.limitAt(tr.s), st.sigLimit) / 3.6;
    for (let d = 5; d < 2500; d += 5) {
      const q = tr.s + d, over = q >= target, lim = over ? 0 : track.limitAt(q) / 3.6;
      vAllow = Math.min(vAllow, Math.sqrt(lim * lim + 2 * pl * Math.max(0, (over ? target - tr.s : d) - 1.5)));
      if (over) break;
    }
    const n = st.nextSignal;
    if (n >= 0) {
      const a = st.signals[n], lim = a === 'R' ? 0 : a === 'Y' ? 45 / 3.6 : a === 'YG' ? 65 / 3.6 : 1e9, dd = route.signals![n].s - tr.s;
      if (dd > 0 && dd < 1500) vAllow = Math.min(vAllow, Math.sqrt(lim * lim + 2 * pl * Math.max(0, dd - 10)));
    }
    const v = tr.v;
    ctx.actions.setNotch(v > vAllow + .3 ? -Math.min(8, Math.max(1, Math.ceil((v - vAllow) * 6 + 3))) : v > vAllow - .8 ? 0 : 5);
    if (st.ats.state !== 'normal') ctx.actions.atsAck();
    return false;
  };
  const run = (service: ServiceId, stageId = 'all', maxSec = 3000) => {
    if (st.state === 'result') ctx.actions.toTitle();
    st.sel.service = service; st.sel.stageId = stageId; ctx.actions.selectStage(0);
    log.length = 0;
    ctx.actions.startOrRetry();
    const rows: unknown[][] = [];
    for (let i = 0; i < maxSec && st.state !== 'result'; i++) {
      advance(1, 1 / 30, hook);
      const o = st.overtake;
      if (o && !o.cleared) rows.push([+st.t.toFixed(0), o.station, o.stage, Math.round(o.head - o.len), Math.round(o.head), +(o.v * 3.6).toFixed(0), o.localStopped, Math.round(st.train.s), st.state]);
    }
    return { t: +st.t.toFixed(0), log, overtake: rows };
  };
  (window as any).__qa = { run, hook, log };
}
