// VVVF インバータ・主電動機・歯車の合成音
// 出力周波数 f ≈ 1.45 × km/h [Hz]（車輪径 860mm・歯車比 7・4極機を想定）
// 低速: 非同期（キャリア固定ぎみ）→ 同期 27P→15P→9P→5P→3P → 1パルス。回生ブレーキは同じ梯子を逆に降りる
import { NOTCH_EB } from '../core/config';
import { harmonicWave, type AudioCore } from './engine';
import type { TractionSound } from './settings';
import { create8300Gear } from './gear';
import { nankaiInverterProfile, type InverterMode as Mode, type NankaiInverterId } from './nankai-inverters';

const MODES: Mode[] = [
  { until: 25, pulses: 0 },
  { until: 33, pulses: 27 },
  { until: 45, pulses: 15 },
  { until: 57, pulses: 9 },
  { until: 64, pulses: 5 },
  { until: 70, pulses: 3 },
  { until: Infinity, pulses: 1 },
];
// 1000系未更新車のコイル録音を参考にした段順。速度と磁励音の強さは試聴用の近似値。
const GTO_POWER: Mode[] = [
  { until: 10, pulses: 0 }, { until: 30, pulses: 15 }, { until: 39, pulses: 11 },
  { until: 49, pulses: 7 }, { until: 59, pulses: 3 }, { until: 70, pulses: 3 },
  { until: Infinity, pulses: 1 },
];
const GTO_REGEN: Mode[] = [{ until: 10, pulses: 21 }, ...GTO_POWER.slice(1)];
const HZ_PER_KMH = 1.45;

export type InverterSound = TractionSound | 'gto' | NankaiInverterId;
export interface VvvfTuning {
  carrier: number;
  sideband: number;
  hiss: number;
  motor: number;
  hum: number;
  gear: number;
  startHz: number;
  transitionKmh: number;
}
const neutralTuning: Partial<VvvfTuning> = {};

export interface Vvvf {
  update(v: number, notch: number): void;
  /** 即時停止（リセット時） */
  silence(): void;
  /** デバッグ用: 現在モード */
  readonly mode: string;
}

