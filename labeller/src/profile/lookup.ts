// Fetches the existing profile of each account seen posting, once. Later edits arrive on
// the stream, so there is no need to look again.

export const APPVIEW = 'https://public.api.bsky.app';
/** The most accounts one request may name. */
export const BATCH_SIZE = 25;
/** The account waiting longest makes way when the list is full. */
export const PENDING_LIMIT = 10_000;
/** Time between requests, enough for 60 accounts a second. */
export const INTERVAL_MS = 400;
export const BACKOFF_MS = 30_000;
const TIMEOUT_MS = 10_000;

/** The accounts whose profile has been judged. */
export interface Checked {
	has(did: string): Promise<boolean>;
	add(did: string): Promise<void>;
}

export interface LookupOptions {
	checked: Checked;
	/**
	 * Takes a fetched profile. Undefined means the account has none to show, for example
	 * because it was deactivated. The receiver marks the account as checked.
	 */
	deliver(did: string, profile: unknown): void;
	/** The labeller's own account, which is never judged. */
	exempt?: string;
	request?: typeof fetch;
	now?: () => number;
	limit?: number;
}

export function profileLookup({
	checked,
	deliver,
	exempt,
	request = fetch,
	now = Date.now,
	limit = PENDING_LIMIT
}: LookupOptions) {
	const pending = new Set<string>();
	/** Accounts in the request under way. */
	const flying = new Set<string>();
	/** Accounts whose profile changed on the stream while being fetched. */
	const stale = new Set<string>();
	let busy = false;
	let waitUntil = 0;

	async function nextBatch(): Promise<string[]> {
		const batch: string[] = [];
		for (const did of pending) {
			if (batch.length === BATCH_SIZE) break;
			pending.delete(did);
			flying.add(did);
			if (await checked.has(did)) flying.delete(did);
			else batch.push(did);
		}
		return batch;
	}

	async function fetchProfiles(dids: string[]): Promise<Map<string, unknown>> {
		const url = new URL('/xrpc/app.bsky.actor.getProfiles', APPVIEW);
		for (const did of dids) url.searchParams.append('actors', did);
		const response = await request(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) throw new Error(`getProfiles answered ${response.status}`);
		const { profiles } = (await response.json()) as { profiles?: { did: string }[] };
		if (!Array.isArray(profiles)) throw new Error('getProfiles sent no list of profiles');
		return new Map(profiles.map((profile) => [profile.did, profile]));
	}

	return {
		/** Asks for an account's profile to be judged, if it has not been. */
		want(did: string): void {
			if (did === exempt || flying.has(did) || pending.has(did)) return;
			pending.add(did);
			if (pending.size <= limit) return;
			const [oldest] = pending;
			pending.delete(oldest as string);
		},
		/** Call when the stream brings a newer version of a profile. */
		supersede(did: string): void {
			pending.delete(did);
			if (flying.has(did)) stale.add(did);
		},
		/**
		 * Fetches one batch, unless one is under way or a failure was recent. An account
		 * whose request fails is dropped, and wanted again when it next posts.
		 */
		async run(): Promise<void> {
			if (busy || now() < waitUntil || !pending.size) return;
			busy = true;
			try {
				const batch = await nextBatch();
				if (!batch.length) return;
				const profiles = await fetchProfiles(batch);
				for (const did of batch) if (!stale.has(did)) deliver(did, profiles.get(did));
			} catch (error) {
				waitUntil = now() + BACKOFF_MS;
				console.warn('Could not fetch profiles:', (error as Error).message);
			} finally {
				flying.clear();
				stale.clear();
				busy = false;
			}
		},
		size: () => pending.size
	};
}
