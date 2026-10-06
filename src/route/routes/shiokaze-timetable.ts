// 汐風線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceId, ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 375 }, 4: { arr: 495, dep: 520 }, 5: { arr: 590, dep: 615 }, 6: { arr: 695, dep: 720 }, 7: { arr: 805, dep: 830 }, 8: { arr: 930, dep: 955 }, 9: { arr: 1100 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 105 }, 3: { arr: 155 }, 4: { arr: 245, dep: 270 }, 5: { arr: 330 }, 6: { arr: 375 }, 7: { arr: 420 }, 8: { arr: 480 }, 9: { arr: 610 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 60 }, 2: { arr: 95 }, 3: { arr: 140 }, 4: { arr: 205 }, 5: { arr: 235 }, 6: { arr: 280 }, 7: { arr: 320 }, 8: { arr: 375 }, 9: { arr: 505 } },
};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 340, dep: 365 }, 4: { arr: 445, dep: 470 }, 5: { arr: 545, dep: 570 }, 6: { arr: 685, dep: 750 }, 7: { arr: 850, dep: 875 }, 8: { arr: 955, dep: 980 }, 9: { arr: 1095 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 145 }, 3: { arr: 190 }, 4: { arr: 235 }, 5: { arr: 290, dep: 315 }, 6: { arr: 415 }, 7: { arr: 465 }, 8: { arr: 510 }, 9: { arr: 615 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 75 }, 2: { arr: 130 }, 3: { arr: 170 }, 4: { arr: 215 }, 5: { arr: 245 }, 6: { arr: 315 }, 7: { arr: 360 }, 8: { arr: 405 }, 9: { arr: 510 } },
};
