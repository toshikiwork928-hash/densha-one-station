// 路線レジストリ
import type { Route } from './types';
import { sakuragaoka } from './routes/sakuragaoka';
import { shiokaze } from './routes/shiokaze';

export const ROUTES: Record<string, Route> = { [sakuragaoka.id]: sakuragaoka, [shiokaze.id]: shiokaze };
/** 既定は全線（先頭区間は旧 sakuragaoka と同一） */
export const DEFAULT_ROUTE = shiokaze;
export type { Route } from './types';
