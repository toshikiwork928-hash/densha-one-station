// 路線レジストリ
import type { Route } from './types';
import { sakuragaoka } from './routes/sakuragaoka';
import { shiokaze, shiokazeUp } from './routes/shiokaze';
import { mountain, mountainUp } from './routes/mountain';

export const ROUTES: Record<string, Route> = { [sakuragaoka.id]: sakuragaoka, [shiokaze.id]: shiokaze, [shiokazeUp.id]: shiokazeUp, [mountain.id]: mountain, [mountainUp.id]: mountainUp };
/** 方向の切替（下り ↔ 上り）。タイトルの方向ボタン用 */
export const ROUTE_DIRS: { id: string; label: string; desc: string }[] = [
  { id: shiokaze.id, label: '下り', desc: '桜ヶ丘 → 岬口' },
  { id: shiokazeUp.id, label: '上り', desc: '岬口 → 桜ヶ丘' },
];
/** 路線（線区）の一覧。メインメニューの路線選択用。dirs[0] が既定の方向。山岳線は route/routes/ に追加して登録する */
export interface LineEntry { id: string; name: string; desc: string; theme: 'coast' | 'mountain'; dirs: { id: string; label: string; desc: string }[] }
export const LINES: LineEntry[] = [
  { id: 'shiokaze', name: '汐風線', desc: '海沿いの複線。普通・急行・特急、待避と追い抜き', theme: 'coast', dirs: ROUTE_DIRS },
  {
    id: 'mountain', name: '霧峰線', desc: '谷を上る単線の山岳線。50‰ の急勾配と急曲線、交換駅で行き違い。各停（2300系 2両/4両）', theme: 'mountain',
    dirs: [
      { id: mountain.id, label: '下り', desc: '川原町 → 雲ノ橋' },
      { id: mountainUp.id, label: '上り', desc: '雲ノ橋 → 川原町' },
    ],
  },
];
/** route id → 線区 */
export const lineOf = (routeId: string): LineEntry | undefined => LINES.find(l => l.dirs.some(d => d.id === routeId));
/** 既定は全線（先頭区間は旧 sakuragaoka と同一） */
export const DEFAULT_ROUTE = shiokaze;
export type { Route } from './types';
