import assert from 'node:assert/strict';
import { ROUTES } from '../src/route';
import { applyRealDiagram, realTrainFor } from '../src/route/real-diagram';

const down = ROUTES['misaki-wakayamako'];
assert(down, 'misaki-wakayamako route is missing');
const southern = realTrainFor(down, 'southern', 0, down.stations.length - 1, 'evening');
assert(southern, 'evening southern train is missing');
assert.equal(southern.no, '0603');
assert.equal(southern.dep['和歌山大学前'], 420);
assert.equal(southern.dep['和歌山市'], 900, '0603 departs Wakayamashi at 18:41');
assert.equal(southern.arr, 1140, '0603 arrives Wakayamako at 18:45');
down.timeOfDay = 'evening';
applyRealDiagram(down, 'southern', 0, down.stations.length - 1);
const wakayamashi = down.stations.find(s => s.name === '和歌山市')!;
assert.equal(down.startClock + wakayamashi.scheduledArrival, 18 * 3600 + 39 * 60, '0603 arrives Wakayamashi at 18:39');
assert.equal(down.startClock + wakayamashi.scheduledArrival + wakayamashi.dwell!, 18 * 3600 + 41 * 60, '0603 departs Wakayamashi at 18:41');

const up = ROUTES['misaki-wakayamako-up'];
assert(up, 'misaki-wakayamako-up route is missing');
const upSouthern = realTrainFor(up, 'southern', 0, up.stations.length - 1, 'night');
assert(upSouthern, 'night up southern train is missing');
assert.equal(upSouthern.no, '0606');
assert.equal(upSouthern.dep['和歌山市'], 420);
assert.equal(upSouthern.arrAt?.['和歌山市'], 300, '064号は和歌山市に21:30着');
assert.equal(southern.arrAt?.['和歌山大学前'], undefined, '発車時刻だけの駅では到着を推定する');

console.log('real diagram connection times: OK');
