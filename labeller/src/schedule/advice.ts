// The monitor's advice, passed through a file so it can cross into a container.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

/** Older advice is ignored, so a monitor that stops cannot leave the labeller paused. */
export const STALE_MS = 3 * 60 * 1000;

export interface Advice {
	pause: boolean;
	reason: string;
	/** When it was given (Unix milliseconds). */
	at: number;
}

/** Writes through a temporary file so a half-written one is never read. */
export function writeJson(path: string, value: unknown): void {
	writeFileSync(`${path}.tmp`, `${JSON.stringify(value)}\n`);
	renameSync(`${path}.tmp`, path);
}

export const writeAdvice = (path: string, advice: Advice) => writeJson(path, advice);

/** Why to pause, or nothing when there is no current advice to. Unreadable means carry on. */
export function pauseReason(path: string, now = Date.now()): string | undefined {
	try {
		const { pause, reason, at } = JSON.parse(readFileSync(path, 'utf8')) as Advice;
		// A little clock difference between host and container is allowed.
		if (pause !== true || !(Math.abs(now - at) <= STALE_MS)) return;
		return String(reason);
	} catch {
		return;
	}
}
