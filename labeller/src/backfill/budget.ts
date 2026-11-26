// Keeps the labeller's databases within a disk allowance.
import { statSync } from 'node:fs';

export const DEFAULT_LIMIT_GIB = 10;
const GIB = 1024 ** 3;

/** The space SQLite databases take up, including their journals. */
export function databaseBytes(paths: readonly string[]): number {
	return paths
		.flatMap((path) => [path, `${path}-wal`, `${path}-shm`])
		.reduce((total, file) => total + (statSync(file, { throwIfNoEntry: false })?.size ?? 0), 0);
}

/** The allowance in bytes, from a setting in GiB. */
export function limitBytes(setting: string | undefined): number {
	const gib = Number(setting?.trim() || DEFAULT_LIMIT_GIB);
	if (!(gib > 0)) throw new Error('BACKFILL_MAX_GIB must be above zero.');
	return gib * GIB;
}
