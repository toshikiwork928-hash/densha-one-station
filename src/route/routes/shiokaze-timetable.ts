// 汐風線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceId, ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 145, dep: 170 }, 2: { arr: 315, dep: 390 }, 3: { arr: 550, dep: 575 }, 4: { arr: 730, dep: 755 }, 5: { arr: 900 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 130 }, 2: { arr: 230 }, 3: { arr: 365, dep: 390 }, 4: { arr: 545, dep: 570 }, 5: { arr: 715 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 120 }, 2: { arr: 220 }, 3: { arr: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 615 } },
};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 140, dep: 165 }, 2: { arr: 320, dep: 345 }, 3: { arr: 500, dep: 575 }, 4: { arr: 725, dep: 750 }, 5: { arr: 895 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 140, dep: 165 }, 2: { arr: 320, dep: 345 }, 3: { arr: 490 }, 4: { arr: 590 }, 5: { arr: 715 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 135, dep: 160 }, 2: { arr: 280 }, 3: { arr: 395 }, 4: { arr: 495 }, 5: { arr: 615 } },
};
