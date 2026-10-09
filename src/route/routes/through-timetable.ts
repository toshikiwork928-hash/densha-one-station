// 南海本線 堺〜岸和田（通し）の時刻表（scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec } from '../types';

type Id = 'local' | 'express' | 'airport' | 'limited' | 'southern';
/** 下り（堺 → 岸和田） */
export const NT: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075, dep: 1176 }, 10: { arr: 1306, dep: 1331 }, 11: { arr: 1431, dep: 1456 }, 12: { arr: 1551, dep: 1576 }, 13: { arr: 1666 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 145 }, 3: { arr: 190 }, 4: { arr: 240 }, 5: { arr: 295, dep: 320 }, 6: { arr: 420 }, 7: { arr: 470 }, 8: { arr: 515 }, 9: { arr: 575, dep: 600 }, 10: { arr: 705 }, 11: { arr: 760 }, 12: { arr: 810 }, 13: { arr: 875 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 80 }, 2: { arr: 140 }, 3: { arr: 185 }, 4: { arr: 230 }, 5: { arr: 285, dep: 310 }, 6: { arr: 405 }, 7: { arr: 455 }, 8: { arr: 500 }, 9: { arr: 555, dep: 580 }, 10: { arr: 680 }, 11: { arr: 755, dep: 780 }, 12: { arr: 855 }, 13: { arr: 920 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 75 }, 2: { arr: 130 }, 3: { arr: 170 }, 4: { arr: 215 }, 5: { arr: 255 }, 6: { arr: 330 }, 7: { arr: 375 }, 8: { arr: 415 }, 9: { arr: 450 }, 10: { arr: 525 }, 11: { arr: 580 }, 12: { arr: 630 }, 13: { arr: 695 } },
  southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 85 }, 2: { arr: 140 }, 3: { arr: 185 }, 4: { arr: 235 }, 5: { arr: 275 }, 6: { arr: 350 }, 7: { arr: 395 }, 8: { arr: 435 }, 9: { arr: 470 }, 10: { arr: 550 }, 11: { arr: 605 }, 12: { arr: 655 }, 13: { arr: 720 } },
};

/** 上り（岸和田 → 堺） */
export const NT_UP: Record<Id, ServiceSpec['timetable']> = {
  local: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 586 }, 5: { arr: 671, dep: 696 }, 6: { arr: 776, dep: 801 }, 7: { arr: 896, dep: 961 }, 8: { arr: 1081, dep: 1106 }, 9: { arr: 1181, dep: 1206 }, 10: { arr: 1291, dep: 1316 }, 11: { arr: 1406, dep: 1431 }, 12: { arr: 1531, dep: 1556 }, 13: { arr: 1661 } },
  express: { 0: { arr: 0, dep: 0 }, 1: { arr: 70 }, 2: { arr: 125 }, 3: { arr: 180 }, 4: { arr: 280, dep: 305 }, 5: { arr: 370 }, 6: { arr: 415 }, 7: { arr: 465 }, 8: { arr: 560, dep: 585 }, 9: { arr: 640 }, 10: { arr: 680 }, 11: { arr: 735 }, 12: { arr: 795 }, 13: { arr: 870 } },
  airport: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 135, dep: 160 }, 3: { arr: 240 }, 4: { arr: 340, dep: 365 }, 5: { arr: 425 }, 6: { arr: 470 }, 7: { arr: 520 }, 8: { arr: 610, dep: 635 }, 9: { arr: 690 }, 10: { arr: 725 }, 11: { arr: 780 }, 12: { arr: 840 }, 13: { arr: 915 } },
  limited: { 0: { arr: 0, dep: 0 }, 1: { arr: 65 }, 2: { arr: 115 }, 3: { arr: 170 }, 4: { arr: 250 }, 5: { arr: 285 }, 6: { arr: 325 }, 7: { arr: 370 }, 8: { arr: 445 }, 9: { arr: 485 }, 10: { arr: 520 }, 11: { arr: 575 }, 12: { arr: 630 }, 13: { arr: 705 } },
  southern: { 0: { arr: 0, dep: 0 }, 1: { arr: 70 }, 2: { arr: 120 }, 3: { arr: 175 }, 4: { arr: 255 }, 5: { arr: 290 }, 6: { arr: 335 }, 7: { arr: 380 }, 8: { arr: 455 }, 9: { arr: 495 }, 10: { arr: 530 }, 11: { arr: 585 }, 12: { arr: 645 }, 13: { arr: 720 } },
};