export function createVvvf(core: AudioCore, dest: AudioNode = core.run,
  getSound: () => InverterSound = () => 'soft',
  getTuning: () => Partial<VvvfTuning> = () => neutralTuning): Vvvf {
  const { ac } = core;
  const out = ac.createGain(); out.gain.value = 0; // インバータ動作中の音量
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = .4;
  // 車体越しに聞こえる磁励音を近似。耳に刺さる高い倍音を全体音量と独立に抑える。
  const presence = ac.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 2800; presence.Q.value = .75;
  out.connect(tone).connect(presence).connect(dest);

  // キャリア（PWM の主成分）。わずかに倍音を含む
  const carrierWave = harmonicWave(ac, { 1: 1, 2: .12, 3: .18, 5: .05 });
  const softCarrierWave = harmonicWave(ac, { 1: 1, 2: .025, 3: .035, 5: .006 });
  const carrier = ac.createOscillator(); carrier.setPeriodicWave(carrierWave); carrier.frequency.value = 1000;
  // fc ± 2f の側帯波: キャリアを 2f で振幅変調（キャリア抑圧）
  const mod2f = ac.createOscillator(); mod2f.frequency.value = 1;
  const amSide = ac.createGain(); amSide.gain.value = 0;
  const sideDepth = ac.createGain(); sideDepth.gain.value = 0;
  mod2f.connect(sideDepth).connect(amSide.gain);
  const carrierDirect = ac.createGain(); carrierDirect.gain.value = 0;
  carrier.connect(carrierDirect); carrier.connect(amSide);
  // 2fc ± f の成分（弱め）
  const carrier2 = ac.createOscillator(); carrier2.frequency.value = 2000;
  const modF = ac.createOscillator(); modF.frequency.value = 1;
  const am2 = ac.createGain(); am2.gain.value = 0;
  const am2Depth = ac.createGain(); am2Depth.gain.value = 0;
  carrier2.connect(am2); modF.connect(am2Depth).connect(am2.gain);
  const carrierMix = ac.createGain(); carrierMix.gain.value = 1;
  const octave = ac.createGain(); octave.gain.value = 0;
  carrier2.connect(octave).connect(carrierMix);
  // 更新9000系の非同期域では fc ± 2f に加え、その外側の側帯波を重ねる。
  const mod4f = ac.createOscillator(), outerDepth = ac.createGain();
  const outerSide = ac.createGain(); outerDepth.gain.value = 0; outerSide.gain.value = 0;
  mod4f.connect(outerDepth).connect(outerSide.gain);
  carrier.connect(outerSide).connect(carrierMix);
  carrierDirect.connect(carrierMix); amSide.connect(carrierMix); am2.connect(carrierMix);
  carrierMix.connect(out);

  // キャリア周辺のインバータ雑音（シャー）
  const hiss = core.noiseSrc('white');
  const hissBp = ac.createBiquadFilter(); hissBp.type = 'bandpass'; hissBp.Q.value = 3; hissBp.frequency.value = 1000;
  const hissG = ac.createGain(); hissG.gain.value = 0;
  hiss.connect(hissBp).connect(hissG).connect(out);

  // 主電動機の電磁音（6k±1 次高調波が支配的。1パルスで目立つ）
  const motorWave = harmonicWave(ac, { 1: .25, 2: .2, 5: 1, 7: .7, 11: .35, 13: .28, 17: .12, 19: .1, 23: .05 });
  const motor = ac.createOscillator(); motor.setPeriodicWave(motorWave); motor.frequency.value = 1;
  const motorG = ac.createGain(); motorG.gain.value = 0;
  const motorLp = ac.createBiquadFilter(); motorLp.type = 'lowpass'; motorLp.frequency.value = 2600;
  motor.connect(motorLp).connect(motorG).connect(out);

  // 低いうなり（基本波・トルク脈動）
  const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 1;
  const humLp = ac.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 220;
  const humG = ac.createGain(); humG.gain.value = 0;
  hum.connect(humLp).connect(humG).connect(out);

  const gear = create8300Gear(core, dest);

  for (const o of [carrier, mod2f, carrier2, modF, mod4f, motor, hum]) o.start();

  let modeIdx = 0, active = false, lastSound: InverterSound | null = null;
  let modes = MODES;
  const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

  function update(v: number, notch: number) {
    const now = ac.currentTime, kmh = Math.max(0, v * 3.6);
    const sound = getSound(), legacy = sound === 'legacy', gto = sound === 'gto';
    const nankai = nankaiInverterProfile(sound);
    const mix = getTuning();
    if (sound !== lastSound) {
      carrier.setPeriodicWave(legacy || gto || nankai ? carrierWave : softCarrierWave);
      tone.frequency.setTargetAtTime(legacy ? 5200 : gto ? 3100 : 2400, now, .12);
      presence.gain.setTargetAtTime(legacy ? 0 : -6, now, .12);
      lastSound = sound;
    }
    carrierDirect.gain.setTargetAtTime((legacy ? .5 : gto ? .28 : .14) * (mix.carrier ?? 1), now, .04);
    sideDepth.gain.setTargetAtTime((legacy ? .6 : gto ? .75 : .46) * (mix.sideband ?? 1), now, .04);
    am2Depth.gain.setTargetAtTime((legacy ? .22 : gto ? .18 : .065) * (mix.sideband ?? 1), now, .04);
    humG.gain.setTargetAtTime((legacy ? .25 : gto ? .3 : .45) * (mix.hum ?? 1), now, .04);
    const power = notch > 0, brake = notch < 0 && notch > NOTCH_EB;
    // 回生は 5km/h 付近で失効（電空切替）。力行は停止中から
    const fullElectric = sound === 'nankai-8300' || sound === 'nankai-9000' || sound === 'nankai-8000';
    const regenFade = brake ? (fullElectric ? smooth(kmh / 2) : Math.min(1, Math.max(0, (kmh - 4) / 6))) : 0;
    const tq = power ? notch / 5 : brake ? Math.min(1, -notch / 7) * regenFade : 0;
    const on = tq > 0.001;

    // 出力周波数（すべり: 力行 +、回生 −）
    const slip = power ? 1 + 1.5 * tq : brake ? -1.2 * tq : 0;
    const hzPerKmh = sound === 'nankai-8300' ? HZ_PER_KMH * 1.5 : HZ_PER_KMH;
    const f = Math.max(.5, kmh * hzPerKmh + slip);

    // モード決定（回生側は 2km/h 低めで切替＝ヒステリシス）
    const hyst = !nankai && brake ? -2 : 0;
    // GTO風の試聴モデル。起動時の低い搬送波から同期域へ移る速度を耳で合わせる。
    const nextModes = nankai ? (brake ? nankai.regen : nankai.power) : gto ? (brake ? GTO_REGEN : GTO_POWER) : MODES;
    const sameModes = nextModes === modes;
    modes = nextModes;
    // 1000系の調整量は段全体に適用し、つまみを上げても切替順を保つ。
    const tuningShift = sound === 'nankai-1000' && !brake ? ((mix.transitionKmh ?? 10) - 10) * hzPerKmh : 0;
    const position = nankai ? f - tuningShift : kmh;
    const firstSwitch = gto ? mix.transitionKmh ?? 10 : modes[0].until;
    const limit = (index: number) => index === 0 ? firstSwitch : modes[index].until;
    let mi = modes.findIndex((_, i) => position < limit(i) + hyst);
    if (mi < 0) mi = modes.length - 1;
    // 同じ境界を速度が往復してもモードが毎フレーム切り替わらない。
    const margin = nankai ? .25 : .8;
    if (sameModes && !legacy && mi !== modeIdx) {
      if (mi > modeIdx && position < limit(modeIdx) + hyst + margin) mi = modeIdx;
      if (mi < modeIdx && position > limit(modeIdx - 1) + hyst - margin) mi = modeIdx;
    }
    const m = modes[mi];
    let fc: number;
    // 改良音は低い起動キャリアから立ち上げる独自近似。実車の制御値ではない。
    if (nankai && m.pulses === 0) {
      fc = mix.startHz ?? nankai.carrierHz;
      if (brake && fullElectric) {
        if (sound === 'nankai-8000' && kmh < 5) fc = 200;
        else if (sound !== 'nankai-8000') fc *= .35 + .65 * smooth(kmh / 6);
      }
    } else if (gto && m.pulses === 0) {
      const start = mix.startHz ?? 180;
      fc = start * (1 + 1.5 * smooth((kmh / firstSwitch - .25) / .75));
    } else if (m.pulses === 0) fc = legacy ? (mix.startHz ?? 1000) + 200 * Math.min(1, kmh / 25)
      : (mix.startHz ?? 220) + 330 * smooth(kmh / 25);
    else fc = m.pulses * f;

    const jumped = mi !== modeIdx;
    modeIdx = mi;
    const setF = (p: AudioParam, val: number) => {
      if (legacy && jumped) { p.cancelScheduledValues(now); p.setValueAtTime(val, now); }
      else p.setTargetAtTime(val, now, legacy ? .025 : jumped ? .055 : .035);
    };
    const one = m.pulses === 1;
    setF(carrier.frequency, Math.max(20, fc));
    setF(carrier2.frequency, Math.max(40, fc * 2));
    setF(hissBp.frequency, Math.max(200, fc));
    setF(mod2f.frequency, 2 * f);
    setF(mod4f.frequency, 4 * f);
    outerDepth.gain.setTargetAtTime(sound === 'nankai-9000' && !m.pulses ? .24 * (mix.sideband ?? 1) : 0, now, .04);
    octave.gain.setTargetAtTime(sound === 'nankai-1000' && !m.pulses ? .65 * (mix.carrier ?? 1) : 0, now, .04);
    setF(modF.frequency, f);
    setF(motor.frequency, f);
    setF(hum.frequency, f);

    // 各層の配分: 1パルスはキャリア無し・電動機音主体
    const wideThree = m.wide || (gto && mi === 5);
    const progress = wideThree ? (position - limit(mi - 1) - hyst) / (limit(mi) - limit(mi - 1)) : 0;
    const carrierLevel = one ? 0 : wideThree ? .55 - .34 * smooth(progress)
      : m.pulses === 3 ? .55 : m.pulses === 5 ? .75 : 1;
    carrierMix.gain.setTargetAtTime(carrierLevel * (legacy ? 1 : .62 + .38 * smooth(kmh / 18)), now, legacy ? .01 : .05);
    hissG.gain.setTargetAtTime((one ? .02 : .1) * (legacy ? 1 : gto ? .35 : .6) * (mix.hiss ?? 1), now, .05);
    const motorLevel = one ? .55 : m.pulses && m.pulses <= 5 ? .3 : .12 * Math.min(1, kmh / 15);
    motorG.gain.setTargetAtTime((legacy ? motorLevel : motorLevel + .12 * smooth(kmh / 12)) * (mix.motor ?? 1), now, .05);

    // 全体音量: トルク依存。高速域（定出力域）では電流が減って少し静かに
    const speedShape = .55 + .45 * Math.min(1, kmh / 30);
    const fieldWeak = kmh > 75 ? Math.max(.6, 1 - (kmh - 75) / 80) : 1;
    // 起動直後（非同期域の低速）はうるさく感じるので 35% から 20km/h までに滑らかに 100% へ
    const lt = Math.min(1, kmh / 20), lowFade = .35 + .65 * lt * lt * (3 - 2 * lt);
    // 停止状態でPを入れただけでは高い音を鳴らさず、車輪の動きとともに出す。
    const motion = legacy ? 1 : smooth(kmh / .9);
    const vol = on ? (legacy ? .085 : .095) * Math.pow(tq, .55) * speedShape * fieldWeak * lowFade * motion : 0;
    // ゲート ON は速く、OFF は少し余韻
    out.gain.setTargetAtTime(vol, now, legacy ? on && !active ? .03 : on ? .06 : .09 : on ? .1 : .12);
    active = on;

    // 歯車音: 速度依存＋トルクで増える
    gear.update(v, notch, mix.gear ?? 1);
  }

  return {
    update,
    silence() { const now = ac.currentTime; out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, .05); gear.silence(); active = false; },
    get mode() { const m = modes[modeIdx]; return m.wide ? 'wide3P' : m.pulses === 0 ? 'async' : m.pulses + 'P'; },
  };
}
