import type { GameContext } from '../core/context';
import { misakiWakayamako } from '../route/routes/misaki-wakayamako';
import { downFrame } from './down-frame';

export function mwFrame(ctx: GameContext): GameContext | null {
  return downFrame(ctx, misakiWakayamako);
}
