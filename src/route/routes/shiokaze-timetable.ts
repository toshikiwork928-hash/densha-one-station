// 汐風線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceId, ServiceSpec } from '../types';

/** 下り（桜ヶ丘 → 岬口） */
export const TT: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 145, dep: 170 }, 2: { arr: 315, dep: 413 }, 3: { arr: 573, dep: 598 }, 4: { arr: 693, dep: 718 }, 5: { arr: 803, dep: 867 }, 6: { arr: 1012 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 130 }, 2: { arr: 250, dep: 275 }, 3: { arr: 415 }, 4: { arr: 470 }, 5: { arr: 530, dep: 555 }, 6: { arr: 700 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 120 }, 2: { arr: 235, dep: 260 }, 3: { arr: 395 }, 4: { arr: 450 }, 5: { arr: 485 }, 6: { arr: 595 } },
};

/** 上り（岬口 → 桜ヶ丘） */
export const TT_UP: Record<ServiceId, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 140, dep: 204 }, 2: { arr: 289, dep: 314 }, 3: { arr: 409, dep: 434 }, 4: { arr: 589, dep: 687 }, 5: { arr: 837, dep: 862 }, 6: { arr: 1007 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 140, dep: 165 }, 2: { arr: 230 }, 3: { arr: 285 }, 4: { arr: 420, dep: 445 }, 5: { arr: 580 }, 6: { arr: 705 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 110 }, 2: { arr: 145 }, 3: { arr: 195 }, 4: { arr: 325, dep: 350 }, 5: { arr: 475 }, 6: { arr: 595 } },
};
