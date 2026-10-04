// ゲーム状態（1プレイ分）
import { NOTCH_INITIAL } from '../core/config';
import type { SignalAspect } from '../core/events';
import type { Route } from '../route/types';
import type { TrainState } from '../sim/train';
import type { PassJudgement, StopJudgement } from './scoring';

export type GameStateName = 'title' | 'run' | 'dwell' | 'result';

/** 運転モード: 通常 / 遅延回復（遅れて発車、定時採点が厳しい）/ 定時運転（時間のみ採点） */
export type GameMode = 'normal' | 'recovery' | 'timeOnly';
export const MODE_LABEL: Record<GameMode, string> = { normal: '通常', recovery: '遅延回復', timeOnly: '定時運転' };

/** ステージ = 停車駅間（全線通しは from = 始発, to = 終着） */
export interface Stage { id: string; from: number; to: number; label: string }

export interface Selection { stageId: string; mode: GameMode }

export interface AtsState {
  /** normal = 正常, warn = 警報中（確認待ち）, brake = 非常制動中 */
  state: 'normal' | 'warn' | 'brake';
  /** warn の残り時間 [s] */
  timer: number;
  reason: string;
}

export interface Penalties { atsWarn: number; atsBrake: number; redPass: number; wrongStop: number }

export interface GameState {
  state: GameStateName;
  train: TrainState;
  /** 始発駅出発からの経過時間 [s]（ステージ途中開始でも時刻表基準） */
  t: number;
  /** 次に停車する駅の index（route.stations） */
  target: number;
  /** 速度超過の累積時間 [s] */
  overspeed: number;
  /** 非常ブレーキ使用（ATS による作動は除く） */
  eb: boolean;
  /** 停止継続時間（停止判定用） */
  stopTimer: number;
  /** 停止した瞬間のノッチ（衝動判定用） */
  notchAtStop: number;
  lastJoint: number;
  /** 速度超過中 */
  overspeedActive: boolean;
  /** 警報音の間隔タイマ */
  beepT: number;
  /** 停車中の戸閉めまでの残り時間（dwell） */
  dwellT: number;
  /** 一度だけ出す案内のフラグ */
  flags: Record<string, boolean>;
  /** 停車駅ごとの判定 */
  stops: StopJudgement[];
  /** 通過駅ごとの判定 */
  passes: PassJudgement[];

  // ---- 拡張 ----
  /** 選択中のステージ・モード（リセットしても保持） */
  sel: Selection;
  /** 今回プレイの開始駅 / 終着駅 index */
  fromIndex: number;
  endIndex: number;
  /** 開始時の遅れ [s]（遅延回復モード） */
  lateStart: number;
  /** ドア状態 */
  doors: 'open' | 'closed';
  /** 各信号の表示現示（route.signals と同順。自列車・先行列車の在線を反映） */
  signals: SignalAspect[];
  /** 次に通過する信号の index（無ければ -1） */
  nextSignal: number;
  /** 直前に通過した信号による制限 [km/h]（Infinity = 制限なし） */
  sigLimit: number;
  /** 先行列車の先頭位置 [m] */
  precedingS: number;
  ats: AtsState;
  penalties: Penalties;
}

/** 停車駅（通過駅を除く）の index 列 */
export const stopIndices = (route: Route): number[] => route.stations.map((s, i) => (s.pass ? -1 : i)).filter(i => i >= 0);

export function stagesOf(route: Route): Stage[] {
  const idx = stopIndices(route), st = route.stations;
  const list: Stage[] = [];
  for (let k = 0; k < idx.length - 1; k++) {
    const a = idx[k], b = idx[k + 1];
    list.push({ id: `${a}-${b}`, from: a, to: b, label: `${st[a].name} → ${st[b].name}` });
  }
  if (list.length > 1) {
    const a = idx[0], b = idx[idx.length - 1];
    list.push({ id: 'all', from: a, to: b, label: '全線通し' });
  }
  return list;
}

export const findStage = (route: Route, id: string): Stage => {
  const list = stagesOf(route);
  return list.find(s => s.id === id) ?? list[0];
};

/** 駅の定刻発車時刻 [s] */
export const departureTime = (route: Route, index: number): number => {
  const s = route.stations[index];
  return s.scheduledArrival + (index === 0 ? 0 : s.dwell ?? 20);
};

/** 遅延回復モードの開始遅れ [s] */
export const lateStartFor = (stage: Stage, mode: GameMode): number =>
  mode !== 'recovery' ? 0 : stage.id === 'all' ? 45 : 20;

export function createState(route: Route): GameState {
  const st = {} as GameState;
  resetState(st, route);
  return st;
}

export function resetState(st: GameState, route: Route): void {
  const sel: Selection = st.sel ?? { stageId: stagesOf(route)[0]?.id ?? 'all', mode: 'normal' };
  const stage = findStage(route, sel.stageId);
  const from = stage?.from ?? 0, end = stage?.to ?? route.stations.length - 1;
  const s0 = from === 0 ? route.startS : route.stations[from].stopS;
  const late = stage ? lateStartFor(stage, sel.mode) : 0;
  Object.assign(st, {
    state: 'title',
    train: { s: s0, v: 0, acc: 0, notch: NOTCH_INITIAL },
    t: departureTime(route, from) + late, target: nextStopIndex(route, from), overspeed: 0, eb: false,
    stopTimer: 0, notchAtStop: 0, lastJoint: Math.floor(s0 / 25),
    overspeedActive: false, beepT: 0, dwellT: 0, flags: {}, stops: [], passes: [],
    sel, fromIndex: from, endIndex: end, lateStart: late, doors: 'closed',
    signals: (route.signals ?? []).map(() => 'G'), nextSignal: -1, sigLimit: Infinity, precedingS: 0,
    ats: { state: 'normal', timer: 0, reason: '' },
    penalties: { atsWarn: 0, atsBrake: 0, redPass: 0, wrongStop: 0 },
  } satisfies GameState);
}

/** index より後の最初の停車駅（通過駅を除く）。無ければ -1 */
export function nextStopIndex(route: Route, index: number): number {
  for (let i = index + 1; i < route.stations.length; i++) if (!route.stations[i].pass) return i;
  return -1;
}

/** 今回プレイの終着か */
export const isFinalStop = (route: Route, index: number, st?: GameState): boolean =>
  st ? index === st.endIndex || nextStopIndex(route, index) < 0 : nextStopIndex(route, index) < 0;
