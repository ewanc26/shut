// Whether to follow advice to pause, without ever falling too far behind the stream.

export const DEFAULT_MAX_DELAY_MINUTES = 60;
/**
 * The longest delay that may be set. Public Jetstream servers replayed about 36 hours when
 * tried in November 2026; anything older is lost.
 */
export const LONGEST_DELAY_MINUTES = 24 * 60;
/** Close enough behind to count as caught up. */
export const CAUGHT_UP_MS = 60_000;

/**
 * Answers whether to be paused, given the advice and how far behind the last handled event
 * is. Once the delay is reached it runs until caught up, however busy the machine.
 */
export function gate(maxDelayMs: number) {
	let catchingUp = false;
	return (advised: boolean, lagMs: number | undefined): boolean => {
		if (lagMs !== undefined && lagMs >= maxDelayMs) catchingUp = true;
		else if (lagMs === undefined || lagMs <= CAUGHT_UP_MS) catchingUp = false;
		// With no position yet, pausing would leave nothing to resume from.
		return advised && lagMs !== undefined && !catchingUp;
	};
}
