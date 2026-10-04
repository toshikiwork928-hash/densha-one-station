// 自己ベスト（localStorage。使えない環境では記録しないだけ）
import type { ServiceId } from '../route/types';
import type { GameMode } from './state';

const KEY = 'densha.best.v1';

export interface BestEntry { total: number; rank: string; date: string }

function load(): Record<string, BestEntry> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; }
}

// 急行は従来（種別導入前）の記録と同じキー
const keyOf = (routeId: string, stageId: string, mode: GameMode, service?: ServiceId) =>
  `${routeId}:${service && service !== 'express' ? service + '/' : ''}${stageId}:${mode}`;

export function getBest(routeId: string, stageId: string, mode: GameMode, service?: ServiceId): BestEntry | undefined {
  return load()[keyOf(routeId, stageId, mode, service)];
}

/** 結果を登録。戻り値: 自己ベスト更新か、と更新前の記録 */
export function submitScore(routeId: string, stageId: string, mode: GameMode, total: number, rank: string, service?: ServiceId): { isNew: boolean; prev?: BestEntry } {
  const all = load(), k = keyOf(routeId, stageId, mode, service), prev = all[k];
  if (prev && prev.total >= total) return { isNew: false, prev };
  all[k] = { total, rank, date: new Date().toISOString().slice(0, 10) };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 保存不可 */ }
  return { isNew: true, prev };
}
