// 南海本線 みさき公園〜和歌山港の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'southern';
/** 下り（みさき公園 → 和歌山港） */
export const MWT: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 335, dep: 360 }, 2: { arr: 475, dep: 500 }, 3: { arr: 695, dep: 720 }, 4: { arr: 900, dep: 925 }, 5: { arr: 1165 } }, express: { 0: { arr: 0, dep: 0 }, 1: { arr: 250 }, 2: { arr: 395, dep: 420 }, 3: { arr: 595 }, 4: { arr: 780, dep: 805 }, 5: { arr: 1140 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 255 }, 2: { arr: 395, dep: 420 }, 3: { arr: 595 }, 4: { arr: 780, dep: 805 }, 5: { arr: 1140 } } };
/** 上り（和歌山港 → みさき公園） */
export const MWT_UP: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 300, dep: 325 }, 2: { arr: 480, dep: 505 }, 3: { arr: 780, dep: 805 }, 4: { arr: 925, dep: 950 }, 5: { arr: 1200 } }, express: { 0: { arr: 0, dep: 0 }, 1: { arr: 395, dep: 420 }, 2: { arr: 560 }, 3: { arr: 755, dep: 780 }, 4: { arr: 895 }, 5: { arr: 1175 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 395, dep: 420 }, 2: { arr: 560 }, 3: { arr: 755, dep: 780 }, 4: { arr: 895 }, 5: { arr: 1175 } } };
