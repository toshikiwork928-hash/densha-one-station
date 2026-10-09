// 南海本線 泉佐野〜みさき公園の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'southern';
export const SM: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 145, dep: 170 }, 2: { arr: 265, dep: 290 }, 3: { arr: 390, dep: 415 }, 4: { arr: 530, dep: 555 }, 5: { arr: 700, dep: 725 }, 6: { arr: 830, dep: 855 }, 7: { arr: 980, dep: 1005 }, 8: { arr: 1205, dep: 1230 }, 9: { arr: 1360 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 110 }, 2: { arr: 160 }, 3: { arr: 210 }, 4: { arr: 275 }, 5: { arr: 390, dep: 415 }, 6: { arr: 510 }, 7: { arr: 590 }, 8: { arr: 755 }, 9: { arr: 840 } } };
export const SM_UP: Record<Id, ServiceSpec['timetable']> = { local: { 0: { arr: 0, dep: 0 }, 1: { arr: 110, dep: 135 }, 2: { arr: 335, dep: 360 }, 3: { arr: 485, dep: 510 }, 4: { arr: 610, dep: 635 }, 5: { arr: 780, dep: 805 }, 6: { arr: 920, dep: 945 }, 7: { arr: 1045, dep: 1070 }, 8: { arr: 1165, dep: 1190 }, 9: { arr: 1320 } }, southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 95 }, 2: { arr: 255 }, 3: { arr: 330 }, 4: { arr: 420, dep: 445 }, 5: { arr: 570 }, 6: { arr: 635 }, 7: { arr: 685 }, 8: { arr: 735 }, 9: { arr: 835 } } };
