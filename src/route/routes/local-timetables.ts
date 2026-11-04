// 時間帯ごとの普通の時刻表（待避で停車時間が変わる。scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec, TimeOfDay } from '../types';

export const LOCAL_TT: Record<string, Partial<Record<TimeOfDay, ServiceSpec['timetable']>>> = {
  'shiokaze': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 607 }, 6: { arr: 692, dep: 717 }, 7: { arr: 807, dep: 832 }, 8: { arr: 932, dep: 957 }, 9: { arr: 1062 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 375 }, 4: { arr: 495, dep: 520 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705, dep: 730 }, 7: { arr: 820, dep: 845 }, 8: { arr: 945, dep: 970 }, 9: { arr: 1075 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 565 }, 6: { arr: 650, dep: 675 }, 7: { arr: 765, dep: 790 }, 8: { arr: 890, dep: 915 }, 9: { arr: 1020 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 305, dep: 330 }, 4: { arr: 440, dep: 465 }, 5: { arr: 540, dep: 565 }, 6: { arr: 650, dep: 675 }, 7: { arr: 765, dep: 790 }, 8: { arr: 890, dep: 915 }, 9: { arr: 1020 } },
  },
  'shiokaze-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 522 }, 5: { arr: 602, dep: 627 }, 6: { arr: 737, dep: 762 }, 7: { arr: 852, dep: 877 }, 8: { arr: 957, dep: 982 }, 9: { arr: 1062 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 685, dep: 750 }, 7: { arr: 845, dep: 870 }, 8: { arr: 950, dep: 975 }, 9: { arr: 1055 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 735, dep: 760 }, 7: { arr: 850, dep: 875 }, 8: { arr: 955, dep: 980 }, 9: { arr: 1060 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 685, dep: 750 }, 7: { arr: 845, dep: 870 }, 8: { arr: 950, dep: 975 }, 9: { arr: 1055 } },
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
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 522 }, 5: { arr: 602, dep: 627 }, 6: { arr: 737, dep: 762 }, 7: { arr: 852, dep: 877 }, 8: { arr: 957, dep: 982 }, 9: { arr: 1062, dep: 1257 }, 10: { arr: 1387, dep: 1412 }, 11: { arr: 1512, dep: 1537 }, 12: { arr: 1632, dep: 1657 }, 13: { arr: 1747 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 685, dep: 752 }, 7: { arr: 847, dep: 872 }, 8: { arr: 952, dep: 977 }, 9: { arr: 1057, dep: 1158 }, 10: { arr: 1288, dep: 1313 }, 11: { arr: 1413, dep: 1438 }, 12: { arr: 1533, dep: 1558 }, 13: { arr: 1648 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 735, dep: 760 }, 7: { arr: 850, dep: 875 }, 8: { arr: 955, dep: 980 }, 9: { arr: 1055, dep: 1080 }, 10: { arr: 1200, dep: 1225 }, 11: { arr: 1325, dep: 1350 }, 12: { arr: 1445, dep: 1470 }, 13: { arr: 1560 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 445, dep: 470 }, 5: { arr: 540, dep: 565 }, 6: { arr: 685, dep: 752 }, 7: { arr: 847, dep: 872 }, 8: { arr: 952, dep: 977 }, 9: { arr: 1057, dep: 1158 }, 10: { arr: 1288, dep: 1313 }, 11: { arr: 1413, dep: 1438 }, 12: { arr: 1533, dep: 1558 }, 13: { arr: 1648 } },
  },
  'nankai-through': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 716 }, 5: { arr: 801, dep: 826 }, 6: { arr: 906, dep: 931 }, 7: { arr: 1021, dep: 1046 }, 8: { arr: 1156, dep: 1181 }, 9: { arr: 1256, dep: 1323 }, 10: { arr: 1408, dep: 1433 }, 11: { arr: 1523, dep: 1548 }, 12: { arr: 1648, dep: 1673 }, 13: { arr: 1778 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 586 }, 5: { arr: 671, dep: 696 }, 6: { arr: 776, dep: 801 }, 7: { arr: 896, dep: 961 }, 8: { arr: 1081, dep: 1106 }, 9: { arr: 1181, dep: 1206 }, 10: { arr: 1291, dep: 1316 }, 11: { arr: 1406, dep: 1431 }, 12: { arr: 1531, dep: 1556 }, 13: { arr: 1661 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 684 }, 5: { arr: 769, dep: 794 }, 6: { arr: 874, dep: 899 }, 7: { arr: 989, dep: 1014 }, 8: { arr: 1124, dep: 1149 }, 9: { arr: 1224, dep: 1249 }, 10: { arr: 1334, dep: 1359 }, 11: { arr: 1449, dep: 1474 }, 12: { arr: 1574, dep: 1599 }, 13: { arr: 1704 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 586 }, 5: { arr: 671, dep: 696 }, 6: { arr: 776, dep: 801 }, 7: { arr: 891, dep: 916 }, 8: { arr: 1026, dep: 1051 }, 9: { arr: 1126, dep: 1151 }, 10: { arr: 1236, dep: 1261 }, 11: { arr: 1351, dep: 1376 }, 12: { arr: 1476, dep: 1501 }, 13: { arr: 1606 } },
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
