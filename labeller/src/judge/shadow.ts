// Runs the model beside the labeller. It only logs, and must never delay or stop labelling.
import type { Answer } from './model.js';
import { MAX_AGE_MS, pendingQueue, type Pending } from './queue.js';

export const REPORT_EVERY = 25;
export const TIMEOUT_MS = 30_000;
/** Used when a rate limit does not say how long to wait. */
export const DEFAULT_PAUSE_MS = 60 * 60 * 1000;

export type Ask = (segments: readonly string[], signal: AbortSignal) => Promise<Answer>;

export interface ShadowOptions {
	ask: Ask;
	/** The most calls in one UTC day. A restart resets the count. */
	dailyLimit: number;
	queueLimit?: number;
	/** How long one question may take. */
	timeoutMs?: number;
	log?: (line: string) => void;
}

interface Failure {
	name?: string;
	status?: number;
	reason?: string;
	retryAfterMs?: number;
}

const nextDay = (time: number) => new Date(time).setUTCHours(24, 0, 0, 0);

export function shadowJudge({
	ask,
	dailyLimit,
	queueLimit,
	timeoutMs = TIMEOUT_MS,
	log = console.log
}: ShadowOptions) {
	const stop = new AbortController();
	const queue = pendingQueue(queueLimit);
	/** The one call in flight. */
	let current: Promise<void> | undefined;
	let currentUri: string | undefined;
	/** Set when the record being asked about is edited or deleted. */
	let withdrawn = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let day = '';
	let today = 0;
	let pausedUntil = 0;
	/** Set while the labeller is paused. */
	let held = false;
	const total = {
		calls: 0,
		incel: 0,
		ordinary: 0,
		unclear: 0,
		unreadable: 0,
		rateLimited: 0,
		failed: 0,
		dropped: 0,
		expired: 0
	};

	const report = () =>
		log(
			`judge totals: ${Object.entries({ ...total, waiting: queue.size() })
				.map(([name, count]) => `${name}=${count}`)
				.join(' ')}`
		);

	const resumeAt = (time: number) => {
		clearTimeout(timer);
		timer = setTimeout(pump, Math.max(0, time - Date.now()));
		// Waiting must not keep the process alive.
		timer.unref();
	};

	/** The oldest record still young enough to ask about. */
	function nextFresh(): Pending | undefined {
		for (let entry = queue.take(); entry; entry = queue.take()) {
			if (Date.now() - entry.queuedAt <= MAX_AGE_MS) return entry;
			total.expired += 1;
		}
		return;
	}

	function pump(): void {
		if (stop.signal.aborted || held || current || queue.size() === 0) return;
		const now = Date.now();
		if (now < pausedUntil) return resumeAt(pausedUntil);
		const date = new Date(now).toISOString().slice(0, 10);
		if (date !== day) [day, today] = [date, 0];
		if (today >= dailyLimit) return resumeAt(nextDay(now));
		const entry = nextFresh();
		if (!entry) return;
		today += 1;
		total.calls += 1;
		currentUri = entry.uri;
		withdrawn = false;
		current = run(entry).finally(() => {
			current = currentUri = undefined;
			pump();
		});
		if (total.calls % REPORT_EVERY === 0) report();
	}

	async function run(entry: Pending) {
		try {
			const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(timeoutMs)]);
			const answer = await ask(entry.segments, signal);
			total[answer.sense] += 1;
			// The address and decision only: logs never hold post text.
			if (answer.sense === 'incel' && !withdrawn) log(`judge would label ${entry.uri}`);
		} catch (error) {
			if (stop.signal.aborted) return;
			// The error's kind only, in case a message echoes the request.
			const { name, status, reason, retryAfterMs } = error as Failure;
			if (reason === 'rate_limit' || status === 429) {
				total.rateLimited += 1;
				pausedUntil = Date.now() + (retryAfterMs || DEFAULT_PAUSE_MS);
				if (!withdrawn) queue.restore(entry);
				log(`judge paused by a rate limit until ${new Date(pausedUntil).toISOString()}`);
				return;
			}
			total.failed += 1;
			log(`judge failed: ${name ?? 'error'}${status ? ` ${status}` : ''}`);
		}
	}

	return {
		/** Returns at once. The record is asked about now, or when the limits next allow. */
		offer(uri: string, segments: readonly string[]): void {
			if (stop.signal.aborted) return;
			if (uri === currentUri) withdrawn = true;
			if (queue.add({ uri, segments, queuedAt: Date.now() })) total.dropped += 1;
			pump();
		},
		/** Drops a record that was deleted, or no longer needs an opinion. */
		forget(uri: string): void {
			if (uri === currentUri) withdrawn = true;
			queue.remove(uri);
		},
		/** Asks nothing new until resumed. A call in flight finishes. */
		hold(): void {
			held = true;
			clearTimeout(timer);
		},
		resume(): void {
			held = false;
			pump();
		},
		/** Resolves when no call is in flight. Records may still be waiting. */
		async idle(): Promise<void> {
			while (current) await current;
		},
		/** Abandons the call in flight and anything waiting, and logs the totals. */
		close(): void {
			stop.abort();
			clearTimeout(timer);
			if (total.calls > 0) report();
		},
		waiting: () => queue.size(),
		total: (): Readonly<typeof total> => total
	};
}
