// 時間帯ごとの普通の時刻表（待避で停車時間が変わる。scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec, TimeOfDay } from '../types';

export const LOCAL_TT: Record<string, Partial<Record<TimeOfDay, ServiceSpec['timetable']>>> = {
  'shiokaze': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 718 }, 6: { arr: 803, dep: 828 }, 7: { arr: 918, dep: 943 }, 8: { arr: 1043, dep: 1068 }, 9: { arr: 1173 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 375 }, 4: { arr: 495, dep: 520 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705, dep: 730 }, 7: { arr: 820, dep: 845 }, 8: { arr: 945, dep: 970 }, 9: { arr: 1075 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 580 }, 6: { arr: 665, dep: 690 }, 7: { arr: 780, dep: 805 }, 8: { arr: 905, dep: 930 }, 9: { arr: 1035 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 580 }, 6: { arr: 665, dep: 690 }, 7: { arr: 780, dep: 805 }, 8: { arr: 905, dep: 930 }, 9: { arr: 1035 } },
  },
  'shiokaze-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 522 }, 5: { arr: 602, dep: 627 }, 6: { arr: 747, dep: 812 }, 7: { arr: 907, dep: 932 }, 8: { arr: 1012, dep: 1037 }, 9: { arr: 1117 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 616 }, 5: { arr: 696, dep: 721 }, 6: { arr: 841, dep: 866 }, 7: { arr: 961, dep: 986 }, 8: { arr: 1066, dep: 1091 }, 9: { arr: 1171 } },
  },
  'kishiwada-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485 } },
  },
  'nankai-through-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 522 }, 5: { arr: 602, dep: 627 }, 6: { arr: 747, dep: 812 }, 7: { arr: 907, dep: 932 }, 8: { arr: 1012, dep: 1037 }, 9: { arr: 1117, dep: 1216 }, 10: { arr: 1346, dep: 1371 }, 11: { arr: 1471, dep: 1496 }, 12: { arr: 1591, dep: 1616 }, 13: { arr: 1706 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075, dep: 1176 }, 10: { arr: 1306, dep: 1331 }, 11: { arr: 1431, dep: 1456 }, 12: { arr: 1551, dep: 1576 }, 13: { arr: 1666 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075, dep: 1272 }, 10: { arr: 1402, dep: 1427 }, 11: { arr: 1527, dep: 1552 }, 12: { arr: 1647, dep: 1672 }, 13: { arr: 1762 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 616 }, 5: { arr: 696, dep: 721 }, 6: { arr: 841, dep: 866 }, 7: { arr: 961, dep: 986 }, 8: { arr: 1066, dep: 1091 }, 9: { arr: 1171, dep: 1370 }, 10: { arr: 1500, dep: 1525 }, 11: { arr: 1625, dep: 1650 }, 12: { arr: 1745, dep: 1770 }, 13: { arr: 1860 } },
  },
  'nankai-through': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 584 }, 5: { arr: 669, dep: 694 }, 6: { arr: 774, dep: 799 }, 7: { arr: 894, dep: 919 }, 8: { arr: 1039, dep: 1064 }, 9: { arr: 1139, dep: 1302 }, 10: { arr: 1387, dep: 1412 }, 11: { arr: 1502, dep: 1527 }, 12: { arr: 1627, dep: 1652 }, 13: { arr: 1757 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 586 }, 5: { arr: 671, dep: 696 }, 6: { arr: 776, dep: 801 }, 7: { arr: 896, dep: 961 }, 8: { arr: 1081, dep: 1106 }, 9: { arr: 1181, dep: 1206 }, 10: { arr: 1291, dep: 1316 }, 11: { arr: 1406, dep: 1431 }, 12: { arr: 1531, dep: 1556 }, 13: { arr: 1661 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 680 }, 5: { arr: 765, dep: 790 }, 6: { arr: 870, dep: 895 }, 7: { arr: 990, dep: 1015 }, 8: { arr: 1135, dep: 1160 }, 9: { arr: 1235, dep: 1260 }, 10: { arr: 1345, dep: 1370 }, 11: { arr: 1460, dep: 1485 }, 12: { arr: 1585, dep: 1610 }, 13: { arr: 1715 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 680 }, 5: { arr: 765, dep: 790 }, 6: { arr: 870, dep: 895 }, 7: { arr: 990, dep: 1015 }, 8: { arr: 1135, dep: 1160 }, 9: { arr: 1235, dep: 1260 }, 10: { arr: 1345, dep: 1370 }, 11: { arr: 1460, dep: 1485 }, 12: { arr: 1585, dep: 1610 }, 13: { arr: 1715 } },
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
