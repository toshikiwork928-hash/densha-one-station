// 空港線の追加3方向の時刻表（scripts/timetable.ts が生成）
import type { ServiceSpec } from '../types';
export const AT_UP = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 335, dep: 360 }, 2: { arr: 480 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 290, dep: 315 }, 2: { arr: 435 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 295, dep: 320 }, 2: { arr: 445 } },
} satisfies Record<string, ServiceSpec['timetable']>;
export const KT_UP = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 335, dep: 360 }, 2: { arr: 480, dep: 505 }, 3: { arr: 630, dep: 655 }, 4: { arr: 740, dep: 765 }, 5: { arr: 840, dep: 865 }, 6: { arr: 985, dep: 1010 }, 7: { arr: 1120, dep: 1145 }, 8: { arr: 1225 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 290, dep: 315 }, 2: { arr: 435, dep: 460 }, 3: { arr: 570 }, 4: { arr: 610 }, 5: { arr: 645 }, 6: { arr: 730, dep: 755 }, 7: { arr: 850 }, 8: { arr: 905 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 295, dep: 320 }, 2: { arr: 445, dep: 470 }, 3: { arr: 580 }, 4: { arr: 620 }, 5: { arr: 655 }, 6: { arr: 720 }, 7: { arr: 790 }, 8: { arr: 845 } },
} satisfies Record<string, ServiceSpec['timetable']>;
export const NT_AIRPORT = {
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 245, dep: 270 }, 3: { arr: 330 }, 4: { arr: 375 }, 5: { arr: 400 }, 6: { arr: 440 }, 7: { arr: 505 }, 8: { arr: 590, dep: 615 }, 9: { arr: 690 }, 10: { arr: 745 }, 11: { arr: 790 }, 12: { arr: 835 }, 13: { arr: 890, dep: 915 }, 14: { arr: 1010 }, 15: { arr: 1055 }, 16: { arr: 1095 }, 17: { arr: 1150, dep: 1175 }, 18: { arr: 1270 }, 19: { arr: 1345, dep: 1370 }, 20: { arr: 1440 }, 21: { arr: 1505, dep: 1530 }, 22: { arr: 1585 }, 23: { arr: 1675, dep: 1700 }, 24: { arr: 1795 }, 25: { arr: 1830 }, 26: { arr: 1870 }, 27: { arr: 1975, dep: 2000 }, 28: { arr: 2125, dep: 2150 }, 29: { arr: 2500 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 250, dep: 275 }, 3: { arr: 335 }, 4: { arr: 380 }, 5: { arr: 405 }, 6: { arr: 445 }, 7: { arr: 510 }, 8: { arr: 595, dep: 620 }, 9: { arr: 700 }, 10: { arr: 755 }, 11: { arr: 795 }, 12: { arr: 840 }, 13: { arr: 880 }, 14: { arr: 955 }, 15: { arr: 1000 }, 16: { arr: 1040 }, 17: { arr: 1075 }, 18: { arr: 1150 }, 19: { arr: 1205 }, 20: { arr: 1255 }, 21: { arr: 1320, dep: 1345 }, 22: { arr: 1405 }, 23: { arr: 1475 }, 24: { arr: 1540 }, 25: { arr: 1575 }, 26: { arr: 1615 }, 27: { arr: 1720, dep: 1745 }, 28: { arr: 1875, dep: 1900 }, 29: { arr: 2250 } },
} satisfies Record<string, ServiceSpec['timetable']>;
