import { JOINT_INTERVAL } from '../core/config';
import type { Route, TrainKind } from '../route/types';
import { createCore } from '../audio/engine';
import { createRunning } from '../audio/running';
import { createResistance } from '../audio/resistance';
import { createVvvf } from '../audio/vvvf';
import { isResistance, type VehicleTuning } from '../audio/vehicle-tuning';

export type Track = 'straight' | 'curve' | 'bridge' | 'tunnel';
const straight: Route['segments'] = [{ type: 'straight', length: 1000000 }];
const tracks: Record<Track, Pick<Route, 'segments' | 'structures'>> = {
  straight: { segments: straight },
  curve: { segments: [{ type: 'arc', radius: 300, angle: 6, turn: 'L' }] },
  bridge: { segments: straight, structures: [{ kind: 'bridge', from: 0, to: 1000000 }] },
  tunnel: { segments: straight, structures: [{ kind: 'tunnel', from: 0, to: 1000000 }] },
};

export const SWEEP_SECONDS = 24;
export function createPreview(context: BaseAudioContext, train: TrainKind, getTuning: () => VehicleTuning, getTrack: () => Track) {
  const core = createCore(context);
  core.master.gain.value = .8;
  const engine = isResistance(train)
    ? createResistance(core, core.layers.traction, getTuning)
    : createVvvf(core, core.layers.traction, () => getTuning().sound, () => getTuning().vvvf);
  const running = createRunning(core, () => tracks[getTrack()]);
  let distance = 0, previous = getTuning();
  const trackKeys = Object.keys(previous.track) as (keyof VehicleTuning['track'])[];
  for (const key of trackKeys) core.layers[key].gain.value = previous.track[key];
  return {
    update(kmh: number, notch: number, dt: number) {
      const tuning = getTuning();
      if (previous !== tuning) {
        for (const k of trackKeys) {
          core.layers[k].gain.setTargetAtTime(tuning.track[k], context.currentTime, .02);
        }
        previous = tuning;
      }
      const speed = kmh / 3.6, lastJoint = Math.floor(distance / JOINT_INTERVAL);
      distance += speed * dt;
      const joint = Math.floor(distance / JOINT_INTERVAL);
      engine.update(speed, notch);
      running.update(speed, distance % 1500);
      if (joint > lastJoint) running.joint(speed, distance, joint * JOINT_INTERVAL);
    },
  };
}

export function sweepState(seconds: number) {
  if (seconds < 13) return { kmh: 90 * seconds / 13, notch: 5 };
  if (seconds < 16) return { kmh: 90, notch: 0 };
  return { kmh: 90 * Math.max(0, (23 - seconds) / 7), notch: -5 };
}

export async function renderSweep(train: TrainKind, tuning: VehicleTuning, track: Track) {
  const rate = 44100;
  const context = new OfflineAudioContext(1, rate * SWEEP_SECONDS, rate);
  const graph = createPreview(context, train, () => tuning, () => track);
  const updates = Array.from({ length: SWEEP_SECONDS * 25 }, (_, index) => context.suspend(index / 25));
  const done = context.startRendering();
  for (const update of updates) {
    await update;
    const state = sweepState(context.currentTime);
    graph.update(state.kmh, state.notch, 1 / 25);
    await context.resume();
  }
  return done;
}
