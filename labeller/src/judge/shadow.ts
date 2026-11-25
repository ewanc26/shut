// Runs the model beside the labeller. It only logs, and must never delay or stop labelling.
import type { Answer } from './model.js';

/** Calls beyond these limits are skipped, not queued. */
export const CONCURRENCY = 4;
export const REPORT_EVERY = 100;

export type Ask = (segments: readonly string[], signal: AbortSignal) => Promise<Answer>;

export interface ShadowOptions {
	ask: Ask;
	/** The most calls in one UTC day, which bounds the bill. A restart resets the count. */
	dailyLimit: number;
	log?: (line: string) => void;
	now?: () => Date;
}

export function shadowJudge({ ask, dailyLimit, log = console.log, now }: ShadowOptions) {
	const clock = now ?? (() => new Date());
	const stop = new AbortController();
	const running = new Set<Promise<void>>();
	let day = '';
	let today = 0;
	const total = {
		calls: 0,
		incel: 0,
		ordinary: 0,
		unclear: 0,
		refused: 0,
		unreadable: 0,
		failed: 0,
		skipped: 0,
		inputTokens: 0,
		outputTokens: 0
	};

	const report = () =>
		log(
			`judge totals: ${Object.entries(total)
				.map(([name, count]) => `${name}=${count}`)
				.join(' ')}`
		);

	async function run(uri: string, segments: readonly string[]) {
		try {
			const answer = await ask(segments, stop.signal);
			total[answer.sense] += 1;
			total.inputTokens += answer.inputTokens;
			total.outputTokens += answer.outputTokens;
			// The address and decision only: logs never hold post text.
			if (answer.sense === 'incel') log(`judge would label ${uri}`);
		} catch (error) {
			if (stop.signal.aborted) return;
			total.failed += 1;
			// The error's name and status only, in case a message echoes the request.
			const { name, status } = error as { name?: string; status?: number };
			log(`judge failed: ${name ?? 'error'}${status ? ` ${status}` : ''}`);
		}
	}

	return {
		/** Returns at once. */
		offer(uri: string, segments: readonly string[]): void {
			if (stop.signal.aborted) return;
			const date = clock().toISOString().slice(0, 10);
			if (date !== day) [day, today] = [date, 0];
			if (today >= dailyLimit || running.size >= CONCURRENCY) {
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
