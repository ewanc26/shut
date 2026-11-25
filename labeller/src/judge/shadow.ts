// Runs the model beside the labeller. It only logs, and must never delay or stop labelling.
import type { Answer } from './model.js';

/** Calls beyond these limits are skipped, not queued. */
export const CONCURRENCY = 1;
export const REPORT_EVERY = 25;
export const TIMEOUT_MS = 30_000;
/** Used when a rate limit does not say how long to wait. */
export const DEFAULT_PAUSE_MS = 60 * 60 * 1000;

export type Ask = (segments: readonly string[], signal: AbortSignal) => Promise<Answer>;

export interface ShadowOptions {
	ask: Ask;
	/** The most calls in one UTC day. A restart resets the count. */
	dailyLimit: number;
	log?: (line: string) => void;
	now?: () => Date;
}

interface Failure {
	name?: string;
	status?: number;
	reason?: string;
	retryAfterMs?: number;
}

export function shadowJudge({ ask, dailyLimit, log = console.log, now }: ShadowOptions) {
	const clock = now ?? (() => new Date());
	const stop = new AbortController();
	const running = new Set<Promise<void>>();
	let day = '';
	let today = 0;
	let pausedUntil = 0;
	const total = {
		calls: 0,
		incel: 0,
		ordinary: 0,
		unclear: 0,
		unreadable: 0,
		rateLimited: 0,
		failed: 0,
		skipped: 0
	};

	const report = () =>
		log(
			`judge totals: ${Object.entries(total)
				.map(([name, count]) => `${name}=${count}`)
				.join(' ')}`
		);

	async function run(uri: string, segments: readonly string[]) {
		try {
			const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(TIMEOUT_MS)]);
			const answer = await ask(segments, signal);
			total[answer.sense] += 1;
			// The address and decision only: logs never hold post text.
			if (answer.sense === 'incel') log(`judge would label ${uri}`);
		} catch (error) {
			if (stop.signal.aborted) return;
			// The error's kind only, in case a message echoes the request.
			const { name, status, reason, retryAfterMs } = error as Failure;
			if (reason === 'rate_limit' || status === 429) {
				total.rateLimited += 1;
				const until = clock().getTime() + (retryAfterMs || DEFAULT_PAUSE_MS);
				if (until > pausedUntil) {
					pausedUntil = until;
					log(`judge paused by a rate limit until ${new Date(until).toISOString()}`);
				}
				return;
			}
			total.failed += 1;
			log(`judge failed: ${name ?? 'error'}${status ? ` ${status}` : ''}`);
		}
	}

	return {
		/** Returns at once. */
		offer(uri: string, segments: readonly string[]): void {
			if (stop.signal.aborted) return;
			const time = clock();
			const date = time.toISOString().slice(0, 10);
			if (date !== day) [day, today] = [date, 0];
			if (time.getTime() < pausedUntil || today >= dailyLimit || running.size >= CONCURRENCY) {
				total.skipped += 1;
				return;
			}
			today += 1;
			total.calls += 1;
			const task: Promise<void> = run(uri, segments).finally(() => {
				running.delete(task);
			});
			running.add(task);
			if (total.calls % REPORT_EVERY === 0) report();
		},
		/** Resolves when the calls in flight have finished. */
		async idle(): Promise<void> {
			await Promise.all(running);
		},
		/** Abandons calls in flight and logs the totals. */
		close(): void {
			stop.abort();
			if (total.calls > 0) report();
		},
		total: (): Readonly<typeof total> => total
	};
}
