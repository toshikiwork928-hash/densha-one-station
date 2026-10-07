// 南海本線 堺〜岸和田（通し）の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 下り（堺 → 岸和田） */
export const NT: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 810 }, 7: { arr: 905, dep: 930 }, 8: { arr: 1010, dep: 1035 }, 9: { arr: 1115, dep: 1140 }, 10: { arr: 1270, dep: 1295 }, 11: { arr: 1395, dep: 1420 }, 12: { arr: 1515, dep: 1540 }, 13: { arr: 1630 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 145 }, 3: { arr: 190 }, 4: { arr: 240 }, 5: { arr: 295, dep: 320 }, 6: { arr: 420 }, 7: { arr: 470 }, 8: { arr: 515 }, 9: { arr: 575, dep: 600 }, 10: { arr: 705 }, 11: { arr: 780, dep: 805 }, 12: { arr: 885 }, 13: { arr: 950 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 80 }, 2: { arr: 140 }, 3: { arr: 185 }, 4: { arr: 230 }, 5: { arr: 285, dep: 310 }, 6: { arr: 405 }, 7: { arr: 455 }, 8: { arr: 500 }, 9: { arr: 555, dep: 580 }, 10: { arr: 680 }, 11: { arr: 755, dep: 780 }, 12: { arr: 855 }, 13: { arr: 920 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 75 }, 2: { arr: 130 }, 3: { arr: 170 }, 4: { arr: 215 }, 5: { arr: 255 }, 6: { arr: 330 }, 7: { arr: 375 }, 8: { arr: 415 }, 9: { arr: 450 }, 10: { arr: 525 }, 11: { arr: 580 }, 12: { arr: 630 }, 13: { arr: 695 } },
  southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 140 }, 3: { arr: 185 }, 4: { arr: 235 }, 5: { arr: 275 }, 6: { arr: 350 }, 7: { arr: 395 }, 8: { arr: 435 }, 9: { arr: 470 }, 10: { arr: 550 }, 11: { arr: 605 }, 12: { arr: 655 }, 13: { arr: 720 } },
};

/** 上り（岸和田 → 堺） */
export const NT_UP: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 510 }, 5: { arr: 595, dep: 620 }, 6: { arr: 700, dep: 725 }, 7: { arr: 820, dep: 885 }, 8: { arr: 1005, dep: 1030 }, 9: { arr: 1105, dep: 1170 }, 10: { arr: 1255, dep: 1280 }, 11: { arr: 1370, dep: 1395 }, 12: { arr: 1495, dep: 1520 }, 13: { arr: 1625 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 70 }, 2: { arr: 145, dep: 170 }, 3: { arr: 255 }, 4: { arr: 355, dep: 380 }, 5: { arr: 445 }, 6: { arr: 490 }, 7: { arr: 540 }, 8: { arr: 635, dep: 660 }, 9: { arr: 715 }, 10: { arr: 755 }, 11: { arr: 810 }, 12: { arr: 870 }, 13: { arr: 945 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 135, dep: 160 }, 3: { arr: 240 }, 4: { arr: 340, dep: 365 }, 5: { arr: 425 }, 6: { arr: 470 }, 7: { arr: 520 }, 8: { arr: 610, dep: 635 }, 9: { arr: 690 }, 10: { arr: 725 }, 11: { arr: 780 }, 12: { arr: 840 }, 13: { arr: 915 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 115 }, 3: { arr: 170 }, 4: { arr: 250 }, 5: { arr: 285 }, 6: { arr: 325 }, 7: { arr: 370 }, 8: { arr: 445 }, 9: { arr: 485 }, 10: { arr: 520 }, 11: { arr: 575 }, 12: { arr: 630 }, 13: { arr: 705 } },
  southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 70 }, 2: { arr: 120 }, 3: { arr: 175 }, 4: { arr: 255 }, 5: { arr: 290 }, 6: { arr: 335 }, 7: { arr: 380 }, 8: { arr: 455 }, 9: { arr: 495 }, 10: { arr: 530 }, 11: { arr: 585 }, 12: { arr: 645 }, 13: { arr: 720 } },
};
