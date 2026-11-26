// Holds requests back for servers that answer 429 or report their quota. Adapted from the
// rate limiter in Ewan Croft's @ewanc26/croft-click-core, for any request rather than
// repository writes.

/** Share of an advertised quota left unused. */
export const HEADROOM = 0.15;
/** The wait after a 429 that says nothing about when to return. */
export const FALLBACK_WAIT_MS = 60_000;
/**
 * The longest wait on quota headers alone. The reported bucket may not be the one that
 * matters, so the next request is allowed to find out; a real limit answers 429.
 */
export const MAX_QUOTA_WAIT_MS = 60_000;
/** No header can hold requests back longer than this. */
export const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

interface Quota {
	limit: number;
	remaining: number;
	resetAt: number;
}

export interface Clock {
	now(): number;
	sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

const clock: Clock = {
	now: Date.now,
	sleep: (ms, signal) =>
		new Promise((resolve, reject) => {
			signal?.throwIfAborted();
			const abort = () => {
				clearTimeout(timer);
				reject(signal?.reason);
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener('abort', abort);
				resolve();
			}, ms);
			signal?.addEventListener('abort', abort, { once: true });
		})
};

/** A reset header may be seconds from now, or a time in epoch seconds or milliseconds. */
function resetTime(value: number, now: number): number {
	if (value >= 1e12) return value;
	return value >= 1e9 ? value * 1000 : now + value * 1000;
}

/** Retry-After is a number of seconds or an HTTP date. */
function retryTime(value: string | null, now: number): number | undefined {
	if (!value?.trim()) return;
	const seconds = Number(value);
	const at = Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(value);
	return at > now ? at : undefined;
}

/** The quota and any refusal for one server. */
export function rateLimiter({ now, sleep }: Clock = clock) {
	let quota: Quota | undefined;
	/** Set by a 429, which is the server's own word and is waited out in full. */
	let blockedUntil = 0;

	function read(headers: Headers) {
		const number = (name: string) =>
			Number.parseInt(headers.get(name) ?? headers.get(`x-${name}`) ?? '', 10);
		const limit = number('ratelimit-limit');
		const remaining = number('ratelimit-remaining');
		if (!(limit > 0) || Number.isNaN(remaining)) return;
		const policy = headers.get('ratelimit-policy') ?? headers.get('x-ratelimit-policy');
		const window = Number(/;w=(\d+)/.exec(policy ?? '')?.[1] ?? 3600) * 1000;
		const reset = number('ratelimit-reset');
		const at = Number.isNaN(reset) ? now() + window : resetTime(reset, now());
		// An implausibly distant reset is taken as one window.
		quota = { limit, remaining, resetAt: at > now() + 2 * window ? now() + window : at };
	}

	return {
		/** Takes in what a response says about the quota. */
		update({ status, headers }: Pick<Response, 'status' | 'headers'>): void {
			read(headers);
			if (status !== 429) return;
			const at = retryTime(headers.get('retry-after'), now());
			const reset = quota && quota.resetAt > now() ? quota.resetAt : undefined;
			// The later of the two, so a short Retry-After cannot undercut the reset.
			const until = at || reset ? Math.max(at ?? 0, reset ?? 0) : now() + FALLBACK_WAIT_MS;
			blockedUntil = Math.max(blockedUntil, Math.min(until, now() + MAX_WAIT_MS));
		},
		/** Resolves when another request may be sent, and counts it against the quota. */
		async permit(signal?: AbortSignal, onWait?: (ms: number) => void): Promise<void> {
			// Checked again after sleeping: another request may have been refused meanwhile.
			while (blockedUntil > now()) {
				const wait = blockedUntil - now();
				onWait?.(wait);
				await sleep(wait, signal);
			}
			if (quota && quota.resetAt <= now()) quota = undefined;
			if (!quota) return;
			if (quota.remaining - Math.floor(quota.limit * HEADROOM) < 1) {
				const wait = Math.min(quota.resetAt - now(), MAX_QUOTA_WAIT_MS);
				onWait?.(wait);
				await sleep(wait, signal);
				return;
			}
			quota.remaining--;
		}
	};
}

export interface LimitedOptions {
	/** Applied to each request once it is allowed out, so waiting does not use it up. */
	timeoutMs?: number;
	request?: typeof fetch;
	clock?: Clock;
	warn?: (message: string) => void;
}

/**
 * A `fetch` that waits its turn, keeping a separate limit for each server. It never repeats
 * a request: the 429 is returned for the caller to retry.
 */
export function limitedFetch({
	timeoutMs,
	request = fetch,
	clock: time,
	warn = console.warn
}: LimitedOptions = {}): typeof fetch {
	const hosts = new Map<string, ReturnType<typeof rateLimiter>>();

	return async (input, init) => {
		const { host } = new URL(input instanceof Request ? input.url : input);
		let limiter = hosts.get(host);
		if (!limiter) hosts.set(host, (limiter = rateLimiter(time)));
		const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
		await limiter.permit(signal, (ms) => {
			if (ms >= 1000) warn(`Rate limited by ${host}: waiting ${Math.ceil(ms / 1000)} s`);
		});
		const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter(
			(each) => each !== undefined
		);
		const response = await request(input, {
			...init,
			...(signals.length ? { signal: AbortSignal.any(signals) } : {})
		});
		limiter.update(response);
		return response;
	};
}
