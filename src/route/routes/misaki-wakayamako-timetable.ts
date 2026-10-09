// 南海本線 みさき公園〜和歌山港の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'southern';
/** 下り（みさき公園 → 和歌山港） */
export const MWT: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 270, dep: 295 }, 2: { arr: 410, dep: 435 }, 3: { arr: 635, dep: 660 }, 4: { arr: 820, dep: 845 }, 5: { arr: 1060 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 275 }, 2: { arr: 390, dep: 415 }, 3: { arr: 595 }, 4: { arr: 740, dep: 765 }, 5: { arr: 985 } } };
/** 上り（和歌山港 → みさき公園） */
export const MWT_UP: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 175, dep: 200 }, 2: { arr: 360, dep: 385 }, 3: { arr: 595, dep: 620 }, 4: { arr: 740, dep: 765 }, 5: { arr: 1025 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 180, dep: 205 }, 2: { arr: 360 }, 3: { arr: 550, dep: 575 }, 4: { arr: 695 }, 5: { arr: 950 } } };
