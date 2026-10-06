// 路線レジストリ
import type { Route } from './types';
import { sakuragaoka } from './routes/sakuragaoka';
import { shiokaze, shiokazeUp } from './routes/shiokaze';
import { mountain, mountainUp } from './routes/mountain';
import { kishiwada, kishiwadaUp } from './routes/kishiwada';
import { through, throughUp } from './routes/through';

export const ROUTES: Record<string, Route> = { [sakuragaoka.id]: sakuragaoka, [shiokaze.id]: shiokaze, [shiokazeUp.id]: shiokazeUp, [mountain.id]: mountain, [mountainUp.id]: mountainUp,
  [kishiwada.id]: kishiwada, [kishiwadaUp.id]: kishiwadaUp, [through.id]: through, [throughUp.id]: throughUp };
/** 方向の切替（下り ↔ 上り）。タイトルの方向ボタン用 */
export const ROUTE_DIRS: { id: string; label: string; desc: string }[] = [
  { id: shiokaze.id, label: '上り', desc: '泉大津 → 堺' },
  { id: shiokazeUp.id, label: '下り', desc: '堺 → 泉大津' },
];
/** 路線（線区）の一覧。メインメニューの路線選択用。dirs[0] が既定の方向。山岳線は route/routes/ に追加して登録する */
export interface DirEntry { id: string; label: string; desc: string }
/** 区間（同じ線区を複数の路線データに分けたもの）。dirs[0] が既定の方向 */
export interface SectionEntry { id: string; name: string; desc: string; dirs: DirEntry[] }
/** dirs = 線区の全方向（区間があれば全区間の方向を連結）。sections があればメニューで区間 → 方向の順に選ぶ */
export interface LineEntry { id: string; name: string; desc: string; theme: 'coast' | 'mountain'; dirs: DirEntry[]; sections?: SectionEntry[] }
/** 南海本線の区間（難波側から） */
const NANKAI_SECTIONS: SectionEntry[] = [
  { id: 'izumiotsu-sakai', name: '堺〜泉大津', desc: '10駅・10.6km。高架駅、路面電車跨線橋、鉄橋と支線', dirs: ROUTE_DIRS },
  {
    id: 'izumiotsu-kishiwada', name: '泉大津〜岸和田', desc: '5駅・5.6km。大津川を渡って地上へ、高架の屋内駅・岸和田。空港急行・特急ラピート・特急サザン',
    dirs: [
      { id: kishiwada.id, label: '下り', desc: '泉大津 → 岸和田' },
      { id: kishiwadaUp.id, label: '上り', desc: '岸和田 → 泉大津' },
    ],
  },
  {
    id: 'sakai-kishiwada', name: '堺〜岸和田（通し）', desc: '14駅・16.2km。2区間の通し。特急ラピート・特急サザンは堺〜岸和田ノンストップ',
    dirs: [
      { id: throughUp.id, label: '下り', desc: '堺 → 岸和田' },
      { id: through.id, label: '上り', desc: '岸和田 → 堺' },
    ],
  },
];
export const LINES: LineEntry[] = [
  {
    id: 'shiokaze', name: '南海本線', desc: '南海本線（堺〜泉大津〜岸和田）。海沿いの複線。区間を選ぶ。普通・急行・空港急行・特急ラピート・特急サザン', theme: 'coast',
    dirs: NANKAI_SECTIONS.flatMap(x => x.dirs), sections: NANKAI_SECTIONS,
  },
  {
    id: 'mountain', name: '高野線', desc: '高野線（橋本〜極楽橋、一部の駅を省略）。谷を上る単線の山岳線。50‰ の急勾配と急曲線、交換駅で行き違い。各停（2300系 2両/4両）', theme: 'mountain',
    dirs: [
      { id: mountain.id, label: '下り', desc: '橋本 → 極楽橋' },
      { id: mountainUp.id, label: '上り', desc: '極楽橋 → 橋本' },
    ],
  },
];
/** route id → 区間（区間の無い線区は undefined） */
export const sectionOf = (routeId: string): SectionEntry | undefined => lineOf(routeId)?.sections?.find(x => x.dirs.some(d => d.id === routeId));
/** route id → 線区 */
export const lineOf = (routeId: string): LineEntry | undefined => LINES.find(l => l.dirs.some(d => d.id === routeId));
/** 既定は南海本線の全線 */
export const DEFAULT_ROUTE = shiokaze;
export type { Route } from './types';
