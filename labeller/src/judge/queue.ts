// Records waiting for the model. Held in memory only, so post text is never written to disk.

/** The oldest record makes way when the queue is full. */
export const QUEUE_LIMIT = 5_000;
/** A record waiting longer than this is no longer worth asking about. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface Pending {
	uri: string;
	segments: readonly string[];
	queuedAt: number;
}

export function pendingQueue(limit = QUEUE_LIMIT) {
	// A map keeps insertion order and finds a record by its address.
	let entries = new Map<string, Pending>();

	return {
		/** Adds or replaces a record. Returns true if the oldest one had to be dropped. */
		add(entry: Pending): boolean {
			entries.delete(entry.uri);
			entries.set(entry.uri, entry);
			if (entries.size <= limit) return false;
			const [oldest] = entries.keys();
			entries.delete(oldest as string);
			return true;
		},
		/** Puts a record back at the front, unless a newer version has arrived or there is no room. */
		restore(entry: Pending): void {
			if (entries.has(entry.uri) || entries.size >= limit) return;
			entries = new Map([[entry.uri, entry], ...entries]);
		},
		remove(uri: string): void {
			entries.delete(uri);
		},
		/** Takes the oldest record. */
		take(): Pending | undefined {
			const entry = entries.values().next().value;
			if (entry) entries.delete(entry.uri);
			return entry;
		},
		size: () => entries.size
	};
}
