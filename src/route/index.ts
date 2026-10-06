// 路線レジストリ
import type { Route } from './types';
import { sakuragaoka } from './routes/sakuragaoka';
import { shiokaze, shiokazeUp } from './routes/shiokaze';
import { mountain, mountainUp } from './routes/mountain';

export const ROUTES: Record<string, Route> = { [sakuragaoka.id]: sakuragaoka, [shiokaze.id]: shiokaze, [shiokazeUp.id]: shiokazeUp, [mountain.id]: mountain, [mountainUp.id]: mountainUp };
/** 方向の切替（下り ↔ 上り）。タイトルの方向ボタン用 */
export const ROUTE_DIRS: { id: string; label: string; desc: string }[] = [
  { id: shiokaze.id, label: '上り', desc: '泉大津 → 堺' },
  { id: shiokazeUp.id, label: '下り', desc: '堺 → 泉大津' },
];
/** 路線（線区）の一覧。メインメニューの路線選択用。dirs[0] が既定の方向。山岳線は route/routes/ に追加して登録する */
export interface LineEntry { id: string; name: string; desc: string; theme: 'coast' | 'mountain'; dirs: { id: string; label: string; desc: string }[] }
export const LINES: LineEntry[] = [
  { id: 'shiokaze', name: '南海本線', desc: '南海本線（泉大津〜堺）。海沿いの複線10駅・10.6km。高架駅、路面電車跨線橋、鉄橋と支線。普通・急行・特急', theme: 'coast', dirs: ROUTE_DIRS },
  {
    id: 'mountain', name: '高野線', desc: '高野線（橋本〜極楽橋、一部の駅を省略）。谷を上る単線の山岳線。50‰ の急勾配と急曲線、交換駅で行き違い。各停（2300系 2両/4両）', theme: 'mountain',
    dirs: [
      { id: mountain.id, label: '下り', desc: '橋本 → 極楽橋' },
      { id: mountainUp.id, label: '上り', desc: '極楽橋 → 橋本' },
    ],
  },
];
/** route id → 線区 */
export const lineOf = (routeId: string): LineEntry | undefined => LINES.find(l => l.dirs.some(d => d.id === routeId));
/** 既定は南海本線の全線 */
export const DEFAULT_ROUTE = shiokaze;
export type { Route } from './types';
