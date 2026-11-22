// 南海8300系を基準にした共通ギヤ音。主回路音の種類に依存せず全車両で鳴らす。
import { harmonicWave, type AudioCore } from './engine';
import { NOTCH_EB } from '../core/config';

export interface GearSound {
  /** 速度[m/s]、ノッチ、車両別ゲインを受けて更新する。 */
  update(v: number, notch: number, gain: number): void;
  silence(): void;
}

export function create8300Gear(core: AudioCore, dest: AudioNode): GearSound {
  const { ac } = core;
  const out = ac.createGain(); out.gain.value = 0;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .5; lp.frequency.value = 2200;
  out.connect(lp).connect(dest);
  const tone = ac.createOscillator(); tone.setPeriodicWave(harmonicWave(ac, { 1: 1, 2: .35, 3: .08 })); tone.frequency.value = 100;
  const toneGain = ac.createGain(); toneGain.gain.value = .32; tone.connect(toneGain).connect(out);
  const noise = core.noiseSrc('white');
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 18; bp.frequency.value = 100;
  const noiseGain = ac.createGain(); noiseGain.gain.value = 1.6; noise.connect(bp).connect(noiseGain).connect(out);
  tone.start();

  return {
    update(v, notch, gain) {
      const now = ac.currentTime, kmh = Math.max(0, v * 3.6);
      const f = 7 * kmh * 1.45;
      tone.frequency.setTargetAtTime(Math.max(20, f), now, .03);
      bp.frequency.setTargetAtTime(Math.max(20, f), now, .03);
      const power = notch > 0, brake = notch < 0 && notch > NOTCH_EB;
      const regenFade = brake ? Math.min(1, Math.max(0, (kmh - 4) / 6)) : 0;
      const load = power ? notch / 5 : brake ? Math.min(1, -notch / 7) * regenFade : 0;
      const level = kmh < 3 ? 0 : .018 * Math.min(1, kmh / 60) * (1 + 1.2 * load);
      out.gain.setTargetAtTime(level * gain, now, .08);
    },
    silence() { out.gain.setTargetAtTime(0, ac.currentTime, .05); },
  };
}
