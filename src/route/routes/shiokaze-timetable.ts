// 南海本線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<'local' | 'express' | 'limited', ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 375 }, 4: { arr: 495, dep: 520 }, 5: { arr: 595, dep: 660 }, 6: { arr: 745, dep: 770 }, 7: { arr: 860, dep: 885 }, 8: { arr: 985, dep: 1010 }, 9: { arr: 1115 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 110 }, 3: { arr: 160 }, 4: { arr: 255, dep: 280 }, 5: { arr: 335 }, 6: { arr: 370 }, 7: { arr: 430 }, 8: { arr: 490 }, 9: { arr: 570 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 60 }, 2: { arr: 100 }, 3: { arr: 145 }, 4: { arr: 215 }, 5: { arr: 255 }, 6: { arr: 290 }, 7: { arr: 345 }, 8: { arr: 400 }, 9: { arr: 475 } },
};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<'local' | 'express' | 'limited', ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 810 }, 7: { arr: 905, dep: 930 }, 8: { arr: 1010, dep: 1035 }, 9: { arr: 1115 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 145 }, 3: { arr: 190 }, 4: { arr: 240 }, 5: { arr: 295, dep: 320 }, 6: { arr: 420 }, 7: { arr: 470 }, 8: { arr: 515 }, 9: { arr: 575 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 75 }, 2: { arr: 130 }, 3: { arr: 170 }, 4: { arr: 215 }, 5: { arr: 255 }, 6: { arr: 330 }, 7: { arr: 375 }, 8: { arr: 415 }, 9: { arr: 470 } },
};
