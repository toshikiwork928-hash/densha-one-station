// 南海本線 堺〜難波の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 上り（堺 → 難波） */
export const NB: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 235, dep: 260 }, 3: { arr: 340, dep: 365 }, 4: { arr: 425, dep: 450 }, 5: { arr: 540, dep: 565 }, 6: { arr: 640, dep: 665 }, 7: { arr: 770, dep: 795 }, 8: { arr: 915 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 105 }, 2: { arr: 180 }, 3: { arr: 225 }, 4: { arr: 250 }, 5: { arr: 310 }, 6: { arr: 375, dep: 400 }, 7: { arr: 515, dep: 540 }, 8: { arr: 665 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 100 }, 2: { arr: 175 }, 3: { arr: 220 }, 4: { arr: 245 }, 5: { arr: 305 }, 6: { arr: 365, dep: 390 }, 7: { arr: 495, dep: 520 }, 8: { arr: 640 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 95 }, 2: { arr: 170 }, 3: { arr: 215 }, 4: { arr: 240 }, 5: { arr: 300 }, 6: { arr: 360, dep: 385 }, 7: { arr: 490, dep: 515 }, 8: { arr: 635 } },
  southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 105 }, 2: { arr: 180 }, 3: { arr: 225 }, 4: { arr: 250 }, 5: { arr: 310 }, 6: { arr: 375, dep: 400 }, 7: { arr: 515, dep: 540 }, 8: { arr: 665 } },
};
