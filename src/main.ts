// エントリポイント: 各モジュールを組み立てて描画ループを回すだけ
import './ui/styles.css';
import * as THREE from 'three';
import { MAX_DT } from './core/config';
import type { GameContext } from './core/context';
import { $ } from './core/dom';
import { EventBus } from './core/events';
import { createRng } from './core/rng';
import { DEFAULT_ROUTE } from './route';
import { buildTrack } from './route/track';
import { createTrainEnv } from './sim/train';
import { createState } from './game/state';
import { createGame } from './game/loop';
import { createRenderCore } from './render/renderer';
import { createCabCamera } from './render/camera';
import { createEnvironment } from './env/environment';
import { attachEnvSystem } from './env';
import { buildWorld } from './world';
import { attachSfx } from './audio/sfx';
import { attachHud } from './ui/hud';
import { attachOverlay } from './ui/overlay';
import { attachKeyboard } from './input/keyboard';
import { attachTouch } from './input/touch';
import { attachGamepad } from './input/gamepad';

const route = DEFAULT_ROUTE;
const { renderer, scene, camera } = createRenderCore($<HTMLCanvasElement>('c'));
const env = createEnvironment(scene);

const ctx: GameContext = {
  route,
  track: buildTrack(route),
  events: new EventBus(),
  state: createState(route),
  trainEnv: createTrainEnv(),
  scene, camera, renderer, env,
  rng: createRng(12345),
  assetsReady: false,
  envState: { timeOfDay: 'noon', weather: 'clear', intensity: 0 },
  light: { night: 0, tunnel: 0 },
  cameraMode: 'cab',
  actions: undefined as unknown as GameContext['actions'], // createGame で設定
};

const world = buildWorld(ctx);
const game = createGame(ctx);
const cab = createCabCamera(ctx);
attachEnvSystem(ctx); // [B] 空・時間帯・天候・影・夜間照明
attachSfx(ctx.events, ctx);
attachHud(ctx);
attachOverlay(ctx);
attachKeyboard(ctx.actions);
attachTouch(ctx.actions);
attachGamepad(ctx); // [A]

world.loadAssets()
  .catch((e: unknown) => { console.error(e); return -1; })
  .then(failed => { ctx.assetsReady = true; ctx.events.emit('assetsReady', { failed: Math.max(0, failed) }); });

const clock = new THREE.Clock();
function step(dt: number, time: number) {
  game.update(dt);
  ctx.events.emit('frame', { dt, time, state: ctx.state.state });
  env.update(dt, time);
  cab.update(time);
  renderer.render(scene, camera);
}
function loop() {
  const dt = Math.min(MAX_DT, clock.getDelta());
  step(dt, clock.elapsedTime);
  requestAnimationFrame(loop);
}
loop();

// デバッグ用（開発時のみ）
if (import.meta.env.DEV) (window as any).__densha = ctx;
