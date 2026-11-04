// 時間帯ごとの普通の時刻表（待避で停車時間が変わる。scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec, TimeOfDay } from '../types';

export const LOCAL_TT: Record<string, Partial<Record<TimeOfDay, ServiceSpec['timetable']>>> = {
  'shiokaze': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 607 }, 6: { arr: 692, dep: 717 }, 7: { arr: 807, dep: 832 }, 8: { arr: 932, dep: 957 }, 9: { arr: 1062 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 565 }, 6: { arr: 650, dep: 675 }, 7: { arr: 765, dep: 790 }, 8: { arr: 890, dep: 915 }, 9: { arr: 1020 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 565 }, 6: { arr: 650, dep: 675 }, 7: { arr: 765, dep: 790 }, 8: { arr: 890, dep: 915 }, 9: { arr: 1020 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 565 }, 6: { arr: 650, dep: 675 }, 7: { arr: 765, dep: 790 }, 8: { arr: 890, dep: 915 }, 9: { arr: 1020 } },
  },
  'shiokaze-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 618 }, 5: { arr: 698, dep: 723 }, 6: { arr: 833, dep: 858 }, 7: { arr: 948, dep: 973 }, 8: { arr: 1053, dep: 1078 }, 9: { arr: 1158 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 675, dep: 700 }, 7: { arr: 790, dep: 815 }, 8: { arr: 895, dep: 920 }, 9: { arr: 1000 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 616 }, 5: { arr: 696, dep: 721 }, 6: { arr: 831, dep: 856 }, 7: { arr: 946, dep: 971 }, 8: { arr: 1051, dep: 1076 }, 9: { arr: 1156 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 812 }, 7: { arr: 907, dep: 932 }, 8: { arr: 1012, dep: 1037 }, 9: { arr: 1117 } },
  },
  'kishiwada': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 130, dep: 155 }, 2: { arr: 255, dep: 280 }, 3: { arr: 375, dep: 400 }, 4: { arr: 490 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 130, dep: 155 }, 2: { arr: 255, dep: 280 }, 3: { arr: 375, dep: 400 }, 4: { arr: 490 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 130, dep: 155 }, 2: { arr: 255, dep: 280 }, 3: { arr: 375, dep: 400 }, 4: { arr: 490 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 130, dep: 155 }, 2: { arr: 255, dep: 280 }, 3: { arr: 375, dep: 400 }, 4: { arr: 490 } },
  },
  'kishiwada-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
  },
  'izumisano': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 220, dep: 245 }, 3: { arr: 360, dep: 385 }, 4: { arr: 460, dep: 485 }, 5: { arr: 570, dep: 595 }, 6: { arr: 720 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 220, dep: 245 }, 3: { arr: 360, dep: 385 }, 4: { arr: 460, dep: 485 }, 5: { arr: 570, dep: 595 }, 6: { arr: 720 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 220, dep: 245 }, 3: { arr: 360, dep: 385 }, 4: { arr: 460, dep: 485 }, 5: { arr: 570, dep: 595 }, 6: { arr: 720 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 220, dep: 245 }, 3: { arr: 360, dep: 385 }, 4: { arr: 460, dep: 485 }, 5: { arr: 570, dep: 595 }, 6: { arr: 720 } },
  },
  'izumisano-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 215, dep: 240 }, 3: { arr: 315, dep: 340 }, 4: { arr: 460, dep: 485 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 215, dep: 240 }, 3: { arr: 315, dep: 340 }, 4: { arr: 460, dep: 485 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 215, dep: 240 }, 3: { arr: 315, dep: 340 }, 4: { arr: 460, dep: 485 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 215, dep: 240 }, 3: { arr: 315, dep: 340 }, 4: { arr: 460, dep: 485 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705 } },
  },
  'nankai-through-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 618 }, 5: { arr: 698, dep: 723 }, 6: { arr: 833, dep: 858 }, 7: { arr: 948, dep: 973 }, 8: { arr: 1053, dep: 1078 }, 9: { arr: 1158, dep: 1259 }, 10: { arr: 1389, dep: 1414 }, 11: { arr: 1514, dep: 1539 }, 12: { arr: 1634, dep: 1659 }, 13: { arr: 1749 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 675, dep: 700 }, 7: { arr: 790, dep: 815 }, 8: { arr: 895, dep: 920 }, 9: { arr: 1000, dep: 1101 }, 10: { arr: 1231, dep: 1256 }, 11: { arr: 1356, dep: 1381 }, 12: { arr: 1476, dep: 1501 }, 13: { arr: 1591 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 616 }, 5: { arr: 696, dep: 721 }, 6: { arr: 831, dep: 856 }, 7: { arr: 946, dep: 971 }, 8: { arr: 1051, dep: 1076 }, 9: { arr: 1156, dep: 1355 }, 10: { arr: 1485, dep: 1510 }, 11: { arr: 1610, dep: 1635 }, 12: { arr: 1730, dep: 1755 }, 13: { arr: 1845 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 812 }, 7: { arr: 907, dep: 932 }, 8: { arr: 1012, dep: 1037 }, 9: { arr: 1112, dep: 1137 }, 10: { arr: 1257, dep: 1282 }, 11: { arr: 1382, dep: 1407 }, 12: { arr: 1502, dep: 1527 }, 13: { arr: 1617 } },
  },
  'nankai-through': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 682 }, 5: { arr: 767, dep: 792 }, 6: { arr: 872, dep: 897 }, 7: { arr: 987, dep: 1012 }, 8: { arr: 1122, dep: 1147 }, 9: { arr: 1222, dep: 1385 }, 10: { arr: 1470, dep: 1495 }, 11: { arr: 1585, dep: 1610 }, 12: { arr: 1710, dep: 1735 }, 13: { arr: 1840 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 684 }, 5: { arr: 769, dep: 794 }, 6: { arr: 874, dep: 899 }, 7: { arr: 989, dep: 1014 }, 8: { arr: 1124, dep: 1149 }, 9: { arr: 1224, dep: 1249 }, 10: { arr: 1334, dep: 1359 }, 11: { arr: 1449, dep: 1474 }, 12: { arr: 1574, dep: 1599 }, 13: { arr: 1704 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 684 }, 5: { arr: 769, dep: 794 }, 6: { arr: 874, dep: 899 }, 7: { arr: 989, dep: 1014 }, 8: { arr: 1124, dep: 1149 }, 9: { arr: 1224, dep: 1249 }, 10: { arr: 1334, dep: 1359 }, 11: { arr: 1449, dep: 1474 }, 12: { arr: 1574, dep: 1599 }, 13: { arr: 1704 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 684 }, 5: { arr: 769, dep: 794 }, 6: { arr: 874, dep: 899 }, 7: { arr: 989, dep: 1014 }, 8: { arr: 1124, dep: 1149 }, 9: { arr: 1224, dep: 1249 }, 10: { arr: 1334, dep: 1359 }, 11: { arr: 1449, dep: 1474 }, 12: { arr: 1574, dep: 1599 }, 13: { arr: 1704 } },
  },
  'namba': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 115, dep: 140 }, 2: { arr: 245, dep: 270 }, 3: { arr: 350, dep: 375 }, 4: { arr: 435, dep: 460 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 955 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 115, dep: 140 }, 2: { arr: 245, dep: 270 }, 3: { arr: 350, dep: 375 }, 4: { arr: 435, dep: 460 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 955 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 115, dep: 140 }, 2: { arr: 245, dep: 270 }, 3: { arr: 350, dep: 375 }, 4: { arr: 435, dep: 460 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 955 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 115, dep: 140 }, 2: { arr: 245, dep: 270 }, 3: { arr: 350, dep: 375 }, 4: { arr: 435, dep: 460 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 955 } },
  },
  'namba-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 250, dep: 275 }, 3: { arr: 350, dep: 375 }, 4: { arr: 465, dep: 490 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 925 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 250, dep: 275 }, 3: { arr: 350, dep: 375 }, 4: { arr: 465, dep: 490 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 925 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 250, dep: 275 }, 3: { arr: 350, dep: 375 }, 4: { arr: 465, dep: 490 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 925 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 120, dep: 145 }, 2: { arr: 250, dep: 275 }, 3: { arr: 350, dep: 375 }, 4: { arr: 465, dep: 490 }, 5: { arr: 550, dep: 575 }, 6: { arr: 655, dep: 680 }, 7: { arr: 785, dep: 810 }, 8: { arr: 925 } },
  },
};
