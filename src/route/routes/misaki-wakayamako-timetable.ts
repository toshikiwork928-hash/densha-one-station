// 南海本線 みさき公園〜和歌山港の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'southern';
/** 下り（みさき公園 → 和歌山港） */
export const MWT: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 275, dep: 300 }, 2: { arr: 430, dep: 455 }, 3: { arr: 665, dep: 690 }, 4: { arr: 860, dep: 885 }, 5: { arr: 1115 } }, express: { 0: { arr: 0, dep: 0 }, 1: { arr: 250 }, 2: { arr: 370, dep: 395 }, 3: { arr: 570 }, 4: { arr: 720, dep: 745 }, 5: { arr: 980 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 255 }, 2: { arr: 375, dep: 400 }, 3: { arr: 575 }, 4: { arr: 720, dep: 745 }, 5: { arr: 980 } } };
/** 上り（和歌山港 → みさき公園） */
export const MWT_UP: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 185, dep: 210 }, 2: { arr: 380, dep: 405 }, 3: { arr: 620, dep: 645 }, 4: { arr: 780, dep: 805 }, 5: { arr: 1060 } }, express: { 0: { arr: 0, dep: 0 }, 1: { arr: 190, dep: 215 }, 2: { arr: 355 }, 3: { arr: 555, dep: 580 }, 4: { arr: 695 }, 5: { arr: 940 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 190, dep: 215 }, 2: { arr: 355 }, 3: { arr: 550, dep: 575 }, 4: { arr: 690 }, 5: { arr: 940 } } };
