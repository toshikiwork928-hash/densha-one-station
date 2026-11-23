import type { GameContext } from '../core/context';
import { namba } from '../route/routes/namba';
import { downFrame } from './down-frame';

export function nambaFrame(ctx: GameContext): GameContext | null {
  return downFrame(ctx, namba);
}
