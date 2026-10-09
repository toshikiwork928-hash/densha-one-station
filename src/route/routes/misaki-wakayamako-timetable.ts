// 南海本線 みさき公園〜和歌山港の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'southern';
/** 下り（みさき公園 → 和歌山港） */
export const MWT: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 255, dep: 280 }, 2: { arr: 395, dep: 420 }, 3: { arr: 615, dep: 640 }, 4: { arr: 795, dep: 820 }, 5: { arr: 1035 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 255 }, 2: { arr: 360, dep: 385 }, 3: { arr: 560 }, 4: { arr: 690, dep: 715 }, 5: { arr: 935 } } };
/** 上り（和歌山港 → みさき公園） */
export const MWT_UP: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 170, dep: 195 }, 2: { arr: 350, dep: 375 }, 3: { arr: 575, dep: 600 }, 4: { arr: 720, dep: 745 }, 5: { arr: 995 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 175, dep: 200 }, 2: { arr: 340 }, 3: { arr: 520, dep: 545 }, 4: { arr: 660 }, 5: { arr: 895 } } };
