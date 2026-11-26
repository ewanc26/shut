// Word-presence counts for a small naive Bayes judge, learned from the stream.
//
// Privacy by construction: only counts are kept. Text is turned into words and discarded at once,
// and a word is kept only when it appears in at least MIN_POSTS distinct posts, so no stored
// entry can single out one post.

export const MIN_POSTS = 20;

export interface Tally {
	pos: number;
	neg: number;
}

export interface Counts {
	/** Posts that the word list labelled, and posts it found clean. */
	docs: Tally;
	words: Map<string, Tally>;
}

export function emptyCounts(): Counts {
	return { docs: { pos: 0, neg: 0 }, words: new Map() };
}

/** Counts one post's distinct words under one class. */
export function add(counts: Counts, label: 'pos' | 'neg', words: readonly string[]): void {
	counts.docs[label]++;
	for (const word of new Set(words)) {
		const tally = counts.words.get(word) ?? { pos: 0, neg: 0 };
		tally[label]++;
		counts.words.set(word, tally);
	}
}

/** Drops every word seen in fewer than MIN_POSTS posts. */
export function prune(counts: Counts, minPosts = MIN_POSTS): Counts {
	const words = new Map<string, Tally>();
	for (const [word, tally] of counts.words) {
		if (tally.pos + tally.neg >= minPosts) words.set(word, { ...tally });
	}
	return { docs: { ...counts.docs }, words };
}

/** How strongly one word points to `pos`: a log likelihood ratio with add-one smoothing. */
export function weight({ docs }: Counts, tally: Tally): number {
	return Math.log((tally.pos + 1) / (docs.pos + 2) / ((tally.neg + 1) / (docs.neg + 2)));
}

/** Frees memory once there are more than `max` words, forgetting the rarest first. */
export function trim(counts: Counts, max: number): void {
	for (let seen = 1; counts.words.size > max && seen < MIN_POSTS; seen++) {
		for (const [word, { pos, neg }] of counts.words) {
			if (pos + neg <= seen) counts.words.delete(word);
		}
	}
}

/** Raised when what is counted changes, so older counts are not mixed in. */
const VERSION = 2;

/** A plain JSON form holding only pruned counts. */
export function serialise(counts: Counts): string {
	const pruned = prune(counts);
	return JSON.stringify({
		version: VERSION,
		minPosts: MIN_POSTS,
		docs: pruned.docs,
		words: Object.fromEntries([...pruned.words].sort(([a], [b]) => a.localeCompare(b)))
	});
}

/** Reads what `serialise` wrote. Throws on anything else. */
export function parse(text: string): Counts {
	const saved = JSON.parse(text) as {
		version?: unknown;
		docs?: Tally;
		words?: Record<string, Tally>;
	} | null;
	const whole = (tally: Tally | undefined): Tally => {
		const { pos, neg } = tally ?? {};
		if (!Number.isInteger(pos) || !Number.isInteger(neg)) throw new Error('Unreadable counts.');
		return { pos: pos as number, neg: neg as number };
	};
	if (saved?.version !== VERSION || !saved.words) throw new Error('Unreadable counts.');
	return {
		docs: whole(saved.docs),
		words: new Map(Object.entries(saved.words).map(([word, tally]) => [word, whole(tally)]))
	};
}
