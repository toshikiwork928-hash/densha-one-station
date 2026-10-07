// 時間帯ごとの普通の時刻表（待避で停車時間が変わる。scripts/timetable.ts が生成。手で直さない）
import type { ServiceSpec, TimeOfDay } from '../types';

export const LOCAL_TT: Record<string, Partial<Record<TimeOfDay, ServiceSpec['timetable']>>> = {
  'shiokaze': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 580 }, 6: { arr: 665, dep: 690 }, 7: { arr: 780, dep: 805 }, 8: { arr: 905, dep: 930 }, 9: { arr: 1035 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 375 }, 4: { arr: 495, dep: 520 }, 5: { arr: 595, dep: 620 }, 6: { arr: 705, dep: 730 }, 7: { arr: 820, dep: 845 }, 8: { arr: 945, dep: 970 }, 9: { arr: 1075 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 580 }, 6: { arr: 665, dep: 690 }, 7: { arr: 780, dep: 805 }, 8: { arr: 905, dep: 930 }, 9: { arr: 1035 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 85, dep: 110 }, 2: { arr: 190, dep: 215 }, 3: { arr: 310, dep: 335 }, 4: { arr: 455, dep: 480 }, 5: { arr: 555, dep: 580 }, 6: { arr: 665, dep: 690 }, 7: { arr: 780, dep: 805 }, 8: { arr: 905, dep: 930 }, 9: { arr: 1035 } },
  },
  'shiokaze-up': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 730 }, 7: { arr: 825, dep: 850 }, 8: { arr: 930, dep: 955 }, 9: { arr: 1035 } },
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
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 730 }, 7: { arr: 825, dep: 850 }, 8: { arr: 930, dep: 955 }, 9: { arr: 1035, dep: 1060 }, 10: { arr: 1190, dep: 1215 }, 11: { arr: 1315, dep: 1340 }, 12: { arr: 1435, dep: 1460 }, 13: { arr: 1550 } },
    noon: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 480 }, 5: { arr: 560, dep: 585 }, 6: { arr: 705, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075, dep: 1176 }, 10: { arr: 1306, dep: 1331 }, 11: { arr: 1431, dep: 1456 }, 12: { arr: 1551, dep: 1576 }, 13: { arr: 1666 } },
    evening: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 520 }, 5: { arr: 600, dep: 625 }, 6: { arr: 745, dep: 770 }, 7: { arr: 865, dep: 890 }, 8: { arr: 970, dep: 995 }, 9: { arr: 1075, dep: 1270 }, 10: { arr: 1400, dep: 1425 }, 11: { arr: 1525, dep: 1550 }, 12: { arr: 1645, dep: 1670 }, 13: { arr: 1760 } },
    night: { 0: { arr: 0, dep: 0 }, 1: { arr: 105, dep: 130 }, 2: { arr: 230, dep: 255 }, 3: { arr: 335, dep: 360 }, 4: { arr: 455, dep: 616 }, 5: { arr: 696, dep: 721 }, 6: { arr: 841, dep: 866 }, 7: { arr: 961, dep: 986 }, 8: { arr: 1066, dep: 1091 }, 9: { arr: 1171, dep: 1366 }, 10: { arr: 1496, dep: 1521 }, 11: { arr: 1621, dep: 1646 }, 12: { arr: 1741, dep: 1766 }, 13: { arr: 1856 } },
  },
  'nankai-through': {
    morning: { 0: { arr: 0, dep: 0 }, 1: { arr: 90, dep: 115 }, 2: { arr: 210, dep: 235 }, 3: { arr: 335, dep: 360 }, 4: { arr: 485, dep: 510 }, 5: { arr: 595, dep: 620 }, 6: { arr: 700, dep: 725 }, 7: { arr: 820, dep: 845 }, 8: { arr: 965, dep: 990 }, 9: { arr: 1065, dep: 1090 }, 10: { arr: 1175, dep: 1200 }, 11: { arr: 1290, dep: 1315 }, 12: { arr: 1415, dep: 1440 }, 13: { arr: 1545 } },
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
