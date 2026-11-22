// 高野線の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

/** 下り（橋本 → 極楽橋） */
export const MT: Record<'local', ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 175, dep: 200 }, 2: { arr: 465, dep: 495 }, 3: { arr: 775, dep: 800 }, 4: { arr: 1045 } },
};

/** 上り（極楽橋 → 橋本） */
export const MT_UP: Record<'local', ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 235, dep: 260 }, 2: { arr: 530, dep: 560 }, 3: { arr: 795, dep: 820 }, 4: { arr: 990 } },
};
