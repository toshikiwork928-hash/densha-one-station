// 列車の運動モデル。ノッチ → 目標加速度、ブレーキ遅れ、走行抵抗
import { NOTCH_EB } from '../core/config';

export interface TrainState {
  /** 先頭位置 [m] */
  s: number;
  /** 速度 [m/s] */
  v: number;
  /** 現在の加減速度（遅れ込み）[m/s²] */
  acc: number;
  notch: number;
}

/** 外部環境係数。天候・路線側モジュールが書き換える */
export interface TrainEnv {
  /** 粘着係数の倍率（1 = 乾燥。雨天で < 1） */
  adhesion: number;
  /** 現在位置の勾配 [‰]（正 = 上り）。ゲームループが毎 tick 更新 */
  gradePermil: number;
}

export const createTrainEnv = (): TrainEnv => ({ adhesion: 1, gradePermil: 0 });

const G = 9.81;

/** 1 ステップ進める。戻り値: 今回停止した瞬間なら true */
export function stepTrain(tr: TrainState, env: TrainEnv, dt: number): boolean {
  const v = tr.v, n = tr.notch;
  let target = 0;
  if (n > 0) { const amax = v < 9.7 ? .92 : .92 * 9.7 / v; target = amax * n / 5; }
  else if (n < 0) target = n === NOTCH_EB ? -1.45 : -1.15 * (-n) / 8;
  // 粘着低下時は加減速度の上限を下げる（簡易）
  if (env.adhesion < 1) target *= env.adhesion;
  const tau = n < 0 ? .75 : .5; // 空気ブレーキの立ち上がり遅れ
  tr.acc += (target - tr.acc) * Math.min(1, dt / tau);
  const res = .018 + .00005 * v * v;
  // 勾配抵抗（上りで減速）
  const grade = env.gradePermil ? G * env.gradePermil / 1000 : 0;
  const a = tr.acc - (v > 0 ? res : 0) - grade;
  const prevV = tr.v;
  tr.v = Math.max(0, v + a * dt);
  tr.s += tr.v * dt;
  return prevV > 0 && tr.v === 0;
}
