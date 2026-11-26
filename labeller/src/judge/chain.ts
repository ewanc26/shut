// Tries each service in turn, so one that is rate limited or down does not stop the judge.
import { ChatError } from './chat.js';
import type { Generate } from './model.js';
import { DEFAULT_PAUSE_MS, TIMEOUT_MS } from './shadow.js';

/** How soon a record is tried again when one service is limited and another failed. */
export const RETRY_FAILED_MS = 5 * 60 * 1000;

export interface Link {
	name: string;
	generate: Generate;
}

interface Failure {
	name?: string;
	status?: number;
	reason?: string;
	retryAfterMs?: number;
}

export interface ChainOptions {
	/** For each service, so a slow one leaves time for the next. */
	timeoutMs?: number;
	log?: (line: string) => void;
}

/**
 * Asks the first service that is not waiting out a rate limit, and moves on if it fails.
 * When none answers and one was rate limited, the error is a rate limit lasting until it
 * is worth asking again. Otherwise it is the last failure.
 */
export function chain(
	links: readonly Link[],
	{ timeoutMs = TIMEOUT_MS, log = console.log }: ChainOptions = {}
): Generate {
	const pausedUntil = new Map<Link, number>();

	return async (prompt, signal) => {
		/** When the first rate limit ends, if any service has one. */
		let limitEnds = Infinity;
		let failure: { error: unknown } | undefined;

		for (const link of links) {
			const paused = pausedUntil.get(link) ?? 0;
			if (paused > Date.now()) {
				limitEnds = Math.min(limitEnds, paused);
				continue;
			}
			const own = AbortSignal.timeout(timeoutMs);
			try {
				return await link.generate(prompt, signal ? AbortSignal.any([signal, own]) : own);
			} catch (error) {
				if (signal?.aborted) throw error;
				// The error's kind only, in case a message echoes the request.
				const { name, status, reason, retryAfterMs } = error as Failure;
				if (reason === 'rate_limit' || status === 429) {
					const until = Date.now() + (retryAfterMs || DEFAULT_PAUSE_MS);
					pausedUntil.set(link, until);
					limitEnds = Math.min(limitEnds, until);
					log(`judge: ${link.name} is rate limited until ${new Date(until).toISOString()}`);
				} else {
					failure = { error };
					log(`judge: ${link.name} failed: ${name ?? 'error'}${status ? ` ${status}` : ''}`);
				}
			}
		}

		if (limitEnds === Infinity) throw failure?.error ?? new Error('No model service to ask.');
		const wait = Math.max(1, limitEnds - Date.now());
		throw new ChatError(429, failure ? Math.min(wait, RETRY_FAILED_MS) : wait);
	};
}
