// 路線レジストリ
import type { Route } from './types';
import { sakuragaoka } from './routes/sakuragaoka';
import { shiokaze, shiokazeUp } from './routes/shiokaze';

export const ROUTES: Record<string, Route> = { [sakuragaoka.id]: sakuragaoka, [shiokaze.id]: shiokaze, [shiokazeUp.id]: shiokazeUp };
/** 方向の切替（下り ↔ 上り）。タイトルの方向ボタン用 */
export const ROUTE_DIRS: { id: string; label: string; desc: string }[] = [
  { id: shiokaze.id, label: '下り', desc: '桜ヶ丘 → 岬口' },
  { id: shiokazeUp.id, label: '上り', desc: '岬口 → 桜ヶ丘' },
];
/** 既定は全線（先頭区間は旧 sakuragaoka と同一） */
export const DEFAULT_ROUTE = shiokaze;
export type { Route } from './types';
