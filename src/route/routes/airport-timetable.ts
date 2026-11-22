// 南海空港線 泉佐野〜関西空港の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';
type Id = 'local' | 'airport' | 'limited';
export const AT: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 125, dep: 150 }, 2: { arr: 535 } }, airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 125, dep: 150 }, 2: { arr: 500 } }, limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 130, dep: 155 }, 2: { arr: 505 } },
};
export const KT_AIRPORT: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 75, dep: 100 }, 2: { arr: 210, dep: 235 }, 3: { arr: 350, dep: 375 }, 4: { arr: 450, dep: 475 }, 5: { arr: 560, dep: 585 }, 6: { arr: 710, dep: 735 }, 7: { arr: 860, dep: 885 }, 8: { arr: 1270 } }, airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 55 }, 2: { arr: 145, dep: 170 }, 3: { arr: 265 }, 4: { arr: 300 }, 5: { arr: 340 }, 6: { arr: 445, dep: 470 }, 7: { arr: 595, dep: 620 }, 8: { arr: 970 } }, limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 60 }, 2: { arr: 130 }, 3: { arr: 195 }, 4: { arr: 230 }, 5: { arr: 270 }, 6: { arr: 375, dep: 400 }, 7: { arr: 530, dep: 555 }, 8: { arr: 905 } },
};
